export function minimumOutput(quotedOutput, slippageBps) {
  return quotedOutput * BigInt(10_000 - slippageBps) / 10_000n;
}

export function assessOpportunity({ tradeAmountUsdc, wbtcOutput, referencePrice, gasUsdc, minProfitUsdc }) {
  if (![tradeAmountUsdc, wbtcOutput, referencePrice, gasUsdc, minProfitUsdc].every(Number.isFinite)) {
    throw new TypeError("Opportunity inputs must be finite numbers");
  }
  if (tradeAmountUsdc <= 0 || wbtcOutput <= 0 || referencePrice <= 0 || gasUsdc < 0) {
    throw new RangeError("Trade amount, output and price must be positive; gas cannot be negative");
  }
  const markValueUsdc = wbtcOutput * referencePrice;
  const grossProfitUsdc = markValueUsdc - tradeAmountUsdc;
  const netProfitUsdc = grossProfitUsdc - gasUsdc;
  return {
    dexPrice: tradeAmountUsdc / wbtcOutput,
    grossProfitUsdc,
    netProfitUsdc,
    profitable: netProfitUsdc >= minProfitUsdc
  };
}
