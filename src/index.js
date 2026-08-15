import "dotenv/config";
import { JsonRpcProvider } from "ethers";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { ArcArbitrageAgent } from "./agent.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const provider = new JsonRpcProvider(config.rpcUrl, { name: "arc", chainId: config.chainId }, { staticNetwork: true });
const circleClient = config.dryRun ? null : initiateDeveloperControlledWalletsClient({
  apiKey: config.circleApiKey,
  entitySecret: config.circleEntitySecret
});
const agent = new ArcArbitrageAgent({ config, provider, circleClient });
process.once("SIGINT", () => agent.stop());
process.once("SIGTERM", () => agent.stop());
await agent.start();
