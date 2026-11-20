"use client";

import { Crop, ImagePlus, RefreshCw, ScanSearch, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import type { Zone } from "@/lib/data/screenshot";
import { cn } from "@/lib/utils";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MO = 15;

/**
 * Capture d'écran (photo d'événement, image de vidéo TikTok / YouTube…) : clic, glisser-déposer
 * ou Ctrl+V. L'utilisateur entoure ensuite la pièce, comme sur une épingle Pinterest.
 */
export function ScreenshotDrop({
  disabled,
  onSearch,
}: {
  disabled?: boolean;
  onSearch: (image: Blob, zone?: Zone) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cadreRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [trace, setTrace] = useState<{ x0: number; y0: number } | null>(null);
  const [survol, setSurvol] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function choisir(fichier: File | undefined | null) {
    if (!fichier) return;
    setErreur(null);
    if (!TYPES.includes(fichier.type)) return setErreur("Format accepté : PNG, JPG ou WebP.");
    if (fichier.size > MAX_MO * 1024 * 1024)
      return setErreur(`Image trop lourde (${MAX_MO} Mo maximum).`);
    // L'ancienne URL est libérée par l'effet de nettoyage ci-dessous.
    setImage({ blob: fichier, url: URL.createObjectURL(fichier) });
    setZone(null);
  }

  // Coller une capture depuis le presse-papiers, n'importe où sur la page.
  useEffect(() => {
    const coller = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      choisir(item.getAsFile());
    };
    window.addEventListener("paste", coller);
    return () => window.removeEventListener("paste", coller);
  }, []);

  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  function point(e: PointerEvent) {
    const r = cadreRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  function debut(e: PointerEvent) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    setTrace({ x0: p.x, y0: p.y });
    setZone({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function deplacer(e: PointerEvent) {
    if (!trace) return;
    const p = point(e);
    setZone({
      x: Math.min(trace.x0, p.x),
      y: Math.min(trace.y0, p.y),
      w: Math.abs(p.x - trace.x0),
      h: Math.abs(p.y - trace.y0),
    });
  }

  function fin() {
    setTrace(null);
    // Un simple clic (zone minuscule) annule la sélection : on cherchera sur toute l'image.
    setZone((z) => (z && z.w > 0.04 && z.h > 0.04 ? z : null));
  }

  if (!image) {
    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setSurvol(true);
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSurvol(false);
            choisir(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line-soft bg-linen px-6 py-10 text-center transition-colors hover:border-brand/50 focus-within:ring-3 focus-within:ring-ring/50",
            survol && "border-brand bg-blush/40",
          )}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-white text-brand-deep shadow-sm">
            <ImagePlus className="size-6" aria-hidden="true" />
          </span>
          <span className="text-base font-bold">Ajoute une capture d&apos;écran</span>
          <span className="max-w-sm text-sm text-grey">
            Une photo prise à un événement, une image de vidéo TikTok ou YouTube… Clique, glisse
            l&apos;image ici ou colle-la avec Ctrl+V.
          </span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={TYPES.join(",")}
            className="sr-only"
            onChange={(e) => {
              choisir(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {erreur && (
          <p role="alert" className="text-caption font-medium text-destructive">
            {erreur}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-grey">
        <Crop className="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />
        Entoure la pièce qui t&apos;intéresse (glisse sur l&apos;image). Sans sélection, on regarde
        toute l&apos;image.
      </p>
      <div className="flex justify-center rounded-3xl bg-linen p-3">
        <div
          ref={cadreRef}
          onPointerDown={debut}
          onPointerMove={deplacer}
          onPointerUp={fin}
          onPointerCancel={fin}
          className={cn(
            "relative touch-none select-none",
            disabled ? "cursor-progress" : "cursor-crosshair",
          )}
        >
          <img
            src={image.url}
            alt="Ta capture d'écran"
            draggable={false}
            className="block max-h-[60vh] w-auto max-w-full rounded-2xl"
          />
          {zone && zone.w > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-lg border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] outline-2 outline-brand"
              style={{
                left: `${zone.x * 100}%`,
                top: `${zone.y * 100}%`,
                width: `${zone.w * 100}%`,
                height: `${zone.h * 100}%`,
              }}
            />
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          className="h-12 flex-1 sm:flex-none"
          disabled={disabled}
          onClick={() => onSearch(image.blob, zone ?? undefined)}
        >
          <ScanSearch aria-hidden="true" />
          {zone ? "Trouver cette pièce" : "Trouver les vêtements"}
        </Button>
        {zone && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-12"
            disabled={disabled}
            onClick={() => setZone(null)}
          >
            <X aria-hidden="true" />
            Effacer la sélection
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="h-12"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <RefreshCw aria-hidden="true" />
          Changer d&apos;image
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            choisir(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {erreur && (
        <p role="alert" className="text-caption font-medium text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}
