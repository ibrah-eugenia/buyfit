/**
 * Appels au site BuyFit avec la session de l'utilisateur (cookies).
 *
 * Le panneau s'affiche souvent dans une iframe sur Pinterest : pour Chrome c'est un contexte
 * tiers, et les cookies du site n'y sont pas envoyés (l'extension croit alors qu'on n'est pas
 * connecté). Le service worker, lui, n'est dans aucune page : avec la permission d'hôte du site,
 * ses requêtes partent avec les cookies. Le panneau lui délègue donc ces appels.
 */
import { browser } from "wxt/browser";

const WEB_URL = import.meta.env.WXT_WEB_URL;

export type WebFetchMessage = {
  type: "buyfit:web-fetch";
  path: string;
  method: "GET" | "POST";
  /** Corps JSON déjà sérialisé. */
  body?: string;
};
export type WebFetchResponse = { status: number; text: string } | { status: 0; error: string };

/** Côté service worker : exécute la requête (chemin du site uniquement, jamais une URL libre). */
export async function runWebFetch(msg: WebFetchMessage): Promise<WebFetchResponse> {
  if (!msg.path.startsWith("/api/")) return { status: 0, error: "Chemin refusé" };
  try {
    const res = await fetch(new URL(msg.path, WEB_URL), {
      method: msg.method,
      credentials: "include",
      cache: "no-store",
      headers: {
        "X-BuyFit-Request": "fitting",
        ...(msg.body ? { "Content-Type": "application/json" } : {}),
      },
      body: msg.body,
    });
    return { status: res.status, text: await res.text() };
  } catch (e) {
    return { status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Côté panneau : appel au site via le service worker. Lève une erreur si le site est injoignable. */
export async function webFetch(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const msg: WebFetchMessage = {
    type: "buyfit:web-fetch",
    path,
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  const res = (await browser.runtime.sendMessage(msg)) as WebFetchResponse | undefined;
  if (!res || !("text" in res))
    throw new Error("Site BuyFit injoignable. Vérifie qu'il est lancé, puis réessaie.");
  let json: unknown = null;
  try {
    json = JSON.parse(res.text);
  } catch {
    /* réponse non JSON */
  }
  return { status: res.status, json };
}
