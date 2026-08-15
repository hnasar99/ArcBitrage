import test from "node:test";
import assert from "node:assert/strict";
import { previewSnapshot } from "../api/proxy.js";

test("Vercel preview is deterministic, read-only dry-run telemetry", () => {
  const snapshot = previewSnapshot(Date.parse("2026-08-15T20:00:00Z"));
  assert.equal(snapshot.preview, true);
  assert.equal(snapshot.dryRun, true);
  assert.equal(snapshot.active, false);
  assert.equal(snapshot.totalYieldUsdc, 0);
  assert.equal(snapshot.series.length, 30);
  assert.ok(Number.isFinite(snapshot.latest.spreadBps));
});
