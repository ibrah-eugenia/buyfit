/**
 * Appel brut Bright Data → Google Lens sur une image, pour inspecter la réponse JSON.
 * Usage : pnpm --filter @buyfit/api bd:lens <url-image> [onglet=products] [fichier-sortie.json]
 */
import { writeFileSync } from "node:fs";

const [imageUrl, tab = "products", out] = process.argv.slice(2);
const token = process.env.BRIGHTDATA_API_TOKEN;
const zone = process.env.BRIGHTDATA_SERP_ZONE || "serp_api1";
if (!imageUrl || !token) {
  console.error("Usage : bd:lens <url-image> [onglet] [sortie.json] — BRIGHTDATA_API_TOKEN requis");
  process.exit(1);
}

const target =
  `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}` +
  `&hl=fr&gl=fr&brd_json=1&brd_lens=${tab}`;

const t0 = Date.now();
const res = await fetch("https://api.brightdata.com/request", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ zone, url: target, format: "raw" }),
});
const text = await res.text();
console.log(`HTTP ${res.status} en ${Date.now() - t0} ms, ${text.length} octets`);

let json: unknown;
try {
  json = JSON.parse(text);
} catch {
  console.log(text.slice(0, 800));
  process.exit(1);
}
if (out) writeFileSync(out, JSON.stringify(json, null, 2));

// Aperçu de la structure : clés de 1er niveau et 1er élément de chaque tableau.
for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
  if (Array.isArray(v)) {
    console.log(`\n${k}: tableau de ${v.length}`);
    if (v[0]) console.log(JSON.stringify(v[0], null, 2).slice(0, 900));
  } else {
    console.log(`\n${k}: ${JSON.stringify(v).slice(0, 200)}`);
  }
}
