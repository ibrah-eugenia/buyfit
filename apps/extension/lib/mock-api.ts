/** Faux apps/api pour développer l'extension sans back-end (WXT_USE_MOCK_API=true). */
import type { OrderStatus, ProductMatch } from "@buyfit/shared";
import type { BuyFitApi } from "./api";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PRODUCTS: ProductMatch[] = [
  {
    id: "mock-1",
    marque: "Zara",
    nom: "Blazer oversize en laine mélangée",
    prix: 69.95,
    devise: "EUR",
    url: "https://www.zara.com/fr/",
    imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600",
    tailleDisponibles: ["XS", "S", "M", "L"],
    score: 0.94,
  },
  {
    id: "mock-2",
    marque: "Mango",
    nom: "Veste structurée boutonnée",
    prix: 59.99,
    devise: "EUR",
    url: "https://shop.mango.com/fr",
    imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600",
    tailleDisponibles: ["S", "M", "L"],
    score: 0.88,
  },
  {
    id: "mock-3",
    marque: "COS",
    nom: "Manteau court droit",
    prix: 79,
    devise: "EUR",
    url: "https://www.cos.com/fr-fr/",
    imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600",
    tailleDisponibles: ["34", "36", "38", "40"],
    score: 0.81,
  },
];

const orders = new Map<string, { startedAt: number; deliveryAt?: number; confirmedAt?: number }>();
const LIVRAISONS = [
  { id: "standard", label: "Livraison standard", prix: "Gratuit", delai: "3 à 5 jours ouvrés" },
  { id: "express", label: "Livraison express", prix: "6,95 €", delai: "24 h" },
  { id: "relais", label: "Point relais", prix: "2,95 €", delai: "2 à 4 jours ouvrés" },
];

function status(orderId: string): OrderStatus {
  const o = orders.get(orderId);
  const base = {
    orderId,
    h_session_id: `mock-session-${orderId}`,
    updatedAt: new Date().toISOString(),
  };
  if (!o) return { ...base, statut: "echec", message: "Commande inconnue" };
  if (o.confirmedAt) {
    return Date.now() - o.confirmedAt > 3000
      ? { ...base, statut: "commandee", message: "Commande n° MOCK-1234" }
      : { ...base, statut: "en_cours", message: "Validation du paiement…" };
  }
  if (o.deliveryAt) {
    return Date.now() - o.deliveryAt > 3000
      ? { ...base, statut: "confirmation_requise", etape: "paiement", message: "Veste croisée beige, taille L", total: "75,90 €" }
      : { ...base, statut: "en_cours", message: "L'agent finalise la commande…" };
  }
  const t = Date.now() - o.startedAt;
  if (t < 2000) return { ...base, statut: "en_attente" };
  if (t < 6000) return { ...base, statut: "en_cours", message: "L'agent ajoute l'article au panier…" };
  return { ...base, statut: "confirmation_requise", etape: "livraison", livraisons: LIVRAISONS };
}

export const mockApi: BuyFitApi = {
  async identify() {
    await wait(900);
    return {
      nom: "Blazer croisé en laine à carreaux bleu",
      requete: "blazer croisé laine carreaux bleu homme",
      requetesSecours: ["blazer carreaux bleu homme", "blazer bleu"],
      categorie: "veste",
      couleur: "bleu",
      matiere: "laine",
      genre: "homme",
    };
  },
  async serp(req) {
    await wait(1200);
    return { requete: req.requete, resultats: PRODUCTS };
  },
  async search() {
    await wait(1800);
    return {
      filtreIA: true,
      resultats: [
        { ...PRODUCTS[0]!, score: 0.9 },
        { ...PRODUCTS[1]!, score: 0.7 },
        { ...PRODUCTS[2]!, marque: "Uniqlo", url: "https://www.uniqlo.com/fr/", score: 0.6 },
      ],
    };
  },
  async capture(req) {
    await wait(1500);
    return req.budgetMax ? PRODUCTS.filter((p) => p.prix <= req.budgetMax!) : PRODUCTS;
  },
  async tryOn(req) {
    await wait(1500);
    return { resultImageUrl: req.garmentImageUrl, latencyMs: 1500 };
  },
  async order() {
    await wait(500);
    const id = crypto.randomUUID();
    orders.set(id, { startedAt: Date.now() });
    return status(id);
  },
  async getOrder(id) {
    return status(id);
  },
  async confirmOrder(id, livraison) {
    const o = orders.get(id);
    if (o && livraison) o.deliveryAt = Date.now();
    else if (o) o.confirmedAt = Date.now();
    return status(id);
  },
};
