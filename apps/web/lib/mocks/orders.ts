import type { CartItem, Livraison, OrderStatut, WebOrder, WebProfile } from "@/lib/types";
import { attendre, ecrire, erreurSimulee, id, lire, MockError } from "./storage";

const cle = (userId: string) => `commandes:${userId}`;

/**
 * Statut simulé selon le temps écoulé. L'agent s'arrête TOUJOURS avant le paiement :
 * la dernière étape simulée est `confirmation_requise` (pas de bouton de confirmation côté site).
 */
function statutSimule(createdAt: string, echec: boolean): { statut: OrderStatut; message: string } {
  const secondes = (Date.now() - new Date(createdAt).getTime()) / 1000;
  if (secondes < 4) return { statut: "en_attente", message: "L'agent se prépare." };
  if (secondes < 12)
    return { statut: "en_cours", message: "L'agent remplit le panier et la livraison." };
  if (echec) return { statut: "echec", message: "Article en rupture au moment de la commande." };
  return {
    statut: "confirmation_requise",
    message: "Panier et livraison prêts. L'agent s'est arrêté avant le paiement.",
  };
}

type Stocke = Omit<WebOrder, "statut" | "message" | "updatedAt"> & {
  echec?: boolean;
  statutFige?: OrderStatut;
  messageFige?: string;
};

function hydrater(o: Stocke): WebOrder {
  const { echec, statutFige, messageFige, ...reste } = o;
  const simule = statutFige
    ? { statut: statutFige, message: messageFige ?? "" }
    : statutSimule(o.createdAt, !!echec);
  return { ...reste, ...simule, updatedAt: new Date().toISOString() };
}

export async function getOrders(userId: string): Promise<WebOrder[]> {
  await attendre(300);
  if (erreurSimulee()) throw new MockError("Impossible de charger tes commandes.");
  return lire<Stocke[]>(cle(userId), [])
    .map(hydrater)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function placeOrders(
  userId: string,
  panier: CartItem[],
  livraison: Livraison,
  profil: WebProfile,
): Promise<WebOrder[]> {
  await attendre(1000);
  if (erreurSimulee())
    throw new MockError("La commande n'a pas pu être lancée. Ton panier est conservé.");
  const parMarchand = new Map<string, CartItem[]>();
  for (const item of panier) {
    parMarchand.set(item.product.marque, [...(parMarchand.get(item.product.marque) ?? []), item]);
  }
  const fraisParEnvoi = livraison.prix / Math.max(parMarchand.size, 1);
  const libelle =
    livraison.mode === "domicile"
      ? `${livraison.adresse.numeroEtRue}, ${livraison.adresse.codePostal} ${livraison.adresse.ville}`
      : `${livraison.point.nom} — ${livraison.point.adresse}`;
  const maintenant = new Date().toISOString();
  const nouvelles: Stocke[] = [...parMarchand.entries()].map(([marchand, items]) => {
    const compte = profil.comptesMarchands.find(
      (c) => c.marchand === marchand && c.statut === "connecte",
    );
    const sousTotal = items.reduce((s, i) => s + i.product.prix * i.quantite, 0);
    const orderId = id("cmd");
    return {
      orderId,
      h_session_id: id("hsess"),
      agentViewUrl: `https://example.com/agent-view/${orderId}`,
      marchand,
      mode: compte ? "compte" : "invite",
      articles: items.map((i) => ({
        nom: i.product.nom,
        marque: i.product.marque,
        taille: i.taille,
        prix: i.product.prix * i.quantite,
        imageUrl: i.product.imageUrl,
      })),
      livraison: { mode: livraison.mode, libelle, prix: Number(fraisParEnvoi.toFixed(2)) },
      total: Number((sousTotal + fraisParEnvoi).toFixed(2)),
      createdAt: maintenant,
    };
  });
  ecrire(cle(userId), [...nouvelles, ...lire<Stocke[]>(cle(userId), [])]);
  return nouvelles.map(hydrater);
}

/** Commandes d'exemple pour que le tableau de bord ne soit pas vide en démo. */
export function seedOrders(userId: string) {
  if (lire<Stocke[]>(cle(userId), []).length > 0) return;
  const ilYa = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const exemples: Stocke[] = [
    {
      orderId: "cmd_demo1",
      h_session_id: "hsess_demo1",
      agentViewUrl: "https://example.com/agent-view/cmd_demo1",
      marchand: "Zara",
      mode: "invite",
      articles: [
        {
          nom: "Blazer noir coupe droite",
          marque: "Zara",
          taille: "M",
          prix: 69.95,
          imageUrl: "https://example.com/buyfit/zara-blazer.jpg",
        },
      ],
      livraison: {
        mode: "relais",
        libelle: "Tabac de la Mairie — 12 rue de la République",
        prix: 2.95,
      },
      total: 72.9,
      createdAt: ilYa(30),
      statutFige: "commandee",
      messageFige: "Commande passée. Numéro Zara : 5402-118.",
    },
    {
      orderId: "cmd_demo2",
      h_session_id: "hsess_demo2",
      agentViewUrl: "https://example.com/agent-view/cmd_demo2",
      marchand: "COS",
      mode: "compte",
      articles: [
        {
          nom: "Pull torsadé en laine",
          marque: "COS",
          taille: "S",
          prix: 115,
          imageUrl: "https://example.com/buyfit/cos-pull.jpg",
        },
      ],
      livraison: { mode: "domicile", libelle: "Adresse enregistrée", prix: 4.95 },
      total: 119.95,
      createdAt: ilYa(72),
      statutFige: "echec",
      messageFige: "Taille S en rupture au moment de la commande.",
    },
  ];
  ecrire(cle(userId), exemples);
}
