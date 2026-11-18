import { useState } from "react";
import {
  answer,
  clearPurchase,
  hidePurchase,
  isTerminal,
  pendingStep,
  retryWithSize,
  type Purchase,
} from "@/lib/purchase";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const formatPrice = (prix: number, devise: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise }).format(prix);
import { Spinner } from "./Spinner";

type StepState = "todo" | "active" | "waiting" | "done";

/**
 * Suivi de l'achat par l'agent H Company. L'agent travaille dans un onglet en arrière-plan ;
 * ici l'utilisateur répond aux pauses : livraison, paiement, puis validation bancaire si demandée.
 */
export function Checkout({ purchase }: { purchase: Purchase }) {
  const { product, size, order, error, sending } = purchase;
  const [livraison, setLivraison] = useState<string | null>(null);
  const [newSize, setNewSize] = useState<string | null>(null);
  const outOfStock = order?.statut === "echec" && order.motif === "rupture";
  const siteBlocked = order?.statut === "echec" && order.motif === "site_bloque";

  const step = pendingStep(purchase);
  const done = order?.statut === "commandee";
  const failed = order?.statut === "echec" || (error !== null && !order);
  const etape = order?.statut === "confirmation_requise" ? order.etape : undefined;
  const reached = (e: "livraison" | "paiement" | "banque") => {
    const order_ = ["livraison", "paiement", "banque"];
    const now = etape ? order_.indexOf(etape) : -1;
    return now > order_.indexOf(e);
  };

  const cart: StepState = purchase.deliveryDone || etape || done ? "done" : "active";
  const delivery: StepState =
    step === "livraison" ? "waiting" : reached("livraison") || purchase.paymentDone || done ? "done" : purchase.deliveryDone ? "active" : "todo";
  const payment: StepState =
    step === "paiement" || step === "banque"
      ? "waiting"
      : done
        ? "done"
        : purchase.paymentDone
          ? "active"
          : "todo";
  const steps: { label: string; state: StepState }[] = [
    { label: "Page produit, panier, commande", state: cart },
    { label: "Livraison", state: delivery },
    { label: step === "banque" ? "Validation bancaire" : "Paiement", state: payment },
  ];

  const options = order?.livraisons ?? [];
  const terminal = isTerminal(purchase) || failed;

  return (
    <div className="screen">
      <div className="content checkout">
        <div className="piece">
          <img className="thumb" src={product.imageUrl} alt="" />
          <div>
            <div className="checkout-store">
              {product.marque} · Taille {size}
              {purchase.sizeEquivalent && <> ({purchase.sizeEquivalent})</>}
              {product.prix > 0 && <> · {formatPrice(product.prix, product.devise)}</>}
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
            <p>Tu vas recevoir l'e-mail de confirmation de {product.marque}.</p>
          </div>
        ) : siteBlocked ? (
          <div className="status stock">
            <div className="stock-icon" aria-hidden="true">
              <ShieldIcon />
            </div>
            <h2>{product.marque} bloque les achats automatiques</h2>
            <p>
              Le site a affiché une vérification anti-robot : l'agent s'est arrêté sans la contourner.
              Finis l'achat toi-même, en taille {size}
              {purchase.sizeEquivalent && <> ({purchase.sizeEquivalent})</>}.
            </p>
          </div>
        ) : outOfStock ? (
          <div className="status stock">
            <div className="stock-icon" aria-hidden="true">
              <BoxIcon />
            </div>
            <h2>Rupture de stock</h2>
            <p>
              Cet article n'est plus disponible en taille {size} chez {product.marque}.
            </p>
            <div className="field">
              <span className="label">Essayer une autre taille</span>
              <div className="size-row" role="radiogroup" aria-label="Autre taille">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={newSize === s}
                    disabled={s === size}
                    className={`chip${newSize === s ? " on" : ""}`}
                    onClick={() => setNewSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
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

            {step === "livraison" && (
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

            {step === "paiement" && (
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

            {step === "banque" && (
              <div className="pay-recap bank">
                <BankIcon />
                <p>
                  Ta banque demande de confirmer le paiement. Valide-le dans ton application
                  bancaire, puis reviens ici.
                </p>
              </div>
            )}

            {!step && order?.message && <p className="checkout-msg">{order.message}</p>}
            {!step && <p className="checkout-msg">L'agent travaille dans un onglet en arrière-plan : tu peux continuer sur Pinterest.</p>}
            {error && <p className="error">{error}</p>}
          </>
        )}

        {order?.agentViewUrl && !terminal && (
          <a className="link-btn agent-link" href={order.agentViewUrl} target="_blank" rel="noreferrer">
            Voir l'agent en direct ↗
          </a>
        )}
      </div>

      <footer className="actions-bar">
        {step === "livraison" ? (
          <button
            type="button"
            className="btn primary"
            disabled={!livraison || sending}
            onClick={() => void answer(livraison!)}
          >
            {sending ? <Spinner light /> : "Continuer"}
          </button>
        ) : step === "paiement" ? (
          <button type="button" className="btn primary" disabled={sending} onClick={() => void answer()}>
            {sending ? <Spinner light /> : `Confirmer le paiement${order?.total ? ` · ${order.total}` : ""}`}
          </button>
        ) : step === "banque" ? (
          <button type="button" className="btn primary" disabled={sending} onClick={() => void answer()}>
            {sending ? <Spinner light /> : "J'ai validé dans mon appli"}
          </button>
        ) : siteBlocked ? (
          <div className="actions-row">
            <button type="button" className="btn secondary" onClick={clearPurchase}>
              Autre article
            </button>
            <a className="btn primary" href={product.url} target="_blank" rel="noreferrer">
              Finir sur {product.marque}
            </a>
          </div>
        ) : outOfStock ? (
          <div className="actions-row">
            <button type="button" className="btn secondary" onClick={clearPurchase}>
              Autre article
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!newSize}
              onClick={() => newSize && retryWithSize(newSize)}
            >
              {newSize ? `Acheter en ${newSize}` : "Choisis une taille"}
            </button>
          </div>
        ) : terminal ? (
          <button type="button" className="btn secondary" onClick={clearPurchase}>
            Retour aux résultats
          </button>
        ) : (
          <button type="button" className="btn secondary" onClick={hidePurchase}>
            Masquer · l'agent continue
          </button>
        )}
      </footer>
    </div>
  );
}

/** Bandeau compact quand l'écran d'achat est masqué. */
export function PurchaseBanner({ purchase, onShow }: { purchase: Purchase; onShow: () => void }) {
  const step = pendingStep(purchase);
  const done = purchase.order?.statut === "commandee";
  const failed = purchase.order?.statut === "echec";
  const outOfStock = failed && purchase.order?.motif === "rupture";
  const siteBlocked = failed && purchase.order?.motif === "site_bloque";
  const label = done
    ? "Commande validée"
    : outOfStock
      ? "Rupture de stock"
      : siteBlocked
        ? `Finis l'achat sur ${purchase.product.marque}`
      : failed
      ? "Commande interrompue"
      : step === "livraison"
        ? "Choisis ta livraison"
        : step === "paiement"
          ? "Confirme le paiement"
          : step === "banque"
            ? "Valide dans ton appli bancaire"
            : "Achat en cours…";
  return (
    <button type="button" className={`purchase-banner${step ? " attention" : ""}`} onClick={onShow}>
      {!step && !done && !failed ? <Spinner /> : <span className="banner-dot" aria-hidden="true" />}
      <span className="banner-text">
        <b>{label}</b>
        <small>
          {purchase.product.marque} · {purchase.product.nom}
        </small>
      </span>
      <span className="banner-cta">Voir</span>
    </button>
  );
}

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z" />
    <path d="M9 12h6" />
  </svg>
);
const BoxIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5v-9z" />
    <path d="M3 7.5l9 4.5 9-4.5M12 12v9M9 10.5l6-3" />
  </svg>
);
const BankIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M10 18h4M9.5 10.5l2 2 3.5-4" />
  </svg>
);
