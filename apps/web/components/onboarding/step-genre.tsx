"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError } from "@/components/states";
import { GENRES, GenreStepSchema } from "@/lib/types";
import { ChoiceCard, StepFooter, StepHeader, type StepProps } from "./step-shell";

type Values = z.infer<typeof GenreStepSchema>;

export function StepGenre({ initial, onSubmit, onBack, submitLabel }: StepProps<Values>) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(GenreStepSchema), defaultValues: initial });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader
        title="Pour qui cherche-t-on ?"
        description="On adapte les rayons et les guides des tailles."
      />
      <fieldset aria-describedby={errors.genre ? "genre-err" : undefined}>
        <legend className="sr-only">Genre</legend>
        <Controller
          control={control}
          name="genre"
          render={({ field }) => (
            <div className="grid gap-3 sm:grid-cols-3">
              {GENRES.map((g) => (
                <ChoiceCard
                  key={g.value}
                  name="genre"
                  value={g.value}
                  checked={field.value === g.value}
                  onChange={field.onChange}
                  className="min-h-20 text-[15px]"
                >
                  {g.label}
                </ChoiceCard>
              ))}
            </div>
          )}
        />
        <div className="mt-2">
          <FieldError id="genre-err" message={errors.genre ? "Choisis une option" : undefined} />
        </div>
      </fieldset>
      <StepFooter onBack={onBack} submitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
