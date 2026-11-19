/**
 * Achat en cours par l'agent H Company, indépendant des écrans : il continue quand
 * l'utilisateur change d'épingle ou referme le panneau (l'iframe du lanceur reste vivante
 * dans l'onglet Pinterest). Effets de bord :
 * - la vue live de l'agent s'ouvre dans un onglet en arrière-plan (l'utilisateur reste sur Pinterest) ;
 * - à chaque pause (livraison, paiement, banque) et à la fin : notification Chrome + ouverture
 *   automatique du panneau ; pastille animée sur le logo tant que l'agent travaille.
 */
import {
  ORDER_TERMINAL_STATUTS,
  sizeEquivalentLabel,
  type IdentifiedItem,
  type OrderStatus,
  type ProductMatch,
} from "@buyfit/shared";
import { useSyncExternalStore } from "react";
import { browser } from "wxt/browser";
import { getActiveTab } from "./active-tab";
import { api } from "./api";

const POLL_MS = 2500;

/** Pièce identifiée : genre et catégorie pour l'équivalence de taille (L → 52–54). */
export type PieceMeta = Pick<IdentifiedItem, "genre" | "categorie">;

export interface Purchase {
  product: ProductMatch;
  size: string;
  /** Équivalent numérique affiché (« 52–54 »), "" si aucun. */
  sizeEquivalent: string;
  meta: PieceMeta;
  order: OrderStatus | null;
  error: string | null;
  /** Étapes déjà franchies par l'utilisateur (l'agent met quelques secondes à repartir). */
  deliveryDone: boolean;
  paymentDone: boolean;
  bankDone: boolean;
  sending: boolean;
  /** Écran d'achat masqué (l'achat continue, bandeau « Achat en cours »). */
  hidden: boolean;
}

let current: Purchase | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let originTabId: number | undefined;
let buyerId = "";
let agentTabOpened = false;
let lastSignal = "";

const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<Purchase>) => {
  if (!current) return;
  current = { ...current, ...patch };
  emit();
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function usePurchase(): Purchase | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export const isTerminal = (p: Purchase | null) =>
  !!p?.order && ORDER_TERMINAL_STATUTS.includes(p.order.statut);

/** Pause en attente de l'utilisateur (null si l'agent travaille ou a fini). */
export function pendingStep(p: Purchase | null): "livraison" | "paiement" | "banque" | null {
  const o = p?.order;
  if (!p || o?.statut !== "confirmation_requise" || !o.etape) return null;
  if (o.etape === "livraison" && !p.deliveryDone) return "livraison";
  if (o.etape === "paiement" && !p.paymentDone) return "paiement";
  if (o.etape === "banque" && !p.bankDone) return "banque";
  return null;
}

export async function startPurchase(
  product: ProductMatch,
  size: string,
  userId: string,
  meta: PieceMeta = {},
) {
  buyerId = userId;
  stopPolling();
  agentTabOpened = false;
  lastSignal = "";
  originTabId = (await getActiveTab().catch(() => undefined))?.id;
  const opts = {
    ...(meta.genre ? { genre: meta.genre } : {}),
    ...(meta.categorie ? { categorie: meta.categorie } : {}),
  };
  current = {
    product,
    size,
    sizeEquivalent: sizeEquivalentLabel(size, opts),
    meta,
    order: null,
    error: null,
    deliveryDone: false,
    paymentDone: false,
    bankDone: false,
    sending: false,
    hidden: false,
  };
  emit();
  signalBusy(true);
  try {
    update(
      await api.order({
        userId,
        productId: product.id,
        productUrl: product.url,
        taille: size,
        ...opts,
      }),
    );
    timer = setInterval(() => {
      const id = current?.order?.orderId;
      if (id) api.getOrder(id).then(update, (e: unknown) => set({ error: errMsg(e) }));
    }, POLL_MS);
  } catch (e) {
    set({ error: errMsg(e) });
    signalBusy(false);
    notify("Achat impossible", errMsg(e));
  }
}

/** Réponse à la pause en cours : `livraison` = id du mode choisi ; sinon sans argument. */
export async function answer(livraison?: string) {
  const p = current;
  const step = pendingStep(p);
  if (!p?.order || !step) return;
  set({ sending: true, error: null });
  try {
    const next = await api.confirmOrder(p.order.orderId, livraison);
    set({
      ...(step === "livraison" ? { deliveryDone: true } : {}),
      ...(step === "paiement" ? { paymentDone: true } : {}),
      ...(step === "banque" ? { bankDone: true } : {}),
      sending: false,
    });
    update(next);
  } catch (e) {
    set({ sending: false, error: errMsg(e) });
  }
}

/** Rupture de stock : relance le même article dans une autre taille. */
export function retryWithSize(size: string) {
  if (current) void startPurchase(current.product, size, buyerId, current.meta);
}

export const hidePurchase = () => set({ hidden: true });
export const showPurchase = () => set({ hidden: false });

export function clearPurchase() {
  stopPolling();
  signalBusy(false);
  current = null;
  emit();
}

function stopPolling() {
  if (timer) clearInterval(timer);
  timer = null;
}

function update(order: OrderStatus) {
  if (!current) return;
  set({ order });
  if (order.agentViewUrl && !agentTabOpened) {
    agentTabOpened = true;
    void openAgentTab(order.agentViewUrl);
  }
  const terminal = ORDER_TERMINAL_STATUTS.includes(order.statut);
  if (terminal) {
    stopPolling();
    signalBusy(false);
  }
  // Une notification par nouvel état qui demande l'attention de l'utilisateur.
  const step = pendingStep(current);
  const signal = step ?? (terminal ? order.statut : "");
  if (!signal || signal === lastSignal) return;
  lastSignal = signal;
  const { product } = current;
  const texts: Record<string, [string, string]> = {
    livraison: ["Choisis ta livraison", `${product.nom} est dans le panier ${product.marque}.`],
    paiement: ["Confirme le paiement", `${product.marque} · ${order.total ?? product.nom}`],
    banque: ["Valide dans ton appli bancaire", "Ta banque demande de confirmer le paiement."],
    commandee: [
      "Commande validée ✓",
      `Tu vas recevoir l'e-mail de confirmation de ${product.marque}.`,
    ],
    echec:
      order.motif === "rupture"
        ? [
            "Rupture de stock",
            `${product.nom} n'est plus disponible en taille ${current.size} chez ${product.marque}.`,
          ]
        : order.motif === "site_bloque"
          ? [
              `${product.marque} bloque les achats automatiques`,
              "Finis l'achat sur le site en un clic.",
            ]
          : order.motif === "connexion"
            ? [
                `Connexion ${product.marque} impossible`,
                order.message ?? "Vérifie le compte enregistré.",
              ]
            : ["Commande interrompue", order.message ?? "L'agent n'a pas pu terminer."],
  };
  const [title, body] = texts[signal] ?? ["BuyFit", ""];
  notify(title, body);
  set({ hidden: false });
  attention();
}

/** Vue live de l'agent, en arrière-plan, juste à droite de l'onglet Pinterest. */
async function openAgentTab(url: string) {
  try {
    const origin = originTabId !== undefined ? await browser.tabs.get(originTabId) : undefined;
    await browser.tabs.create({
      url,
      active: false,
      ...(origin
        ? { index: origin.index + 1, openerTabId: origin.id, windowId: origin.windowId }
        : {}),
    });
  } catch (e) {
    console.debug("[buyfit] onglet de l'agent non ouvert", e);
  }
}

/** Panneau du lanceur (iframe) : demande au content script de l'ouvrir. */
function attention() {
  if (window.parent !== window) window.parent.postMessage({ type: "buyfit:attention" }, "*");
}

function signalBusy(on: boolean) {
  if (window.parent !== window) window.parent.postMessage({ type: "buyfit:busy", on }, "*");
}

let iconUrl: string | null = null;
/** Icône de notification dessinée à la volée (carré bordeaux + B barré), sans fichier. */
function icon(): string {
  if (iconUrl) return iconUrl;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "#7A1F2B";
  g.beginPath();
  g.roundRect(0, 0, 96, 96, 22);
  g.fill();
  g.fillStyle = "#fff";
  g.font = "bold 64px Inter, system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("B", 48, 52);
  iconUrl = c.toDataURL("image/png");
  return iconUrl;
}

function notify(title: string, message: string) {
  // L'id porte l'onglet Pinterest : un clic sur la notification y ramène (cf. background).
  const id = `buyfit-order|${originTabId ?? ""}|${Date.now()}`;
  browser.notifications
    ?.create(id, { type: "basic", iconUrl: icon(), title, message, priority: 2 })
    .catch((e: unknown) => console.debug("[buyfit] notification impossible", e));
}
