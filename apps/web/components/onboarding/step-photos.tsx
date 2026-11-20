"use client";

import { Check, ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { addSourcePhoto, listSourcePhotos, removeSourcePhoto, type SourcePhoto } from "@/lib/data";
import { buildSheet, generateMannequin } from "@/lib/data/fitting";
import type { PhotosStep } from "@/lib/types";
import { StepFooter, StepHeader, type StepProps } from "./step-shell";

const MAX_PHOTOS = 4;
const POSES = ["De face", "Trois-quarts", "En marche"] as const;

type Pose = { state: "idle" | "loading" | "ready" | "error"; url?: string; error?: string };
/** Photo d'origine : enregistrée (id) ou en cours d'envoi (aperçu local). */
type Item = { key: string; url: string; id?: string };

/**
 * Mannequin d'essayage : photos du visage (gros plan) + photos en pied, une ou plusieurs de
 * chaque (plus il y en a, plus le visage est fidèle). Le navigateur les assemble en deux planches,
 * puis 3 poses sont générées en parallèle ; l'utilisateur choisit la sienne.
 */
export function StepPhotos({ initial, onSubmit, onBack, submitLabel }: StepProps<PhotosStep>) {
  // Photos d'origine persistantes (bucket privé, dossier sources/) : rechargées à chaque visite,
  // elles permettent de régénérer le mannequin quand le moteur évolue, sans tout redemander.
  const [faces, setFaces] = useState<Item[]>([]);
  const [bodies, setBodies] = useState<Item[]>([]);
  useEffect(() => {
    let alive = true;
    listSourcePhotos()
      .then((photos: SourcePhoto[]) => {
        if (!alive) return;
        const item = (ph: SourcePhoto): Item => ({ key: ph.id, id: ph.id, url: ph.url });
        setFaces(photos.filter((ph) => ph.type === "face").map(item));
        setBodies(photos.filter((ph) => ph.type === "pied").map(item));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [poses, setPoses] = useState<Pose[]>(() => POSES.map(() => ({ state: "idle" })));
  const [chosen, setChosen] = useState<string | undefined>(initial.mannequinUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const generating = poses.some((p) => p.state === "loading");
  const uploading = [...faces, ...bodies].some((it) => !it.id);
  const canGenerate = faces.length > 0 && bodies.length > 0 && !generating && !uploading;

  async function generate() {
    if (!canGenerate) return;
    setError("");
    setChosen(undefined);
    setPoses(POSES.map(() => ({ state: "loading" })));
    let face: Blob, body: Blob;
    try {
      const blobs = (items: Item[]) =>
        Promise.all(items.map(async (it) => (await fetch(it.url)).blob()));
      [face, body] = await Promise.all([
        blobs(faces).then(buildSheet),
        blobs(bodies).then(buildSheet),
      ]);
    } catch {
      setPoses(POSES.map(() => ({ state: "idle" })));
      return setError("Impossible de lire une des photos. Essaie en JPEG ou PNG.");
    }
    await Promise.all(
      POSES.map(async (_, i) => {
        try {
          const url = await generateMannequin(face, body, i);
          setPoses((ps) => ps.map((p, k) => (k === i ? { state: "ready", url } : p)));
          // La première pose prête est sélectionnée par défaut.
          setChosen((c) => c ?? url);
        } catch (e) {
          const message = e instanceof Error ? e.message : "La génération a échoué.";
          setPoses((ps) => ps.map((p, k) => (k === i ? { state: "error", error: message } : p)));
        }
      }),
    );
  }

  const allFailed = poses.every((p) => p.state === "error");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!chosen || saving || generating) return;
        setSaving(true);
        setError("");
        try {
          await onSubmit({ mannequinUrl: chosen });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Enregistrement impossible.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <StepHeader
        title="Ton mannequin d’essayage"
        description="Ajoute des photos de ton visage et de toi debout. Plus tu en mets (jusqu’à 4 de chaque, angles différents), plus ton mannequin te ressemble. Ta taille, ton poids et ta morphologie servent à garder ton vrai corps. On génère 3 poses, tu choisis la tienne."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <PhotoSet
          label="Ton visage"
          hint="Gros plans nets, bonne lumière, de face et de trois-quarts"
          type="face"
          items={faces}
          onChange={setFaces}
          onError={setError}
          disabled={generating}
        />
        <PhotoSet
          label="Toi debout"
          hint="En pied, de la tête aux chaussures, vêtements près du corps"
          type="pied"
          items={bodies}
          onChange={setBodies}
          onError={setError}
          disabled={generating}
        />
      </div>

      <Button
        className="mt-5"
        type="button"
        variant="secondary"
        onClick={generate}
        disabled={!canGenerate}
      >
        {generating ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" /> Génération des 3 poses…
          </>
        ) : poses.some((p) => p.state !== "idle") ? (
          <>
            <RefreshCw aria-hidden="true" /> Générer à nouveau
          </>
        ) : (
          "Générer mon mannequin"
        )}
      </Button>
      {!canGenerate && !generating && (faces.length === 0 || bodies.length === 0) && (
        <p className="mt-2 text-caption text-grey">
          Il faut au moins une photo du visage et une photo debout.
        </p>
      )}

      {poses.some((p) => p.state !== "idle") ? (
        <fieldset className="mt-8">
          <legend className="mb-3 text-sm font-semibold">Choisis ta pose</legend>
          <div className="grid grid-cols-3 gap-3">
            {poses.map((p, i) => {
              const selected = !!p.url && p.url === chosen;
              return (
                <button
                  key={POSES[i]}
                  type="button"
                  disabled={p.state !== "ready"}
                  onClick={() => p.url && setChosen(p.url)}
                  aria-pressed={selected}
                  className={`group relative aspect-[3/4] overflow-hidden rounded-2xl border bg-linen text-left transition-all ${
                    selected
                      ? "border-[1.5px] border-brand ring-3 ring-brand/20"
                      : "border-line hover:border-ink/40"
                  }`}
                >
                  {p.state === "ready" && p.url && (
                    <img
                      src={p.url}
                      alt={`Ton mannequin, pose ${POSES[i]?.toLowerCase()}`}
                      className="size-full animate-in object-cover duration-700 fade-in zoom-in-95"
                    />
                  )}
                  {p.state === "loading" && (
                    <span className="absolute inset-0 animate-pulse bg-gradient-to-b from-linen via-white to-linen" />
                  )}
                  {p.state === "error" && (
                    <span className="absolute inset-0 grid place-items-center p-3 text-center text-caption text-destructive">
                      {p.error}
                    </span>
                  )}
                  <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-ink">
                    {POSES[i]}
                  </span>
                  {selected && (
                    <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-brand text-white">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        initial.mannequinUrl && (
          <div className="mt-8 max-w-[220px]">
            <p className="mb-2 text-sm font-semibold">Ton mannequin actuel</p>
            <img
              className="aspect-[3/4] w-full rounded-2xl border border-line bg-white object-cover"
              src={initial.mannequinUrl}
              alt="Ton mannequin actuel"
            />
          </div>
        )
      )}

      {(error || (allFailed && poses[0]?.error)) && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error || poses[0]?.error}
        </p>
      )}

      {chosen ? (
        <StepFooter
          onBack={generating || saving ? undefined : onBack}
          submitting={saving}
          submitLabel={submitLabel ?? "Utiliser ce mannequin"}
        />
      ) : (
        onBack && (
          <Button
            type="button"
            variant="ghost"
            className="mt-6"
            disabled={generating}
            onClick={onBack}
          >
            Retour
          </Button>
        )
      )}
    </form>
  );
}

function PhotoSet({
  label,
  hint,
  type,
  items,
  onChange,
  onError,
  disabled,
}: {
  label: string;
  hint: string;
  type: "face" | "pied";
  items: Item[];
  onChange: (update: (items: Item[]) => Item[]) => void;
  onError: (message: string) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => {
    const room = MAX_PHOTOS - items.length;
    const files = [...(list ?? [])]
      .filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) && f.size <= 10 * 1024 * 1024)
      .slice(0, Math.max(0, room));
    for (const file of files) {
      // Aperçu immédiat, puis envoi au bucket privé : l'aperçu est remplacé par la photo enregistrée.
      const key = crypto.randomUUID();
      onChange((cur) => [...cur, { key, url: URL.createObjectURL(file) }]);
      addSourcePhoto(file, type)
        .then((saved) =>
          onChange((cur) =>
            cur.map((it) => (it.key === key ? { key, id: saved.id, url: saved.url } : it)),
          ),
        )
        .catch((e) => {
          onChange((cur) => cur.filter((it) => it.key !== key));
          onError(e instanceof Error ? e.message : "Envoi de la photo impossible.");
        });
    }
  };
  const remove = (it: Item) => {
    onChange((cur) => cur.filter((x) => x.key !== it.key));
    if (it.id) void removeSourcePhoto(it.id).catch(() => {});
  };
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm font-semibold">
        {label} <span className="font-normal text-grey">({items.length}/{MAX_PHOTOS})</span>
      </p>
      <p className="mb-3 text-caption text-grey">{hint}</p>
      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => (
          <div key={it.key} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-linen">
            <img
              src={it.url}
              alt=""
              className={`size-full object-cover ${it.id ? "" : "opacity-60"}`}
            />
            {!it.id && (
              <Loader2
                className="absolute inset-0 m-auto size-5 animate-spin text-white drop-shadow"
                aria-label="Envoi en cours"
              />
            )}
            <button
              type="button"
              disabled={disabled || !it.id}
              onClick={() => remove(it)}
              aria-label="Retirer cette photo"
              className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-white/90 text-ink"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </div>
        ))}
        {items.length < MAX_PHOTOS && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => input.current?.click()}
            className="grid aspect-[3/4] place-items-center rounded-xl border border-dashed border-line-strong text-grey transition-colors hover:border-brand hover:text-brand"
            aria-label={`Ajouter une photo : ${label.toLowerCase()}`}
          >
            <ImagePlus className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-grey">
        Enregistrées dans ton espace privé, pour régénérer ton mannequin plus tard.
      </p>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
