/**
 * Sélection « à l'écran » façon Google Lens, directement sur la page Pinterest :
 * un voile couvre la page, l'utilisateur entoure la pièce qui l'intéresse, et on retrouve
 * l'image d'épingle sous la zone. On renvoie l'URL de l'image en grand format + la zone en
 * coordonnées normalisées DANS l'image : l'extension la découpe ensuite en haute définition
 * (pas de capture d'écran → pas de permission <all_urls>).
 */
import type { NormRect } from "./crop";
import { largestFromSrcset, upgradePinimgUrl } from "./pinimg";

export interface ScreenSelection {
  imageUrl: string;
  rect: NormRect;
}

const MIN_PX = 24;

const CSS = `
:host { all: initial; }
.veil { position: fixed; inset: 0; z-index: 2147483647; cursor: none; touch-action: none;
  background: rgba(17,17,17,.35); font-family: Inter, system-ui, sans-serif; }
.veil.drawing { background: transparent; }
.hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); pointer-events: none;
  padding: 10px 16px; border-radius: 999px; background: #111; color: #fff; font-size: 14px; font-weight: 600;
  box-shadow: 0 8px 24px rgba(17,17,17,.3); white-space: nowrap; }
.hint b { color: #F3D6DB; }
.hint.error { background: #B3261E; }
.dot { position: fixed; left: 0; top: 0; width: 12px; height: 12px; margin: -6px 0 0 -6px;
  border-radius: 50%; background: #fff; pointer-events: none; opacity: 0; will-change: transform;
  box-shadow: 0 0 0 2px #7A1F2B, 0 0 10px 4px rgba(122,31,43,.85), 0 0 24px 10px rgba(122,31,43,.45);
  transition: opacity .12s ease, width .12s ease, height .12s ease, margin .12s ease; }
.dot.on { opacity: 1; }
.dot.down { width: 8px; height: 8px; margin: -4px 0 0 -4px; }
@media (prefers-reduced-motion: reduce) { .dot { transition: none; } }
.rect { position: fixed; border: 2px solid #fff; border-radius: 8px; pointer-events: none;
  box-shadow: 0 0 0 2px #7A1F2B, 0 0 0 9999px rgba(17,17,17,.45); }
`;

export function startScreenSelection(): Promise<ScreenSelection | null> {
  return new Promise((resolve) => {
    const host = document.createElement("buyfit-select");
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>${CSS}</style>
      <div class="veil" role="dialog" aria-label="Sélection d'une pièce">
        <div class="hint">Entoure la pièce qui t'intéresse · <b>Échap</b> pour annuler</div>
        <div class="dot" aria-hidden="true"></div>
      </div>`;
    document.documentElement.append(host);
    const veil = root.querySelector<HTMLDivElement>(".veil")!;
    const hint = root.querySelector<HTMLDivElement>(".hint")!;
    // Curseur : point blanc lumineux à halo bordeaux (le curseur système est masqué).
    const dot = root.querySelector<HTMLDivElement>(".dot")!;
    const moveDot = (e: PointerEvent) => {
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      dot.classList.add("on");
    };
    veil.addEventListener("pointermove", moveDot);
    veil.addEventListener("pointerleave", () => dot.classList.remove("on"));
    let rectEl: HTMLDivElement | null = null;
    let start: { x: number; y: number } | null = null;

    const finish = (result: ScreenSelection | null) => {
      window.removeEventListener("keydown", onKey, true);
      host.remove();
      resolve(result);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        finish(null);
      }
    };
    window.addEventListener("keydown", onKey, true);

    const box = (e: PointerEvent) => {
      const s = start!;
      return {
        left: Math.min(s.x, e.clientX),
        top: Math.min(s.y, e.clientY),
        width: Math.abs(e.clientX - s.x),
        height: Math.abs(e.clientY - s.y),
      };
    };

    veil.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      veil.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY };
      dot.classList.add("down");
      veil.classList.add("drawing");
      rectEl?.remove();
      rectEl = document.createElement("div");
      rectEl.className = "rect";
      veil.insertBefore(rectEl, dot); // le point reste au-dessus du voile
    });
    veil.addEventListener("pointermove", (e) => {
      if (!start || !rectEl) return;
      const b = box(e);
      Object.assign(rectEl.style, {
        left: `${b.left}px`,
        top: `${b.top}px`,
        width: `${b.width}px`,
        height: `${b.height}px`,
      });
    });
    veil.addEventListener("pointerup", (e) => {
      if (!start) return;
      const b = box(e);
      start = null;
      dot.classList.remove("down");
      veil.classList.remove("drawing");
      if (b.width < MIN_PX || b.height < MIN_PX) {
        rectEl?.remove();
        rectEl = null;
        return;
      }
      // Le voile masque la page pendant la recherche d'image sous la zone.
      host.style.display = "none";
      const found = imageUnder(b);
      host.style.display = "";
      if (!found) {
        hint.classList.add("error");
        hint.textContent = "Aucune image d'épingle ici : entoure une photo · Échap pour annuler";
        rectEl?.remove();
        rectEl = null;
        return;
      }
      finish(found);
    });
  });
}

type Box = { left: number; top: number; width: number; height: number };

/** Image de la page qui recouvre le plus la zone, et la zone exprimée dans cette image. */
function imageUnder(sel: Box): ScreenSelection | null {
  let best: { img: HTMLImageElement; area: number } | null = null;
  for (const img of Array.from(document.images)) {
    if (!img.complete || !img.naturalWidth || !/^https?:/.test(img.currentSrc || img.src)) continue;
    const r = img.getBoundingClientRect();
    const w = Math.min(sel.left + sel.width, r.right) - Math.max(sel.left, r.left);
    const h = Math.min(sel.top + sel.height, r.bottom) - Math.max(sel.top, r.top);
    if (w <= 0 || h <= 0) continue;
    const area = w * h;
    if (!best || area > best.area) best = { img, area };
  }
  if (!best || best.area < (sel.width * sel.height) / 4) return null;

  const { img } = best;
  const r = img.getBoundingClientRect();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  // Taille réellement peinte de l'image selon object-fit (Pinterest recadre souvent en « cover »).
  const fit = getComputedStyle(img).objectFit;
  let sx = r.width / nw;
  let sy = r.height / nh;
  if (fit === "cover") sx = sy = Math.max(sx, sy);
  else if (fit === "contain" || fit === "scale-down") sx = sy = Math.min(sx, sy, fit === "scale-down" ? 1 : Infinity);
  else if (fit === "none") sx = sy = 1;
  const ox = r.left + (r.width - nw * sx) / 2;
  const oy = r.top + (r.height - nh * sy) / 2;

  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const x0 = clamp((sel.left - ox) / (nw * sx));
  const y0 = clamp((sel.top - oy) / (nh * sy));
  const x1 = clamp((sel.left + sel.width - ox) / (nw * sx));
  const y1 = clamp((sel.top + sel.height - oy) / (nh * sy));
  if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return null;

  const src = largestFromSrcset(img.getAttribute("srcset")) ?? img.currentSrc ?? img.src;
  return { imageUrl: upgradePinimgUrl(src), rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}
