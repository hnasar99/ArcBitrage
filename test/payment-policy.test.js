import test from "node:test";
import assert from "node:assert/strict";
import { AgentPaymentPolicy } from "../src/payment-policy.js";

test("payment policy returns a transport-neutral 402 challenge", async () => {
  const policy = new AgentPaymentPolicy({ enabled: true, resource: "agent:run", price: "0.01", network: "eip155:5042002", payTo: "0xabc" });
  assert.deepEqual(await policy.authorize(), {
    authorized: false, status: 402,
    requirement: { resource: "agent:run", price: "0.01", network: "eip155:5042002", payTo: "0xabc" }
  });
});

test("payment policy delegates verification to an x402 adapter", async () => {
  const policy = new AgentPaymentPolicy({ enabled: true, verify: async payment => ({ valid: payment === "proof", settlement: "paid" }) });
  assert.deepEqual(await policy.authorize("proof"), { authorized: true, settlement: "paid" });
});
