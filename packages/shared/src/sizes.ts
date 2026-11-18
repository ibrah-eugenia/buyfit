/**
 * Équivalences approximatives entre tailles lettres (XS…XXL) et tailles numériques européennes,
 * selon le genre et le type de pièce. Les magasins (Zara, Mango…) affichent souvent des tailles
 * numériques pour les vestes, costumes et pantalons : l'agent s'en sert pour choisir la bonne,
 * l'extension pour l'afficher (« L · 52–54 »). Repères courants, à affiner par marque.
 */
export type SizeLetter = "XS" | "S" | "M" | "L" | "XL" | "XXL";

type Table = Record<SizeLetter, string[]>;

const TABLES: Record<string, Table> = {
  // Vestes, blazers, costumes, manteaux homme (tour de poitrine / 2)
  "homme-tailleur": { XS: ["44"], S: ["46"], M: ["48", "50"], L: ["52", "54"], XL: ["56", "58"], XXL: ["60", "62"] },
  // Chemises homme (tour de cou en cm)
  "homme-chemise": { XS: ["37"], S: ["38"], M: ["39", "40"], L: ["41", "42"], XL: ["43", "44"], XXL: ["45", "46"] },
  // Pantalons homme (taille FR)
  "homme-bas": { XS: ["36"], S: ["38"], M: ["40", "42"], L: ["44", "46"], XL: ["48"], XXL: ["50", "52"] },
  // Hauts, robes, vestes, pantalons femme (taille FR)
  femme: { XS: ["34"], S: ["36"], M: ["38"], L: ["40"], XL: ["42"], XXL: ["44"] },
};

const TAILLEUR = /veste|blazer|costume|manteau|blouson|trench|parka|caban|gilet de costume/i;
const CHEMISE = /chemise/i;
const BAS = /pantalon|jean|chino|short|bermuda|jupe/i;
/** Pièces vendues en lettres partout (t-shirts, pulls…) : pas d'équivalence numérique utile. */
const LETTRES = /t-?shirt|tee|pull|sweat|hoodie|polo|débardeur|top|cardigan/i;

function tableFor(genre?: string, categorie?: string): Table | null {
  const c = categorie ?? "";
  if (LETTRES.test(c) && !TAILLEUR.test(c)) return null;
  if (genre === "femme") return TABLES.femme!;
  if (genre !== "homme" && genre !== "mixte") return null;
  if (CHEMISE.test(c)) return TABLES["homme-chemise"]!;
  if (BAS.test(c)) return TABLES["homme-bas"]!;
  if (TAILLEUR.test(c)) return TABLES["homme-tailleur"]!;
  return null;
}

/** Tailles numériques équivalentes à `taille` (ex. L, veste homme → ["52", "54"]), sinon []. */
export function sizeEquivalents(taille: string, opts: { genre?: string; categorie?: string }): string[] {
  const t = taille.trim().toUpperCase() as SizeLetter;
  return tableFor(opts.genre, opts.categorie)?.[t] ?? [];
}

/** Libellé court pour l'affichage : « 52–54 », « 40 », ou "" sans équivalence. */
export function sizeEquivalentLabel(taille: string, opts: { genre?: string; categorie?: string }): string {
  const v = sizeEquivalents(taille, opts);
  return v.length > 1 ? `${v[0]}–${v[v.length - 1]}` : (v[0] ?? "");
}
