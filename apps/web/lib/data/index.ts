/**
 * Point d'entrée unique des données du site.
 *
 * Branché sur Supabase : auth, profil, photos, comptes marchands (vault H Company), historique.
 * Encore simulés (lib/mocks) tant que apps/api n'est pas déployée : recherche, frais de
 * livraison, points relais et lancement des commandes.
 */
export { getSession, signIn, signOut, signUp } from "./auth";
export { connectMerchant, disconnectMerchant, getProfile, saveProfile } from "./profile";
export { getDashboard } from "./dashboard";
export { searchProducts } from "@/lib/mocks/search";
export { findRelayPoints, getDeliveryQuote } from "@/lib/mocks/delivery";
export { getOrders, placeOrders } from "@/lib/mocks/orders";
export { MARQUES, MARQUES_SUGGEREES } from "@/lib/mocks/brands";
