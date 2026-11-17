/**
 * Agent computer-use H Company (SDK `hai-agents`, région EU par défaut).
 * Clé : variable d'env HAI_API_KEY. Doc : https://hub.hcompany.ai/agents-api/introduction
 *
 * Garde-fou paiement (l'API H ne permet pas de soumettre un clic navigateur à validation) :
 * 1. 1er tour : l'agent remplit le panier et s'arrête AVANT le paiement, réponse
 *    `{ etape: "panier_pret" }` → statut `confirmation_requise`.
 * 2. POST /order/:id/confirm envoie un message à la session (restée `idle`) → 2e tour :
 *    l'agent valide, réponse `{ etape: "commande_validee" }` → statut `commandee`.
 * La réponse est structurée (answerSchema → `agent.answer_format`) : on ne dépend pas de
 * `outcome`, qu'un agent qui s'arrête volontairement peut noter `partial`.
 */
import { HaiAgentsClient } from "hai-agents";
import { z } from "zod";
import type { CompteMarchand, OrderStatut } from "@buyfit/shared";
import { config } from "../config.js";

let client: HaiAgentsClient | null = null;
const hai = () => (client ??= new HaiAgentsClient({ apiKey: config.HAI_API_KEY! }));

/** Lien live + replay de secours si l'API n'en renvoie pas (format observé le 17/11/2026). */
const fallbackAgentViewUrl = (sessionId: string) =>
  `https://platform.hcompany.ai/agents/sessions/${sessionId}`;

/** Format de réponse imposé à l'agent, à chaque tour. */
export const OrderAnswerSchema = z.object({
  etape: z
    .enum(["panier_pret", "commande_validee", "bloque"])
    .describe(
      "panier_pret = arrêté juste avant le paiement ; commande_validee = paiement validé ; bloque = impossible de continuer",
    ),
  resume: z.string().describe("Récapitulatif court : article, taille, livraison"),
  prixTotal: z.string().nullable().describe("Prix total affiché, devise incluse (ex. '69,95 €')"),
  numeroCommande: z.string().nullable().describe("Numéro de commande si validée, sinon null"),
  raison: z
    .string()
    .nullable()
    .describe("Si bloque : ce qui manque (connexion, rupture, captcha…)"),
});
export type OrderAnswer = z.infer<typeof OrderAnswerSchema>;

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
      ? `Si une connexion est demandée, connecte-toi au compte ${compte.marchand} avec les identifiants enregistrés.`
      : "Si une connexion est demandée, arrête-toi avec etape=bloque et explique ce qui manque.",
    "Va jusqu'à la dernière page avant le paiement, en gardant l'adresse et le moyen de paiement enregistrés.",
    "IMPORTANT : ne clique PAS sur le bouton final de paiement / validation de commande.",
    "Arrête-toi juste avant et réponds avec etape=panier_pret, le récapitulatif et le prix total.",
    "Si l'article ou la taille est indisponible, réponds avec etape=bloque.",
  ].join("\n");

const CONFIRM_PROMPT = [
  "L'utilisateur a vérifié le récapitulatif et confirme l'achat.",
  "Valide maintenant la commande (bouton final de paiement).",
  "Réponds avec etape=commande_validee et le numéro de commande, ou etape=bloque si ça échoue.",
].join("\n");

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
    answerSchema: OrderAnswerSchema,
    idleTimeoutS: 900, // la session attend 15 min la confirmation avant d'être libérée
    ...(Object.keys(overrides).length ? { overrides } : {}),
  });
  const full = await session.get().catch(() => null);
  return {
    sessionId: session.id,
    agentViewUrl: full?.agentViewUrl ?? fallbackAgentViewUrl(session.id),
  };
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

  const session = await hai().session(sessionId).get();
  const { status, steps, error } = session.status;
  switch (status) {
    case "queued":
    case "pending":
      return { statut: "en_attente" };
    case "running":
    case "paused":
    case "awaiting_tool_results":
      return { statut: "en_cours", message: `L'agent travaille… (${steps ?? 0} étapes)` };
    case "idle":
    case "completed":
      return fromAnswer(session.latestAnswer, confirmed);
    case "interrupted":
      return { statut: "echec", message: "Session interrompue (délai de confirmation dépassé ?)" };
    default: // failed, timed_out
      return { statut: "echec", message: error ?? status };
  }
}

function fromAnswer(raw: unknown, confirmed: boolean): SessionState {
  const parsed = OrderAnswerSchema.safeParse(raw);
  if (!parsed.success) return { statut: "echec", message: "Réponse de l'agent illisible." };
  const a = parsed.data;
  switch (a.etape) {
    case "bloque":
      return { statut: "echec", message: a.raison ?? a.resume };
    case "panier_pret":
      // Confirmé mais le 2e tour n'a pas encore produit de réponse : on attend.
      return confirmed
        ? { statut: "en_cours", message: "Validation du paiement…" }
        : {
            statut: "confirmation_requise",
            message: [a.resume, a.prixTotal && `Total : ${a.prixTotal}`]
              .filter(Boolean)
              .join(" — "),
          };
    case "commande_validee":
      return {
        statut: "commandee",
        message: a.numeroCommande ? `Commande n° ${a.numeroCommande}` : a.resume,
      };
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
