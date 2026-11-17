/** Helpers pour les images Pinterest (CDN i.pinimg.com). */

const PINIMG_SIZE = /^(https?:\/\/i\.pinimg\.com\/)(?:\d+x\d*|originals)(\/.+)$/;

/** Passe une miniature (236x, 474x…) en grand format (736x, toujours disponible). */
export function upgradePinimgUrl(url: string): string {
  const m = PINIMG_SIZE.exec(url);
  return m ? `${m[1]}736x${m[2]}` : url;
}

/** Plus grande entrée d'un attribut srcset (ex. "a.jpg 1x, b.jpg 4x" → "b.jpg"). */
export function largestFromSrcset(srcset: string | null | undefined): string | null {
  if (!srcset) return null;
  let best: { url: string; w: number } | null = null;
  for (const part of srcset.split(",")) {
    const [url, size = "1x"] = part.trim().split(/\s+/);
    if (!url) continue;
    const w = parseFloat(size) * (size.endsWith("x") ? 1000 : 1);
    if (!best || w > best.w) best = { url, w };
  }
  return best?.url ?? null;
}
