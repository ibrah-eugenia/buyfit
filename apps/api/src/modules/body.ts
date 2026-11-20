/**
 * Description du corps de l'utilisateur pour le mannequin, tirée de son profil (étapes Silhouette
 * et Morphologie). Sans elle, le modèle d'image produit par défaut un corps de mannequin
 * « idéal » (musclé, affiné) : flatteur mais faux, donc des essayages trompeurs.
 */
import { db } from "./supabase.js";

type Row = {
  genre: string | null;
  poids_kg: number | null;
  mensurations: Record<string, unknown> | null;
  morphologie: Record<string, unknown> | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Phrase anglaise pour le prompt, ou "" si le profil ne dit rien du corps. */
export function describeBody(row: Row): string {
  const m = row.mensurations ?? {};
  const morpho = row.morphologie ?? {};
  const height = num(m.hauteurCm);
  const weight = num(row.poids_kg === null ? undefined : Number(row.poids_kg));
  const parts: string[] = [];

  if (height) parts.push(`height about ${Math.round(height)} cm`);
  if (weight) parts.push(`weight about ${Math.round(weight)} kg`);
  // Épaules étroites + ventre plat + hanches étroites : silhouette fine, déclarée par
  // l'utilisateur ; elle prime sur l'IMC (un 1,83 m / 83 kg peut être fin et élancé).
  const slim =
    morpho.epaules === "etroites" && morpho.ventre === "plat" && morpho.hanches !== "larges";
  if (height && weight && !slim) {
    const bmi = weight / (height / 100) ** 2;
    parts.push(
      bmi < 18.5
        ? "slim, lean build"
        : bmi < 22
          ? "slim to average build"
          : bmi < 25
            ? "average build"
            : bmi < 28
              ? "average build with some softness, slightly stocky"
              : bmi < 32
                ? "heavier build with a soft midsection"
                : "large, heavy build",
    );
  }
  const shoulders = {
    etroites: "narrow, sloping shoulders and a slender upper body with thin arms",
    moyennes: "average-width shoulders",
    larges: "broad shoulders",
  }[String(morpho.epaules)];
  if (shoulders) parts.push(shoulders);
  const belly = { plat: "flat stomach", moyen: "slight belly", arrondi: "rounded belly" }[
    String(morpho.ventre)
  ];
  if (belly) parts.push(belly);
  const hips = { etroites: "narrow", moyennes: "average", larges: "wide" }[String(morpho.hanches)];
  if (hips) parts.push(`${hips} hips`);
  // Dit explicitement, sinon le modèle d'image garde un corps de mannequin athlétique.
  if (slim) parts.unshift("slim, slender, lean build (not athletic, not muscular)");
  const coupe = { ajustee: "slim-fitting", normale: "regular-fitting", ample: "loose, relaxed" }[
    String(morpho.coupe)
  ];
  if (coupe) parts.push(`wears ${coupe} clothes`);
  const chest = num(m.poitrineCm);
  const waist = num(m.tourDeTailleCm);
  if (chest) parts.push(`chest ${Math.round(chest)} cm`);
  if (waist) parts.push(`waist ${Math.round(waist)} cm`);
  return parts.join(", ");
}

export async function bodyOf(userId: string): Promise<string> {
  const { data } = await db()
    .from("profiles")
    .select("genre, poids_kg, mensurations, morphologie")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? describeBody(data as Row) : "";
}
