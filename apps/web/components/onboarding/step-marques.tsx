"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarquesStepSchema } from "@/lib/types";
import { BrandPicker } from "./brand-picker";
import { StepFooter, StepHeader, type StepProps } from "./step-shell";

type Values = z.infer<typeof MarquesStepSchema>;

export function StepMarques({ initial, onSubmit, onBack, submitLabel }: StepProps<Values>) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(MarquesStepSchema),
    defaultValues: {
      budgetMax: initial.budgetMax,
      marquesPreferees: initial.marquesPreferees ?? [],
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader
        title="Budget et marques"
        description="On cherche d'abord chez tes marques, dans ton budget."
      />
      <div className="mb-8 flex max-w-xs flex-col gap-2">
        <Label htmlFor="budgetMax">
          Budget maximum par pièce
          <span className="text-brand" aria-hidden="true">
            *
          </span>
        </Label>
        <div className="relative">
          <Input
            id="budgetMax"
            inputMode="decimal"
            placeholder="80"
            aria-required
            aria-invalid={!!errors.budgetMax}
            aria-describedby={errors.budgetMax ? "budget-err" : "budget-aide"}
            className="pr-10"
            {...register("budgetMax", {
              setValueAs: (v: unknown) =>
                v === "" || v === undefined || v === null
                  ? undefined
                  : Number(String(v).replace(",", ".")),
            })}
          />
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-grey">
            €
          </span>
        </div>
        <p id="budget-aide" className="text-caption text-grey">
          Les pièces plus chères seront signalées.
        </p>
        <FieldError id="budget-err" message={errors.budgetMax?.message} />
      </div>
      <p className="mb-2.5 text-sm font-semibold">Marques préférées</p>
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
