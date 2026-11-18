import type { PagePreview } from "./messages";

/**
 * Lit l'aperçu de l'épingle affichée DANS la page Pinterest.
 * Injectée via chrome.scripting.executeScript : la fonction doit rester autonome
 * (aucun import ni variable extérieure, elle est sérialisée).
 *
 * Pinterest est une SPA : les balises OpenGraph peuvent dater d'une page précédente,
 * donc on ne les croit que si og:url contient l'id de l'épingle courante ; sinon on lit
 * l'image principale de l'épingle dans le DOM.
 */
export function readPinPage(): PagePreview {
  const meta = (prop: string) =>
    document.querySelector<HTMLMetaElement>(`meta[property="${prop}"], meta[name="${prop}"]`)
      ?.content || undefined;
  const upgrade = (u: string) =>
    u.replace(/^(https?:\/\/i\.pinimg\.com\/)(?:\d+x\d*|originals)(\/.+)$/, "$1736x$2");

  const pinId = location.pathname.match(/\/pin\/([\w-]+)/)?.[1];
  const ogUrl = meta("og:url");
  const ogFresh = Boolean(pinId && ogUrl?.includes(pinId));

  const closeup = document.querySelector<HTMLImageElement>(
    '[data-test-id="pin-closeup-image"] img, [data-test-id="closeup-image"] img, [data-test-id="visual-content-container"] img',
  );
  const largest = Array.from(document.images)
    .filter((i) => i.currentSrc.includes("i.pinimg.com") && i.naturalWidth >= 200)
    .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)[0];
  const img = closeup ?? largest;

  const ogImage = ogFresh ? meta("og:image") : undefined;
  const raw = ogImage && ogImage.includes("i.pinimg.com") ? ogImage : img?.currentSrc || img?.src;

  const title = [
    ogFresh ? meta("og:title") : null,
    document.querySelector("h1")?.textContent,
    img?.alt,
  ]
    .map((t) => t?.replace(/\s+/g, " ").trim())
    .find((t) => t && t.length >= 3);

  return {
    url: location.href,
    ...(raw ? { imageUrl: upgrade(raw) } : {}),
    ...(title ? { title: title.slice(0, 140) } : {}),
  };
}
