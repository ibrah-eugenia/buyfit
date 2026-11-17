"use client";

import { cn } from "@/lib/utils";

/** Sélecteur de taille natif (accessible au clavier et aux lecteurs d'écran). */
export function SizeSelect({
  id,
  value,
  options,
  onChange,
  className,
  label = "Taille",
}: {
  id: string;
  value: string;
  options: string[];
  onChange: (taille: string) => void;
  className?: string;
  label?: string;
}) {
  const liste = options.includes(value) || !value ? options : [value, ...options];
  return (
    <label
      htmlFor={id}
      className={cn("inline-flex items-center gap-2 text-caption font-medium text-grey", className)}
    >
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-[10px] border border-input bg-white px-2.5 text-sm font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {liste.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
