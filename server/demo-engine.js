export class DemoEngine {
  constructor(state) { this.state = state; this.timer = null; this.tick = 0; }

  start(intervalMs = 1_200) {
    this.timer = setInterval(() => this.cycle(), intervalMs);
    this.cycle();
  }

  cycle() {
    if (!this.state.active) return;
    this.tick += 1;
    const referencePrice = 67_840 + Math.sin(this.tick / 4) * 105 + Math.sin(this.tick / 11) * 48;
    const spreadBps = 18 + Math.sin(this.tick / 3) * 31 + Math.random() * 12;
    const dexPrice = referencePrice * (1 - spreadBps / 10_000);
    const gasUsdc = 0.08 + Math.random() * 0.05;
    const netProfitUsdc = this.state.tradeAmountUsdc * spreadBps / 10_000 - gasUsdc;
    const executable = netProfitUsdc >= this.state.minProfitUsdc;
    this.state.record({
      id: `arc_${Date.now().toString(36)}`, timestamp: new Date().toISOString(),
      referencePrice, dexPrice, spreadBps, gasUsdc, netProfitUsdc,
      status: executable ? (this.state.dryRun ? "simulated" : "executed") : "monitoring",
      txId: executable ? `0x${crypto.randomUUID().replaceAll("-", "").padEnd(64, "0")}` : null
    });
  }

  stop() { clearInterval(this.timer); }
}
