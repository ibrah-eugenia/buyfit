import type { ProductMatch } from "@buyfit/shared";
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";

export type Fitting =
  | { kind: "loading" }
  | { kind: "ready"; url: string; zone?: Zone }
  | { kind: "error"; message: string };

type Zone = "haut" | "bas" | "veste" | "robe" | "chaussures";
/** Cadrage par zone (analyse IA du produit) sur une photo en pied 3:4 : centre en %, zoom. */
const ZONE_FOCUS: Record<Zone, { x: number; y: number; scale: number }> = {
  haut: { x: 50, y: 36, scale: 1.9 },
  veste: { x: 50, y: 38, scale: 1.75 },
  bas: { x: 50, y: 68, scale: 1.7 },
  robe: { x: 50, y: 50, scale: 1.35 },
  chaussures: { x: 50, y: 91, scale: 2.6 },
};

/** Zone de la pièce sur une photo en pied 3:4 (centre en %, et zoom pour la cadrer). */
const BAS = /pantalon|jean|short|chino|jogging|jupe|bermuda|legging|cargo/i;
const PIEDS = /chaussure|basket|sneaker|botte|bottine|mocassin|sandale|derby/i;
export function focusFor(
  categorie?: string,
  nom?: string,
): { x: number; y: number; scale: number } {
  const t = `${categorie ?? ""} ${nom ?? ""}`;
  if (PIEDS.test(t)) return { x: 50, y: 90, scale: 2.6 };
  if (BAS.test(t)) return { x: 50, y: 66, scale: 1.7 };
  return { x: 50, y: 34, scale: 1.9 }; // haut, veste, pull, chemise…
}

const LOADING_STEPS = [
  "Analyse de la pièce",
  "Ajustement à ta silhouette",
  "Rendu des plis et de la matière",
  "Finitions",
];

/**
 * Essayage 2D : arrive cadré sur la pièce essayée, puis dézoome en douceur sur la tenue entière.
 * Molette / pincement pour zoomer, glisser pour se déplacer, double-clic pour basculer.
 */
export function TryOnViewer({
  product,
  categorie,
  fitting,
  onRetry,
  onEditAvatar,
}: {
  product: ProductMatch;
  categorie?: string | undefined;
  fitting: Fitting;
  onRetry: () => void;
  onEditAvatar: () => void;
}) {
  if (fitting.kind === "loading") return <FittingLoader product={product} />;
  if (fitting.kind === "error")
    return (
      <div className="fit-stage fit-error" role="alert">
        <p>{fitting.message}</p>
        {/mannequin/i.test(fitting.message) ? (
          <button type="button" className="btn ghost small" onClick={onEditAvatar}>
            Créer mon mannequin
          </button>
        ) : (
          <button type="button" className="btn ghost small" onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    );
  return (
    <FittingImage
      key={fitting.url}
      url={fitting.url}
      product={product}
      focus={fitting.zone ? ZONE_FOCUS[fitting.zone] : focusFor(categorie, product.nom)}
      onEditAvatar={onEditAvatar}
    />
  );
}

function FittingLoader({ product }: { product: ProductMatch }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 4500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fit-stage fit-loading" role="status" aria-live="polite">
      <img className="fit-ghost" src={product.imageUrl} alt="" aria-hidden="true" />
      <div className="fit-scan" aria-hidden="true" />
      <div className="fit-loading-text">
        <strong>Essayage en cours</strong>
        <span key={step} className="fit-step">
          {LOADING_STEPS[step]}…
        </span>
        <div className="fit-progress" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  );
}

type View = { scale: number; x: number; y: number }; // x / y : origine du zoom en %

function FittingImage({
  url,
  product,
  focus,
  onEditAvatar,
}: {
  url: string;
  product: ProductMatch;
  focus: { x: number; y: number; scale: number };
  onEditAvatar: () => void;
}) {
  const piece: View = { scale: focus.scale, x: focus.x, y: focus.y };
  const full: View = { scale: 1, x: 50, y: 50 };
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>(piece);
  const [animate, setAnimate] = useState(true);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  // Révélation : net sur la pièce, puis dézoom automatique sur la tenue entière.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      setAnimate(true);
      setView(full);
    }, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const zoomed = view.scale > 1.05;
  const goTo = (v: View) => {
    setAnimate(true);
    setView(v);
  };
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  const onWheel = (e: WheelEvent) => {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect) return;
    setAnimate(false);
    const scale = clamp(view.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 3.5);
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setView(scale === 1 ? full : { scale, x, y });
  };
  const onPointerDown = (e: PointerEvent) => {
    if (!zoomed) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
    setAnimate(false);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    const rect = stage.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const k = 100 / (view.scale - 1 || 1);
    setView((v) => ({
      ...v,
      x: clamp(d.x - ((e.clientX - d.px) / rect.width) * k, 0, 100),
      y: clamp(d.y - ((e.clientY - d.py) / rect.height) * k, 0, 100),
    }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="fit-wrap">
      <div
        ref={stage}
        className={`fit-stage fit-ready${loaded ? " in" : ""}${zoomed ? " zoomed" : ""}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => goTo(zoomed ? full : piece)}
      >
        <img
          src={url}
          alt={`${product.nom} essayé sur ton mannequin`}
          draggable={false}
          onLoad={() => setLoaded(true)}
          style={{
            transform: `scale(${view.scale})`,
            transformOrigin: `${view.x}% ${view.y}%`,
            transition: `opacity 0.6s ease, filter 0.9s ease${
              animate ? ", transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)" : ""
            }`,
          }}
        />
        <span className="fit-badge">Sur toi</span>
        <button type="button" className="fit-edit" onClick={onEditAvatar}>
          Modifier mon mannequin
        </button>
      </div>
      <div className="fit-controls" role="group" aria-label="Zoom">
        <button type="button" aria-pressed={zoomed} onClick={() => goTo(piece)}>
          Zoom sur la pièce
        </button>
        <button type="button" aria-pressed={!zoomed} onClick={() => goTo(full)}>
          Tenue entière
        </button>
      </div>
    </div>
  );
}
