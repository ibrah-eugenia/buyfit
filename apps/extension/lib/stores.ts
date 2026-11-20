/**
 * Magasins qui bloquent les achats par agent (vérification anti-robot) : on n'essaie pas de
 * contourner leur protection. Le bouton « Acheter sur <magasin> » ouvre la fiche produit et
 * l'utilisateur finit l'achat lui-même. Les autres magasins passent par l'agent H Company,
 * qui s'arrête aussi de lui-même s'il tombe sur un CAPTCHA (motif `site_bloque`).
 */
const HANDOFF_STORES = new Set<string>([]);

/** Page panier de chaque magasin (ouverte après l'ajout par l'agent). */
const CART_URLS: Record<string, string> = {
  zara: "https://www.zara.com/fr/fr/shop/cart",
  uniqlo: "https://www.uniqlo.com/fr/fr/cart",
};
export const cartUrl = (marque: string, fallback: string) =>
  CART_URLS[marque.trim().toLowerCase()] ?? fallback;

export const isHandoffStore = (marque: string) => HANDOFF_STORES.has(marque.trim().toLowerCase());
