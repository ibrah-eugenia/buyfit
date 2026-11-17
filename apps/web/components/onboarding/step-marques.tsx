"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError } from "@/components/states";
import { MarquesStepSchema } from "@/lib/types";
import { BrandPicker } from "./brand-picker";
import { StepFooter, StepHeader, type StepProps } from "./step-shell";

type Values = z.infer<typeof MarquesStepSchema>;

export function StepMarques({ initial, onSubmit, onBack, submitLabel }: StepProps<Values>) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(MarquesStepSchema),
    defaultValues: { marquesPreferees: initial.marquesPreferees ?? [] },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader
        title="Tes marques préférées"
        description="On cherche d'abord chez elles. Tu peux en choisir autant que tu veux."
      />
      <Controller
        control={control}
        name="marquesPreferees"
        render={({ field }) => (
          <BrandPicker
            value={field.value}
            onChange={field.onChange}
            invalid={!!errors.marquesPreferees}
            describedBy={errors.marquesPreferees ? "marques-err" : undefined}
          />
        )}
      />
      <div className="mt-2">
        <FieldError id="marques-err" message={errors.marquesPreferees?.message} />
      </div>
      <StepFooter onBack={onBack} submitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
