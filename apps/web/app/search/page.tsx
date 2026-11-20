"use client";

import { ChevronDown, Mic, MicOff, Search, SearchX } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/components/app-providers";
import { RequireAuth } from "@/components/layout/require-auth";
import { PageContainer, PageTitle, SiteHeader } from "@/components/layout/site-header";
import { ImageLightbox } from "@/components/image-lightbox";
import { ResultCard } from "@/components/search/result-card";
import { ScreenshotDrop } from "@/components/search/screenshot-drop";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSpeech } from "@/hooks/use-speech";
import { searchProducts } from "@/lib/data";
import { chercherParImage, decouper, identifierPiece, type Zone } from "@/lib/data/screenshot";
import { SearchQuerySchema, type SearchQuery, type SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXEMPLES = [
  "Blazer noir coupe droite",
  "Pull col roulé en laine",
  "Robe en satin",
  "Pantalon à pinces",
];

type Relance =
  | { type: "texte"; brut: string; source: SearchQuery["source"] }
  | { type: "image"; image: Blob; zone?: Zone };

/** `apercu` : zone de la capture envoyée au modèle (recherche par image). */
type Etat =
  | { type: "initial" }
  | { type: "identification"; apercu: string }
  | { type: "chargement"; libelle: string; apercu?: string }
  | { type: "erreur"; message: string; relance: Relance; apercu?: string }
  | { type: "resultats"; libelle: string; resultats: SearchResult[]; apercu?: string };

export default function SearchPage() {
  return (
    <>
      <SiteHeader />
      <RequireAuth>
        <SearchView />
      </RequireAuth>
    </>
  );
}

function SearchView() {
  const { profile } = useSession();
  const [texte, setTexte] = useState("");
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat>({ type: "initial" });
  const [marque, setMarque] = useState<string | null>(null);
  const [modeTexte, setModeTexte] = useState(false);
  const [apercuPleinEcran, setApercuPleinEcran] = useState(false);

  const lancer = useCallback(
    async (brut: string, source: SearchQuery["source"]) => {
      const parse = SearchQuerySchema.safeParse({ texte: brut, source });
      if (!parse.success) {
        setErreurSaisie(parse.error.issues[0]?.message ?? "Recherche invalide");
        return;
      }
      setErreurSaisie(null);
      setMarque(null);
      const libelle = parse.data.texte;
      setEtat({ type: "chargement", libelle });
      try {
        setEtat({
          type: "resultats",
          libelle,
          resultats: await searchProducts(parse.data, profile),
        });
      } catch (e) {
        setEtat({
          type: "erreur",
          message: e instanceof Error ? e.message : "Recherche impossible.",
          relance: { type: "texte", brut, source },
        });
      }
    },
    [profile],
  );

  // Capture d'écran : même chaîne que l'épingle Pinterest (zone → identification → boutiques).
  const lancerImage = useCallback(
    async (image: Blob, zone?: Zone) => {
      setMarque(null);
      let apercu: string | undefined;
      try {
        apercu = await decouper(image, zone);
        setEtat({ type: "identification", apercu });
        const item = await identifierPiece(apercu);
        setEtat({ type: "chargement", libelle: item.nom, apercu });
        setEtat({
          type: "resultats",
          libelle: item.nom,
          apercu,
          resultats: await chercherParImage(item, apercu, profile),
        });
      } catch (e) {
        setEtat({
          type: "erreur",
          message: e instanceof Error ? e.message : "Recherche impossible.",
          relance: { type: "image", image, zone },
          apercu,
        });
      }
    },
    [profile],
  );
  const occupe = etat.type === "chargement" || etat.type === "identification";

  const voix = useSpeech(
    useCallback(
      (t: string) => {
        setTexte(t);
        void lancer(t, "voix");
      },
      [lancer],
    ),
  );

  const resultats = useMemo(() => (etat.type === "resultats" ? etat.resultats : []), [etat]);
  const marques = useMemo(() => {
    const compte = new Map<string, number>();
    for (const r of resultats) compte.set(r.marque, (compte.get(r.marque) ?? 0) + 1);
    return [...compte.entries()];
  }, [resultats]);
  const filtres = marque ? resultats.filter((r) => r.marque === marque) : resultats;
  const prenom = profile?.contact.prenom;

  return (
    <PageContainer>
      <PageTitle
        leading={
          <Avatar className="size-9 ring-2 ring-blush">
            {profile?.photoTeteUrl && (
              <AvatarImage src={profile.photoTeteUrl} alt="Ton avatar" className="object-cover" />
            )}
            <AvatarFallback className="bg-blush text-[13px] font-bold text-brand-deep">
              {prenom?.[0]?.toUpperCase() ?? "B"}
            </AvatarFallback>
          </Avatar>
        }
        overline={prenom ? `Pour toi, ${prenom}` : "Pour toi"}
        title="Qu'est-ce qu'on cherche ?"
      />

      <ScreenshotDrop disabled={occupe} onSearch={(img, zone) => void lancerImage(img, zone)} />

      <button
        type="button"
        onClick={() => setModeTexte((v) => !v)}
        aria-expanded={modeTexte}
        aria-controls="recherche-texte"
        className="mt-4 flex items-center gap-1 self-start text-sm font-semibold text-grey hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        Ou décris-le avec des mots
        <ChevronDown
          className={cn("size-4 transition-transform", modeTexte && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {modeTexte && (
        <form
          id="recherche-texte"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void lancer(texte, "texte");
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <label htmlFor="recherche" className="sr-only">
            Décris le vêtement
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-grey"
                aria-hidden="true"
              />
              <Input
                id="recherche"
                value={voix.ecoute ? voix.interim || texte : texte}
                onChange={(e) => setTexte(e.target.value)}
                placeholder="Ex. blazer noir coupe droite"
                className="h-14 rounded-full bg-linen pr-14 pl-12 text-base sm:h-16"
                aria-invalid={!!erreurSaisie}
                aria-describedby={erreurSaisie ? "recherche-err" : "recherche-aide"}
              />
              {voix.supporte && (
                <Button
                  type="button"
                  size="icon"
                  variant={voix.ecoute ? "default" : "ghost"}
                  onClick={voix.ecoute ? voix.stop : voix.start}
                  aria-label={voix.ecoute ? "Arrêter la dictée" : "Dicter ma recherche"}
                  aria-pressed={voix.ecoute}
                  className={cn(
                    "absolute top-1/2 right-2 -translate-y-1/2",
                    voix.ecoute && "animate-pulse",
                  )}
                >
                  {voix.ecoute ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
                </Button>
              )}
            </div>
            <Button type="submit" size="lg" className="h-14 px-7 sm:h-16" disabled={occupe}>
              <span className="hidden sm:inline">Rechercher</span>
              <Search className="sm:hidden" aria-label="Rechercher" />
            </Button>
          </div>
          <p id="recherche-aide" className="text-caption text-grey" aria-live="polite">
            {voix.ecoute
              ? "Je t'écoute… décris le vêtement."
              : (voix.erreur ??
                (voix.supporte
                  ? "Écris ou appuie sur le micro pour dicter."
                  : "Dictée vocale non disponible sur ce navigateur : écris ta recherche."))}
          </p>
          {erreurSaisie && (
            <p
              id="recherche-err"
              role="alert"
              className="text-caption font-medium text-destructive"
            >
              {erreurSaisie}
            </p>
          )}
        </form>
      )}

      <section className="mt-8" aria-live="polite" aria-busy={etat.type === "chargement"}>
        {etat.type === "initial" && modeTexte && (
          <div className="flex flex-col gap-3">
            <p className="overline-label">Idées de recherche</p>
            <div className="flex flex-wrap gap-2">
              {EXEMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setTexte(ex);
                    void lancer(ex, "texte");
                  }}
                  className="h-9 rounded-full bg-linen px-4 text-sm font-semibold transition-colors hover:bg-line-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {etat.type !== "initial" && etat.apercu && (
          <div className="mb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setApercuPleinEcran(true)}
              aria-label="Voir la pièce sélectionnée en plein écran"
              className="shrink-0 cursor-zoom-in rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <img
                src={etat.apercu}
                alt="Pièce sélectionnée"
                className="size-16 rounded-xl object-cover ring-1 ring-line-soft"
              />
            </button>
            <ImageLightbox
              src={etat.apercu}
              alt="Pièce sélectionnée"
              open={apercuPleinEcran}
              onOpenChange={setApercuPleinEcran}
            />
            <p className="text-sm text-grey">
              {etat.type === "identification"
                ? "On identifie la pièce…"
                : etat.type === "erreur"
                  ? "Pièce sélectionnée"
                  : etat.libelle}
            </p>
          </div>
        )}

        {etat.type === "identification" && (
          <CardsSkeleton count={3} className="sm:grid-cols-2 lg:grid-cols-3" />
        )}

        {etat.type === "chargement" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-grey">On cherche « {etat.libelle} » chez tes marques…</p>
            <CardsSkeleton count={3} className="sm:grid-cols-2 lg:grid-cols-3" />
          </div>
        )}

        {etat.type === "erreur" && (
          <ErrorState
            message={etat.message}
            onRetry={() => {
              const r = etat.relance;
              if (r.type === "texte") void lancer(r.brut, r.source);
              else void lancerImage(r.image, r.zone);
            }}
          />
        )}

        {etat.type === "resultats" && resultats.length === 0 && (
          <EmptyState
            icon={SearchX}
            title={`Rien trouvé pour « ${etat.libelle} »`}
            description={
              etat.apercu
                ? "Entoure la pièce de plus près, ou essaie une capture plus nette."
                : "Essaie avec d'autres mots : la pièce, la matière, la couleur (ex. « pull laine »)."
            }
          />
        )}

        {etat.type === "resultats" && resultats.length > 0 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-title font-bold">
                {resultats.length} pièce{resultats.length > 1 ? "s" : ""} pour « {etat.libelle} »
              </h2>
              <p className="text-sm text-grey">
                Triées par ressemblance. Tes marques préférées passent en premier à égalité.
              </p>
            </div>

            <div
              className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
              role="group"
              aria-label="Filtrer par marque"
            >
              {[[null, resultats.length] as const, ...marques].map(([m, n]) => (
                <button
                  key={m ?? "toutes"}
                  type="button"
                  onClick={() => setMarque(m)}
                  aria-pressed={marque === m}
                  className={cn(
                    "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    marque === m ? "bg-ink text-white" : "bg-linen text-ink hover:bg-line-soft",
                  )}
                >
                  {m ?? "Toutes"}{" "}
                  <span className={marque === m ? "text-white/70" : "text-grey"}>{n}</span>
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtres.map((r) => (
                <ResultCard
                  key={r.id}
                  result={r}
                  avatarUrl={profile?.mannequinUrl}
                  budgetMax={profile?.budgetMax}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
