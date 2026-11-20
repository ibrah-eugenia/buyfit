"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bot,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useCart, useSession } from "@/components/app-providers";
import { RequireAuth } from "@/components/layout/require-auth";
import { PageContainer, PageTitle, SiteHeader } from "@/components/layout/site-header";
import { OrderCard } from "@/components/orders/order-card";
import { ProductImage } from "@/components/product-image";
import { EmptyState, ErrorState, FieldError, LoadingState } from "@/components/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findRelayPoints, getDeliveryQuote, getOrders, placeOrders, saveProfile } from "@/lib/data";
import {
  AdresseSchema,
  ORDER_FINAL,
  type Adresse,
  type DeliveryQuote,
  type RelayPoint,
  type WebOrder,
} from "@/lib/types";
import { cn, formatPrix } from "@/lib/utils";

export default function CheckoutPage() {
  return (
    <>
      <SiteHeader />
      <RequireAuth>
        <Checkout />
      </RequireAuth>
    </>
  );
}

function Checkout() {
  const { session, profile, setProfile } = useSession();
  const { items, subtotal, clear } = useCart();
  const [mode, setMode] = useState<"domicile" | "relais">("domicile");
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [adresse, setAdresse] = useState<Adresse | null>(null);
  const [editAdresse, setEditAdresse] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [commandes, setCommandes] = useState<WebOrder[] | null>(null);

  const parMarchand = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const i of items) m.set(i.product.marque, [...(m.get(i.product.marque) ?? []), i]);
    return [...m.entries()];
  }, [items]);

  useEffect(() => {
    const parse = AdresseSchema.safeParse(profile?.adresse);
    // Initialisation depuis le profil.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (parse.success) setAdresse(parse.data);
    else setEditAdresse(true);
  }, [profile?.adresse]);

  useEffect(() => {
    if (parMarchand.length === 0) return;
    void getDeliveryQuote(parMarchand.length).then(setQuote);
  }, [parMarchand.length]);

  // Suivi des commandes lancées : toutes les 3 s jusqu'à l'arrêt de l'agent.
  useEffect(() => {
    if (!commandes || !session) return;
    if (commandes.every((c) => ORDER_FINAL.includes(c.statut))) return;
    const ids = new Set(commandes.map((c) => c.orderId));
    const t = setTimeout(async () => {
      try {
        const toutes = await getOrders(session.userId);
        setCommandes(toutes.filter((c) => ids.has(c.orderId)));
      } catch {
        // on réessaie au prochain tour
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [commandes, session]);

  const [relais, setRelais] = useState<{
    etat: "idle" | "chargement" | "erreur" | "ok";
    points: RelayPoint[];
    choisi?: string;
    autour?: string;
  }>({ etat: "idle", points: [] });

  const chargerRelais = useCallback(
    async (cible: { codePostal: string; ville: string; numeroEtRue?: string }) => {
      setRelais((r) => ({ ...r, etat: "chargement" }));
      try {
        const points = await findRelayPoints(cible);
        setRelais({
          etat: "ok",
          points,
          choisi: points[0]?.id,
          autour: `${cible.codePostal} ${cible.ville}`,
        });
      } catch {
        setRelais((r) => ({ ...r, etat: "erreur" }));
      }
    },
    [],
  );

  if (!session || !profile) return null;

  if (commandes) {
    const toutesArretees = commandes.every((c) => ORDER_FINAL.includes(c.statut));
    return (
      <PageContainer className="max-w-3xl">
        <PageTitle
          overline="Commande lancée"
          title={toutesArretees ? "Tout est prêt pour le paiement" : "L'agent prépare ta commande"}
          description={
            toutesArretees
              ? "L'agent a rempli le panier et la livraison, puis s'est arrêté juste avant le paiement. Rien n'a été payé."
              : "Une commande par marque. Tu peux suivre l'agent en direct, la page se met à jour toute seule."
          }
        />
        <div className="flex flex-col gap-4" aria-live="polite">
          {commandes.map((c) => (
            <OrderCard key={c.orderId} order={c} />
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/dashboard">Voir mes commandes</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/search">Continuer mes recherches</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (items.length === 0) {
    return (
      <PageContainer className="max-w-3xl">
        <PageTitle title="Commander" />
        <EmptyState
          icon={ShoppingBag}
          title="Ton panier est vide"
          description="Ajoute des pièces depuis la recherche pour passer commande."
          action={
            <Button asChild>
              <Link href="/search">Rechercher un vêtement</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const fraisLivraison = quote ? quote[mode].prix : 0;
  const pointChoisi = relais.points.find((p) => p.id === relais.choisi);
  const pret = !!quote && (mode === "domicile" ? !!adresse && !editAdresse : !!pointChoisi);

  async function commander() {
    if (!session || !profile || !quote) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const livraison =
        mode === "domicile" && adresse
          ? { mode: "domicile" as const, adresse, prix: quote.domicile.prix }
          : pointChoisi
            ? { mode: "relais" as const, point: pointChoisi, prix: quote.relais.prix }
            : null;
      if (!livraison) return;
      const res = await placeOrders(session.userId, items, livraison, profile);
      clear();
      setCommandes(res);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La commande n'a pas pu être lancée.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <PageContainer>
      <PageTitle
        overline="Panier BuyFit"
        title="Commander"
        description="Choisis la livraison. L'agent passe une commande par marque et s'arrête avant le paiement."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="livraison-titre" className="flex flex-col gap-4">
            <h2 id="livraison-titre" className="text-title font-bold">
              Livraison
            </h2>
            {!quote ? (
              <LoadingState label="Calcul des frais de livraison…" className="py-6" />
            ) : (
              <div
                className="grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Mode de livraison"
              >
                {(
                  [
                    ["domicile", "À domicile", Home],
                    ["relais", "En point relais", Store],
                  ] as const
                ).map(([valeur, libelle, Icon]) => (
                  <label
                    key={valeur}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      mode === valeur
                        ? "border-[1.5px] border-brand bg-blush/50"
                        : "border-input hover:bg-linen",
                    )}
                  >
                    <input
                      type="radio"
                      name="livraison"
                      value={valeur}
                      checked={mode === valeur}
                      onChange={() => {
                        setMode(valeur);
                        if (valeur === "relais" && relais.etat === "idle" && adresse)
                          void chargerRelais(adresse);
                      }}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-[10px]",
                        mode === valeur ? "bg-white text-brand" : "bg-linen text-grey",
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-semibold">{libelle}</span>
                      <span className="text-caption text-grey">{quote[valeur].delai}</span>
                    </span>
                    <span className="text-[15px] font-bold">{formatPrix(quote[valeur].prix)}</span>
                  </label>
                ))}
              </div>
            )}

            {mode === "domicile" &&
              (editAdresse || !adresse ? (
                <AdresseForm
                  initial={adresse ?? undefined}
                  onCancel={adresse ? () => setEditAdresse(false) : undefined}
                  onSave={async (a, memoriser) => {
                    setAdresse(a);
                    setEditAdresse(false);
                    if (memoriser) setProfile(await saveProfile(session.userId, { adresse: a }));
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditAdresse(true)}
                  className="flex items-center gap-3 rounded-xl bg-linen p-3 text-left transition-colors hover:bg-line-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-label={`Adresse de livraison : ${adresse.numeroEtRue}, ${adresse.codePostal} ${adresse.ville}. Modifier`}
                >
                  <span className="flex size-9 items-center justify-center rounded-[10px] bg-white">
                    <MapPin className="size-4 text-brand" aria-hidden="true" />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-caption text-grey">Livrer à</span>
                    <span className="text-sm font-semibold">
                      {profile.contact.prenom} {profile.contact.nom} · {adresse.numeroEtRue},{" "}
                      {adresse.codePostal} {adresse.ville}
                    </span>
                  </span>
                  <Pencil className="size-4 text-grey" aria-hidden="true" />
                </button>
              ))}

            {mode === "relais" && (
              <RelaisPicker
                etat={relais.etat}
                points={relais.points}
                choisi={relais.choisi}
                autour={relais.autour}
                onChoisir={(id) => setRelais((r) => ({ ...r, choisi: id }))}
                onChercher={chargerRelais}
                onRetry={() => adresse && void chargerRelais(adresse)}
              />
            )}
          </section>

          <section aria-labelledby="articles-titre" className="flex flex-col gap-4">
            <h2 id="articles-titre" className="text-title font-bold">
              Articles
            </h2>
            {parMarchand.map(([marchand, lignes]) => {
              const compte = profile.comptesMarchands.find(
                (c) => c.marchand === marchand && c.statut === "connecte",
              );
              return (
                <div
                  key={marchand}
                  className="flex flex-col gap-3 rounded-[24px] border border-ink/10 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{marchand}</span>
                    <span className="text-caption font-medium text-grey">
                      {compte
                        ? "Sur ton compte client"
                        : profile.comptesMarchands.some(
                              (c) => c.marchand === marchand && c.statut === "a_reconnecter",
                            )
                          ? "Compte à reconnecter : commande en invité"
                          : "Commande en invité"}
                    </span>
                  </div>
                  {lignes.map((l) => (
                    <div key={l.lineId} className="flex items-center gap-3">
                      <ProductImage
                        src={l.product.imageUrl}
                        alt={l.product.nom}
                        categorie={l.product.categorie}
                        className="h-14 w-11 shrink-0 rounded-lg"
                      />
                      <span className="flex-1 text-sm">
                        {l.product.nom} · <span className="text-grey">taille {l.taille}</span>
                        {l.quantite > 1 && <span className="text-grey"> · ×{l.quantite}</span>}
                      </span>
                      <span className="text-sm font-semibold">
                        {formatPrix(l.product.prix * l.quantite)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-labelledby="recap">
          <div className="flex flex-col gap-4 rounded-2xl bg-linen p-5">
            <h2 id="recap" className="text-title font-bold">
              Récapitulatif
            </h2>
            <dl className="flex flex-col gap-2 border-b border-line pb-4 text-sm">
              <div className="flex justify-between">
                <dt>Articles</dt>
                <dd className="font-semibold">{formatPrix(subtotal)}</dd>
              </div>
              {quote && (
                <>
                  <div className={cn("flex justify-between", mode !== "domicile" && "text-grey")}>
                    <dt>Livraison à domicile</dt>
                    <dd>{formatPrix(quote.domicile.prix)}</dd>
                  </div>
                  <div className={cn("flex justify-between", mode !== "relais" && "text-grey")}>
                    <dt>Livraison en point relais</dt>
                    <dd>{formatPrix(quote.relais.prix)}</dd>
                  </div>
                </>
              )}
              {parMarchand.length > 1 && (
                <p className="text-caption text-grey">
                  {parMarchand.length} marques = {parMarchand.length} envois.
                </p>
              )}
            </dl>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold">Total</span>
              <span className="text-[22px] font-bold">{formatPrix(subtotal + fraisLivraison)}</span>
            </div>
            {erreur && (
              <Alert variant="destructive">
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}
            <Button
              size="lg"
              className="hidden lg:inline-flex"
              disabled={!pret || envoi}
              onClick={() => void commander()}
            >
              {envoi ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Bot aria-hidden="true" />
              )}
              {envoi ? "Lancement de l'agent…" : "Lancer la commande"}
            </Button>
            <p className="flex items-start gap-2 text-caption text-grey">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" aria-hidden="true" />
              L&apos;agent s&apos;arrête avant le paiement : rien n&apos;est débité sans toi.
            </p>
          </div>
        </aside>
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center gap-3 border-t border-line-soft bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex flex-col">
          <span className="text-caption text-grey">Total</span>
          <span className="text-lg font-bold">{formatPrix(subtotal + fraisLivraison)}</span>
        </div>
        <Button
          size="lg"
          className="flex-1"
          disabled={!pret || envoi}
          onClick={() => void commander()}
        >
          {envoi ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Bot aria-hidden="true" />
          )}
          {envoi ? "Lancement…" : "Lancer la commande"}
        </Button>
      </div>
    </PageContainer>
  );
}

function AdresseForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Adresse;
  onSave: (a: Adresse, memoriser: boolean) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [memoriser, setMemoriser] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Adresse>({ resolver: zodResolver(AdresseSchema), defaultValues: initial });
  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();
        void handleSubmit((v) => onSave(v, memoriser))(e);
      }}
      noValidate
      className="grid gap-4 rounded-[24px] border border-ink/10 p-4 sm:grid-cols-2"
      aria-label="Adresse de livraison"
    >
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="liv-rue">Numéro et rue</Label>
        <Input
          id="liv-rue"
          autoComplete="address-line1"
          placeholder="12 rue de Rivoli"
          aria-invalid={!!errors.numeroEtRue}
          aria-describedby={errors.numeroEtRue ? "liv-rue-err" : undefined}
          {...register("numeroEtRue")}
        />
        <FieldError id="liv-rue-err" message={errors.numeroEtRue?.message} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="liv-cp">Code postal</Label>
        <Input
          id="liv-cp"
          inputMode="numeric"
          autoComplete="postal-code"
          aria-invalid={!!errors.codePostal}
          aria-describedby={errors.codePostal ? "liv-cp-err" : undefined}
          {...register("codePostal")}
        />
        <FieldError id="liv-cp-err" message={errors.codePostal?.message} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="liv-ville">Ville</Label>
        <Input
          id="liv-ville"
          autoComplete="address-level2"
          aria-invalid={!!errors.ville}
          aria-describedby={errors.ville ? "liv-ville-err" : undefined}
          {...register("ville")}
        />
        <FieldError id="liv-ville-err" message={errors.ville?.message} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={memoriser}
          onChange={(e) => setMemoriser(e.target.checked)}
          className="size-4 accent-brand"
        />
        Enregistrer comme adresse par défaut
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          Utiliser cette adresse
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}

function RelaisPicker({
  etat,
  points,
  choisi,
  autour,
  onChoisir,
  onChercher,
  onRetry,
}: {
  etat: "idle" | "chargement" | "erreur" | "ok";
  points: RelayPoint[];
  choisi?: string;
  autour?: string;
  onChoisir: (id: string) => void;
  onChercher: (cible: { codePostal: string; ville: string }) => Promise<void>;
  onRetry: () => void;
}) {
  const [cp, setCp] = useState("");
  const [ville, setVille] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\d{5}$/.test(cp.trim()) || !ville.trim())
            return setErreur("Indique un code postal à 5 chiffres et une ville.");
          setErreur(null);
          void onChercher({ codePostal: cp.trim(), ville: ville.trim() });
        }}
        className="flex flex-col gap-2"
        aria-label="Chercher des points relais autour d'une autre adresse"
      >
        <p className="text-sm font-semibold">Chercher autour d&apos;une autre adresse</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Code postal"
            placeholder="Code postal"
            inputMode="numeric"
            value={cp}
            onChange={(e) => setCp(e.target.value)}
            className="sm:w-36"
          />
          <Input
            aria-label="Ville"
            placeholder="Ville"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="outline" disabled={etat === "chargement"}>
            <Search aria-hidden="true" />
            Chercher
          </Button>
        </div>
        {erreur && (
          <p role="alert" className="text-caption font-medium text-destructive">
            {erreur}
          </p>
        )}
      </form>

      {etat === "chargement" && (
        <LoadingState label="Recherche des points relais…" className="py-6" />
      )}
      {etat === "erreur" && (
        <ErrorState message="Impossible de charger les points relais." onRetry={onRetry} />
      )}
      {etat === "ok" && points.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="Aucun point relais trouvé"
          description="Essaie une autre ville."
        />
      )}
      {etat === "ok" && points.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-caption text-grey">
            Points relais près de {autour} · le plus proche est présélectionné
          </legend>
          {points.map((p, i) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                choisi === p.id
                  ? "border-[1.5px] border-brand bg-blush/40"
                  : "border-line-soft hover:bg-linen",
              )}
            >
              <input
                type="radio"
                name="relais"
                value={p.id}
                checked={choisi === p.id}
                onChange={() => onChoisir(p.id)}
                className="mt-1 size-4 accent-brand"
              />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {p.nom}
                  {i === 0 && (
                    <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-brand">
                      Le plus proche
                    </span>
                  )}
                </span>
                <span className="text-caption text-grey">{p.adresse}</span>
                <span className="text-caption text-grey">{p.horaires}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold">
                {p.distanceKm.toLocaleString("fr-FR")} km
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
