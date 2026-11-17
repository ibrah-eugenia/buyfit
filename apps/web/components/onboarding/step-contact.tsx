"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { FieldError } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ContactStepSchema, type ContactStep } from "@/lib/types";
import { DaltonismePicker } from "./daltonisme-picker";
import { StepFooter, StepHeader, type StepProps } from "./step-shell";

type Champ = {
  name: FieldPath<ContactStep>;
  label: string;
  autoComplete: string;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
};

const CONTACT: Champ[] = [
  { name: "contact.prenom", label: "Prénom", autoComplete: "given-name" },
  { name: "contact.nom", label: "Nom", autoComplete: "family-name" },
  {
    name: "contact.email",
    label: "Email",
    autoComplete: "email",
    type: "email",
    placeholder: "prenom@exemple.fr",
  },
  {
    name: "contact.telephone",
    label: "Téléphone",
    autoComplete: "tel",
    type: "tel",
    inputMode: "tel",
    placeholder: "06 12 34 56 78",
  },
];

const ADRESSE: Champ[] = [
  {
    name: "adresse.numeroEtRue",
    label: "Numéro et rue",
    autoComplete: "address-line1",
    placeholder: "12 rue de Rivoli",
    className: "sm:col-span-2",
  },
  {
    name: "adresse.codePostal",
    label: "Code postal",
    autoComplete: "postal-code",
    inputMode: "numeric",
    placeholder: "75004",
  },
  { name: "adresse.ville", label: "Ville", autoComplete: "address-level2", placeholder: "Paris" },
];

export function StepContact({ initial, onSubmit, onBack, submitLabel }: StepProps<ContactStep>) {
  const { register, control, handleSubmit, getFieldState, setValue, formState } =
    useForm<ContactStep>({
      resolver: zodResolver(ContactStepSchema),
      defaultValues: {
        ...initial,
        daltonisme: initial.daltonisme ?? { actif: false },
      } as ContactStep,
    });
  const daltonien = useWatch({ control, name: "daltonisme.actif" });

  function champ(c: Champ) {
    const id = c.name.replace(".", "-");
    const { error } = getFieldState(c.name, formState);
    return (
      <div key={c.name} className={`flex flex-col gap-2 ${c.className ?? ""}`}>
        <Label htmlFor={id}>{c.label}</Label>
        <Input
          id={id}
          type={c.type ?? "text"}
          inputMode={c.inputMode}
          autoComplete={c.autoComplete}
          placeholder={c.placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          {...register(c.name)}
        />
        <FieldError id={`${id}-err`} message={error?.message} />
      </div>
    );
  }

  const erreurType = getFieldState("daltonisme.type", formState).error?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader
        title="Contact et livraison"
        description="L'agent s'en sert pour remplir la commande à ta place."
      />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 overline-label">Contact</legend>
        {CONTACT.map(champ)}
      </fieldset>
      <fieldset className="mt-8 grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 overline-label">Adresse de livraison</legend>
        {ADRESSE.map(champ)}
      </fieldset>

      <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-linen p-5">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="daltonien" className="flex flex-col items-start gap-1">
            <span className="text-sm font-semibold">Je suis daltonien</span>
            <span className="text-caption font-normal text-grey">
              On décrira les couleurs en toutes lettres et on adaptera l&apos;affichage.
            </span>
          </Label>
          <Controller
            control={control}
            name="daltonisme.actif"
            render={({ field }) => (
              <Switch
                id="daltonien"
                checked={field.value}
                onCheckedChange={(v) => {
                  field.onChange(v);
                  if (!v) setValue("daltonisme.type", undefined);
                }}
              />
            )}
          />
        </div>
        {daltonien && (
          <>
            <Controller
              control={control}
              name="daltonisme.type"
              render={({ field }) => (
                <DaltonismePicker
                  value={field.value}
                  onChange={field.onChange}
                  describedBy={erreurType ? "dalto-err" : undefined}
                />
              )}
            />
            <FieldError id="dalto-err" message={erreurType} />
          </>
        )}
      </div>
      <StepFooter onBack={onBack} submitting={formState.isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
