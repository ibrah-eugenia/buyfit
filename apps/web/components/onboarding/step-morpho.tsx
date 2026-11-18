"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError } from "@/components/states";
import { MORPHO_ZONES, MorphologieStepSchema } from "@/lib/types";
import { ChoiceCard, StepFooter, StepHeader, type StepProps } from "./step-shell";

type Values = z.infer<typeof MorphologieStepSchema>;

export function StepMorpho({ initial, onSubmit, onBack, submitLabel }: StepProps<Values>) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(MorphologieStepSchema),
    defaultValues: initial as Values,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader
        title="Ta morphologie"
        description="Un choix par zone. Ça affine la coupe et la taille conseillées."
      />
      <div className="flex flex-col gap-6">
        {MORPHO_ZONES.map((zone) => {
          const err = errors.morphologie?.[zone.key]?.message;
          return (
            <fieldset key={zone.key} aria-describedby={err ? `${zone.key}-err` : undefined}>
              <legend className="mb-2.5 text-sm font-semibold">{zone.label}</legend>
              <Controller
                control={control}
                name={`morphologie.${zone.key}`}
                render={({ field }) => (
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
                )}
              />
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
