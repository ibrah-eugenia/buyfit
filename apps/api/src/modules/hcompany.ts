/**
 * Agent computer-use H Company (SDK `hai-agents`, région EU par défaut).
 * Clé : variable d'env HAI_API_KEY. Doc : https://hub.hcompany.ai/agents-api/introduction
 *
 * Garde-fou : l'agent s'arrête AVANT le paiement final et répond avec un récapitulatif ;
 * la session passe alors en `idle` → statut `confirmation_requise`. Le paiement n'est
 * validé qu'après POST /order/:id/confirm (clic explicite de l'utilisateur).
 */
import { HaiAgentsClient } from "hai-agents";
import type { CompteMarchand, OrderStatut } from "@buyfit/shared";
import { config } from "../config.js";

let client: HaiAgentsClient | null = null;
const hai = () => (client ??= new HaiAgentsClient({ apiKey: config.HAI_API_KEY! }));

export interface StartOrderInput {
  productUrl: string;
  taille: string;
  compte?: CompteMarchand;
}

export interface SessionInfo {
  sessionId: string;
  agentViewUrl: string | null;
}

export interface SessionState {
  statut: OrderStatut;
  message?: string;
}

const orderPrompt = ({ productUrl, taille, compte }: StartOrderInput) =>
  [
    `Va sur la page produit ${productUrl}.`,
    `Sélectionne la taille "${taille}" et ajoute l'article au panier.`,
    compte
      ? `Connecte-toi au compte ${compte.marchand}${compte.email ? ` (${compte.email})` : ""} avec les identifiants du vault.`
      : "Si une connexion est demandée, arrête-toi et explique ce qui manque.",
    "Va jusqu'à la page de paiement en gardant l'adresse et le moyen de paiement enregistrés.",
    "IMPORTANT : ne clique PAS sur le bouton final de paiement / validation de commande.",
    "Arrête-toi juste avant et réponds avec un récapitulatif : article, taille, prix total, adresse de livraison.",
  ].join("\n");

const CONFIRM_PROMPT =
  "L'utilisateur confirme : valide maintenant la commande (bouton final de paiement), puis réponds avec le numéro de commande.";

// ---------- mock ----------
const mockSessions = new Map<string, { startedAt: number; confirmedAt?: number }>();

export async function startOrderSession(input: StartOrderInput): Promise<SessionInfo> {
  if (config.mocks.hcompany) {
    const sessionId = `mock-session-${crypto.randomUUID()}`;
    mockSessions.set(sessionId, { startedAt: Date.now() });
    return { sessionId, agentViewUrl: null };
  }
  const overrides: Record<string, unknown> = {};
  if (input.compte?.vaultId) {
    overrides["agent.environments[kind=web].vault_id"] = input.compte.vaultId;
  }
  const session = await hai().startSession({
    agent: config.HAI_AGENT_ID,
    messages: orderPrompt(input),
    idleTimeoutS: 900, // garde la session ouverte en attendant la confirmation
    ...(Object.keys(overrides).length ? { overrides } : {}),
  });
  const full = await session.get();
  return { sessionId: session.id, agentViewUrl: full.agentViewUrl ?? null };
}

export async function confirmOrderSession(sessionId: string): Promise<void> {
  if (config.mocks.hcompany) {
    const s = mockSessions.get(sessionId);
    if (s) s.confirmedAt = Date.now();
    return;
  }
  await hai().session(sessionId).sendMessage({ type: "user_message", message: CONFIRM_PROMPT });
}

export async function getSessionState(
  sessionId: string,
  confirmed: boolean,
): Promise<SessionState> {
  if (config.mocks.hcompany) return mockState(sessionId);

  const s = await hai().session(sessionId).status();
  switch (s.status) {
    case "queued":
    case "pending":
      return { statut: "en_attente" };
    case "running":
    case "paused":
    case "awaiting_tool_results":
      return { statut: "en_cours", message: `${s.steps ?? 0} étapes` };
    case "idle":
    case "completed":
      if (s.outcome && s.outcome !== "success") {
        return { statut: "echec", message: `L'agent n'a pas pu terminer (${s.outcome}).` };
      }
      return confirmed
        ? { statut: "commandee", message: "Commande validée." }
        : { statut: "confirmation_requise", message: "Panier prêt : confirme l'achat." };
    default: // failed, timed_out, interrupted
      return { statut: "echec", message: s.error ?? s.status };
  }
}

function mockState(sessionId: string): SessionState {
  const s = mockSessions.get(sessionId);
  if (!s) return { statut: "echec", message: "Session mock inconnue (API redémarrée ?)" };
  if (s.confirmedAt) {
    return Date.now() - s.confirmedAt > 3000
      ? { statut: "commandee", message: "Commande mock validée (n° MOCK-1234)." }
      : { statut: "en_cours", message: "Validation du paiement…" };
  }
  const elapsed = Date.now() - s.startedAt;
  if (elapsed < 2000) return { statut: "en_attente" };
  if (elapsed < 8000) return { statut: "en_cours", message: "L'agent remplit le panier…" };
  return { statut: "confirmation_requise", message: "Panier prêt : confirme l'achat." };
}
