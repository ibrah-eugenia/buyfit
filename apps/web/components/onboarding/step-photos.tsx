"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { generateMannequin } from "@/lib/data/fitting";
import type { PhotosStep } from "@/lib/types";
import { PhotoDrop } from "./photo-drop";
import { StepFooter, StepHeader, type StepProps } from "./step-shell";

export function StepPhotos({ initial, onSubmit, onBack, submitLabel }: StepProps<PhotosStep>) {
  const [source, setSource] = useState(initial.photoCorpsUrl);
  const [preview, setPreview] = useState(initial.mannequinUrl);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState("");

  async function generate() {
    if (!source || busy) return;
    setBusy("generate");
    setError("");
    try {
      setPreview(await generateMannequin(source));
    } catch (e) {
      setError(e instanceof Error ? e.message : "La génération a échoué.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!preview || busy) return;
        setBusy("save");
        setError("");
        try {
          await onSubmit({ mannequinUrl: preview });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Enregistrement impossible.");
        } finally {
          setBusy(null);
        }
      }}
    >
      <StepHeader
        title="Ton mannequin d’essayage"
        description="Choisis une photo en pied, visage et chaussures visibles. Hugging Face redresse ta pose sur fond blanc. Tu pourras valider le résultat avant de l’utiliser pour tes essayages."
      />
      <fieldset disabled={!!busy} className="grid gap-5 sm:grid-cols-2">
        <PhotoDrop
          label="Ta photo en pied"
          hint="JPEG, PNG ou WebP"
          value={source}
          onChange={(photo) => {
            if (busy) return;
            setSource(photo);
            setPreview(photo ? undefined : initial.mannequinUrl);
            setError("");
          }}
        />
        {preview && (
          <div>
            <p className="mb-2 text-sm font-semibold">Ton mannequin</p>
            <img
              className="aspect-[3/4] w-full rounded-2xl border border-line bg-white object-contain"
              src={preview}
              alt="Mannequin proposé pour tes essayages"
            />
          </div>
        )}
      </fieldset>
      {source && (
        <Button
          className="mt-5"
          type="button"
          variant="secondary"
          onClick={generate}
          disabled={!!busy}
        >
          {busy === "generate"
            ? "Génération en cours…"
            : preview
              ? "Générer à nouveau"
              : "Générer mon mannequin"}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {preview ? (
        <StepFooter
          onBack={busy ? undefined : onBack}
          submitting={!!busy}
          submitLabel={submitLabel ?? "Utiliser ce mannequin"}
        />
      ) : (
        onBack && (
          <Button type="button" variant="ghost" disabled={!!busy} onClick={onBack}>
            Retour
          </Button>
        )
      )}
    </form>
  );
}
