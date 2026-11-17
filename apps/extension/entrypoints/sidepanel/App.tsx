import {
  ORDER_TERMINAL_STATUTS,
  type InspirationCapture,
  type OrderStatus,
  type ProductMatch,
  type TryOnResult,
} from "@buyfit/shared";
import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { api, USE_MOCK } from "@/lib/api";
import { CAPTURE_STORAGE_KEY } from "@/lib/messages";
import { Home } from "./Home";
import { Wordmark } from "./Logo";

// TODO(ibrahim) : remplacer par l'utilisateur connecté (auth Supabase via apps/web).
const USER_ID = "demo-user";
const POLL_MS = 3000;
/** Ouvert dans le panneau du logo flottant (iframe sur Pinterest). */
const EMBEDDED = new URLSearchParams(location.search).get("mode") === "embed";

type Phase =
  | { kind: "idle" }
  | { kind: "searching"; capture: InspirationCapture }
  | { kind: "results"; capture: InspirationCapture; matches: ProductMatch[] }
  | { kind: "error"; message: string };

const price = (p: ProductMatch) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: p.devise }).format(p.prix);

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // budgetMax absent (clic droit) → l'API prend le budget du profil.
  const search = useCallback(
    async (capture: InspirationCapture, budgetMax?: number, requetesSecours?: string[]) => {
    setPhase({ kind: "searching", capture });
    try {
      const matches = await api.capture({
        userId: USER_ID,
        capture,
        ...(budgetMax ? { budgetMax } : {}),
        ...(requetesSecours?.length ? { requetesSecours } : {}),
      });
      setPhase({ kind: "results", capture, matches });
    } catch (e) {
      setPhase({ kind: "error", message: errMsg(e) });
    }
    },
    [],
  );

  const reset = () => {
    void browser.storage.session.remove(CAPTURE_STORAGE_KEY);
    setPhase({ kind: "idle" });
  };

  // Le background dépose la capture dans storage.session : on lit l'existante puis on écoute.
  useEffect(() => {
    void browser.storage.session.get(CAPTURE_STORAGE_KEY).then((r) => {
      const c = r[CAPTURE_STORAGE_KEY] as InspirationCapture | undefined;
      if (c) void search(c);
    });
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      const c = changes[CAPTURE_STORAGE_KEY]?.newValue as InspirationCapture | undefined;
      if (area === "session" && c) void search(c);
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, [search]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <Wordmark />
        </h1>
        {USE_MOCK && <span className="badge">mock</span>}
        <div className="topbar-actions">
          {phase.kind !== "idle" && (
            <button type="button" className="btn ghost small" onClick={reset}>
              Nouvelle recherche
            </button>
          )}
          {EMBEDDED && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Fermer BuyFit"
              onClick={() => window.parent.postMessage({ type: "buyfit:close" }, "*")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {phase.kind === "idle" && <Home userId={USER_ID} />}

      {phase.kind !== "idle" && (
        <main className="content">
      {phase.kind === "searching" && (
        <>
          <img className="inspiration" src={phase.capture.imageUrl} alt="Inspiration" />
          <p className="loading">Recherche d'équivalents dans ton budget…</p>
        </>
      )}

      {phase.kind === "error" && <p className="error">Erreur : {phase.message}</p>}

      {phase.kind === "results" && (
        <>
          <img className="inspiration" src={phase.capture.imageUrl} alt="Inspiration" />
          {phase.matches.length === 0 && <p className="hint">Aucun équivalent dans ton budget.</p>}
          {phase.matches.length > 0 && (
            <div className="results-row">
              {phase.matches.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </>
      )}
        </main>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: ProductMatch }) {
  const [tryOn, setTryOn] = useState<TryOnResult | "loading" | null>(null);
  const [taille, setTaille] = useState(product.tailleDisponibles[0] ?? "");
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doTryOn = async () => {
    setError(null);
    setTryOn("loading");
    try {
      setTryOn(await api.tryOn({ userId: USER_ID, garmentImageUrl: product.imageUrl }));
    } catch (e) {
      setTryOn(null);
      setError(errMsg(e));
    }
  };

  const doOrder = async () => {
    setError(null);
    try {
      setOrder(
        await api.order({
          userId: USER_ID,
          productId: product.id,
          productUrl: product.url,
          taille: taille.trim(),
        }),
      );
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const doConfirm = async () => {
    if (!order) return;
    try {
      setOrder(await api.confirmOrder(order.orderId));
    } catch (e) {
      setError(errMsg(e));
    }
  };

  // Suivi de la session H Company jusqu'à un statut terminal.
  const orderId = order?.orderId;
  const terminal = order ? ORDER_TERMINAL_STATUTS.includes(order.statut) : true;
  useEffect(() => {
    if (!orderId || terminal) return;
    const t = setInterval(() => {
      api.getOrder(orderId).then(setOrder, (e: unknown) => setError(errMsg(e)));
    }, POLL_MS);
    return () => clearInterval(t);
  }, [orderId, terminal]);

  return (
    <article className="card">
      <img src={tryOn && tryOn !== "loading" ? tryOn.resultImageUrl : product.imageUrl} alt="" />
      <div className="body">
        <div className="brand">{product.marque}</div>
        <div className="name">{product.nom}</div>
        <div className="price">{price(product)}</div>

        {!order && (
          <div className="actions">
            <button onClick={doTryOn} disabled={tryOn === "loading"}>
              {tryOn === "loading" ? "Essayage…" : "Essayer"}
            </button>
            {product.tailleDisponibles.length > 0 ? (
              <select value={taille} onChange={(e) => setTaille(e.target.value)}>
                {product.tailleDisponibles.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            ) : (
              // Tailles inconnues (Google Shopping ne les donne pas) : saisie libre.
              <input
                className="size"
                value={taille}
                onChange={(e) => setTaille(e.target.value)}
                placeholder="Taille"
                aria-label="Taille"
                size={5}
              />
            )}
            <button className="primary" onClick={doOrder} disabled={!taille.trim()}>
              Acheter
            </button>
          </div>
        )}

        {order && (
          <div className={`order ${order.statut}`}>
            <div>
              <b>{order.statut.replace("_", " ")}</b>
              {order.message && <> — {order.message}</>}
            </div>
            {order.agentViewUrl && (
              <a href={order.agentViewUrl} target="_blank" rel="noreferrer">
                Voir l'agent en direct
              </a>
            )}
            {order.statut === "confirmation_requise" && (
              <button className="primary" onClick={doConfirm}>
                Confirmer l'achat ({price(product)})
              </button>
            )}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </article>
  );
}
