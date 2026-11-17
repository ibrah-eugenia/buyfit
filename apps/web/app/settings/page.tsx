"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/app-providers";
import { RequireAuth } from "@/components/layout/require-auth";
import { PageContainer, PageTitle, SiteHeader } from "@/components/layout/site-header";
import { MerchantAccounts } from "@/components/onboarding/merchant-accounts";
import { StepContact } from "@/components/onboarding/step-contact";
import { StepCorps } from "@/components/onboarding/step-corps";
import { StepGenre } from "@/components/onboarding/step-genre";
import { StepMarques } from "@/components/onboarding/step-marques";
import { StepMorpho } from "@/components/onboarding/step-morpho";
import { StepPhotos } from "@/components/onboarding/step-photos";
import { StepHeader } from "@/components/onboarding/step-shell";
import { saveProfile } from "@/lib/mocks";
import { versEtape, versProfil } from "@/lib/profile-mapping";
import type { WebProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "genre", label: "Genre" },
  { id: "photos", label: "Photos" },
  { id: "corps", label: "Silhouette" },
  { id: "morpho", label: "Morphologie" },
  { id: "marques", label: "Marques" },
  { id: "contact", label: "Contact et livraison" },
  { id: "comptes", label: "Comptes marchands" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export default function SettingsPage() {
  return (
    <>
      <SiteHeader />
      <RequireAuth>
        <Settings />
      </RequireAuth>
    </>
  );
}

function Settings() {
  const { session, profile, setProfile } = useSession();
  const [section, setSection] = useState<SectionId>("genre");
  if (!session || !profile) return null;
  const p = profile;

  async function enregistrer(patch: Partial<WebProfile>) {
    if (!session) return;
    try {
      setProfile(await saveProfile(session.userId, patch));
      toast.success("Modifications enregistrées");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'enregistrement a échoué.");
    }
  }

  const commun = { submitLabel: "Enregistrer" };

  return (
    <PageContainer>
      <PageTitle
        overline="Mon profil"
        title="Réglages"
        description="Modifie tout ce que tu as saisi à l'inscription."
      />
      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-10">
        <nav
          aria-label="Sections du profil"
          className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
        >
          <ul className="flex gap-1 md:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSection(s.id)}
                  aria-current={section === s.id ? "page" : undefined}
                  className={cn(
                    "h-10 w-full rounded-[10px] px-3.5 text-left text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    section === s.id
                      ? "bg-blush text-brand-deep"
                      : "text-grey hover:bg-linen hover:text-ink",
                  )}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <section key={section} className="min-w-0">
          {section === "genre" && (
            <StepGenre {...commun} initial={versEtape.genre(p)} onSubmit={enregistrer} />
          )}
          {section === "photos" && (
            <StepPhotos {...commun} initial={versEtape.photos(p)} onSubmit={enregistrer} />
          )}
          {section === "corps" && (
            <StepCorps
              {...commun}
              initial={versEtape.corps(p)}
              onSubmit={(v) => enregistrer(versProfil.corps(p, v))}
            />
          )}
          {section === "morpho" && (
            <StepMorpho {...commun} initial={versEtape.morpho(p)} onSubmit={enregistrer} />
          )}
          {section === "marques" && (
            <StepMarques {...commun} initial={versEtape.marques(p)} onSubmit={enregistrer} />
          )}
          {section === "contact" && (
            <StepContact
              {...commun}
              initial={versEtape.contact(p, session.email)}
              onSubmit={enregistrer}
            />
          )}
          {section === "comptes" && (
            <>
              <StepHeader
                title="Comptes marchands"
                description="Connecte ou déconnecte tes comptes clients. Sans compte, l'agent commande en invité."
              />
              <MerchantAccounts />
            </>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
