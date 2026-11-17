"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldPath } from "react-hook-form";
import { FieldError } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CorpsStepSchema, type CorpsStep } from "@/lib/types";
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

export function StepCorps({ initial, onSubmit, onBack, submitLabel }: StepProps<CorpsStep>) {
  const { register, handleSubmit, getFieldState, formState } = useForm<CorpsStep>({
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
