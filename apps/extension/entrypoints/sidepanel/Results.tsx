import type { ProductMatch } from "@buyfit/shared";
import { useEffect, useState } from "react";
import { startPurchase } from "@/lib/purchase";
import type { Piece } from "./Home";
import { Spinner } from "./Spinner";

export type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; resultats: ProductMatch[] }
  | { kind: "error"; message: string };

const price = (p: ProductMatch) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: p.devise }).format(p.prix);

/**
 * Écran de résultats : la pièce sélectionnée en tête, puis les articles les plus ressemblants
 * un par un (flèches gauche / droite). « Relancer la recherche » ramène à l'épingle.
 */
export function Results({
  piece,
  search,
  userId,
  size,
  onRestart,
  onRetry,
}: {
  piece: Piece;
  search: SearchState;
  userId: string;
  size: string | null;
  onRestart: () => void;
  onRetry?: (() => void) | undefined;
}) {
  const buy = (p: ProductMatch) => void startPurchase(p, size ?? "M", userId);
  return (
    <div className="screen">
      <div className="content">
        <div className="piece">
          <img className="thumb" src={piece.cropUrl} alt="Pièce sélectionnée" />
          <div className="piece-name">
            {piece.kind === "ready" ? piece.item.nom : piece.kind === "loading" ? "Analyse de la pièce…" : "Pièce non reconnue"}
          </div>
        </div>

        {piece.kind === "error" ? (
          <Status text={piece.message} error />
        ) : search.kind === "error" ? (
          <Status text={search.message} error action={onRetry && { label: "Réessayer", onClick: onRetry }} />
        ) : search.kind === "ready" ? (
          search.resultats.length ? (
            <Carousel
              key={search.resultats.map((r) => r.id).join()}
              items={search.resultats}
              onBuy={buy}
            />
          ) : (
            <Status text="Aucun article assez ressemblant chez Zara, Mango ou Uniqlo." />
          )
        ) : (
          <div className="status">
            <Spinner large />
            <p>{piece.kind === "loading" ? "On reconnaît la pièce…" : "Recherche chez Zara, Mango et Uniqlo…"}</p>
          </div>
        )}
      </div>

      <footer className="actions-bar">
        <button type="button" className="btn secondary" onClick={onRestart}>
          <RestartIcon /> Relancer la recherche
        </button>
      </footer>
    </div>
  );
}

function Status({
  text,
  error = false,
  action,
}: {
  text: string;
  error?: boolean;
  action?: { label: string; onClick: () => void } | undefined;
}) {
  return (
    <div className="status">
      <p className={error ? "error" : ""}>{text}</p>
      {action && (
        <button type="button" className="btn ghost small" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function Carousel({ items, onBuy }: { items: ProductMatch[]; onBuy: (p: ProductMatch) => void }) {
  const [i, setI] = useState(0);
  const p = items[Math.min(i, items.length - 1)]!;
  const go = (d: number) => setI((cur) => (cur + d + items.length) % items.length);

  // Flèches du clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section className="carousel" aria-roledescription="carrousel" aria-label="Articles ressemblants">
      <div className="slide-wrap">
        {items.length > 1 && (
          <button type="button" className="arrow prev" aria-label="Article précédent" onClick={() => go(-1)}>
            <Chevron dir="left" />
          </button>
        )}
        <article key={p.id} className="slide">
          <a className="slide-media" href={p.url} target="_blank" rel="noreferrer">
            <img src={p.imageUrl} alt={p.nom} />
            <span className="store">{p.marque}</span>
          </a>
          <div className="slide-body">
            <div className="slide-name">{p.nom}</div>
            <div className="slide-foot">
              <span className="price">{p.prix > 0 ? price(p) : ""}</span>
              <a className="see" href={p.url} target="_blank" rel="noreferrer">
                {p.prix > 0 ? "Voir" : "Voir le prix"} <ExternalIcon />
              </a>
            </div>
            <button type="button" className="btn primary buy" onClick={() => onBuy(p)}>
              Acheter
            </button>
          </div>
        </article>
        {items.length > 1 && (
          <button type="button" className="arrow next" aria-label="Article suivant" onClick={() => go(1)}>
            <Chevron dir="right" />
          </button>
        )}
      </div>
      {items.length > 1 && (
        <div className="dots" aria-hidden="true">
          {items.map((it, k) => (
            <span key={it.id} className={k === i ? "on" : ""} />
          ))}
        </div>
      )}
    </section>
  );
}

const icon = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg {...icon} width={20} height={20}>
    <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
  </svg>
);
const ExternalIcon = () => (
  <svg {...icon} width={14} height={14}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </svg>
);
const RestartIcon = () => (
  <svg {...icon} width={16} height={16}>
    <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5" />
  </svg>
);
