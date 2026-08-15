import test from "node:test";
import assert from "node:assert/strict";
import { DashboardState } from "../server/dashboard-state.js";

test("dashboard state validates controls and derives performance", () => {
  const state = new DashboardState();
  state.toggle(true);
  state.configure({ tradeAmountUsdc: 500, minProfitUsdc: 1 });
  state.record({ timestamp: "2026-01-01T00:00:00.000Z", spreadBps: 30, netProfitUsdc: 1.4, status: "simulated" });
  const snapshot = state.snapshot();
  assert.equal(snapshot.active, true);
  assert.equal(snapshot.executions, 1);
  assert.equal(snapshot.totalYieldUsdc, 0);
  assert.equal(snapshot.simulatedYieldUsdc, 1.4);
  assert.equal(snapshot.hitRate, 1);
});

test("dashboard rejects invalid strategy values", () => {
  const state = new DashboardState();
  assert.throws(() => state.configure({ tradeAmountUsdc: 0 }), /positive/);
  assert.throws(() => state.toggle("yes"), /boolean/);
});
