"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type StepProps<T> = {
  /** Valeurs initiales, tirées du profil */
  initial: Partial<T>;
  /** Enregistre l'étape (onboarding : passe à la suivante ; réglages : sauvegarde) */
  onSubmit: (values: T) => Promise<void> | void;
  onBack?: () => void;
  submitLabel?: string;
};

export function StepHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-3">
      <h2 className="font-display text-[40px] leading-[1] tracking-[-0.02em] text-ink sm:text-[52px]">
        {title}
      </h2>
      {description && (
        <p className="text-[17px] leading-relaxed font-light text-ink">{description}</p>
      )}
    </div>
  );
}

export function StepFooter({
  onBack,
  submitting,
  submitLabel = "Continuer",
}: {
  onBack?: () => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex flex-row-reverse items-center gap-2 border-t border-line-soft bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="flex-1 sm:min-w-44 sm:flex-none"
      >
        {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {submitting ? "Enregistrement…" : submitLabel}
      </Button>
      {onBack && (
        <Button type="button" variant="ghost" size="lg" onClick={onBack} className="sm:mr-auto">
          <ArrowLeft aria-hidden="true" />
          Retour
        </Button>
      )}
    </div>
  );
}

/** Carte sélectionnable (radio) au style de la charte : bordure bordeaux + fond rose poudré. */
export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  children,
  className = "",
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-4 text-center text-sm font-semibold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 ${
        checked
          ? "border-[1.5px] border-brand bg-blush font-bold text-brand-deep"
          : "border-input bg-white text-ink hover:bg-linen"
      } ${className}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {children}
    </label>
  );
}
