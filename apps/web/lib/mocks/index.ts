/**
 * Point d'entrée unique des données du site.
 *
 * Tout est simulé (mocks typés) en attendant les fonctions de Thomas dans `lib/supabase/`.
 * Pour brancher le vrai back-end, il suffira de remplacer les exports de ce fichier :
 * les pages n'importent que depuis `@/lib/mocks`.
 *
 * Astuce démo : ajouter `?erreur=1` à l'URL pour afficher les états d'erreur.
 */
export * from "./auth";
export * from "./profile";
export * from "./search";
export * from "./delivery";
export * from "./orders";
export * from "./dashboard";
export { MARQUES, MARQUES_SUGGEREES, MARCHANDS } from "./brands";
export { MockError } from "./storage";
