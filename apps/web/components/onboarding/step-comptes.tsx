"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { MerchantAccounts } from "./merchant-accounts";
import { StepFooter, StepHeader } from "./step-shell";

export function StepComptes({
  onSubmit,
  onBack,
}: {
  onSubmit: () => Promise<void>;
  onBack?: () => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setEnvoi(true);
        try {
          await onSubmit();
        } finally {
          setEnvoi(false);
        }
      }}
    >
      <StepHeader
        title="Comptes marchands"
        description="Facultatif. Connecte tes comptes clients si tu veux que l'agent commande dessus."
      />
      <p className="mb-5 flex items-start gap-2 rounded-xl bg-linen p-4 text-sm text-copy">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        Sans compte connecté, l&apos;agent commande en invité avec tes coordonnées. Tu pourras
        changer ça à tout moment dans ton profil.
      </p>
      <MerchantAccounts />
      <StepFooter onBack={onBack} submitting={envoi} submitLabel="Terminer mon inscription" />
    </form>
  );
}
