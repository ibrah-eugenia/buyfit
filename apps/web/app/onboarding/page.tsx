"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/app-providers";
import { Logo } from "@/components/brand/logo";
import { RequireAuth } from "@/components/layout/require-auth";
import { StepComptes } from "@/components/onboarding/step-comptes";
import { StepContact } from "@/components/onboarding/step-contact";
import { StepCorps } from "@/components/onboarding/step-corps";
import { StepGenre } from "@/components/onboarding/step-genre";
import { StepMarques } from "@/components/onboarding/step-marques";
import { StepMorpho } from "@/components/onboarding/step-morpho";
import { StepPhotos } from "@/components/onboarding/step-photos";
import { saveProfile } from "@/lib/data";
import { versEtape, versProfil } from "@/lib/profile-mapping";
import type { WebProfile } from "@/lib/types";

// Photos après Silhouette et Morphologie : le mannequin est généré avec la taille, le poids
// et la morphologie du profil (corps fidèle, pas un corps de mannequin idéalisé).
const ETAPES = [
  "Genre",
  "Silhouette",
  "Morphologie",
  "Photos",
  "Budget et marques",
  "Contact",
  "Comptes",
] as const;

export default function OnboardingPage() {
  return (
    <RequireAuth allowIncomplete>
      <Onboarding />
    </RequireAuth>
  );
}

function Onboarding() {
  const { session, profile, setProfile } = useSession();
  const router = useRouter();
  const [etape, setEtape] = useState(0);

  if (!session || !profile) return null;

  async function enregistrer(patch: Partial<WebProfile>, suivante = true) {
    if (!session) return;
    try {
      const maj = await saveProfile(session.userId, patch);
      setProfile(maj);
      if (suivante) {
        setEtape((e) => Math.min(e + 1, ETAPES.length - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'enregistrement a échoué.");
      throw e;
    }
  }

  const retour = etape > 0 ? () => setEtape((e) => e - 1) : undefined;
  const p = profile;

  return (
    <div className="flex flex-1 p-2 sm:p-4 lg:p-6">
      <div className="flex flex-1 flex-col overflow-hidden rounded-[28px] bg-white">
        <header className="flex h-[72px] items-center justify-between px-4 sm:h-20 sm:px-8 lg:px-12">
          <span className="text-[26px]">
            <Logo />
          </span>
          <span className="rounded-full bg-linen px-3 py-1.5 text-[13px] font-semibold text-ink">
            Étape {etape + 1}
            <span className="font-normal text-grey"> / {ETAPES.length}</span>
          </span>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-4 pb-10 sm:px-8 sm:pt-8">
          <div className="mb-10 flex flex-col gap-3">
            <ol
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${ETAPES.length}, minmax(0, 1fr))` }}
              aria-label={`Progression : étape ${etape + 1} sur ${ETAPES.length}, ${ETAPES[etape]}`}
            >
              {ETAPES.map((nom, i) => (
                <li
                  key={nom}
                  aria-current={i === etape ? "step" : undefined}
                  className="flex flex-col gap-2"
                >
                  <span
                    className={`h-1.5 rounded-full transition-colors ${i <= etape ? "bg-brand" : "bg-line-soft"}`}
                  />
                  <span
                    className={`hidden text-[12px] font-semibold sm:block ${i === etape ? "text-brand" : i < etape ? "text-ink" : "text-grey"}`}
                  >
                    {nom}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {etape === 0 && (
            <StepGenre initial={versEtape.genre(p)} onSubmit={(v) => enregistrer(v)} />
          )}
          {etape === 3 && (
            <StepPhotos
              initial={versEtape.photos(p)}
              onBack={retour}
              onSubmit={(v) => enregistrer(v)}
            />
          )}
          {etape === 1 && (
            <StepCorps
              genre={p.genre}
              initial={versEtape.corps(p)}
              onBack={retour}
              onSubmit={(v) => enregistrer(versProfil.corps(p, v))}
            />
          )}
          {etape === 2 && (
            <StepMorpho
              initial={versEtape.morpho(p)}
              mensurations={p.mensurations}
              onBack={retour}
              onSubmit={(v) => enregistrer(v)}
            />
          )}
          {etape === 4 && (
            <StepMarques
              initial={versEtape.marques(p)}
              onBack={retour}
              onSubmit={(v) => enregistrer(v)}
            />
          )}
          {etape === 5 && (
            <StepContact
              initial={versEtape.contact(p, session.email)}
              onBack={retour}
              onSubmit={(v) => enregistrer(v)}
            />
          )}
          {etape === 6 && (
            <StepComptes
              onBack={retour}
              onSubmit={async () => {
                await enregistrer({ onboardingTermine: true }, false);
                toast.success("Ton profil est prêt !");
                router.push("/search");
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
