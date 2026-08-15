import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { DashboardState } from "./dashboard-state.js";
import { DemoEngine } from "./demo-engine.js";

if (existsSync(".env")) process.loadEnvFile?.(".env");

const root = fileURLToPath(new URL("../ui/", import.meta.url));
const state = new DashboardState({
  tradeAmountUsdc: Number(process.env.TRADE_AMOUNT_USDC ?? 1_000),
  minProfitUsdc: Number(process.env.MIN_PROFIT_USDC ?? 2),
  dryRun: (process.env.DRY_RUN ?? "true") !== "false"
});
const demo = new DemoEngine(state);
demo.start(Number(process.env.POLL_INTERVAL_MS ?? 1_200));

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};
const body = async req => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    if (chunks.reduce((sum, item) => sum + item.length, 0) > 16_384) throw new Error("Body too large");
  }
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
};

function authorized(req) {
  const expected = process.env.AGENT_API_TOKEN;
  return !expected || req.headers.authorization === `Bearer ${expected}`;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/status") return json(res, 200, state.snapshot());
    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      const send = snapshot => res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
      send(state.snapshot());
      state.on("update", send);
      req.on("close", () => state.off("update", send));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/bot/toggle") {
      if (!authorized(req)) return json(res, 401, { error: "Unauthorized" });
      state.toggle((await body(req)).active);
      return json(res, 200, { success: true, active: state.active });
    }
    if (req.method === "POST" && url.pathname === "/api/bot/config") {
      if (!authorized(req)) return json(res, 401, { error: "Unauthorized" });
      const input = await body(req);
      state.configure({ tradeAmountUsdc: Number(input.tradeAmountUsdc), minProfitUsdc: Number(input.minProfitUsdc) });
      return json(res, 200, { success: true, ...state.snapshot() });
    }
    if (req.method !== "GET") return json(res, 404, { error: "Not found" });
    const pathname = url.pathname === "/" ? "index.html" : normalize(url.pathname).replace(/^[/\\]+/, "");
    const path = join(root, pathname);
    if (!path.startsWith(root)) return json(res, 403, { error: "Forbidden" });
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
    res.writeHead(200, { "content-type": `${types[extname(path)] ?? "application/octet-stream"}; charset=utf-8` });
    res.end(await readFile(path));
  } catch (error) { json(res, error.code === "ENOENT" ? 404 : 400, { error: error.message }); }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`ArcBitrage command center: http://localhost:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { demo.stop(); server.close(); });
