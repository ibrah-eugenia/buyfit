"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { FieldError } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CorpsStepSchema, TAILLES_HABITUELLES, type CorpsStep } from "@/lib/types";
import { equivalence, SizeGuide } from "./size-guide";
import { StepFooter, StepHeader, type StepProps } from "./step-shell";

const versNombre = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(",", "."));

type Champ = {
  name: FieldPath<CorpsStep>;
  label: string;
  unite?: string;
  placeholder: string;
  nombre?: boolean;
};

const OBLIGATOIRES: Champ[] = [
  {
    name: "mensurations.hauteurCm",
    label: "Taille",
    unite: "cm",
    placeholder: "170",
    nombre: true,
  },
  { name: "poidsKg", label: "Poids", unite: "kg", placeholder: "62", nombre: true },
  { name: "pointure", label: "Pointure", unite: "EU", placeholder: "39" },
];

const OPTIONNELS: Champ[] = [
  {
    name: "mensurations.poitrineCm",
    label: "Tour de poitrine",
    unite: "cm",
    placeholder: "88",
    nombre: true,
  },
  {
    name: "mensurations.tourDeTailleCm",
    label: "Tour de taille",
    unite: "cm",
    placeholder: "70",
    nombre: true,
  },
  {
    name: "mensurations.hanchesCm",
    label: "Tour de hanches",
    unite: "cm",
    placeholder: "96",
    nombre: true,
  },
  {
    name: "mensurations.entrejambeCm",
    label: "Entrejambe",
    unite: "cm",
    placeholder: "78",
    nombre: true,
  },
];

/**
 * Jusqu'à 2 tailles par type de vêtement (« entre deux tailles »), enregistrées « M/L » dans
 * l'ordre du guide. Un 3e choix remplace le plus ancien.
 */
function toggleSize(value: string, option: string, options: readonly string[]): string {
  const current = value ? value.split("/") : [];
  const next = current.includes(option)
    ? current.filter((v) => v !== option)
    : [...current, option].slice(-2);
  return next.sort((a, b) => options.indexOf(a) - options.indexOf(b)).join("/");
}

export function StepCorps({
  initial,
  onSubmit,
  onBack,
  submitLabel,
  genre,
}: StepProps<CorpsStep> & { genre?: string | undefined }) {
  const { control, register, handleSubmit, getFieldState, formState } = useForm<CorpsStep>({
    resolver: zodResolver(CorpsStepSchema),
    defaultValues: initial as CorpsStep,
  });

  function champ(c: Champ, obligatoire: boolean) {
    const id = c.name.replace(".", "-");
    const { error } = getFieldState(c.name, formState);
    return (
      <div key={c.name} className="flex flex-col gap-2">
        <Label htmlFor={id}>
          {c.label}
          {obligatoire ? (
            <span className="text-brand" aria-hidden="true">
              *
            </span>
          ) : (
            <span className="font-normal text-grey">(facultatif)</span>
          )}
        </Label>
        <div className="relative">
          <Input
            id={id}
            inputMode={c.nombre ? "decimal" : "text"}
            placeholder={c.placeholder}
            aria-required={obligatoire}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
            className="pr-12"
            {...register(c.name, c.nombre ? { setValueAs: versNombre } : {})}
          />
          {c.unite && (
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-grey">
              {c.unite}
            </span>
          )}
        </div>
        <FieldError id={`${id}-err`} message={error?.message} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader
        title="Ta silhouette"
        description="Pour la taille conseillée par le guide de chaque boutique. Les champs * sont obligatoires."
      />
      <div className="grid gap-4 sm:grid-cols-3">{OBLIGATOIRES.map((c) => champ(c, true))}</div>
      <p className="mt-8 mb-1 overline-label">Les tailles que tu portes</p>
      <p className="mb-4 text-caption text-grey">
        Celles de tes vêtements qui te vont bien aujourd&apos;hui. Entre deux tailles ? Choisis-en
        deux : on ajuste avec le guide de chaque marque.
      </p>
      <div className="flex flex-col gap-5">
        {TAILLES_HABITUELLES.map((t) => {
          const { error } = getFieldState(`tailles.${t.key}`, formState);
          return (
            <fieldset
              key={t.key}
              aria-describedby={error ? `taille-${t.key}-err` : undefined}
            >
              <legend className="mb-2 text-sm font-semibold">
                {t.label}
                <span className="text-brand" aria-hidden="true">
                  {" "}
                  *
                </span>
              </legend>
              <Controller
                control={control}
                name={`tailles.${t.key}`}
                render={({ field }) => {
                  const selected = field.value ? field.value.split("/") : [];
                  const hint = field.value ? equivalence(t.key, field.value, genre) : "";
                  return (
                    <>
                      <div
                        className={`grid gap-2 ${t.options.length > 6 ? "grid-cols-5 sm:grid-cols-10" : "grid-cols-3 sm:grid-cols-6"}`}
                      >
                        {t.options.map((o) => {
                          const on = selected.includes(o);
                          return (
                            <button
                              key={o}
                              type="button"
                              aria-pressed={on}
                              onClick={() => field.onChange(toggleSize(field.value ?? "", o, t.options))}
                              className={`h-11 rounded-2xl border text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
                                on
                                  ? "border-[1.5px] border-brand bg-blush font-bold text-brand-deep"
                                  : "border-input bg-white text-ink hover:bg-linen"
                              }`}
                            >
                              {o}
                            </button>
                          );
                        })}
                      </div>
                      {hint && <p className="mt-1.5 text-caption text-grey">{hint}</p>}
                    </>
                  );
                }}
              />
              <div className="mt-1.5">
                <FieldError id={`taille-${t.key}-err`} message={error?.message} />
              </div>
            </fieldset>
          );
        })}
      </div>
      <SizeGuide genre={genre} />
      <p className="mt-8 mb-3 overline-label">Mensurations précises</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OPTIONNELS.map((c) => champ(c, false))}
      </div>
      <p className="mt-3 text-caption text-grey">
        Mesure au mètre ruban, sans serrer, par-dessus des sous-vêtements fins.
      </p>
      <StepFooter onBack={onBack} submitting={formState.isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
