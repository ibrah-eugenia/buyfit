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

  return { imageUrl, pinUrl };
}
