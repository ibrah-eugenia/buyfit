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
import { Progress } from "@/components/ui/progress";
import { saveProfile } from "@/lib/mocks";
import { versEtape, versProfil } from "@/lib/profile-mapping";
import type { WebProfile } from "@/lib/types";

const ETAPES = [
  "Genre",
  "Photos",
  "Silhouette",
  "Morphologie",
  "Marques",
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
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line-soft">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <span className="text-[24px]">
            <Logo />
          </span>
          <span className="text-caption font-medium text-grey">
            Étape {etape + 1} sur {ETAPES.length}
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-10 sm:px-6 sm:pt-10">
        <div className="mb-8 flex flex-col gap-3">
          <Progress
            value={((etape + 1) / ETAPES.length) * 100}
            aria-label={`Progression : étape ${etape + 1} sur ${ETAPES.length}, ${ETAPES[etape]}`}
            className="h-1.5 bg-line-soft [&>*]:bg-brand"
          />
          <ol className="hidden justify-between sm:flex" aria-label="Étapes">
            {ETAPES.map((nom, i) => (
              <li
                key={nom}
                aria-current={i === etape ? "step" : undefined}
                className={`text-caption font-semibold ${i === etape ? "text-brand" : i < etape ? "text-ink" : "text-grey"}`}
              >
                {nom}
              </li>
            ))}
          </ol>
        </div>

        {etape === 0 && <StepGenre initial={versEtape.genre(p)} onSubmit={(v) => enregistrer(v)} />}
        {etape === 1 && (
          <StepPhotos
            initial={versEtape.photos(p)}
            onBack={retour}
            onSubmit={(v) => enregistrer(v)}
          />
        )}
        {etape === 2 && (
          <StepCorps
            initial={versEtape.corps(p)}
            onBack={retour}
            onSubmit={(v) => enregistrer(versProfil.corps(p, v))}
          />
        )}
        {etape === 3 && (
          <StepMorpho
            initial={versEtape.morpho(p)}
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
  );
}
