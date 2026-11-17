/**
 * Liste les agents H Company disponibles (catalogue h/ + agents de l'org) et le quota de sessions.
 * Usage : pnpm --filter @buyfit/api h:agents
 */
import { HaiAgentsClient } from "hai-agents";

if (!process.env.HAI_API_KEY) {
  console.error("HAI_API_KEY absente : remplis le .env racine.");
  process.exit(1);
}

const client = new HaiAgentsClient();

const page = await client.agents.listAgents();
const items = (page as unknown as { items?: Record<string, unknown>[] }).items ?? [];
console.log(`${items.length} agent(s) :`);
for (const a of items) {
  const desc = String(a.description ?? "")
    .replace(/\s+/g, " ")
    .slice(0, 110);
  console.log(`- ${String(a.name ?? a.id)}  ${desc}`);
}

try {
  const quota = await client.sessions.getSessionQuota();
  console.log("\nQuota sessions :", JSON.stringify(quota));
} catch (err) {
  console.log("\nQuota indisponible :", err instanceof Error ? err.message : err);
}
