/**
 * Lanceur flottant BuyFit sur Pinterest : le logo est ancré au bord droit de la page.
 * Seule la bande blanche à points (poignée) permet de le déplacer, et uniquement de haut
 * en bas (position mémorisée). Un clic sur le logo ouvre / ferme le panneau à sa gauche.
 * Le panneau est la page de l'extension (sidepanel.html?mode=embed) dans une iframe :
 * elle garde l'accès aux API de l'extension. Le tout vit dans un shadow DOM pour ne pas
 * hériter du CSS de Pinterest.
 */
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import type { SelectionMessage } from "@/lib/messages";
import { startScreenSelection } from "@/lib/screen-select";

const POS_KEY = "buyfit:launcher-y";
const DOCK_W = 44;
const GRIP_H = 16;
const LOGO_H = 44;
const DOCK_H = GRIP_H + LOGO_H;
const MARGIN = 16;
const GAP = 10;
const PANEL_W = 380;
const PANEL_H = 600;

const SYMBOL = `<svg viewBox="15 -8 100 176" width="14" height="26" aria-hidden="true"><path d="M30 140 V20 H64 A30 30 0 0 1 64 80 H30 H70 A30 30 0 0 1 70 140 Z" fill="none" stroke="#fff" stroke-width="26" stroke-linejoin="round"/><line x1="62" y1="-6" x2="62" y2="166" stroke="#fff" stroke-width="13"/></svg>`;
const DOTS = `<svg width="14" height="6" viewBox="0 0 14 6" aria-hidden="true">${[1, 7, 13]
  .flatMap((x) => [1, 5].map((y) => `<circle cx="${x}" cy="${y}" r="1.2"/>`))
  .join("")}</svg>`;

const CSS = `
:host { all: initial; }
.dock {
  position: fixed; z-index: 2147483647; right: 0; width: ${DOCK_W}px; height: ${DOCK_H}px;
  display: flex; flex-direction: column; border-radius: 12px 0 0 12px; overflow: hidden;
  box-shadow: 0 6px 18px rgba(17,17,17,.22), 0 0 0 1px rgba(17,17,17,.08);
  transition: width .15s ease;
}
.dock:hover { width: ${DOCK_W + 4}px; }
.dock.dragging { transition: none; box-shadow: 0 10px 28px rgba(17,17,17,.3), 0 0 0 1px rgba(17,17,17,.1); }
.grip {
  height: ${GRIP_H}px; flex-shrink: 0; border: 0; padding: 0; background: #fff; color: #9a948d;
  display: flex; align-items: center; justify-content: center; cursor: ns-resize; touch-action: none;
  fill: currentColor;
}
.grip:hover, .dock.dragging .grip { color: #7A1F2B; }
.logo {
  flex: 1; border: 0; padding: 0; background: #7A1F2B; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: background .15s ease;
}
.logo:hover { background: #5C1420; }
.logo { position: relative; }
.dock.busy .logo::after {
  content: ""; position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 0 2px #7A1F2B; animation: buyfit-pulse 1.2s ease-in-out infinite;
}
@keyframes buyfit-pulse { 50% { opacity: .35; transform: scale(.8); } }
.grip:focus-visible, .logo:focus-visible { outline: 2px solid #111; outline-offset: -2px; }
.panel {
  position: fixed; z-index: 2147483646; width: ${PANEL_W}px; border-radius: 14px; overflow: hidden;
  background: #fff; box-shadow: 0 24px 60px rgba(17,17,17,.22), 0 0 0 1px rgba(17,17,17,.06);
  opacity: 0; transform: scale(.96); transform-origin: right bottom;
  pointer-events: none; transition: opacity .15s ease, transform .15s ease;
}
.panel.open { opacity: 1; transform: none; pointer-events: auto; }
.panel iframe { display: block; width: 100%; height: 100%; border: 0; }
@media (prefers-reduced-motion: reduce) { .dock, .logo, .panel { transition: none; } }
`;

export default defineContentScript({
  matches: ["*://*.pinterest.com/*", "*://*.pinterest.fr/*"],
  async main() {
    if (window.top !== window) return; // pas dans les iframes de Pinterest

    const host = document.createElement("buyfit-launcher");
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>${CSS}</style>
      <div class="panel" role="dialog" aria-label="BuyFit"></div>
      <div class="dock">
        <button class="grip" type="button" aria-label="Déplacer BuyFit (flèches haut / bas)">${DOTS}</button>
        <button class="logo" type="button" aria-label="Ouvrir BuyFit" aria-expanded="false">${SYMBOL}</button>
      </div>`;
    document.documentElement.append(host);

    const dock = root.querySelector<HTMLDivElement>(".dock")!;
    const grip = root.querySelector<HTMLButtonElement>(".grip")!;
    const bubble = root.querySelector<HTMLButtonElement>(".logo")!;
    const panel = root.querySelector<HTMLDivElement>(".panel")!;
    let iframe: HTMLIFrameElement | null = null;
    let open = false;

    const vw = () => document.documentElement.clientWidth;
    const vh = () => window.innerHeight;
    const clampY = (y: number) => Math.min(Math.max(MARGIN, y), vh() - DOCK_H - MARGIN);

    let y = clampY(vh() - DOCK_H - 96);
    try {
      const saved = (await browser.storage.local.get(POS_KEY))[POS_KEY];
      if (typeof saved === "number") y = clampY(saved);
    } catch {
      /* position par défaut */
    }

    /** Panneau à gauche du logo, bas aligné sur le logo, toujours dans l'écran. */
    const layout = () => {
      dock.style.top = `${y}px`;
      const h = Math.min(PANEL_H, vh() - 2 * MARGIN);
      const w = Math.min(PANEL_W, vw() - DOCK_W - GAP - MARGIN);
      const top = Math.min(Math.max(MARGIN, y + DOCK_H - h), vh() - h - MARGIN);
      panel.style.left = `${Math.max(MARGIN, vw() - DOCK_W - GAP - w)}px`;
      panel.style.width = `${w}px`;
      panel.style.top = `${top}px`;
      panel.style.height = `${h}px`;
    };

    const setOpen = (v: boolean) => {
      open = v;
      if (v && !iframe) {
        // Créée au premier clic seulement : rien n'est chargé tant que l'utilisateur n'ouvre pas.
        iframe = document.createElement("iframe");
        iframe.src = browser.runtime.getURL("/sidepanel.html?mode=embed");
        iframe.title = "BuyFit";
        iframe.allow = "clipboard-read; clipboard-write";
        panel.append(iframe);
      }
      panel.classList.toggle("open", v);
      bubble.setAttribute("aria-expanded", String(v));
      bubble.setAttribute("aria-label", v ? "Fermer BuyFit" : "Ouvrir BuyFit");
    };

    layout();

    // Poignée : glisser verticalement (souris / doigt) ou flèches haut / bas.
    let drag: { py: number; y: number } | null = null;
    const save = () => void browser.storage.local.set({ [POS_KEY]: y }).catch(() => {});
    grip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      drag = { py: e.clientY, y };
      dock.classList.add("dragging");
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener("pointermove", (e) => {
      if (!drag) return;
      y = clampY(drag.y + e.clientY - drag.py);
      layout();
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      dock.classList.remove("dragging");
      save();
    };
    grip.addEventListener("pointerup", endDrag);
    grip.addEventListener("pointercancel", endDrag);
    grip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      y = clampY(y + (e.key === "ArrowUp" ? -24 : 24));
      layout();
      save();
    });
    bubble.addEventListener("click", () => setOpen(!open));

    window.addEventListener("resize", () => {
      y = clampY(y);
      layout();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) setOpen(false);
    });
    // Messages du panneau (iframe) : fermer ; achat qui demande l'attention ; agent au travail.
    window.addEventListener("message", (e) => {
      if (!iframe || e.source !== iframe.contentWindow) return;
      const type = e.data?.type;
      if (type === "buyfit:close") {
        setOpen(false);
        bubble.focus();
      } else if (type === "buyfit:attention") {
        setOpen(true);
      } else if (type === "buyfit:busy") {
        dock.classList.toggle("busy", e.data.on === true);
      }
    });
    // Sélection d'une pièce à l'écran : le panneau (iframe ou side panel) la demande,
    // on masque le lanceur le temps de la sélection, puis on renvoie la zone au panneau.
    let selecting = false;
    const runSelection = async () => {
      if (selecting) return;
      selecting = true;
      const wasOpen = open;
      setOpen(false);
      host.style.display = "none";
      const result = await startScreenSelection();
      host.style.display = "";
      selecting = false;
      if (wasOpen) setOpen(true);
      const msg: SelectionMessage = result
        ? { type: "buyfit:selection", imageUrl: result.imageUrl, rect: result.rect }
        : { type: "buyfit:selection-cancel" };
      void browser.runtime.sendMessage(msg).catch(() => {});
    };

    browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
      const type = (msg as { type?: string })?.type;
      // Clic droit « Trouver ce look » : le background demande d'ouvrir le panneau.
      if (type === "buyfit:open-launcher") setOpen(true);
      if (type === "buyfit:start-select") {
        sendResponse({ ok: true });
        void runSelection();
      }
    });
  },
});
