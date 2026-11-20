"use client";

import Link from "next/link";
import { AlertTriangle, Camera, ExternalLink, Package, Shirt, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/app-providers";
import { RequireAuth } from "@/components/layout/require-auth";
import { PageContainer, PageTitle, SiteHeader } from "@/components/layout/site-header";
import { OrderCard } from "@/components/orders/order-card";
import { ProductImage } from "@/components/product-image";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDashboard } from "@/lib/data";
import type { DashboardData, LookCapture, TryOnEntry } from "@/lib/types";
import { cn, formatPrix } from "@/lib/utils";

const STATUT_LOOK: Record<LookCapture["statut"], { label: string; className: string }> = {
  analyse: { label: "Analyse en cours", className: "bg-blush text-brand-deep" },
  produits_trouves: { label: "Produits trouvés", className: "bg-success-soft text-success" },
  aucun_resultat: { label: "Aucun résultat", className: "bg-linen text-grey" },
  erreur: { label: "Erreur", className: "bg-destructive/10 text-destructive" },
};

const STATUT_ESSAYAGE: Record<TryOnEntry["statut"], { label: string; className: string }> = {
  en_cours: { label: "Génération…", className: "bg-blush text-brand-deep" },
  pret: { label: "Prêt", className: "bg-success-soft text-success" },
  echec: { label: "Échec", className: "bg-destructive/10 text-destructive" },
};

const quand = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function Pastille({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold",
        className,
      )}
    >
      {label}
    </span>
  );
}

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />
      <RequireAuth>
        <Dashboard />
      </RequireAuth>
    </>
  );
}

function Dashboard() {
  const { session, profile } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!session) return;
    setErreur(null);
    setData(null);
    try {
      setData(await getDashboard(session.userId, profile));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }, [session, profile]);

  useEffect(() => {
    // Chargement des données (mock) au montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, [charger]);

  const aReconnecter = (profile?.comptesMarchands ?? [])
    .filter((c) => c.statut === "a_reconnecter")
    .map((c) => c.marchand);

  const onglets = [
    { value: "looks", label: "Looks", icon: Camera, n: data?.looks.length },
    { value: "produits", label: "Produits", icon: Shirt, n: data?.produits.length },
    { value: "essayages", label: "Essayages", icon: Sparkles, n: data?.essayages.length },
    { value: "commandes", label: "Commandes", icon: Package, n: data?.commandes.length },
  ];

  return (
    <PageContainer>
      <PageTitle
        overline={profile?.contact.prenom ? `Bonjour ${profile.contact.prenom}` : "Tableau de bord"}
        title="Du look à la commande"
        description="Tes looks capturés, les produits trouvés, tes essayages et le suivi de tes commandes."
      />
      {aReconnecter.length > 0 && (
        <div
          role="status"
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center"
        >
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <p className="flex-1 text-sm text-ink">
            <strong className="font-semibold">
              {aReconnecter.length === 1
                ? `Ton compte ${aReconnecter[0]} doit être reconnecté.`
                : `Tes comptes ${aReconnecter.join(", ")} doivent être reconnectés.`}
            </strong>{" "}
            En attendant, l&apos;agent commande en invité chez{" "}
            {aReconnecter.length === 1 ? "cette marque" : "ces marques"}.
          </p>
          <Button asChild size="sm">
            <Link href="/settings?section=comptes">Reconnecter</Link>
          </Button>
        </div>
      )}
      {erreur ? (
        <ErrorState message={erreur} onRetry={() => void charger()} />
      ) : (
        <Tabs defaultValue="looks" className="gap-6">
          <TabsList className="no-scrollbar h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-linen p-1">
            {onglets.map(({ value, label, icon: Icon, n }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-10 flex-none gap-2 rounded-[10px] px-3.5 data-[state=active]:bg-white sm:flex-1"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                {n !== undefined && (
                  <span className="rounded-full bg-line-soft px-1.5 text-[11px] text-grey">
                    {n}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {!data ? (
            <CardsSkeleton count={4} className="sm:grid-cols-2" />
          ) : (
            <>
              <TabsContent value="looks">
                {data.looks.length === 0 ? (
                  <EmptyState
                    icon={Camera}
                    title="Aucun look capturé"
                    description="Sur Pinterest, clique sur l'extension BuyFit pour capturer une tenue."
                  />
                ) : (
                  <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    {data.looks.map((l) => (
                      <li
                        key={l.id}
                        className="flex flex-col overflow-hidden rounded-[24px] border border-ink/10"
                      >
                        <ProductImage
                          src={l.imageUrl}
                          alt={l.description ?? "Look capturé"}
                          className="aspect-[3/4] w-full"
                        />
                        <div className="flex flex-col gap-2 p-3">
                          <Pastille {...STATUT_LOOK[l.statut]} />
                          <p className="text-sm font-semibold">
                            {l.description ?? "Look sans titre"}
                          </p>
                          <div className="flex items-center justify-between text-caption text-grey">
                            <span>{quand(l.capturedAt)}</span>
                            <a
                              href={l.pinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                            >
                              Épingle <ExternalLink className="size-3" aria-hidden="true" />
                              <span className="sr-only">(nouvel onglet)</span>
                            </a>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="produits">
                {data.produits.length === 0 ? (
                  <EmptyState
                    icon={Shirt}
                    title="Aucun produit trouvé pour l'instant"
                    action={
                      <Button asChild size="sm">
                        <Link href="/search">Lancer une recherche</Link>
                      </Button>
                    }
                  />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.produits.map((p) => {
                      const look = data.looks.find((l) => l.id === p.captureId);
                      return (
                        <li
                          key={`${p.captureId}-${p.id}`}
                          className="flex gap-3 rounded-[20px] border border-ink/10 p-2.5"
                        >
                          <ProductImage
                            src={p.imageUrl}
                            alt={p.nom}
                            categorie={p.categorie}
                            className="h-[72px] w-[60px] shrink-0 rounded-[10px]"
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-[11px] font-semibold tracking-[0.04em] text-grey uppercase">
                              {p.categorie} · {p.marque}
                            </span>
                            <span className="truncate text-sm font-semibold">{p.nom}</span>
                            <span className="text-sm font-bold text-brand">
                              {formatPrix(p.prix, p.devise)}
                            </span>
                            <span className="truncate text-caption text-grey">
                              {Math.round(p.score * 100)} % · taille {p.tailleConseillee}
                              {look?.description ? ` · ${look.description}` : ""}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="essayages">
                {data.essayages.length === 0 ? (
                  <EmptyState
                    icon={Sparkles}
                    title="Aucun essayage"
                    description="Depuis un résultat, affiche « Sur moi » pour voir la pièce sur ton avatar."
                  />
                ) : (
                  <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    {data.essayages.map((e) => (
                      <li
                        key={e.id}
                        className="flex flex-col overflow-hidden rounded-[24px] border border-ink/10"
                      >
                        <div className="relative aspect-[3/4] bg-linen">
                          {e.statut === "pret" && e.resultImageUrl ? (
                            <img
                              src={e.resultImageUrl}
                              alt={`Essayage : ${e.produit}`}
                              className="size-full object-cover"
                            />
                          ) : (
                            <ProductImage
                              alt={`Essayage : ${e.produit}`}
                              categorie="Essayage"
                              className="size-full"
                            />
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 p-3">
                          <Pastille {...STATUT_ESSAYAGE[e.statut]} />
                          <p className="text-sm font-semibold">{e.produit}</p>
                          <p className="text-caption text-grey">
                            {e.marque} · {quand(e.createdAt)}
                            {e.latencyMs
                              ? ` · ${(e.latencyMs / 1000).toLocaleString("fr-FR")} s`
                              : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="commandes">
                {data.commandes.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="Aucune commande"
                    description="Ajoute des pièces au panier puis clique sur Commander."
                  />
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {data.commandes.map((c) => (
                      <OrderCard key={c.orderId} order={c} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      )}
    </PageContainer>
  );
}
