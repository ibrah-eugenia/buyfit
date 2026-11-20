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
.hand { position: fixed; left: 0; top: 0; width: 16px; height: 20px; margin: -1px 0 0 -6px;
  pointer-events: none; opacity: 0; will-change: transform; transform-origin: 6px 1px;
  filter: drop-shadow(0 1px 1.5px rgba(17,17,17,.55)); transition: opacity .12s ease; }
.hand.on { opacity: 1; }
.hand svg { display: block; width: 100%; height: 100%; transition: transform .1s ease; transform-origin: 6px 1px; }
.hand.down svg { transform: scale(.85); }
@media (prefers-reduced-motion: reduce) { .hand, .hand svg { transition: none; } }
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
        <div class="hand" aria-hidden="true"><svg viewBox="0 0 24 30" aria-hidden="true"><g fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"><rect x="6" y="11" width="16" height="12.5" rx="4.5"/><rect x="2.2" y="13" width="7.5" height="4.6" rx="2.3" transform="rotate(-28 6 15.3)"/><rect x="7" y="1" width="5" height="15.5" rx="2.5"/><rect x="11.6" y="9.4" width="4" height="6.4" rx="2"/><rect x="15.2" y="10" width="3.8" height="5.8" rx="1.9"/><rect x="18.5" y="11" width="3.4" height="5.2" rx="1.7"/><rect x="7.8" y="22.5" width="12.6" height="6" rx="1.6"/><path d="M8.6 25.5h11" fill="none" stroke-width="1"/></g></svg></div>
      </div>`;
    document.documentElement.append(host);
    const veil = root.querySelector<HTMLDivElement>(".veil")!;
    const hint = root.querySelector<HTMLDivElement>(".hint")!;
    // Curseur : petite main gantée blanche, index pointé (le curseur système est masqué).
    const hand = root.querySelector<HTMLDivElement>(".hand")!;
    const moveHand = (e: PointerEvent) => {
      hand.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      hand.classList.add("on");
    };
    veil.addEventListener("pointermove", moveHand);
    veil.addEventListener("pointerleave", () => hand.classList.remove("on"));
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
      hand.classList.add("down");
      veil.classList.add("drawing");
      rectEl?.remove();
      rectEl = document.createElement("div");
      rectEl.className = "rect";
      veil.insertBefore(rectEl, hand); // la main reste au-dessus du voile
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
      hand.classList.remove("down");
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
  else if (fit === "contain" || fit === "scale-down")
    sx = sy = Math.min(sx, sy, fit === "scale-down" ? 1 : Infinity);
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
