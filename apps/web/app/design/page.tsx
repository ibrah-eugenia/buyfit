import type { Metadata } from "next";
import { Heart, Search, ShoppingBag } from "lucide-react";
import { AppIcon, Logo, LogoMark, SLOGAN } from "@/components/brand/logo";
import { SiteHeader } from "@/components/layout/site-header";
import { OrderStatusBadge } from "@/components/orders/order-status";
import { CardsSkeleton, EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import type { OrderStatut } from "@/lib/types";

export const metadata: Metadata = { title: "Système de design" };

const COULEURS = [
  {
    nom: "Bordeaux",
    hex: "#7A1F2B",
    token: "brand · primary",
    usage: "Marque, actions principales",
    texte: "text-white",
  },
  {
    nom: "Bordeaux profond",
    hex: "#5C1420",
    token: "brand-deep",
    usage: "Survol, appui",
    texte: "text-white",
  },
  {
    nom: "Rose poudré",
    hex: "#F3D6DB",
    token: "blush · accent",
    usage: "Fonds d'accent, sélection",
    texte: "text-brand-deep",
  },
  {
    nom: "Encre",
    hex: "#111111",
    token: "ink · foreground",
    usage: "Texte principal",
    texte: "text-white",
  },
  {
    nom: "Gris",
    hex: "#6B6B6B",
    token: "grey · muted-foreground",
    usage: "Texte secondaire",
    texte: "text-white",
  },
  {
    nom: "Lin",
    hex: "#F7F5F2",
    token: "linen · muted",
    usage: "Fonds de surface",
    texte: "text-ink",
  },
  {
    nom: "Bordure",
    hex: "#E6E2DC",
    token: "line · border",
    usage: "Séparateurs, contours",
    texte: "text-ink",
  },
  { nom: "Blanc", hex: "#FFFFFF", token: "background", usage: "Fond de page", texte: "text-ink" },
];

const TYPO = [
  { nom: "Titre", spec: "Inter Bold 36 · −0,03em", className: "text-display font-bold" },
  { nom: "Sous-titre", spec: "Inter Semibold 20 · −0,01em", className: "text-title font-semibold" },
  { nom: "Texte courant", spec: "Inter Regular 15 · #333", className: "text-body text-copy" },
  {
    nom: "Légende",
    spec: "Inter Medium 12 · gris",
    className: "text-caption font-medium text-grey",
  },
  {
    nom: "Sur-titre",
    spec: "Inter Semibold 12 · capitales · +0,08em",
    className: "overline-label",
  },
];

function Section({
  id,
  titre,
  children,
}: {
  id: string;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 border-t border-line-soft py-10">
      <h2 id={id} className="overline-label">
        {titre}
      </h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-3 pb-10">
          <p className="overline-label">Système de marque · V1</p>
          <h1 className="text-display font-bold">Design BuyFit</h1>
          <p className="max-w-2xl text-body text-copy">
            Mode, épuré, mobile-first. Les tokens sont dans{" "}
            <code className="rounded bg-linen px-1.5 py-0.5 text-sm">app/globals.css</code> et
            exportés pour l&apos;extension dans{" "}
            <code className="rounded bg-linen px-1.5 py-0.5 text-sm">docs/brand/</code>.
          </p>
        </div>

        <Section id="logo" titre="Logo">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-linen p-10">
              <span className="text-[64px]">
                <Logo />
              </span>
              <p className="text-sm text-grey italic">{SLOGAN}</p>
            </div>
            <div className="flex flex-col justify-between gap-6 rounded-2xl bg-linen p-6">
              <p className="text-caption font-semibold text-grey">Icône d&apos;application</p>
              <div className="flex items-end gap-5">
                {[128, 48, 32, 16].map((s) => (
                  <div key={s} className="flex flex-col items-center gap-2">
                    <AppIcon size={s} />
                    <span className="text-caption text-grey">{s} px</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-xl bg-ink text-white">
                  <LogoMark className="h-8 w-5" />
                </span>
                <span className="text-[40px]">
                  <Logo className="text-ink" />
                </span>
              </div>
            </div>
          </div>
        </Section>

        <Section id="couleurs" titre="Couleurs">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COULEURS.map((c) => (
              <li key={c.hex} className="flex flex-col gap-2">
                <div
                  className={`flex h-24 items-end rounded-xl border border-line p-3 text-[13px] font-semibold ${c.texte}`}
                  style={{ background: c.hex }}
                >
                  {c.hex}
                </div>
                <span className="text-sm font-semibold">{c.nom}</span>
                <span className="text-caption text-grey">{c.usage}</span>
                <code className="text-[11px] text-grey">{c.token}</code>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="typo" titre="Typographie · Inter">
          <div className="flex flex-col divide-y divide-line-soft rounded-2xl bg-linen px-6">
            {TYPO.map((t) => (
              <div
                key={t.nom}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <span className={t.className}>{t.nom}</span>
                <span className="text-caption text-grey">{t.spec}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="rayons" titre="Rayons et espacements">
          <div className="flex flex-wrap gap-6">
            {[
              ["10 px", "rounded-[10px]", "Champs compacts, pastilles de taille"],
              ["12 px", "rounded-xl", "Boutons, champs, cartes"],
              ["16 px", "rounded-2xl", "Panneaux, sections"],
              ["Pilule", "rounded-full", "Filtres, chips, statuts"],
            ].map(([nom, cls, usage]) => (
              <div key={nom} className="flex flex-col gap-2">
                <div className={`size-24 border-[1.5px] border-brand bg-blush ${cls}`} />
                <span className="text-sm font-semibold">{nom}</span>
                <span className="max-w-32 text-caption text-grey">{usage}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="boutons" titre="Boutons">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">
              <ShoppingBag aria-hidden="true" />
              Ajouter au panier
            </Button>
            <Button>Continuer</Button>
            <Button variant="outline">Créer mon compte</Button>
            <Button variant="secondary">Connecter mon compte</Button>
            <Button variant="ghost">Retour</Button>
            <Button variant="link">Voir ce qu&apos;a fait l&apos;agent</Button>
            <Button disabled>Indisponible</Button>
            <Button size="icon" variant="ghost" aria-label="Favori">
              <Heart aria-hidden="true" />
            </Button>
          </div>
        </Section>

        <Section id="champs" titre="Champs et sélections">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="demo-email">Email</Label>
                <Input id="demo-email" placeholder="prenom@exemple.fr" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="demo-err">Numéro et rue</Label>
                <Input
                  id="demo-err"
                  defaultValue="rue de Rivoli"
                  aria-invalid
                  aria-describedby="demo-err-msg"
                />
                <p id="demo-err-msg" className="text-caption font-medium text-destructive">
                  Commence par le numéro de rue (ex. 12 rue de Rivoli)
                </p>
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-grey"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Recherche"
                  placeholder="Ex. blazer noir coupe droite"
                  className="h-14 rounded-2xl pl-12"
                />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div
                className="grid grid-cols-5 gap-2"
                role="group"
                aria-label="Exemple de choix de taille"
              >
                {["XS", "S", "M", "L", "XL"].map((t) => (
                  <span
                    key={t}
                    className={
                      t === "M"
                        ? "flex h-10 items-center justify-center rounded-[10px] border-[1.5px] border-brand bg-blush text-sm font-bold text-brand-deep"
                        : "flex h-10 items-center justify-center rounded-[10px] border border-input text-sm font-semibold"
                    }
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex h-8 items-center rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white">
                  Tout
                </span>
                {["Veste", "Pantalon", "Chaussures"].map((c) => (
                  <span
                    key={c}
                    className="inline-flex h-8 items-center rounded-full bg-linen px-3.5 text-[13px] font-semibold"
                  >
                    {c}
                  </span>
                ))}
                <span className="inline-flex h-8 items-center rounded-full bg-blush px-3.5 text-[13px] font-semibold text-brand-deep">
                  Zara ×
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="demo-switch" defaultChecked />
                <Label htmlFor="demo-switch">Je suis daltonien</Label>
              </div>
              <Progress
                value={43}
                aria-label="Progression : 43 %"
                className="h-1.5 bg-line-soft [&>*]:bg-brand"
              />
            </div>
          </div>
        </Section>

        <Section id="statuts" titre="Statuts de commande">
          <div className="flex flex-wrap gap-2">
            {(
              [
                "en_attente",
                "en_cours",
                "confirmation_requise",
                "commandee",
                "echec",
              ] as OrderStatut[]
            ).map((s) => (
              <OrderStatusBadge key={s} statut={s} />
            ))}
            <Badge className="h-6 bg-success-soft px-2.5 text-success">Connecté</Badge>
            <Badge className="h-6 bg-warning-soft px-2.5 text-warning">À reconnecter</Badge>
            <Badge className="h-6 bg-linen px-2.5 text-grey">Non connecté</Badge>
          </div>
        </Section>

        <Section id="etats" titre="États : chargement, vide, erreur">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-line-soft p-4">
              <LoadingState className="py-4" />
              <CardsSkeleton count={2} />
            </div>
            <EmptyState
              icon={ShoppingBag}
              title="Ton panier est vide"
              description="Ajoute une pièce depuis la recherche."
            />
            <ErrorState message="La recherche n'a pas abouti. Réessaie." />
          </div>
          <Alert>
            <AlertTitle>Bon à savoir</AlertTitle>
            <AlertDescription>
              L&apos;agent s&apos;arrête toujours avant le paiement.
            </AlertDescription>
          </Alert>
        </Section>
      </main>
    </>
  );
}
