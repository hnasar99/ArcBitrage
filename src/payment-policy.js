/**
 * Transport-neutral policy boundary for paid agent actions.
 * Plug an x402 SDK/facilitator adapter into `verify`; wallet and strategy code
 * never need to know which payment transport authorized the action.
 */
export class AgentPaymentPolicy {
  constructor({ enabled = false, resource, price, network, payTo, verify } = {}) {
    this.enabled = enabled;
    this.requirement = { resource, price, network, payTo };
    this.verify = verify;
  }

  async authorize(payment) {
    if (!this.enabled) return { authorized: true, mode: "disabled" };
    if (!payment) return { authorized: false, status: 402, requirement: this.requirement };
    if (typeof this.verify !== "function") throw new Error("x402 verifier adapter is not configured");
    const result = await this.verify(payment, this.requirement);
    return result?.valid
      ? { authorized: true, settlement: result.settlement }
      : { authorized: false, status: 402, requirement: this.requirement };
  }
}
