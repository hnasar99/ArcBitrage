import { EventEmitter } from "node:events";

const MAX_HISTORY = 100;
const MAX_SERIES = 120;

export class DashboardState extends EventEmitter {
  constructor({ tradeAmountUsdc = 1_000, minProfitUsdc = 2, dryRun = true } = {}) {
    super();
    this.active = false;
    this.dryRun = dryRun;
    this.tradeAmountUsdc = tradeAmountUsdc;
    this.minProfitUsdc = minProfitUsdc;
    this.totalYieldUsdc = 0;
    this.simulatedYieldUsdc = 0;
    this.scans = 0;
    this.executions = 0;
    this.lastCycleAt = null;
    this.latest = null;
    this.history = [];
    this.series = [];
  }

  snapshot() {
    return {
      active: this.active, dryRun: this.dryRun,
      tradeAmountUsdc: this.tradeAmountUsdc, minProfitUsdc: this.minProfitUsdc,
      totalYieldUsdc: this.totalYieldUsdc, simulatedYieldUsdc: this.simulatedYieldUsdc,
      scans: this.scans, executions: this.executions,
      hitRate: this.scans ? this.executions / this.scans : 0,
      lastCycleAt: this.lastCycleAt, latest: this.latest,
      history: this.history.slice(0, 20), series: this.series
    };
  }

  toggle(active) {
    if (typeof active !== "boolean") throw new TypeError("active must be a boolean");
    this.active = active;
    this.publish();
  }

  configure({ tradeAmountUsdc, minProfitUsdc }) {
    for (const [name, value] of Object.entries({ tradeAmountUsdc, minProfitUsdc })) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new TypeError(`${name} must be positive`);
    }
    if (tradeAmountUsdc !== undefined) this.tradeAmountUsdc = tradeAmountUsdc;
    if (minProfitUsdc !== undefined) this.minProfitUsdc = minProfitUsdc;
    this.publish();
  }

  record(metrics) {
    this.scans += 1;
    this.lastCycleAt = metrics.timestamp;
    this.latest = metrics;
    this.series.push({ timestamp: metrics.timestamp, spreadBps: metrics.spreadBps, netProfitUsdc: metrics.netProfitUsdc });
    if (this.series.length > MAX_SERIES) this.series.shift();
    if (metrics.status === "executed" || metrics.status === "simulated") {
      this.executions += 1;
      if (metrics.status === "executed") this.totalYieldUsdc += metrics.netProfitUsdc;
      else this.simulatedYieldUsdc += metrics.netProfitUsdc;
      this.history.unshift(metrics);
      this.history.length = Math.min(this.history.length, MAX_HISTORY);
    }
    this.publish();
  }

  publish() { this.emit("update", this.snapshot()); }
}
