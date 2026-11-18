/**
 * Magasins qui bloquent les achats par agent (vérification anti-robot) : on n'essaie pas de
 * contourner leur protection. Le bouton « Acheter sur <magasin> » ouvre la fiche produit et
 * l'utilisateur finit l'achat lui-même. Les autres magasins passent par l'agent H Company,
 * qui s'arrête aussi de lui-même s'il tombe sur un CAPTCHA (motif `site_bloque`).
 */
const HANDOFF_STORES = new Set(["mango"]);

export const isHandoffStore = (marque: string) => HANDOFF_STORES.has(marque.trim().toLowerCase());
