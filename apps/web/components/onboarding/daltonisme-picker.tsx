"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { DALTONISME_TYPES, type DaltonismeType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Carrousel horizontal des types de daltonisme (choix unique). */
export function DaltonismePicker({
  value,
  onChange,
  describedBy,
}: {
  value?: DaltonismeType;
  onChange: (t: DaltonismeType) => void;
  describedBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const defiler = (sens: 1 | -1) => ref.current?.scrollBy({ left: sens * 240, behavior: "smooth" });

  return (
    <fieldset aria-describedby={describedBy} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-semibold">Quel type ?</legend>
        <div className="hidden gap-1 sm:flex">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => defiler(-1)}
            aria-label="Types précédents"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => defiler(1)}
            aria-label="Types suivants"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div
        ref={ref}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1"
      >
        {DALTONISME_TYPES.map((t) => {
          const choisi = value === t.value;
          return (
            <label
              key={t.value}
              className={cn(
                "relative flex w-56 shrink-0 cursor-pointer snap-start flex-col gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                choisi
                  ? "border-[1.5px] border-brand bg-blush"
                  : "border-input bg-white hover:bg-linen",
              )}
            >
              <input
                type="radio"
                name="daltonisme"
                value={t.value}
                checked={choisi}
                onChange={() => onChange(t.value)}
                className="sr-only"
              />
              <div className="flex gap-1.5" aria-hidden="true">
                {t.palette.map((c) => (
                  <span
                    key={c}
                    className="size-7 rounded-full ring-1 ring-black/5"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <span className={cn("text-sm font-bold", choisi ? "text-brand-deep" : "text-ink")}>
                {t.label}
              </span>
              <span className="text-caption text-copy">{t.description}</span>
              {choisi && (
                <Check className="absolute top-3 right-3 size-4 text-brand" aria-hidden="true" />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
