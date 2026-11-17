"use client";

import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MO = 10;

/** Redimensionne l'image côté navigateur (côté long ≤ 1000 px) et renvoie une data URL JPEG. */
async function versDataUrl(fichier: File): Promise<string> {
  const bitmap = await createImageBitmap(fichier);
  const echelle = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * echelle);
  canvas.height = Math.round(bitmap.height * echelle);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function PhotoDrop({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint: string;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  error?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [chargement, setChargement] = useState(false);
  const [erreurFichier, setErreurFichier] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);

  async function traiter(fichier: File | undefined) {
    if (!fichier) return;
    setErreurFichier(null);
    if (!TYPES.includes(fichier.type))
      return setErreurFichier("Format accepté : JPG, PNG ou WebP.");
    if (fichier.size > MAX_MO * 1024 * 1024)
      return setErreurFichier(`Photo trop lourde (${MAX_MO} Mo maximum).`);
    setChargement(true);
    try {
      onChange(await versDataUrl(fichier));
    } catch {
      setErreurFichier("Impossible de lire cette photo. Essaie une autre image.");
    } finally {
      setChargement(false);
    }
  }

  const message = erreurFichier ?? error;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold" id={`${inputId}-label`}>
        {label}
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          void traiter(e.dataTransfer.files[0]);
        }}
        className={cn(
          "relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-[14px] border-[1.5px] border-dashed bg-linen text-center transition-colors",
          survol ? "border-brand bg-blush/40" : "border-[#C9C3BA]",
          message && "border-destructive",
          value && "border-solid border-line",
        )}
      >
        {chargement ? (
          <Loader2 className="size-6 animate-spin text-grey" aria-label="Chargement de la photo" />
        ) : value ? (
          <>
            <img
              src={value}
              alt={`Aperçu : ${label}`}
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-x-2 bottom-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="flex-1 bg-white/95"
                onClick={() => inputRef.current?.click()}
              >
                <RefreshCw aria-hidden="true" />
                Remplacer
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="bg-white/95"
                aria-label={`Supprimer la photo : ${label}`}
                onClick={() => onChange(undefined)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-labelledby={`${inputId}-label`}
            aria-describedby={`${inputId}-hint`}
            className="flex size-full flex-col items-center justify-center gap-2.5 px-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-blush text-brand-deep">
              <ImagePlus className="size-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold">Importer une photo</span>
            <span id={`${inputId}-hint`} className="text-caption text-grey">
              {hint}
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void traiter(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {message && (
        <p role="alert" className="text-caption font-medium text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
