/**
 * Côté navigateur : transmet une session à l'extension BuyFit installée.
 *
 * La page postMessage vers sa propre fenêtre (même origine uniquement) ; le content
 * script de l'extension, injecté sur la plateforme, valide le message, le transmet au
 * background et répond par un `buyfit:ack`. Voir docs/auth-extension.md.
 *
 * Usage dans la page /extension/connect (Antonin) :
 *   const r = await connectExtension();
 *   if (r.status === "not_installed") … // afficher le lien d'installation
 */
import { createExtensionSession } from "./extension-session";
import {
  EXTENSION_SOURCE,
  ExtensionAckSchema,
  WEB_SOURCE,
  type ExtensionAck,
  type WebToExtensionMessage,
} from "./extension-protocol";

const ACK_TIMEOUT_MS = 2000;

export type ExtensionStatus =
  | { status: "connected"; email: string | null }
  | { status: "not_connected" }
  | { status: "not_installed" }
  | { status: "error"; error: string };

type OutgoingMessage =
  | { type: "buyfit:ping" }
  | Omit<Extract<WebToExtensionMessage, { type: "buyfit:session" }>, "source" | "nonce">
  | { type: "buyfit:logout" };

/** Envoie un message et attend l'accusé de réception (null si l'extension ne répond pas). */
function send(message: OutgoingMessage): Promise<ExtensionAck | null> {
  const nonce = crypto.randomUUID();
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      if ((data as { source?: unknown }).source !== EXTENSION_SOURCE) return;
      const ack = ExtensionAckSchema.safeParse(data);
      if (!ack.success || ack.data.nonce !== nonce) return;
      cleanup();
      resolve(ack.data);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, ACK_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    window.addEventListener("message", onMessage);
    const outgoing = { ...message, source: WEB_SOURCE, nonce } as WebToExtensionMessage;
    window.postMessage(outgoing, window.location.origin);
  });
}

/** L'extension est-elle installée, et reliée à quel compte ? */
export async function getExtensionStatus(): Promise<ExtensionStatus> {
  const ack = await send({ type: "buyfit:ping" });
  if (!ack) return { status: "not_installed" };
  if (!ack.ok) return { status: "error", error: ack.error ?? "Erreur de l'extension" };
  return ack.connectedEmail
    ? { status: "connected", email: ack.connectedEmail }
    : { status: "not_connected" };
}

/** Crée une session dédiée à l'extension (côté serveur) et la lui transmet. */
export async function connectExtension(): Promise<ExtensionStatus> {
  const before = await getExtensionStatus();
  if (before.status === "not_installed") return before;
  try {
    const session = await createExtensionSession();
    const ack = await send({ type: "buyfit:session", session });
    if (!ack) return { status: "not_installed" };
    if (!ack.ok) return { status: "error", error: ack.error ?? "L'extension a refusé la session" };
    return { status: "connected", email: session.email };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Demande à l'extension d'oublier sa session (appelé aussi par signOut). */
export async function disconnectExtension(): Promise<ExtensionStatus> {
  const ack = await send({ type: "buyfit:logout" });
  if (!ack) return { status: "not_installed" };
  return ack.ok
    ? { status: "not_connected" }
    : { status: "error", error: ack.error ?? "Erreur de l'extension" };
}
