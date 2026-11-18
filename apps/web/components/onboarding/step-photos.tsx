"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Lock, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { PhotosStepSchema, type PhotosStep } from "@/lib/types";
import { PhotoDrop } from "./photo-drop";
import { StepFooter, StepHeader, type StepProps } from "./step-shell";

const CONSEILS = [
  { ok: true, texte: "En pied, de la tête aux chaussures" },
  { ok: true, texte: "De face, bras le long du corps" },
  { ok: true, texte: "Fond neutre et uni, bonne lumière" },
  { ok: false, texte: "Pas de miroir, de filtre ni de vêtement ample" },
];

export function StepPhotos({ initial, onSubmit, onBack, submitLabel }: StepProps<PhotosStep>) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PhotosStep>({
    resolver: zodResolver(PhotosStepSchema),
    defaultValues: initial as PhotosStep,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader
        title="Crée ton avatar"
        description="Deux photos : on s'en sert pour te montrer chaque tenue sur toi."
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-[1fr_1fr_0.9fr]">
        <Controller
          control={control}
          name="photoCorpsUrl"
          render={({ field }) => (
            <PhotoDrop
              label="Corps entier"
              hint="JPG ou PNG, de face, en pied"
              value={field.value}
              onChange={(v) => field.onChange(v ?? "")}
              error={errors.photoCorpsUrl?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="photoTeteUrl"
          render={({ field }) => (
            <PhotoDrop
              label="Tête de profil"
              hint="JPG ou PNG, visage de profil"
              value={field.value}
              onChange={(v) => field.onChange(v ?? "")}
              error={errors.photoTeteUrl?.message}
            />
          )}
        />
        <aside
          className="flex flex-col gap-3 rounded-2xl bg-linen p-5 md:self-start"
          aria-labelledby="conseils"
        >
          <p id="conseils" className="overline-label">
            Conseils de cadrage
          </p>
          <ul className="flex flex-col gap-2.5">
            {CONSEILS.map((c) => (
              <li key={c.texte} className="flex items-start gap-2 text-sm text-copy">
                {c.ok ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="À faire" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="À éviter" />
                )}
                {c.texte}
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-start gap-2 text-caption text-grey">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Tes photos servent uniquement à l&apos;essayage.
          </p>
        </aside>
      </div>
      <StepFooter onBack={onBack} submitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
