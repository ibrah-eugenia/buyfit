"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { HelpCircle, Sparkles } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError } from "@/components/states";
import { MORPHO_ZONES, MorphologieStepSchema, type MensurationsWeb } from "@/lib/types";
import { ChoiceCard, StepFooter, StepHeader, type StepProps } from "./step-shell";

type Values = z.infer<typeof MorphologieStepSchema>;
type Zone = (typeof MORPHO_ZONES)[number]["key"];

/** Méthodes simples, faisables seul devant un miroir, pour choisir chaque option. */
const AIDES: Record<Zone, { methode: string; reperes: [string, string][] }> = {
  epaules: {
    methode:
      "Debout face au miroir, bras le long du corps : compare la largeur de tes épaules à celle de tes hanches.",
    reperes: [
      ["Étroites", "plus étroites que tes hanches ; les coutures d'épaule des t-shirts tombent sur ton bras."],
      ["Moyennes", "alignées avec tes hanches ; les coutures tombent pile sur l'os de l'épaule."],
      ["Larges", "nettement plus larges que tes hanches ; les t-shirts tirent aux épaules avant d'être serrés ailleurs."],
    ],
  },
  ventre: {
    methode: "De profil, en position naturelle (sans rentrer le ventre) : regarde la ligne entre ta poitrine et ton bassin.",
    reperes: [
      ["Plat", "la ligne est droite, le ventre ne dépasse pas."],
      ["Moyen", "léger relief sous le nombril, qui reste en retrait de la poitrine."],
      ["Arrondi", "le ventre arrive au niveau de la poitrine ou la dépasse."],
    ],
  },
  hanches: {
    methode:
      "Mesure le tour de hanches (au plus large des fesses) et compare-le au tour de poitrine. Sans mètre ruban : regarde la ligne de ton bassin dans le miroir.",
    reperes: [
      ["Étroites", "hanches plus fines que la poitrine (plus de 5 cm d'écart)."],
      ["Moyennes", "hanches et poitrine à peu près égales (± 5 cm)."],
      ["Larges", "hanches plus larges que la poitrine (plus de 5 cm d'écart)."],
    ],
  },
  coupe: {
    methode: "Pense au vêtement dans lequel tu te sens le mieux.",
    reperes: [
      ["Ajustée", "près du corps, sans tirer."],
      ["Normale", "droite, avec un peu d'aisance."],
      ["Ample", "oversize, le vêtement tombe loin du corps."],
    ],
  },
};

/** Hanches déduites des mensurations de l'étape Silhouette (si les deux tours sont connus). */
function hanchesSuggerees(m?: Partial<MensurationsWeb>): string | undefined {
  if (!m?.hanchesCm || !m.poitrineCm) return undefined;
  const ecart = m.hanchesCm - m.poitrineCm;
  return ecart > 5 ? "larges" : ecart < -5 ? "etroites" : "moyennes";
}

export function StepMorpho({
  initial,
  onSubmit,
  onBack,
  submitLabel,
  mensurations,
}: StepProps<Values> & { mensurations?: Partial<MensurationsWeb> }) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(MorphologieStepSchema),
    defaultValues: initial as Values,
  });
  const suggestion: Partial<Record<Zone, string>> = { hanches: hanchesSuggerees(mensurations) };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader
        title="Ta morphologie"
        description="Un choix par zone. Ça affine la coupe et la taille conseillées. Pas sûr ? Ouvre « Comment savoir »."
      />
      <div className="flex flex-col gap-7">
        {MORPHO_ZONES.map((zone) => {
          const err = errors.morphologie?.[zone.key]?.message;
          const aide = AIDES[zone.key];
          const suggere = zone.options.find((o) => o.value === suggestion[zone.key]);
          return (
            <fieldset key={zone.key} aria-describedby={err ? `${zone.key}-err` : undefined}>
              <legend className="mb-2.5 text-sm font-semibold">{zone.label}</legend>
              <Controller
                control={control}
                name={`morphologie.${zone.key}`}
                render={({ field }) => (
                  <>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {zone.options.map((o) => (
                        <ChoiceCard
                          key={o.value}
                          name={zone.key}
                          value={o.value}
                          checked={field.value === o.value}
                          onChange={field.onChange}
                          className="h-12"
                        >
                          {o.label}
                        </ChoiceCard>
                      ))}
                    </div>
                    {suggere && field.value !== suggere.value && (
                      <button
                        type="button"
                        onClick={() => field.onChange(suggere.value)}
                        className="mt-2 inline-flex items-center gap-1.5 text-caption font-semibold text-brand hover:underline"
                      >
                        <Sparkles className="size-3.5" aria-hidden="true" />
                        D&apos;après tes mesures : {suggere.label.toLowerCase()}. Choisir
                      </button>
                    )}
                  </>
                )}
              />
              <details className="group mt-2 rounded-2xl bg-linen px-4 py-2.5 text-caption text-copy open:pb-3.5">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-ink marker:hidden">
                  <HelpCircle className="size-3.5 text-brand" aria-hidden="true" />
                  Comment savoir ?
                </summary>
                <p className="mt-2">{aide.methode}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {aide.reperes.map(([option, texte]) => (
                    <li key={option}>
                      <strong className="font-semibold text-ink">{option}</strong> : {texte}
                    </li>
                  ))}
                </ul>
              </details>
              <div className="mt-1.5">
                <FieldError id={`${zone.key}-err`} message={err} />
              </div>
            </fieldset>
          );
        })}
      </div>
      <StepFooter onBack={onBack} submitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
