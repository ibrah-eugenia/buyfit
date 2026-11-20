/**
 * Affiche la trajectoire d'une session H (la dernière par défaut) : messages texte de l'agent,
 * actions, URL visitées, réponse finale. Sert à vérifier ce que l'agent a vraiment fait.
 * Usage : pnpm --filter @buyfit/api h:last-session [sessionId]
 */
import { HaiAgentsClient } from "hai-agents";

const client = new HaiAgentsClient();
let id = process.argv[2];
if (!id) {
  const page = (await client.sessions.listSessions()) as unknown as {
    items?: Record<string, unknown>[];
  };
  const items = page.items ?? [];
  for (const s of items.slice(0, 5)) {
    console.log(String(s.id), String(s.created_at ?? s.createdAt ?? ""), JSON.stringify(s.status ?? ""));
  }
  id = String(items[0]?.id ?? "");
}
if (!id) process.exit(1);
console.log("\n=== session", id);
for (let page = 1; ; page++) {
  const ev = (await client.sessions.listSessionEvents({ id, page, size: 100 })) as unknown as {
    items: Record<string, unknown>[];
    total: number;
  };
  for (const e of ev.items) {
    // Captures base64 masquées pour garder une sortie lisible.
    console.log(JSON.stringify(e).replace(/"[A-Za-z0-9+/=]{200,}"/g, '"<b64>"').slice(0, 900));
  }
  if (ev.items.length < 100 || page * 100 >= ev.total) break;
}
