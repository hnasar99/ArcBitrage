const $ = id => document.getElementById(id);
const money = value => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const state = { active: false, configured: false, series: [] };

function render(data) {
  state.active = data.active; state.series = data.series ?? [];
  if (data.preview) $("streamState").textContent = "● VERCEL PREVIEW";
  $("agentLabel").textContent = data.active ? "Operando" : "En pausa";
  $("lastCycle").textContent = data.lastCycleAt ? `Último ciclo ${new Date(data.lastCycleAt).toLocaleTimeString()}` : "Esperando activación";
  $("toggleText").textContent = data.active ? "PAUSAR AGENTE" : "INICIAR AGENTE";
  $("toggle").classList.toggle("active", data.active);
  $("yieldLabel").textContent = data.dryRun ? "OPORTUNIDAD SIMULADA" : "RENDIMIENTO CAPTURADO";
  $("yield").textContent = money(data.dryRun ? data.simulatedYieldUsdc : data.totalYieldUsdc);
  $("executions").textContent = `${data.executions} ejecuciones`;
  $("hitRate").textContent = (data.hitRate * 100).toFixed(1);
  $("scans").textContent = data.scans;
  $("threshold").textContent = `${money(data.minProfitUsdc)} USDC`;
  if (!state.configured) { $("amount").value = data.tradeAmountUsdc; $("minimum").value = data.minProfitUsdc; state.configured = true; }
  const latest = data.latest;
  $("spread").textContent = latest ? latest.spreadBps.toFixed(1) : "—";
  $("gas").textContent = latest ? latest.gasUsdc.toFixed(3) : "—";
  $("profit").textContent = latest ? `${latest.netProfitUsdc >= 0 ? "+" : ""}${latest.netProfitUsdc.toFixed(3)} USDC neto` : "Sin señal activa";
  $("refPrice").textContent = latest ? `$${money(latest.referencePrice)}` : "—";
  $("dexPrice").textContent = latest ? `$${money(latest.dexPrice)}` : "—";
  renderHistory(data.history ?? []); drawChart();
}

function renderHistory(items) {
  $("history").innerHTML = items.length ? items.map(item => `<tr><td>${new Date(item.timestamp).toLocaleTimeString()}</td><td><span class="status-pill">${item.status.toUpperCase()}</span></td><td>$${money(item.referencePrice)} / $${money(item.dexPrice)}</td><td>${item.spreadBps.toFixed(1)} bps</td><td class="positive">+${item.netProfitUsdc.toFixed(3)} USDC</td><td class="tx">${item.txId.slice(0, 10)}…${item.txId.slice(-4)}</td></tr>`).join("") : '<tr><td colspan="6" class="empty">Sin ejecuciones todavía. El ledger se actualizará en tiempo real.</td></tr>';
}

function drawChart() {
  const canvas = $("chart"), rect = canvas.getBoundingClientRect(), ratio = devicePixelRatio || 1;
  canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d"); ctx.scale(ratio, ratio);
  const values = state.series.map(point => point.spreadBps); $("emptyChart").hidden = values.length > 1;
  if (values.length < 2) return;
  const w = rect.width, h = rect.height, pad = 12, min = Math.min(...values, 0), max = Math.max(...values, 1), range = max - min || 1;
  ctx.strokeStyle = "#193029"; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { const y = pad + (h - pad * 2) * i / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const points = values.map((v, i) => [i * w / (values.length - 1), pad + (max - v) / range * (h - pad * 2)]);
  const gradient = ctx.createLinearGradient(0, 0, 0, h); gradient.addColorStop(0, "rgba(185,246,87,.25)"); gradient.addColorStop(1, "rgba(185,246,87,0)");
  ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.fillStyle=gradient; ctx.fill();
  ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.strokeStyle="#b9f657"; ctx.lineWidth=2; ctx.stroke();
}

async function post(path, payload) { const response = await fetch(path, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(payload) }); if (!response.ok) throw new Error((await response.json()).error); return response.json(); }
function toast(message) { $("toast").textContent = message; $("toast").classList.add("show"); setTimeout(() => $("toast").classList.remove("show"), 1800); }
$("toggle").addEventListener("click", async () => { try { await post("/api/bot/toggle", { active: !state.active }); toast(state.active ? "Agente pausado" : "Agente iniciado"); } catch (error) { toast(error.message); } });
$("configForm").addEventListener("submit", async event => { event.preventDefault(); try { await post("/api/bot/config", { tradeAmountUsdc:Number($("amount").value), minProfitUsdc:Number($("minimum").value) }); toast("Estrategia actualizada"); } catch(error) { toast(error.message); } });
addEventListener("resize", drawChart, { passive:true });
let pollTimer;
const poll = async () => { try { const response = await fetch("/api/status"); if (response.ok) render(await response.json()); } catch {} };
const events = new EventSource("/api/events");
events.onopen = () => { clearInterval(pollTimer); $("streamState").textContent="● STREAM LIVE"; };
events.onmessage = event => render(JSON.parse(event.data));
events.onerror = () => {
  $("streamState").textContent="● POLLING FALLBACK";
  if (!pollTimer) pollTimer = setInterval(poll, 3_000);
};
poll();
