/**
 * Test réel du module H Company : lance l'agent sur une page produit et suit la session
 * jusqu'à `confirmation_requise` (ou `echec`). Ne confirme JAMAIS le paiement.
 * Usage : pnpm --filter @buyfit/api h:order-test <url-produit> <taille> [couleur] [userId]
 * Avec userId : même compte marchand que POST /order (vault relié dans les Réglages).
 */
import { config } from "../src/config.js";
import { getSessionState, startOrderSession } from "../src/modules/hcompany.js";
import { findMerchantAccount, getProfile } from "../src/modules/supabase.js";

const [productUrl, taille = "M", couleur, userId] = process.argv.slice(2);
if (!productUrl) {
  console.error("Usage : h:order-test <url-produit> [taille]");
  process.exit(1);
}
if (config.mocks.hcompany) {
  console.error("Mode mock actif (HAI_API_KEY absente ou MOCK_HCOMPANY=true).");
  process.exit(1);
}

// Avec userId : même logique que POST /order. Sinon : profil démo (souvent sans vault).
const host = new URL(productUrl).hostname.replace(/^www\./, "");
const compte = userId
  ? await findMerchantAccount(userId, host)
  : (await getProfile("demo-user"))?.comptesMarchands.find((m) => host.endsWith(m.domaine));
console.log(
  `compte   ${compte ? `${compte.marchand} (vault ${compte.vaultId ?? "aucun"})` : "aucun"}`,
);

const { sessionId, agentViewUrl } = await startOrderSession({
  productUrl,
  taille,
  ...(couleur ? { couleur } : {}),
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
  if (["confirmation_requise", "echec", "au_panier", "commandee"].includes(s.statut)) break;
  await new Promise((r) => setTimeout(r, 5000));
}
console.log("Fin du test (aucun paiement validé). La session idle expire seule après 15 min.");
