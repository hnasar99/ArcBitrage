# ArcBitrage

Monitor **USDC → WBTC** quotes on a Uniswap V2-compatible Arc DEX, compare the marked output with an external BTC reference, estimate native-USDC gas, and optionally submit a slippage-protected swap through Circle Developer-Controlled Wallets.

> **Important:** this is an execution prototype, not a guaranteed-return strategy. A one-way purchase is not risk-free arbitrage: realizing profit requires an independently available sale/hedge venue. Start on testnet and keep `DRY_RUN=true` until contracts, token decimals, wallet policy, approvals, and Circle support for the selected chain have been verified.

## Setup

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm test
npm start
```

`npm start` abre el **Agent Command Center** en `http://localhost:3000`: un dashboard responsive con telemetría por Server-Sent Events, control de inicio/pausa, configuración de estrategia, gráfico de spread y ledger de ejecuciones. El motor demo permite revisar el flujo visual sin credenciales; la ejecución real permanece separada y protegida por `DRY_RUN`.

Fill every address with a deployed address. `WALLET_ID` is Circle's identifier; `WALLET_ADDRESS` is the EVM recipient/from address and they are deliberately separate. The zero address is not assumed to be an ERC-20 USDC contract.

Before live mode, approve the configured router to spend the wallet's USDC, then set `DRY_RUN=false`. The bot computes `amountOutMin` from `SLIPPAGE_BPS`; unlike an unadjusted quote, this allows limited price movement while bounding execution slippage. Errors are isolated per polling cycle and HTTP reference requests time out.

## What the profit check means

The check is `WBTC quoted × reference price − USDC input − estimated gas`. It does **not** include a hedge/sale fee, market impact at the exit venue, transfer latency, taxes, or inventory risk. Add those costs—and an atomic or pre-funded exit leg—before treating a signal as arbitrage.

Token conventions default in code to 6 decimals for USDC contract units, 8 for WBTC, and 18 for Arc native gas accounting. Verify these assumptions against the actual deployed tokens.

## Circle agents, x402, and Vercel

The execution worker is designed around a Circle Developer-Controlled Wallet: `WALLET_ID` selects the Circle wallet while `WALLET_ADDRESS` remains the EVM address used in calldata and gas estimation. Keep Circle API credentials and the entity secret **only on the worker**, never in Vercel's browser bundle.

`AgentPaymentPolicy` provides a transport-neutral authorization boundary for paid actions. An x402 SDK or facilitator adapter can verify a payment proof and return settlement data without coupling payment transport to the trading strategy. A missing/invalid proof produces a structured HTTP 402 requirement. The proxy preserves common x402 payment request/response headers, but live settlement deliberately requires a selected, audited facilitator adapter rather than trusting an arbitrary client header.

### Vercel deployment model

The dashboard is deployable to Vercel using `vercel.json`, but the continuous blockchain worker is **not** run inside a Vercel Function. Deploy the worker on a persistent process/container, protect its mutation endpoints with `AGENT_API_TOKEN`, and configure these Vercel variables:

```env
AGENT_API_URL=https://agent-worker.example.com
AGENT_API_TOKEN=a-long-random-secret
DASHBOARD_READ_ONLY=true
```

The Vercel function is a narrow allow-listed proxy. It keeps Circle secrets out of the frontend and forwards payment headers for an x402-aware worker. Hosted mutation routes are denied by default; only set `DASHBOARD_READ_ONLY=false` behind Vercel/SSO operator authentication or an x402-aware authorization layer. In a serverless deployment the UI automatically falls back from SSE to a three-second status poll. For production, terminate TLS at the worker, add operator authentication, use durable storage for metrics/idempotency, and never count simulated yield as realized P&L.

If `AGENT_API_URL` is omitted, the hosted dashboard enters a read-only **Vercel Preview** using synthetic telemetry from the status function. This makes visual review possible without exposing a wallet or worker; preview numbers are always marked as dry-run data and cannot trigger trades.
