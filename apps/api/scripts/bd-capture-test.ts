/**
 * Test réel de la recherche produits (même code que POST /capture) avec le profil démo.
 * Usage : pnpm --filter @buyfit/api bd:capture-test "<description de l'épingle>" [url-image]
 */
import { config } from "../src/config.js";
import { cleanQuery, findMatches, parsePrice } from "../src/modules/brightdata.js";
import { getProfile } from "../src/modules/supabase.js";

const [description = "Pull col roulé torsadé en laine homme", imageUrl] = process.argv.slice(2);
if (config.mocks.brightdata) {
  console.error("Mode mock actif (BRIGHTDATA_API_TOKEN absent ou MOCK_BRIGHTDATA=true).");
  process.exit(1);
}

// Vérifs rapides du parsing des prix (formats renvoyés par Google Shopping).
for (const p of ["30,99 €", "1 299,00 €", "$49.99", "£1,250.00"]) {
  console.log(`prix ${JSON.stringify(p)} → ${JSON.stringify(parsePrice(p))}`);
}

const profile = (await getProfile("demo-user"))!;
console.log(`\nrequête  "${cleanQuery(description)}"`);
console.log(
  `profil   budget ${profile.budgetMax} ${profile.devise}, marques ${profile.marquesPreferees.join(", ")}`,
);

const t0 = Date.now();
const matches = await findMatches(
  {
    imageUrl: imageUrl ?? "https://i.pinimg.com/736x/00/00/00/placeholder.jpg",
    pinUrl: "https://www.pinterest.com/pin/1/",
    description,
    capturedAt: new Date().toISOString(),
  },
  profile,
);
console.log(`\n${matches.length} résultat(s) en ${Date.now() - t0} ms :`);
for (const m of matches) {
  console.log(`- [${m.score}] ${m.marque} — ${m.nom} — ${m.prix} ${m.devise}`);
  console.log(`  ${m.url}`);
}
