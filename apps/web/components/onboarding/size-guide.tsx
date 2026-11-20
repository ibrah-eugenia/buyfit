"use client";

import { Ruler } from "lucide-react";

/**
 * Guide des tailles, comme sur les sites marchands : correspondance lettres ↔ taille française ↔
 * taille US (W) ↔ tour en cm. Valeurs moyennes du prêt-à-porter européen (Zara, Uniqlo, H&M) :
 * chaque marque a son propre guide, celui-ci sert de repère.
 */
type Row = { lettre: string; fr: string; us?: string; cm: string };

const HAUTS: Record<"homme" | "femme", Row[]> = {
  homme: [
    { lettre: "XS", fr: "44", cm: "82–88" },
    { lettre: "S", fr: "46", cm: "88–96" },
    { lettre: "M", fr: "48–50", cm: "96–104" },
    { lettre: "L", fr: "52", cm: "104–112" },
    { lettre: "XL", fr: "54", cm: "112–120" },
    { lettre: "XXL", fr: "56", cm: "120–128" },
  ],
  femme: [
    { lettre: "XS", fr: "34", cm: "80–84" },
    { lettre: "S", fr: "36", cm: "84–88" },
    { lettre: "M", fr: "38", cm: "88–92" },
    { lettre: "L", fr: "40", cm: "92–96" },
    { lettre: "XL", fr: "42", cm: "96–100" },
    { lettre: "XXL", fr: "44", cm: "100–104" },
  ],
};

const BAS: Record<"homme" | "femme", Row[]> = {
  homme: [
    { fr: "36", us: "W28", lettre: "XS", cm: "70–74" },
    { fr: "38", us: "W29", lettre: "XS", cm: "74–77" },
    { fr: "40", us: "W30", lettre: "S", cm: "77–80" },
    { fr: "42", us: "W32", lettre: "M", cm: "80–84" },
    { fr: "44", us: "W33", lettre: "M/L", cm: "84–88" },
    { fr: "46", us: "W34", lettre: "L", cm: "88–92" },
    { fr: "48", us: "W36", lettre: "XL", cm: "92–98" },
    { fr: "50", us: "W38", lettre: "XXL", cm: "98–104" },
    { fr: "52", us: "W40", lettre: "XXL", cm: "104–110" },
  ],
  femme: [
    { fr: "34", us: "W25", lettre: "XS", cm: "62–66" },
    { fr: "36", us: "W26/27", lettre: "S", cm: "66–70" },
    { fr: "38", us: "W28/29", lettre: "M", cm: "70–74" },
    { fr: "40", us: "W30/31", lettre: "L", cm: "74–78" },
    { fr: "42", us: "W32", lettre: "XL", cm: "78–82" },
    { fr: "44", us: "W33/34", lettre: "XXL", cm: "82–86" },
    { fr: "46", us: "W36", lettre: "XXL", cm: "86–92" },
  ],
};

const rayon = (genre?: string) => (genre === "femme" ? "femme" : "homme");

/** Repère affiché sous une taille choisie : « 42 ≈ M · W32 », « L ≈ 52 · poitrine 104–112 cm ». */
export function equivalence(key: "haut" | "veste" | "bas", taille: string, genre?: string) {
  const g = rayon(genre);
  return taille
    .split("/")
    .filter(Boolean)
    .map((t) => {
      if (key === "bas") {
        const r = BAS[g].find((x) => x.fr === t);
        return r ? `${t} ≈ ${r.lettre} · ${r.us}` : null;
      }
      const r = HAUTS[g].find((x) => x.lettre === t);
      return r ? `${t} ≈ ${r.fr} · poitrine ${r.cm} cm` : null;
    })
    .filter(Boolean)
    .join("  ·  ");
}

export function SizeGuide({ genre }: { genre?: string | undefined }) {
  const g = rayon(genre);
  return (
    <details className="group mt-3 rounded-2xl bg-linen px-4 py-3 text-caption text-copy">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-ink">
        <Ruler className="size-3.5 text-brand" aria-hidden="true" />
        Guide des tailles {g === "femme" ? "femme" : "homme"}
        <span className="ml-auto font-normal text-grey group-open:hidden">Afficher</span>
      </summary>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <Table
          title="Hauts et vestes"
          head={["Lettre", "Taille FR", "Tour de poitrine"]}
          rows={HAUTS[g].map((r) => [r.lettre, r.fr, `${r.cm} cm`])}
        />
        <Table
          title="Pantalons et jeans"
          head={["Taille FR", "Jean (US)", "Lettre", "Tour de taille"]}
          rows={BAS[g].map((r) => [r.fr, r.us ?? "", r.lettre, `${r.cm} cm`])}
        />
      </div>
      <p className="mt-3 text-grey">
        Entre deux tailles ? Sélectionne les deux : on garde la plus proche du guide de chaque
        marque. Tour de poitrine sous les bras, tour de taille au niveau du nombril.
      </p>
    </details>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <div>
      <p className="mb-1.5 font-semibold text-ink">{title}</p>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-ink/15 py-1 pr-2 font-semibold text-grey">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.join()} className="border-b border-ink/5">
              {r.map((c, i) => (
                <td key={i} className={`py-1 pr-2 ${i === 0 ? "font-semibold text-ink" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
