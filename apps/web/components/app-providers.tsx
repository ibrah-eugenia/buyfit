"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, SearchResult, Session, WebProfile } from "@/lib/types";
import { getProfile, getSession, signOut } from "@/lib/data";

/* ---------------------------- Session + profil ---------------------------- */

type SessionState = {
  session: Session | null;
  profile: WebProfile | null;
  /** true tant que la session et le profil sont en cours de lecture */
  loading: boolean;
  error: string | null;
  setSession: (s: Session | null) => void;
  setProfile: (p: WebProfile) => void;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession doit être utilisé dans <AppProviders>");
  return ctx;
}

/* --------------------------------- Panier --------------------------------- */

type CartState = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (product: SearchResult, taille: string) => void;
  remove: (lineId: string) => void;
  setTaille: (lineId: string, taille: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé dans <AppProviders>");
  return ctx;
}

const CART_KEY = "buyfit:panier";

function lirePanier(): CartItem[] {
  try {
    const brut = window.localStorage.getItem(CART_KEY);
    return brut ? (JSON.parse(brut) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<WebProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getSession();
      setSession(s);
      setProfile(s ? await getProfile(s.userId) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Chargement initial depuis le stockage local (mock) : uniquement côté navigateur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    setItems(lirePanier());
    setCartReady(true);
  }, [reload]);

  useEffect(() => {
    if (!cartReady) return;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, cartReady]);

  const logout = useCallback(async () => {
    await signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const sessionValue = useMemo<SessionState>(
    () => ({ session, profile, loading, error, setSession, setProfile, reload, logout }),
    [session, profile, loading, error, reload, logout],
  );

  const cartValue = useMemo<CartState>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantite, 0),
      subtotal: items.reduce((s, i) => s + i.product.prix * i.quantite, 0),
      add: (product, taille) =>
        setItems((prev) => {
          const lineId = `${product.id}:${taille}`;
          const existe = prev.find((i) => i.lineId === lineId);
          if (existe)
            return prev.map((i) => (i.lineId === lineId ? { ...i, quantite: i.quantite + 1 } : i));
          return [...prev, { lineId, product, taille, quantite: 1 }];
        }),
      remove: (lineId) => setItems((prev) => prev.filter((i) => i.lineId !== lineId)),
      setTaille: (lineId, taille) =>
        setItems((prev) =>
          prev.map((i) =>
            i.lineId === lineId ? { ...i, taille, lineId: `${i.product.id}:${taille}` } : i,
          ),
        ),
      clear: () => setItems([]),
    }),
    [items],
  );

  return (
    <SessionContext.Provider value={sessionValue}>
      <CartContext.Provider value={cartValue}>{children}</CartContext.Provider>
    </SessionContext.Provider>
  );
}
