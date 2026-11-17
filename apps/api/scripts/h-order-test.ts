/**
 * Test réel du module H Company : lance l'agent sur une page produit et suit la session
 * jusqu'à `confirmation_requise` (ou `echec`). Ne confirme JAMAIS le paiement.
 * Usage : pnpm --filter @buyfit/api h:order-test <url-produit> <taille>
 */
import { config } from "../src/config.js";
import { getSessionState, startOrderSession } from "../src/modules/hcompany.js";
import { getProfile } from "../src/modules/supabase.js";

const [productUrl, taille = "M"] = process.argv.slice(2);
if (!productUrl) {
  console.error("Usage : h:order-test <url-produit> [taille]");
  process.exit(1);
}
if (config.mocks.hcompany) {
  console.error("Mode mock actif (HAI_API_KEY absente ou MOCK_HCOMPANY=true).");
  process.exit(1);
}

// Même logique que POST /order : compte marchand du profil démo dont le domaine correspond.
const host = new URL(productUrl).hostname;
const profile = await getProfile("demo-user");
const compte = profile?.comptesMarchands.find((m) => host.endsWith(m.domaine));
console.log(
  `compte   ${compte ? `${compte.marchand} (vault ${compte.vaultId ?? "aucun"})` : "aucun"}`,
);

const { sessionId, agentViewUrl } = await startOrderSession({
  productUrl,
  taille,
  ...(compte ? { compte } : {}),
});
console.log(`session  ${sessionId}`);
console.log(`live     ${agentViewUrl}`);

const deadline = Date.now() + 15 * 60_000;
let last = "";
while (Date.now() < deadline) {
  const s = await getSessionState(sessionId, false);
  const line = `${s.statut}${s.message ? ` — ${s.message}` : ""}`;
  if (line !== last) console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
  last = line;
  if (s.statut === "confirmation_requise" || s.statut === "echec") break;
  await new Promise((r) => setTimeout(r, 5000));
}
console.log("Fin du test (aucun paiement validé). La session idle expire seule après 15 min.");
