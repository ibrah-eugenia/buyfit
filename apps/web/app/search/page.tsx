"use client";

import { Mic, MicOff, Search, SearchX } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/components/app-providers";
import { RequireAuth } from "@/components/layout/require-auth";
import { PageContainer, PageTitle, SiteHeader } from "@/components/layout/site-header";
import { ResultCard } from "@/components/search/result-card";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSpeech } from "@/hooks/use-speech";
import { searchProducts } from "@/lib/data";
import { SearchQuerySchema, type SearchQuery, type SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXEMPLES = [
  "Blazer noir coupe droite",
  "Pull col roulé en laine",
  "Robe en satin",
  "Pantalon à pinces",
];

type Etat =
  | { type: "initial" }
  | { type: "chargement"; requete: SearchQuery }
  | { type: "erreur"; requete: SearchQuery; message: string }
  | { type: "resultats"; requete: SearchQuery; resultats: SearchResult[] };

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

  const lancer = useCallback(
    async (brut: string, source: SearchQuery["source"]) => {
      const parse = SearchQuerySchema.safeParse({ texte: brut, source });
      if (!parse.success) {
        setErreurSaisie(parse.error.issues[0]?.message ?? "Recherche invalide");
        return;
      }
      setErreurSaisie(null);
      setMarque(null);
      setEtat({ type: "chargement", requete: parse.data });
      try {
        setEtat({
          type: "resultats",
          requete: parse.data,
          resultats: await searchProducts(parse.data, profile),
        });
      } catch (e) {
        setEtat({
          type: "erreur",
          requete: parse.data,
          message: e instanceof Error ? e.message : "Recherche impossible.",
        });
      }
    },
    [profile],
  );

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
      <div className="flex items-center gap-4">
        <Avatar className="size-14 ring-2 ring-blush">
          {profile?.photoTeteUrl && (
            <AvatarImage src={profile.photoTeteUrl} alt="Ton avatar" className="object-cover" />
          )}
          <AvatarFallback className="bg-blush font-bold text-brand-deep">
            {prenom?.[0]?.toUpperCase() ?? "B"}
          </AvatarFallback>
        </Avatar>
        <PageTitle
          overline={prenom ? `Pour toi, ${prenom}` : "Pour toi"}
          title="Qu'est-ce qu'on cherche ?"
        />
      </div>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void lancer(texte, "texte");
        }}
        className="flex flex-col gap-2"
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
              className="h-14 rounded-2xl pr-14 pl-12 text-base"
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
                  "absolute top-1/2 right-2 -translate-y-1/2 rounded-xl",
                  voix.ecoute && "animate-pulse",
                )}
              >
                {voix.ecoute ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              </Button>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-14 rounded-2xl px-6"
            disabled={etat.type === "chargement"}
          >
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
          <p id="recherche-err" role="alert" className="text-caption font-medium text-destructive">
            {erreurSaisie}
          </p>
        )}
      </form>

      <section className="mt-8" aria-live="polite" aria-busy={etat.type === "chargement"}>
        {etat.type === "initial" && (
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

        {etat.type === "chargement" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-grey">
              On cherche « {etat.requete.texte} » chez tes marques…
            </p>
            <CardsSkeleton count={3} className="sm:grid-cols-2 lg:grid-cols-3" />
          </div>
        )}

        {etat.type === "erreur" && (
          <ErrorState
            message={etat.message}
            onRetry={() => void lancer(etat.requete.texte, etat.requete.source)}
          />
        )}

        {etat.type === "resultats" && resultats.length === 0 && (
          <EmptyState
            icon={SearchX}
            title={`Rien trouvé pour « ${etat.requete.texte} »`}
            description="Essaie avec d'autres mots : la pièce, la matière, la couleur (ex. « pull laine »)."
          />
        )}

        {etat.type === "resultats" && resultats.length > 0 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-title font-bold">
                {resultats.length} pièce{resultats.length > 1 ? "s" : ""} pour «{" "}
                {etat.requete.texte} »
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
                  avatarUrl={profile?.photoCorpsUrl}
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
