import { useEffect, useRef, useState } from "react";
import type { NormRect } from "@/lib/crop";

const MIN_SIDE = 0.06; // sélection trop petite = bruit

/**
 * Sélection d'une pièce sur l'image de l'épingle : l'utilisateur trace un rectangle
 * (souris ou doigt) autour du vêtement qui l'intéresse.
 */
export function PieceSelector({
  imageUrl,
  alt,
  onCancel,
  onConfirm,
}: {
  imageUrl: string;
  alt: string;
  onCancel: () => void;
  onConfirm: (rect: NormRect) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<NormRect | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  // L'image remplit la place disponible sans dépasser (pas de défilement vertical).
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setStage({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = natural.w && stage.w ? Math.min(stage.w / natural.w, stage.h / natural.h) : 0;
  const imgSize = scale
    ? { width: natural.w * scale, height: natural.h * scale }
    : { maxWidth: "100%", maxHeight: "100%" };

  const point = (e: React.PointerEvent) => {
    const b = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
    };
  };

  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = point(e);
    setRect({ ...start.current, w: 0, h: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const p = point(e);
    const s = start.current;
    setRect({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };
  const onUp = () => {
    start.current = null;
  };

  const valid = rect !== null && rect.w >= MIN_SIDE && rect.h >= MIN_SIDE;
  const pct = (n: number) => `${n * 100}%`;

  return (
    <div className="selector">
      <p className="selector-hint">Entoure la pièce qui t'intéresse.</p>
      <div className="selector-stage" ref={stageRef}>
        <div className="selector-frame">
          <img
            ref={imgRef}
            src={imageUrl}
            alt={alt}
            draggable={false}
            style={imgSize}
            onLoad={(e) =>
              setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
          />
          <div
            className="selector-layer"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-hidden="true"
          >
            {rect && rect.w > 0 && (
              <div
                className={`selector-rect${valid ? "" : " small"}`}
                style={{
                  left: pct(rect.x),
                  top: pct(rect.y),
                  width: pct(rect.w),
                  height: pct(rect.h),
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="selector-actions">
        <button type="button" className="btn secondary small" onClick={onCancel}>
          Annuler
        </button>
        <button
          type="button"
          className="btn primary small"
          disabled={!valid}
          onClick={() => rect && onConfirm(rect)}
        >
          Identifier cette pièce
        </button>
      </div>
    </div>
  );
}
