import type { SearchQuery, SearchResult, WebProfile } from "@/lib/types";
import { normaliser } from "@/lib/utils";
import { CATALOGUE } from "./catalog";
import { attendre, erreurSimulee, MockError } from "./storage";

const LETTRES = ["XS", "S", "M", "L", "XL"] as const;
const NUMERIQUES = ["34", "36", "38", "40", "42", "44"] as const;

/**
 * Taille conseillée d'après un guide des tailles simplifié (tour de poitrine / hanches).
 * À remplacer par le vrai guide de chaque marchand quand l'API existera.
 */
export function tailleConseillee(
  produit: { categorie: string; marque: string; tailleDisponibles: string[] },
  profil: WebProfile | null,
): string {
  const dispo = produit.tailleDisponibles;
  if (produit.categorie === "Chaussures") {
    const pointure = profil?.taille.pointure;
    return pointure && dispo.includes(pointure)
      ? pointure
      : (dispo[Math.floor(dispo.length / 2)] ?? "");
  }
  const m = profil?.mensurations ?? {};
  const bas = produit.categorie === "Pantalon";
  const mesure = bas ? (m.hanchesCm ?? m.tourDeTailleCm) : (m.poitrineCm ?? m.tourDeTailleCm);
  // Indice 0..4 de XS à XL, calé sur des repères de guide européen.
  const reperes = bas ? [86, 92, 98, 104, 110] : [82, 88, 94, 100, 106];
  let indice = 2;
  if (mesure) {
    indice = reperes.findIndex((r) => mesure <= r);
    if (indice === -1) indice = 4;
  }
  // Coupe préférée ample : une taille au-dessus.
  if (profil?.morphologie.coupe === "ample") indice = Math.min(indice + 1, 4);
  if (profil?.morphologie.coupe === "ajustee" && !mesure) indice = Math.max(indice - 1, 0);
  const echelle: readonly string[] = dispo.some((t) => /^\d+$/.test(t)) ? NUMERIQUES : LETTRES;
  const proposee = echelle[indice] ?? "M";
  return dispo.includes(proposee)
    ? proposee
    : (dispo[Math.min(indice, dispo.length - 1)] ?? proposee);
}

export async function searchProducts(
  query: SearchQuery,
  profil: WebProfile | null,
): Promise<SearchResult[]> {
  await attendre(1100);
  const texte = normaliser(query.texte);
  if (erreurSimulee() || texte.includes("erreur")) {
    throw new MockError("La recherche n'a pas abouti. Vérifie ta connexion et réessaie.");
  }
  const mots = query.texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 2);
  const preferees = new Set((profil?.marquesPreferees ?? []).map(normaliser));

  return CATALOGUE.map((p) => {
    const cles = p.motsCles.join(" ");
    const touches = mots.filter((m) => cles.includes(m) || normaliser(p.nom).includes(m)).length;
    if (touches === 0) return null;
    const base = Math.min(0.55 + touches * 0.14, 0.97);
    const bonus = preferees.has(normaliser(p.marque)) ? 0.02 : 0;
    const { motsCles: _motsCles, ...produit } = p;
    const resultat: SearchResult = {
      ...produit,
      score: Math.min(Number((base + bonus).toFixed(2)), 0.99),
      tailleConseillee: tailleConseillee(p, profil),
      essayage: profil?.photoCorpsUrl
        ? { resultImageUrl: "https://example.com/buyfit/essayage.jpg", latencyMs: 2400 }
        : undefined,
    };
    return resultat;
  })
    .filter((r): r is SearchResult => r !== null)
    .sort((a, b) => b.score - a.score);
}
