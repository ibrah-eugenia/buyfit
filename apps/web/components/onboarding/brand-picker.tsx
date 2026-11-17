"use client";

import { Check, Plus, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MARQUES, MARQUES_SUGGEREES } from "@/lib/data";
import { cn, normaliser } from "@/lib/utils";

/**
 * Sélection multiple de marques : recherche sans accents, ajout libre d'une marque absente,
 * pastilles sous le champ. Après chaque choix, le champ se vide et le menu se ferme.
 */
export function BrandPicker({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: string[];
  onChange: (marques: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  const listId = `${id}-liste`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);

  const choisies = useMemo(() => new Set(value.map(normaliser)), [value]);
  const requete = normaliser(saisie);

  const options = useMemo(() => {
    const trouvees = MARQUES.filter((m) => !requete || normaliser(m).includes(requete))
      .sort(
        (a, b) =>
          Number(!normaliser(a).startsWith(requete)) - Number(!normaliser(b).startsWith(requete)),
      )
      .slice(0, 8)
      .map((m): { label: string; libre: boolean } => ({ label: m, libre: false }));
    const existe = MARQUES.some((m) => normaliser(m) === requete);
    if (saisie.trim().length >= 2 && !existe) trouvees.push({ label: saisie.trim(), libre: true });
    return trouvees;
  }, [requete, saisie]);

  function choisir(marque: string) {
    if (!choisies.has(normaliser(marque))) onChange([...value, marque]);
    setSaisie("");
    setOuvert(false);
    setActif(0);
  }

  function retirer(marque: string) {
    onChange(value.filter((m) => m !== marque));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuvert(true);
      setActif((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Entrée ne doit jamais envoyer le formulaire tant qu'une marque est en cours de saisie.
      if (!saisie.trim()) return;
      e.preventDefault();
      const option = (ouvert ? options[actif] : undefined) ?? options[0];
      if (option) choisir(option.label);
    } else if (e.key === "Escape") {
      setOuvert(false);
    } else if (e.key === "Backspace" && !saisie && value.length) {
      retirer(value[value.length - 1] as string);
    }
  }

  const suggestions = MARQUES_SUGGEREES.filter((m) => !choisies.has(normaliser(m)));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-grey"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-label="Rechercher une marque"
          aria-expanded={ouvert && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={ouvert && options[actif] ? `${id}-opt-${actif}` : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder="Rechercher une marque (ex. sezane, hm…)"
          value={saisie}
          className="pl-10"
          onChange={(e) => {
            setSaisie(e.target.value);
            setOuvert(true);
            setActif(0);
          }}
          onFocus={() => setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 120)}
          onKeyDown={onKeyDown}
        />
        {ouvert && options.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Marques"
            className="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-[0_12px_32px_rgba(17,17,17,0.12)]"
          >
            {options.map((o, i) => {
              const deja = choisies.has(normaliser(o.label));
              return (
                <li
                  key={`${o.label}-${o.libre}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === actif}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choisir(o.label)}
                  onMouseEnter={() => setActif(i)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-sm",
                    i === actif && "bg-linen",
                  )}
                >
                  <span
                    className={cn("flex items-center gap-2", o.libre && "font-semibold text-brand")}
                  >
                    {o.libre && <Plus className="size-4" aria-hidden="true" />}
                    {o.libre ? `Ajouter « ${o.label} »` : o.label}
                  </span>
                  {deja && <Check className="size-4 text-brand" aria-label="déjà choisie" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Marques choisies">
          {value.map((m) => (
            <li key={m}>
              <span className="inline-flex h-9 items-center gap-1 rounded-full bg-blush pr-1 pl-3.5 text-sm font-semibold text-brand-deep">
                {m}
                <button
                  type="button"
                  onClick={() => retirer(m)}
                  aria-label={`Retirer ${m}`}
                  className="flex size-7 items-center justify-center rounded-full hover:bg-white/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-caption font-medium text-grey">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => choisir(m)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-linen px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-line-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
