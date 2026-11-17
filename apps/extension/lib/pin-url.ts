/**
 * Liens d'épingle Pinterest acceptés par BuyFit :
 * - lien court de « Partager → Copier le lien » : https://pin.it/AbC123
 * - URL d'épingle : https://(fr.|www.)pinterest.com|fr/pin/123456789/
 */
const PIN_PATH = /^\/pin\/[\w-]+\/?/;
const PINTEREST_HOST = /(^|\.)pinterest\.[a-z.]{2,6}$/;

export function normalizePinUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host === "pin.it" && url.pathname.length > 1) return `https://pin.it${url.pathname}`;
  if (PINTEREST_HOST.test(host) && PIN_PATH.test(url.pathname)) {
    return `https://${host}${url.pathname.match(PIN_PATH)![0]}`;
  }
  return null;
}
