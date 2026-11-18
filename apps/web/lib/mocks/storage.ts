/**
 * Petit stockage local pour les mocks (navigateur uniquement).
 * À remplacer par les fonctions de Thomas (`lib/supabase/`) quand elles existeront.
 */
const PREFIX = "buyfit:";

export function lire<T>(cle: string, defaut: T): T {
  if (typeof window === "undefined") return defaut;
  try {
    const brut = window.localStorage.getItem(PREFIX + cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

export function ecrire<T>(cle: string, valeur: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + cle, JSON.stringify(valeur));
  } catch {
    // Stockage plein ou bloqué (navigation privée) : on ignore, la démo continue en mémoire.
  }
}

export function effacer(cle: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + cle);
  } catch {
    // ignore
  }
}

/** Latence réseau simulée. */
export function attendre(ms = 600) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class MockError extends Error {}

/** Ajoute `?erreur=1` à l'URL pour voir les états d'erreur de toutes les pages. */
export function erreurSimulee(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("erreur") === "1";
}

export function id(prefixe: string) {
  return `${prefixe}_${Math.random().toString(36).slice(2, 10)}`;
}
