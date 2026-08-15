import test from "node:test";
import assert from "node:assert/strict";
import { assessOpportunity, minimumOutput } from "../src/math.js";

test("minimumOutput applies integer basis-point protection", () => {
  assert.equal(minimumOutput(100_000n, 50), 99_500n);
});

test("assessment subtracts principal and gas from marked output", () => {
  const result = assessOpportunity({ tradeAmountUsdc: 1_000, wbtcOutput: 0.016, referencePrice: 65_000, gasUsdc: 0.15, minProfitUsdc: 2 });
  assert.equal(result.grossProfitUsdc, 40);
  assert.equal(result.netProfitUsdc, 39.85);
  assert.equal(result.profitable, true);
});

test("assessment rejects a loss", () => {
  const result = assessOpportunity({ tradeAmountUsdc: 1_000, wbtcOutput: 0.015, referencePrice: 65_000, gasUsdc: 0.1, minProfitUsdc: 2 });
  assert.equal(result.profitable, false);
});
