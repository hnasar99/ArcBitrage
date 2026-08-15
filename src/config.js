import { getAddress } from "ethers";

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveNumber(env, name, fallback) {
  const value = Number(env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

export function loadConfig(env = process.env) {
  const slippageBps = positiveNumber(env, "SLIPPAGE_BPS", 50);
  if (slippageBps >= 10_000) throw new Error("SLIPPAGE_BPS must be below 10000");

  const dryRun = (env.DRY_RUN ?? "true").toLowerCase() !== "false";
  return {
    rpcUrl: required(env, "ARC_RPC_URL"),
    chainId: positiveNumber(env, "ARC_CHAIN_ID", 5_042_002),
    circleApiKey: dryRun ? env.CIRCLE_API_KEY : required(env, "CIRCLE_API_KEY"),
    circleEntitySecret: dryRun ? env.CIRCLE_ENTITY_SECRET : required(env, "CIRCLE_ENTITY_SECRET"),
    walletId: dryRun ? env.WALLET_ID : required(env, "WALLET_ID"),
    walletAddress: getAddress(required(env, "WALLET_ADDRESS")),
    routerAddress: getAddress(required(env, "ROUTER_ADDRESS")),
    usdcAddress: getAddress(required(env, "USDC_ADDRESS")),
    wbtcAddress: getAddress(required(env, "WBTC_ADDRESS")),
    tradeAmountUsdc: positiveNumber(env, "TRADE_AMOUNT_USDC", 1_000),
    minProfitUsdc: positiveNumber(env, "MIN_PROFIT_USDC", 2),
    slippageBps,
    pollIntervalMs: positiveNumber(env, "POLL_INTERVAL_MS", 5_000),
    referencePriceUrl: env.REFERENCE_PRICE_URL ?? "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
    dryRun
  };
}
