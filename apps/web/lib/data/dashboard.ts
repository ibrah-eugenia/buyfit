/**
 * Tableau de bord : captures, produits trouvés, essayages et commandes lus dans Supabase
 * (lignes écrites par apps/api et l'extension). Les commandes lancées depuis le site restent
 * simulées tant que apps/api n'est pas déployée : on les ajoute à celles de la base.
 */
import type {
  DashboardData,
  FoundProduct,
  LookCapture,
  TryOnEntry,
  WebOrder,
  WebProfile,
} from "@/lib/types";
import { listCaptures, listOrders, listTryons } from "@/lib/supabase/history";
import type { ActionResult, OrderView, ProductMatchView } from "@/lib/supabase/schemas";
import { getOrders as getLocalOrders } from "@/lib/mocks/orders";
import { tailleConseillee } from "@/lib/mocks/search";

function donnees<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

function versProduit(
  p: ProductMatchView,
  captureId: string,
  profil: WebProfile | null,
): FoundProduct {
  const { matchId: _matchId, ...produit } = p;
  const categorie = "Vêtement";
  return {
    ...produit,
    categorie,
    captureId,
    tailleConseillee: tailleConseillee(
      { categorie, marque: p.marque, tailleDisponibles: p.tailleDisponibles },
      profil,
    ),
  };
}

function versCommande(o: OrderView): WebOrder {
  return {
    orderId: o.orderId,
    statut: o.statut,
    h_session_id: o.h_session_id,
    ...(o.agentViewUrl ? { agentViewUrl: o.agentViewUrl } : {}),
    ...(o.message ? { message: o.message } : {}),
    updatedAt: o.updatedAt,
    marchand: o.marchand ?? o.produit?.marque ?? "Marchand",
    mode: o.marchand ? "compte" : "invite",
    articles: o.produit
      ? [
          {
            nom: o.produit.nom,
            marque: o.produit.marque,
            taille: o.taille,
            prix: o.produit.prix,
            imageUrl: o.produit.imageUrl,
          },
        ]
      : [],
    livraison: { mode: "domicile", libelle: "Adresse enregistrée", prix: 0 },
    total: o.produit?.prix ?? 0,
    createdAt: o.createdAt,
  };
}

export async function getDashboard(
  userId: string,
  profil: WebProfile | null,
): Promise<DashboardData> {
  const [captures, tryons, orders, locales] = await Promise.all([
    listCaptures({ limit: 50 }),
    listTryons({ limit: 50 }),
    listOrders({ limit: 50 }),
    getLocalOrders(userId),
  ]);

  const looks: LookCapture[] = donnees(captures).map((c) => ({
    id: c.id,
    imageUrl: c.imageUrl,
    pinUrl: c.pinUrl,
    capturedAt: c.capturedAt,
    statut: c.produits.length > 0 ? "produits_trouves" : "aucun_resultat",
  }));
  const produits = donnees(captures).flatMap((c) =>
    c.produits.map((p) => versProduit(p, c.id, profil)),
  );
  const essayages: TryOnEntry[] = donnees(tryons).map((t) => ({
    id: t.id,
    productId: t.produit?.id ?? t.id,
    produit: t.produit?.nom ?? "Vêtement",
    marque: t.produit?.marque ?? "",
    statut: t.resultImageUrl ? "pret" : "en_cours",
    ...(t.resultImageUrl ? { resultImageUrl: t.resultImageUrl } : {}),
    ...(t.latencyMs !== null ? { latencyMs: t.latencyMs } : {}),
    createdAt: t.createdAt,
  }));
  const commandes = [...donnees(orders).map(versCommande), ...locales].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return { looks, produits, essayages, commandes };
}
