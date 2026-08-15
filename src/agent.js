import { Contract, Interface, formatUnits, parseUnits } from "ethers";
import { minimumOutput, assessOpportunity } from "./math.js";

export const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn,address[] path) view returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline) returns (uint256[] amounts)"
];

const SWAP_SIGNATURE = "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)";

export class ArcArbitrageAgent {
  constructor({ config, provider, circleClient, fetchImpl = fetch, logger = console }) {
    this.config = config;
    this.provider = provider;
    this.circleClient = circleClient;
    this.fetch = fetchImpl;
    this.logger = logger;
    this.router = new Contract(config.routerAddress, ROUTER_ABI, provider);
    this.running = false;
  }

  async referencePrice() {
    const response = await this.fetch(this.config.referencePriceUrl, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`Reference price HTTP ${response.status}`);
    const price = Number((await response.json()).price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Reference source returned an invalid price");
    return price;
  }

  async estimateGasUsdc(amountIn, minOut, deadline) {
    const data = new Interface(ROUTER_ABI).encodeFunctionData("swapExactTokensForTokens", [
      amountIn, minOut, [this.config.usdcAddress, this.config.wbtcAddress], this.config.walletAddress, deadline
    ]);
    const gas = await this.provider.estimateGas({ from: this.config.walletAddress, to: this.config.routerAddress, data });
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (gasPrice == null) throw new Error("RPC did not return a gas price");
    // Arc exposes native USDC with 18 decimals for EVM gas accounting.
    return Number(formatUnits(gas * gasPrice, 18));
  }

  async evaluateOnce() {
    const amountIn = parseUnits(String(this.config.tradeAmountUsdc), 6);
    const path = [this.config.usdcAddress, this.config.wbtcAddress];
    const [amounts, referencePrice] = await Promise.all([
      this.router.getAmountsOut(amountIn, path), this.referencePrice()
    ]);
    const minOut = minimumOutput(amounts[1], this.config.slippageBps);
    const deadline = Math.floor(Date.now() / 1_000) + 120;
    const gasUsdc = await this.estimateGasUsdc(amountIn, minOut, deadline);
    const result = assessOpportunity({
      tradeAmountUsdc: this.config.tradeAmountUsdc,
      wbtcOutput: Number(formatUnits(amounts[1], 8)),
      referencePrice,
      gasUsdc,
      minProfitUsdc: this.config.minProfitUsdc
    });
    this.logger.info(`[sense] DEX $${result.dexPrice.toFixed(2)} | reference $${referencePrice.toFixed(2)} | net ${result.netProfitUsdc.toFixed(4)} USDC`);
    if (result.profitable) await this.execute(amountIn, minOut, deadline);
    return result;
  }

  async execute(amountIn, minOut, deadline) {
    const parameters = [
      amountIn.toString(), minOut.toString(),
      [this.config.usdcAddress, this.config.wbtcAddress], this.config.walletAddress, deadline.toString()
    ];
    if (this.config.dryRun) {
      this.logger.info("[act] DRY_RUN enabled; swap was not submitted");
      return { dryRun: true, parameters };
    }
    const response = await this.circleClient.createContractExecutionTransaction({
      walletId: this.config.walletId,
      contractAddress: this.config.routerAddress,
      abiFunctionSignature: SWAP_SIGNATURE,
      abiParameters: parameters,
      fee: { type: "level", config: { feeLevel: "MEDIUM" } }
    });
    this.logger.info(`[act] Circle transaction submitted: ${response.data?.id ?? "unknown id"}`);
    return response;
  }

  async start() {
    this.running = true;
    while (this.running) {
      try { await this.evaluateOnce(); } catch (error) { this.logger.error(`[error] ${error.message}`); }
      if (this.running) await new Promise(resolve => setTimeout(resolve, this.config.pollIntervalMs));
    }
  }

  stop() { this.running = false; }
}
