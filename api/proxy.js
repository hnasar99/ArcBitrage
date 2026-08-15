const ALLOWED = new Set(["status", "bot/toggle", "bot/config"]);

export function previewSnapshot(now = Date.now()) {
  const tick = Math.floor(now / 3_000);
  const referencePrice = 67_840 + Math.sin(tick / 4) * 105;
  const spreadBps = 24 + Math.sin(tick / 3) * 18;
  const gasUsdc = 0.1;
  const netProfitUsdc = 1_000 * spreadBps / 10_000 - gasUsdc;
  const timestamp = new Date(now).toISOString();
  const series = Array.from({ length: 30 }, (_, index) => ({
    timestamp: new Date(now - (29 - index) * 3_000).toISOString(),
    spreadBps: 24 + Math.sin((tick - 29 + index) / 3) * 18,
    netProfitUsdc: 0
  }));
  return {
    active: false, dryRun: true, preview: true, tradeAmountUsdc: 1_000,
    minProfitUsdc: 2, totalYieldUsdc: 0, simulatedYieldUsdc: 18.42,
    scans: 148, executions: 7, hitRate: 7 / 148, lastCycleAt: timestamp,
    latest: { timestamp, referencePrice, dexPrice: referencePrice * (1 - spreadBps / 10_000), spreadBps, gasUsdc, netProfitUsdc, status: "monitoring" },
    history: [], series
  };
}

export default async function handler(request, response) {
  const path = String(request.query.path ?? "status").replace(/^\/+/, "");
  const origin = process.env.AGENT_API_URL?.replace(/\/$/, "");
  if (!ALLOWED.has(path)) return response.status(404).json({ error: "Unknown agent endpoint" });
  if (!origin && request.method === "GET" && path === "status") return response.status(200).json(previewSnapshot());
  if (!origin) return response.status(503).json({ error: "AGENT_API_URL is not configured" });
  if (request.method !== "GET" && process.env.DASHBOARD_READ_ONLY !== "false") {
    return response.status(403).json({ error: "Hosted dashboard controls are read-only" });
  }

  const headers = { accept: "application/json" };
  if (process.env.AGENT_API_TOKEN) headers.authorization = `Bearer ${process.env.AGENT_API_TOKEN}`;
  for (const name of ["payment-signature", "x-payment"]) {
    if (request.headers[name]) headers[name] = request.headers[name];
  }
  if (request.method !== "GET") headers["content-type"] = "application/json";

  try {
    const upstream = await fetch(`${origin}/api/${path}`, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : JSON.stringify(request.body ?? {}),
      signal: AbortSignal.timeout(8_000)
    });
    const payload = await upstream.text();
    for (const name of ["payment-required", "payment-response"]) {
      const value = upstream.headers.get(name);
      if (value) response.setHeader(name, value);
    }
    response.status(upstream.status).setHeader("content-type", upstream.headers.get("content-type") ?? "application/json").send(payload);
  } catch (error) {
    response.status(502).json({ error: "Agent backend unavailable", detail: error.message });
  }
}
