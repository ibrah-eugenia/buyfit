"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/app-providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectMerchant, disconnectMerchant } from "@/lib/mocks";
import type { CompteMarchandWeb } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Comptes marchands OPTIONNELS. Sans compte connecté, l'agent commande en invité.
 * Le mot de passe n'est jamais saisi ni stocké par BuyFit : il va dans le coffre H Company,
 * on ne garde que la référence `vaultId`.
 */
export const STATUT: Record<CompteMarchandWeb["statut"], { label: string; className: string }> = {
  connecte: { label: "Connecté", className: "bg-success-soft text-success" },
  a_reconnecter: { label: "À reconnecter", className: "bg-warning-soft text-warning" },
  non_connecte: { label: "Non connecté", className: "bg-linen text-grey" },
};

export function MerchantAccounts() {
  const { session, profile, setProfile } = useSession();
  const [cible, setCible] = useState<CompteMarchandWeb | null>(null);
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  if (!session || !profile) return null;
  const comptes = profile.comptesMarchands;

  function ouvrir(c: CompteMarchandWeb) {
    if (!session || !profile) return;
    setCible(c);
    setEmail(c.email ?? profile.contact.email ?? session.email);
    setErreur(null);
  }

  async function connecter() {
    if (!cible || !session || !profile) return;
    if (!/^\S+@\S+\.\S+$/.test(email))
      return setErreur("Saisis l'email de ton compte " + cible.marchand + ".");
    setErreur(null);
    setEnCours(cible.marchand);
    try {
      const maj = await connectMerchant(session.userId, cible.marchand, email);
      setProfile({ ...profile, comptesMarchands: maj });
      toast.success(
        `Compte ${cible.marchand} ${cible.statut === "a_reconnecter" ? "reconnecté" : "connecté"}`,
      );
      setCible(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setEnCours(null);
    }
  }

  async function deconnecter(c: CompteMarchandWeb) {
    if (!session || !profile) return;
    setEnCours(c.marchand);
    try {
      const maj = await disconnectMerchant(session.userId, c.marchand);
      setProfile({ ...profile, comptesMarchands: maj });
      toast(`Compte ${c.marchand} déconnecté`, {
        description: "L'agent commandera en invité chez cette marque.",
      });
    } catch {
      toast.error("La déconnexion a échoué. Réessaie.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {comptes.map((c) => {
          const connecte = c.statut === "connecte";
          const aReconnecter = c.statut === "a_reconnecter";
          return (
            <li
              key={c.marchand}
              className={cn(
                "flex flex-col gap-4 rounded-xl border p-4",
                connecte
                  ? "border-[1.5px] border-brand"
                  : aReconnecter
                    ? "border-[1.5px] border-warning/60 bg-warning-soft/40"
                    : "border-line-soft",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-11 items-center justify-center rounded-[10px] bg-linen text-[13px] font-bold tracking-tight"
                    aria-hidden="true"
                  >
                    {c.logoTexte.slice(0, 3).toUpperCase()}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[15px] font-semibold">{c.marchand}</span>
                    <span className="text-caption text-grey">{c.domaine}</span>
                  </div>
                </div>
                <Badge className={cn("h-6 px-2.5", STATUT[c.statut].className)}>
                  {c.statut === "connecte" && <CheckCircle2 aria-hidden="true" />}
                  {c.statut === "a_reconnecter" && <AlertTriangle aria-hidden="true" />}
                  {STATUT[c.statut].label}
                </Badge>
              </div>
              {c.statut !== "non_connecte" && c.email && (
                <p className="truncate text-caption text-grey">{c.email}</p>
              )}
              {aReconnecter && (
                <p className="text-caption text-copy">
                  Session expirée. Reconnecte-toi pour que l&apos;agent commande sur ce compte ;
                  sinon il commandera en invité.
                </p>
              )}
              {connecte && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={enCours === c.marchand}
                  onClick={() => void deconnecter(c)}
                >
                  {enCours === c.marchand ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Unlink aria-hidden="true" />
                  )}
                  Déconnecter
                </Button>
              )}
              {aReconnecter && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" className="flex-1" onClick={() => ouvrir(c)}>
                    <RefreshCw aria-hidden="true" />
                    Reconnecter
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={enCours === c.marchand}
                    onClick={() => void deconnecter(c)}
                  >
                    Retirer
                  </Button>
                </div>
              )}
              {c.statut === "non_connecte" && (
                <Button type="button" variant="secondary" size="sm" onClick={() => ouvrir(c)}>
                  <Link2 aria-hidden="true" />
                  Connecter mon compte
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={!!cible} onOpenChange={(o) => !o && setCible(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cible?.statut === "a_reconnecter" ? "Reconnecter" : "Connecter"} mon compte{" "}
              {cible?.marchand}
            </DialogTitle>
            <DialogDescription>
              L&apos;agent passera commande sur ton compte client {cible?.marchand} (points
              fidélité, historique).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-marchand">Email du compte {cible?.marchand}</Label>
            <Input
              id="email-marchand"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!erreur}
              aria-describedby={erreur ? "email-marchand-err" : "coffre"}
            />
            {erreur && (
              <p
                id="email-marchand-err"
                role="alert"
                className="text-caption font-medium text-destructive"
              >
                {erreur}
              </p>
            )}
          </div>
          <p
            id="coffre"
            className="flex items-start gap-2 rounded-xl bg-linen p-3 text-caption text-copy"
          >
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            Tu saisiras ton mot de passe dans le coffre sécurisé de notre partenaire H Company.
            BuyFit ne le voit ni ne le stocke jamais.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCible(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void connecter()} disabled={!!enCours}>
              {enCours && <Loader2 className="animate-spin" aria-hidden="true" />}
              Continuer vers le coffre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
