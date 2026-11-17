import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import type { ResolveImageMessage, ResolveImageResponse } from "@/lib/messages";
import { largestFromSrcset, upgradePinimgUrl } from "@/lib/pinimg";

export default defineContentScript({
  matches: ["*://*.pinterest.com/*"],
  main() {
    browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
      const m = msg as ResolveImageMessage;
      if (m?.type !== "buyfit:resolve-image") return;
      sendResponse(resolvePinImage(m.srcUrl));
    });
  },
});

function resolvePinImage(srcUrl: string): ResolveImageResponse {
  const img = Array.from(document.images).find(
    (el) => el.currentSrc === srcUrl || el.src === srcUrl,
  );

  // 1. Plus grande variante du srcset, 2. URL CDN passée en 736x, 3. image cliquée.
  const candidate = largestFromSrcset(img?.getAttribute("srcset")) ?? srcUrl;
  const imageUrl = upgradePinimgUrl(candidate);

  // URL de l'épingle : lien /pin/<id> le plus proche, sinon la page courante (vue détail).
  const link = img?.closest<HTMLAnchorElement>('a[href*="/pin/"]');
  const pinUrl = link ? new URL(link.getAttribute("href")!, location.origin).href : location.href;

  const description = pinDescription(img, Boolean(link));
  return description ? { imageUrl, pinUrl, description } : { imageUrl, pinUrl };
}

/**
 * Texte de l'épingle, utilisé comme requête de recherche produits :
 * texte alternatif de l'image (Pinterest y met le titre/la description), sinon, en vue
 * détail, le titre de l'épingle ou la meta og:description.
 */
function pinDescription(img: HTMLImageElement | undefined, inGrid: boolean): string | undefined {
  const candidates = [
    img?.alt,
    !inGrid ? document.querySelector("h1")?.textContent : null,
    !inGrid
      ? document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content
      : null,
  ];
  const text = candidates
    .map((t) => t?.replace(/\s+/g, " ").trim())
    .find((t) => t && t.length >= 4 && !/^(image|photo|pin)$/i.test(t));
  return text?.slice(0, 500);
}
