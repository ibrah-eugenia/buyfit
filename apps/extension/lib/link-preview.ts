import { browser } from "wxt/browser";
import { getActiveTab } from "./active-tab";
import type { PagePreview } from "./messages";
import { readPinPage } from "./pin-page";
import { normalizePinUrl } from "./pin-url";
import { upgradePinimgUrl } from "./pinimg";

/**
 * Aperçu visuel d'un lien d'épingle (façon « bookmark » Notion), par ordre de préférence :
 * 1. l'épingle est ouverte dans l'onglet actif → on lit la page (script injecté à la demande,
 *    marche aussi sur un onglet ouvert avant l'installation de l'extension) ;
 * 2. oEmbed public de Pinterest (JSON léger : titre + miniature) ;
 * 3. téléchargement de la page et lecture des balises OpenGraph.
 */
export async function getPinPreview(pinUrl: string): Promise<PagePreview | null> {
  const url = await expandShortLink(pinUrl);
  return (
    (await fromActiveTab(url)) ?? (await fromOEmbed(url)) ?? (await fromOpenGraph(url)) ?? null
  );
}

const pinId = (url: string) => url.match(/\/pin\/([\w-]+)/)?.[1];

/** pin.it/xxx → URL de l'épingle (suit la redirection). */
async function expandShortLink(url: string): Promise<string> {
  if (!/^https:\/\/pin\.it\//.test(url)) return url;
  try {
    const res = await fetch(url, { credentials: "omit" });
    return normalizePinUrl(res.url) ?? url;
  } catch (e) {
    console.debug("[buyfit] pin.it non résolu", e);
    return url;
  }
}

async function fromActiveTab(url: string): Promise<PagePreview | null> {
  const id = pinId(url);
  if (!id) return null;
  try {
    const tab = await getActiveTab();
    if (tab?.id === undefined || !tab.url || pinId(tab.url) !== id) return null;
    const [res] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: readPinPage,
    });
    const p = res?.result as PagePreview | undefined;
    return p?.imageUrl ? p : null;
  } catch (e) {
    console.debug("[buyfit] lecture de l'onglet impossible", e);
    return null;
  }
}

async function fromOEmbed(url: string): Promise<PagePreview | null> {
  const id = pinId(url);
  if (!id) return null;
  try {
    const canonical = `https://www.pinterest.com/pin/${id}/`;
    const res = await fetch(
      `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(canonical)}`,
      { credentials: "omit" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    if (!data.thumbnail_url) return null;
    const title = data.title?.replace(/\s+/g, " ").trim();
    return {
      url,
      imageUrl: upgradePinimgUrl(data.thumbnail_url),
      ...(title ? { title: title.slice(0, 140) } : {}),
    };
  } catch (e) {
    console.debug("[buyfit] oEmbed indisponible", e);
    return null;
  }
}

async function fromOpenGraph(url: string): Promise<PagePreview | null> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const og = (prop: string) =>
      doc.querySelector<HTMLMetaElement>(`meta[property="${prop}"], meta[name="${prop}"]`)
        ?.content || undefined;
    const image = og("og:image");
    // Page générique (épingle introuvable / mur de connexion) : image de partage par défaut.
    if (!image?.includes("i.pinimg.com")) return null;
    const title = og("og:title")?.replace(/\s+/g, " ").trim();
    return {
      url,
      imageUrl: upgradePinimgUrl(image),
      ...(title ? { title: title.slice(0, 140) } : {}),
    };
  } catch (e) {
    console.debug("[buyfit] page de l'épingle illisible", e);
    return null;
  }
}
