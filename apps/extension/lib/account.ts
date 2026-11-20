/**
 * Compte BuyFit de l'utilisateur, lu sur le site (cookies de session, permission d'hôte) :
 * aucune clé ni mot de passe dans l'extension. Pas connecté → bouton qui ouvre la page de
 * connexion du site ; le panneau relit le compte quand il reprend le focus.
 */
import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { z } from "zod";
import { webFetch } from "./web-fetch";

const WEB_URL = import.meta.env.WXT_WEB_URL;

const AccountSchema = z.object({
  userId: z.string().min(1),
  email: z.string().nullable(),
  prenom: z.string().nullable(),
  genre: z.string().nullable(),
  tailles: z.object({
    haut: z.string().optional(),
    bas: z.string().optional(),
    veste: z.string().optional(),
    pointure: z.string().optional(),
  }),
  avatarUrl: z.string().nullable().optional(),
  onboardingTermine: z.boolean(),
});
export type Account = z.infer<typeof AccountSchema>;

export type AccountState =
  | { kind: "loading" }
  | { kind: "signed-in"; account: Account }
  | { kind: "signed-out" }
  /** Site injoignable (pas lancé, hors ligne) : l'extension reste utilisable sans compte. */
  | { kind: "offline" };

export async function fetchAccount(): Promise<AccountState> {
  try {
    const res = await webFetch("/api/me");
    if (res.status === 401) return { kind: "signed-out" };
    if (res.status !== 200) return { kind: "offline" };
    const parsed = AccountSchema.safeParse(res.json);
    return parsed.success ? { kind: "signed-in", account: parsed.data } : { kind: "offline" };
  } catch {
    return { kind: "offline" };
  }
}

/** Ouvre une page du site dans un nouvel onglet (connexion, onboarding, réglages). */
export function openWeb(path: string) {
  void browser.tabs.create({ url: new URL(path, WEB_URL).toString() });
}

export function useAccount(): AccountState & { refresh: () => void } {
  const [state, setState] = useState<AccountState>({ kind: "loading" });
  const refresh = useCallback(() => {
    void fetchAccount().then(setState);
  }, []);
  useEffect(() => {
    refresh();
    // Retour sur le panneau après s'être connecté dans l'onglet du site.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    // Connexion faite dans un autre onglet : le panneau ne reprend pas forcément le focus.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 5000);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  return { ...state, refresh };
}

const BAS = /pantalon|jean|short|chino|jogging|jupe|bermuda|legging/i;
const VESTE = /veste|blazer|manteau|blouson|parka|doudoune|trench|caban|gilet|bomber/i;

/** Taille du compte adaptée à la pièce : pantalon → taille bas, veste → taille veste, sinon haut. */
export function sizeForPiece(tailles: Account["tailles"], categorie?: string): string | undefined {
  const c = categorie ?? "";
  if (BAS.test(c)) return tailles.bas ?? undefined;
  if (VESTE.test(c)) return tailles.veste ?? tailles.haut;
  return tailles.haut;
}
