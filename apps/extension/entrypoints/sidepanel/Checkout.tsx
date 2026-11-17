import { ORDER_TERMINAL_STATUTS, type OrderStatus, type ProductMatch } from "@buyfit/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Spinner } from "./Spinner";

const POLL_MS = 2500;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type StepState = "todo" | "active" | "waiting" | "done";

/**
 * Achat par l'agent H Company : page produit → panier → commande, puis deux pauses
 * pour l'utilisateur (mode de livraison, puis confirmation du paiement).
 */
export function Checkout({
  product,
  userId,
  size,
  onBack,
}: {
  product: ProductMatch;
  userId: string;
  size: string;
  onBack: () => void;
}) {
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [livraison, setLivraison] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Étapes déjà franchies côté utilisateur (l'agent peut mettre quelques secondes à repartir).
  const [deliveryDone, setDeliveryDone] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const started = useRef(false);

  // Lancement de l'agent (une seule fois, même en StrictMode).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api
      .order({ userId, productId: product.id, productUrl: product.url, taille: size })
      .then(setOrder, (e: unknown) => setError(errMsg(e)));
  }, [userId, product, size]);

  // Suivi de la session H jusqu'à un statut terminal.
  const orderId = order?.orderId;
  const terminal = order ? ORDER_TERMINAL_STATUTS.includes(order.statut) : false;
  useEffect(() => {
    if (!orderId || terminal) return;
    const t = setInterval(() => {
      api.getOrder(orderId).then(setOrder, (e: unknown) => setError(errMsg(e)));
    }, POLL_MS);
    return () => clearInterval(t);
  }, [orderId, terminal]);

  const pause = order?.statut === "confirmation_requise" ? order.etape : undefined;
  const failed = order?.statut === "echec" || (error !== null && !order);
  const done = order?.statut === "commandee";
  const atDelivery = pause === "livraison" && !deliveryDone;
  const atPayment = pause === "paiement" && !paymentDone;
  const pastCart = deliveryDone || pause !== undefined || paymentDone || done;
  const pastDelivery = (deliveryDone && pause === "paiement") || paymentDone || done;

  const steps: { label: string; state: StepState }[] = [
    { label: "Page produit, panier, commande", state: pastCart ? "done" : "active" },
    {
      label: "Livraison",
      state: pastDelivery ? "done" : atDelivery ? "waiting" : deliveryDone ? "active" : "todo",
    },
    { label: "Paiement", state: done ? "done" : atPayment ? "waiting" : paymentDone ? "active" : "todo" },
  ];

  const send = async (choice?: string) => {
    if (!order) return;
    setSending(true);
    setError(null);
    try {
      const next = await api.confirmOrder(order.orderId, choice);
      if (choice) setDeliveryDone(true);
      else setPaymentDone(true);
      setOrder(next);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  const options = order?.livraisons ?? [];

  return (
    <div className="screen">
      <div className="content checkout">
        <div className="piece">
          <img className="thumb" src={product.imageUrl} alt="" />
          <div>
            <div className="checkout-store">
              {product.marque} · Taille {size}
            </div>
            <div className="piece-name">{product.nom}</div>
          </div>
        </div>

        {done ? (
          <div className="status success">
            <div className="success-icon" aria-hidden="true">
              <CheckIcon />
            </div>
            <h2>Commande validée</h2>
            {order?.message && <p>{order.message}</p>}
          </div>
        ) : failed ? (
          <div className="status">
            <p className="error">{order?.message ?? error ?? "L'agent n'a pas pu terminer la commande."}</p>
          </div>
        ) : (
          <>
            <ol className="steps">
              {steps.map((s) => (
                <li key={s.label} className={`step-row ${s.state}`}>
                  <span className="step-dot" aria-hidden="true">
                    {s.state === "done" ? <CheckIcon /> : s.state === "active" ? <Spinner /> : null}
                  </span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>

            {atDelivery && (
              <fieldset className="delivery">
                <legend>Choisis ta livraison</legend>
                {options.map((o) => (
                  <label key={o.id} className={`delivery-opt${livraison === o.id ? " on" : ""}`}>
                    <input
                      type="radio"
                      name="livraison"
                      value={o.id}
                      checked={livraison === o.id}
                      onChange={() => setLivraison(o.id)}
                    />
                    <span className="delivery-label">
                      {o.label}
                      {o.delai && <small>{o.delai}</small>}
                    </span>
                    {o.prix && <span className="delivery-price">{o.prix}</span>}
                  </label>
                ))}
              </fieldset>
            )}

            {atPayment && (
              <div className="pay-recap">
                {order?.message && <p>{order.message}</p>}
                {order?.total && (
                  <div className="pay-total">
                    <span>Total</span>
                    <b>{order.total}</b>
                  </div>
                )}
              </div>
            )}

            {!atDelivery && !atPayment && order?.message && <p className="checkout-msg">{order.message}</p>}
            {error && <p className="error">{error}</p>}
          </>
        )}

        {order?.agentViewUrl && !done && (
          <a className="link-btn agent-link" href={order.agentViewUrl} target="_blank" rel="noreferrer">
            Voir l'agent en direct ↗
          </a>
        )}
      </div>

      <footer className="actions-bar">
        {atDelivery ? (
          <button
            type="button"
            className="btn primary"
            disabled={!livraison || sending}
            onClick={() => void send(livraison!)}
          >
            {sending ? <Spinner light /> : "Continuer"}
          </button>
        ) : atPayment ? (
          <button type="button" className="btn primary" disabled={sending} onClick={() => void send()}>
            {sending ? <Spinner light /> : `Confirmer le paiement${order?.total ? ` · ${order.total}` : ""}`}
          </button>
        ) : (
          <button type="button" className="btn secondary" onClick={onBack}>
            {done || failed ? "Retour aux résultats" : "Retour (l'agent continue)"}
          </button>
        )}
      </footer>
    </div>
  );
}

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);
