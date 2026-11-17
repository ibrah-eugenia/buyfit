/**
 * Agent computer-use H Company (SDK `hai-agents`, région EU par défaut).
 * Clé : variable d'env HAI_API_KEY. Doc : https://hub.hcompany.ai/agents-api/introduction
 *
 * Parcours en 3 tours, l'agent s'arrête deux fois pour l'utilisateur (session restée `idle`) :
 * 1. Page produit → taille → panier → passer commande, arrêt sur le choix de livraison :
 *    `{ etape: "choix_livraison", livraisons }` → `confirmation_requise` / étape `livraison`.
 * 2. POST /order/:id/confirm { livraison } : l'agent choisit ce mode et va jusqu'à la dernière
 *    page AVANT paiement : `{ etape: "panier_pret" }` → `confirmation_requise` / étape `paiement`.
 * 3. POST /order/:id/confirm : feu vert explicite, l'agent valide le paiement
 *    `{ etape: "commande_validee" }` → statut `commandee`.
 * Garde-fou : l'agent ne clique jamais sur le paiement final sans ce 3e tour.
 * La réponse est structurée (answerSchema → `agent.answer_format`) : on ne dépend pas de
 * `outcome`, qu'un agent qui s'arrête volontairement peut noter `partial`.
 */
import { HaiAgentsClient } from "hai-agents";
import { z } from "zod";
import type { CompteMarchand, LivraisonOption, OrderEtape, OrderStatut } from "@buyfit/shared";
import { config } from "../config.js";

let client: HaiAgentsClient | null = null;
const hai = () => (client ??= new HaiAgentsClient({ apiKey: config.HAI_API_KEY! }));

/** Lien live + replay de secours si l'API n'en renvoie pas (format observé le 17/11/2026). */
const fallbackAgentViewUrl = (sessionId: string) =>
  `https://platform.hcompany.ai/agents/sessions/${sessionId}`;

/** Format de réponse imposé à l'agent, à chaque tour. */
export const OrderAnswerSchema = z.object({
  etape: z
    .enum(["choix_livraison", "panier_pret", "commande_validee", "bloque"])
    .describe(
      "choix_livraison = arrêté sur le choix du mode de livraison ; panier_pret = arrêté juste avant le paiement ; commande_validee = paiement validé ; bloque = impossible de continuer",
    ),
  livraisons: z
    .array(
      z.object({
        id: z.string().describe("Identifiant court, ex. 'standard', 'express', 'relais'"),
        label: z.string().describe("Libellé affiché par le site"),
        prix: z.string().nullable().describe("Prix affiché (ex. 'Gratuit', '4,95 €')"),
        delai: z.string().nullable().describe("Délai affiché (ex. '3-5 jours ouvrés')"),
      }),
    )
    .nullable()
    .describe("Si choix_livraison : modes de livraison proposés, sinon null"),
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
  etape?: OrderEtape;
  livraisons?: LivraisonOption[];
  total?: string;
}

const orderPrompt = ({ productUrl, taille, compte }: StartOrderInput) =>
  [
    `Va sur la page produit ${productUrl}.`,
    `Sélectionne la taille "${taille}" et ajoute l'article au panier.`,
    compte
      ? `Si une connexion est demandée, connecte-toi au compte ${compte.marchand} avec les identifiants enregistrés.`
      : "Si une connexion est demandée, arrête-toi avec etape=bloque et explique ce qui manque.",
    "Ouvre le panier et clique sur « Passer commande » (ou équivalent).",
    "Garde l'adresse enregistrée. Arrête-toi sur l'étape du choix du mode de livraison, SANS en choisir :",
    "réponds avec etape=choix_livraison et la liste des modes proposés (libellé, prix, délai).",
    "S'il n'y a qu'un seul mode, continue jusqu'à la dernière page avant le paiement et réponds avec etape=panier_pret.",
    "IMPORTANT : ne clique JAMAIS sur le bouton final de paiement / validation de commande.",
    "Si l'article ou la taille est indisponible, réponds avec etape=bloque.",
  ].join("\n");

const deliveryPrompt = (option: LivraisonOption) =>
  [
    `L'utilisateur choisit le mode de livraison « ${option.label} ». Sélectionne-le.`,
    "Continue jusqu'à la dernière page avant le paiement, avec le moyen de paiement enregistré.",
    "IMPORTANT : ne clique PAS sur le bouton final de paiement / validation de commande.",
    "Arrête-toi juste avant et réponds avec etape=panier_pret, le récapitulatif et le prix total.",
  ].join("\n");

const CONFIRM_PROMPT = [
  "L'utilisateur a vérifié le récapitulatif et confirme l'achat.",
  "Valide maintenant la commande (bouton final de paiement).",
  "Réponds avec etape=commande_validee et le numéro de commande, ou etape=bloque si ça échoue.",
].join("\n");

/** Sessions dont la livraison est choisie (le 2e tour n'a peut-être pas encore démarré). */
const deliveryChosen = new Set<string>();

// ---------- mock ----------
type MockSession = { startedAt: number; deliveryAt?: number; confirmedAt?: number };
const mockSessions = new Map<string, MockSession>();
const MOCK_LIVRAISONS: LivraisonOption[] = [
  { id: "standard", label: "Livraison standard", prix: "Gratuit", delai: "3 à 5 jours ouvrés" },
  { id: "express", label: "Livraison express", prix: "6,95 €", delai: "24 h" },
  { id: "relais", label: "Point relais", prix: "2,95 €", delai: "2 à 4 jours ouvrés" },
];

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

/** 2e tour : l'utilisateur a choisi son mode de livraison. */
export async function chooseDeliverySession(sessionId: string, option: LivraisonOption): Promise<void> {
  deliveryChosen.add(sessionId);
  if (config.mocks.hcompany) {
    const s = mockSessions.get(sessionId);
    if (s) s.deliveryAt = Date.now();
    return;
  }
  await hai().session(sessionId).sendMessage({ type: "user_message", message: deliveryPrompt(option) });
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
      return fromAnswer(session.latestAnswer, confirmed, deliveryChosen.has(sessionId));
    case "interrupted":
      return { statut: "echec", message: "Session interrompue (délai de confirmation dépassé ?)" };
    default: // failed, timed_out
      return { statut: "echec", message: error ?? status };
  }
}

function fromAnswer(raw: unknown, confirmed: boolean, delivery: boolean): SessionState {
  const parsed = OrderAnswerSchema.safeParse(raw);
  if (!parsed.success) return { statut: "echec", message: "Réponse de l'agent illisible." };
  const a = parsed.data;
  switch (a.etape) {
    case "bloque":
      return { statut: "echec", message: a.raison ?? a.resume };
    case "choix_livraison":
      // Choix envoyé mais le 2e tour n'a pas encore produit de réponse : on attend.
      return delivery || !a.livraisons?.length
        ? { statut: "en_cours", message: "L'agent finalise la commande…" }
        : { statut: "confirmation_requise", etape: "livraison", livraisons: a.livraisons, message: a.resume };
    case "panier_pret":
      // Confirmé mais le 2e tour n'a pas encore produit de réponse : on attend.
      return confirmed
        ? { statut: "en_cours", message: "Validation du paiement…" }
        : {
            statut: "confirmation_requise",
            etape: "paiement",
            message: a.resume,
            ...(a.prixTotal ? { total: a.prixTotal } : {}),
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
  const since = (t: number) => Date.now() - t;
  if (s.confirmedAt) {
    return since(s.confirmedAt) > 3000
      ? { statut: "commandee", message: "Commande n° MOCK-1234" }
      : { statut: "en_cours", message: "Validation du paiement…" };
  }
  if (s.deliveryAt) {
    return since(s.deliveryAt) > 4000
      ? { statut: "confirmation_requise", etape: "paiement", message: "Veste croisée beige, taille L", total: "75,90 €" }
      : { statut: "en_cours", message: "L'agent finalise la commande…" };
  }
  const elapsed = since(s.startedAt);
  if (elapsed < 2000) return { statut: "en_attente" };
  if (elapsed < 8000) return { statut: "en_cours", message: "L'agent ajoute l'article au panier…" };
  return { statut: "confirmation_requise", etape: "livraison", livraisons: MOCK_LIVRAISONS };
}
