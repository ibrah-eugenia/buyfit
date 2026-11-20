/**
 * Agent computer-use H Company (SDK `hai-agents`, région EU par défaut).
 * Clé : variable d'env HAI_API_KEY. Doc : https://hub.hcompany.ai/agents-api/introduction
 *
 * PARCOURS ACTUEL : ajout au panier. L'agent ouvre la fiche, choisit la taille, ajoute au
 * panier, vérifie le panier et s'arrête (`{ etape: "added_to_cart" }` → statut `au_panier`).
 * Le paiement reste à l'utilisateur (authentification forte DSP2). Connexion : profil de
 * navigateur H par défaut (cookies sauvegardés en fin de session) → l'utilisateur se connecte
 * une fois dans la vue agent, aucun mot de passe ne passe par BuyFit.
 *
 * Ancien parcours d'achat complet (fonctions chooseDelivery / confirmOrder ci-dessous) :
 * Parcours en 3 tours, l'agent s'arrête deux fois pour l'utilisateur (session restée `idle`) :
 * 1. Page produit → taille → panier → passer commande, arrêt sur le choix de livraison :
 *    `{ etape: "delivery_choice", livraisons }` → `confirmation_requise` / étape `livraison`.
 * 2. POST /order/:id/confirm { livraison } : l'agent choisit ce mode et va jusqu'à la dernière
 *    page AVANT paiement : `{ etape: "ready_to_pay" }` → `confirmation_requise` / étape `paiement`.
 * 3. POST /order/:id/confirm : feu vert explicite, l'agent valide le paiement
 *    `{ etape: "order_placed" }` → statut `commandee`.
 * Garde-fou : l'agent ne clique jamais sur le paiement final sans ce 3e tour.
 * La réponse est structurée (answerSchema → `agent.answer_format`) : on ne dépend pas de
 * `outcome`, qu'un agent qui s'arrête volontairement peut noter `partial`.
 */
import { HaiAgentsClient } from "hai-agents";
import { z } from "zod";
import type {
  CompteMarchand,
  LivraisonOption,
  OrderEtape,
  OrderMotif,
  OrderStatut,
} from "@buyfit/shared";
import { config } from "../config.js";

let client: HaiAgentsClient | null = null;
const hai = () => (client ??= new HaiAgentsClient({ apiKey: config.HAI_API_KEY! }));

/** Lien live + replay. Le SDK appelle la région EU par défaut : l'interface doit être celle
 * de l'EU, sinon la session est introuvable. */
const agentViewUrl = (sessionId: string) =>
  `https://platform.eu.hcompany.ai/agent-view/${sessionId}`;

/** Format de réponse imposé à l'agent, à chaque tour. */
export const OrderAnswerSchema = z.object({
  // Valeurs en anglais simple : le modèle Holo n'arrive pas à écrire « bloque » (il produit
  // « berge » en boucle, session du 17/11/2026 : 400 événements perdus).
  etape: z
    .enum([
      "added_to_cart",
      "delivery_choice",
      "ready_to_pay",
      "bank_validation",
      "order_placed",
      "blocked",
    ])
    .describe(
      "added_to_cart = the item is in the cart (checked on the cart page); delivery_choice = stopped on the delivery method choice; ready_to_pay = stopped right before the final payment; bank_validation = the bank asks the user to approve the payment (3-D Secure, banking app); order_placed = payment done; blocked = cannot continue",
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
    .describe("If delivery_choice: the delivery methods offered, else null"),
  resume: z.string().describe("Récapitulatif court : article, taille, livraison"),
  prixTotal: z.string().nullable().describe("Prix total affiché, devise incluse (ex. '69,95 €')"),
  numeroCommande: z.string().nullable().describe("Numéro de commande si validée, sinon null"),
  raison: z
    .string()
    .nullable()
    .describe("If blocked: what is missing (login, out of stock, captcha…)"),
  motif: z
    .enum(["out_of_stock", "login_failed", "bot_blocked", "other"])
    .nullable()
    .describe(
      "If blocked: out_of_stock = item or size unavailable; login_failed = cannot log in; bot_blocked = CAPTCHA, anti-bot check or access denied; other = anything else. Else null",
    ),
});
export type OrderAnswer = z.infer<typeof OrderAnswerSchema>;

export interface StartOrderInput {
  productUrl: string;
  taille: string;
  /** Tailles numériques équivalentes (ex. ["52", "54"] pour L en veste homme). */
  equivalents?: string[];
  /** Couleur voulue (« bleu marine ») : peut différer du coloris pointé par l'URL. */
  couleur?: string;
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
  motif?: OrderMotif;
}

const MOTIFS: Record<string, OrderMotif> = {
  out_of_stock: "rupture",
  login_failed: "connexion",
  bot_blocked: "site_bloque",
  other: "autre",
};

/**
 * Connexion au compte marchand de l'utilisateur AVANT l'ajout au panier : un panier invité reste
 * dans le navigateur cloud de H et n'apparaît jamais chez l'utilisateur. Les identifiants sont
 * dans le vault de la session : l'agent les fait taper par H (`fill_secret_at`) sans les voir.
 */
const loginSteps = (compte: CompteMarchand, productUrl: string) => [
  `ÉTAPE 1 — CONNEXION (obligatoire) : l'article doit arriver dans le panier du compte ${compte.marchand} de l'utilisateur, pas dans un panier invité.`,
  "Depuis cette page, ouvre la page de connexion du site (lien « Se connecter », « Connexion », « Mon compte » ou icône de profil en haut de page).",
  "Remplis l'email (ou l'identifiant) et le mot de passe avec les identifiants enregistrés pour ce site (action fill_secret_at), puis valide.",
  "Ne crée jamais de compte et n'invente aucun identifiant.",
  "Vérifie que tu es bien connecté (nom du compte, « Mon compte », « Bonjour… »). Si tu l'étais déjà, passe directement à l'étape 2.",
  "Si la connexion échoue (identifiants refusés, aucun identifiant proposé, code de vérification par email ou SMS demandé), arrête-toi : réponds avec etape=blocked, motif=login_failed et explique ce qui bloque dans raison.",
  `ÉTAPE 2 — AJOUT AU PANIER, toujours connecté : reviens sur la page produit ${productUrl}.`,
];

const cartPrompt = ({ productUrl, taille, equivalents = [], couleur, compte }: StartOrderInput) =>
  [
    `Va sur la page produit ${productUrl}.`,
    "Si une bannière de cookies s'affiche, refuse les cookies non essentiels.",
    // Les sites protégés (Akamai…) renvoient parfois un « Access Denied » passager au 1er
    // chargement : un seul rechargement, sans rien contourner.
    "Si la page affiche « Access Denied » ou une erreur de chargement, attends 5 secondes et recharge-la UNE seule fois avant de conclure à un blocage.",
    ...(compte?.vaultId ? loginSteps(compte, productUrl) : []),
    ...(couleur
      ? [
          `COULEUR : l'utilisateur veut cet article en ${couleur}. Regarde le coloris sélectionné sur la page (libellé « Couleur : … » et photo).`,
          `S'il ne correspond pas à ${couleur}, clique sur la pastille du coloris le plus proche de ${couleur} AVANT de choisir la taille, et vérifie que le libellé a changé.`,
          `Si aucun coloris proche de ${couleur} n'existe, garde le coloris affiché et précise-le dans le résumé.`,
        ]
      : []),
    `Clique sur le bouton de la taille "${taille}" pour la sélectionner (fais défiler si besoin).`,
    "Ne juge la disponibilité qu'APRÈS avoir cliqué sur la taille : tant qu'aucune taille n'est sélectionnée, certains sites affichent « Me notifier » ou un bouton grisé.",
    ...(equivalents.length
      ? [
          `Si le site affiche des tailles numériques au lieu de lettres, prends l'équivalent de ${taille} : ${equivalents.join(" ou ")} (la première disponible).`,
        ]
      : []),
    "Clique sur « Ajouter au panier » (ou équivalent).",
    "Ouvre ensuite le panier et vérifie que l'article y figure dans la bonne taille.",
    ...(compte?.vaultId
      ? [
          "Vérifie aussi sur la page panier que tu es toujours connecté au compte. Si tu as été déconnecté, reconnecte-toi puis revérifie le panier.",
        ]
      : []),
    "Réponds alors avec etape=added_to_cart, un résumé court (article, couleur, taille) et le prix affiché dans prixTotal. N'écris dans le résumé aucun identifiant de compte (code-barres, numéro membre, email).",
    "Ne passe PAS commande, ne va pas jusqu'au paiement, ne saisis aucune autre information personnelle (adresse, carte…).",
    ...(compte?.vaultId
      ? []
      : [
          "Si le site demande de se connecter pour ajouter au panier, ne saisis rien : réponds avec etape=blocked et motif=login_failed.",
        ]),
    "Si, une fois la taille cliquée, elle est barrée ou indiquée en rupture de stock, réponds avec etape=blocked et motif=out_of_stock.",
    "Si le site affiche un CAPTCHA, une vérification anti-robot, ou un accès refusé qui persiste après ce rechargement, ne tente PAS de le résoudre ni de le contourner :",
    "réponds avec etape=blocked et motif=bot_blocked.",
  ].join("\n");

/** Ancien prompt d'achat complet (jusqu'au paiement). */
export const orderPrompt = ({ productUrl, taille, equivalents = [], compte }: StartOrderInput) =>
  [
    `Va sur la page produit ${productUrl}.`,
    `Sélectionne la taille "${taille}" et ajoute l'article au panier.`,
    ...(equivalents.length
      ? [
          `Si le site affiche des tailles numériques au lieu de lettres, prends l'équivalent de ${taille} : ${equivalents.join(" ou ")} (la première disponible).`,
        ]
      : []),
    compte
      ? `Si une connexion est demandée, connecte-toi au compte ${compte.marchand} avec les identifiants enregistrés.`
      : "Si une connexion est demandée, arrête-toi avec etape=blocked, motif=login_failed, et explique ce qui manque.",
    "Ouvre le panier et clique sur « Passer commande » (ou équivalent).",
    "Garde l'adresse enregistrée. Arrête-toi sur l'étape du choix du mode de livraison, SANS en choisir :",
    "réponds avec etape=delivery_choice et la liste des modes proposés (libellé, prix, délai).",
    "S'il n'y a qu'un seul mode, continue jusqu'à la dernière page avant le paiement et réponds avec etape=ready_to_pay.",
    "IMPORTANT : ne clique JAMAIS sur le bouton final de paiement / validation de commande.",
    "Si l'article ou la taille est indisponible (rupture de stock), réponds avec etape=blocked et motif=out_of_stock.",
    "Si le site affiche un CAPTCHA, une vérification anti-robot ou un accès refusé, ne tente PAS de le résoudre ni de le contourner :",
    "réponds tout de suite avec etape=blocked et motif=bot_blocked.",
  ].join("\n");

const deliveryPrompt = (option: LivraisonOption) =>
  [
    `L'utilisateur choisit le mode de livraison « ${option.label} ». Sélectionne-le.`,
    "Continue jusqu'à la dernière page avant le paiement, avec le moyen de paiement enregistré.",
    "IMPORTANT : ne clique PAS sur le bouton final de paiement / validation de commande.",
    "Arrête-toi juste avant et réponds avec etape=ready_to_pay, le récapitulatif et le prix total.",
  ].join("\n");

const CONFIRM_PROMPT = [
  "L'utilisateur a vérifié le récapitulatif et confirme l'achat.",
  "Valide maintenant la commande (bouton final de paiement).",
  "Si la banque demande une validation (3-D Secure, code SMS, appli bancaire), ne saisis rien :",
  "réponds avec etape=bank_validation et attends.",
  "Sinon réponds avec etape=order_placed et le numéro de commande, ou etape=blocked si ça échoue.",
].join("\n");

const BANK_DONE_PROMPT = [
  "L'utilisateur indique avoir validé le paiement dans son application bancaire.",
  "Attends que la page de confirmation de commande s'affiche (recharge si besoin).",
  "Réponds avec etape=order_placed et le numéro de commande, ou etape=blocked si le paiement est refusé.",
].join("\n");

/** Plafond d'actions par session : connexion (~10) + ajout au panier (~15 à 30). */
const MAX_STEPS = 80;

/** Sessions dont la livraison est choisie (le 2e tour n'a peut-être pas encore démarré). */
const deliveryChosen = new Set<string>();
/** Sessions dont l'utilisateur a signalé la validation bancaire. */
const bankApproved = new Set<string>();

// ---------- mock ----------
type MockSession = {
  startedAt: number;
  deliveryAt?: number;
  confirmedAt?: number;
  bankAt?: number;
  taille?: string;
  site?: string;
};
const mockSessions = new Map<string, MockSession>();

export async function startOrderSession(input: StartOrderInput): Promise<SessionInfo> {
  if (config.mocks.hcompany) {
    const sessionId = `mock-session-${crypto.randomUUID()}`;
    mockSessions.set(sessionId, {
      startedAt: Date.now(),
      taille: input.taille,
      site: input.productUrl,
    });
    return { sessionId, agentViewUrl: null };
  }
  // Navigateur vierge à chaque session : le profil H « par défaut » est commun à toute
  // l'organisation, donc ses cookies (connexions, panier) passeraient d'un utilisateur à
  // l'autre. L'agent se connecte au compte de l'utilisateur via SON vault.
  const overrides: Record<string, unknown> = {};
  if (input.compte?.vaultId) {
    overrides["agent.environments[kind=web].vault_id"] = input.compte.vaultId;
  }
  const session = await hai().startSession({
    agent: config.HAI_AGENT_ID,
    messages: cartPrompt(input),
    answerSchema: OrderAnswerSchema,
    idleTimeoutS: 60, // rien à attendre après l'ajout au panier : session libérée vite
    maxSteps: MAX_STEPS, // un agent bloqué ne tourne pas indéfiniment (coût)
    ...(Object.keys(overrides).length ? { overrides } : {}),
  });
  // Lien construit depuis l'id : celui renvoyé par l'API pointe vers l'interface US
  // (platform.hcompany.ai) alors que la session tourne en EU.
  return { sessionId: session.id, agentViewUrl: agentViewUrl(session.id) };
}

/** 2e tour : l'utilisateur a choisi son mode de livraison. */
export async function chooseDeliverySession(
  sessionId: string,
  option: LivraisonOption,
): Promise<void> {
  deliveryChosen.add(sessionId);
  if (config.mocks.hcompany) {
    const s = mockSessions.get(sessionId);
    if (s) s.deliveryAt = Date.now();
    return;
  }
  await hai()
    .session(sessionId)
    .sendMessage({ type: "user_message", message: deliveryPrompt(option) });
}

/** 4e tour (si 3-D Secure) : l'utilisateur a validé le paiement dans son appli bancaire. */
export async function bankApprovedSession(sessionId: string): Promise<void> {
  bankApproved.add(sessionId);
  if (config.mocks.hcompany) {
    const s = mockSessions.get(sessionId);
    if (s) s.bankAt = Date.now();
    return;
  }
  await hai().session(sessionId).sendMessage({ type: "user_message", message: BANK_DONE_PROMPT });
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
      return fromAnswer(session.latestAnswer, {
        confirmed,
        delivery: deliveryChosen.has(sessionId),
        bank: bankApproved.has(sessionId),
      });
    case "interrupted":
      return { statut: "echec", message: "Session interrompue (délai de confirmation dépassé ?)" };
    default: // failed, timed_out
      return { statut: "echec", message: sessionError(status, session.status.errorCode, error) };
  }
}

/** Message lisible pour une session H échouée (l'erreur brute est en anglais et technique). */
function sessionError(status: string, code?: string | null, raw?: string | null): string {
  if (status === "timed_out")
    return "L'agent a dépassé le temps imparti avant d'ajouter l'article au panier.";
  if (code === "internal")
    return "La plateforme H Company a rencontré une erreur interne pendant la session (pas un blocage du site). Réessaie : ça passe en général au 2e essai.";
  return `La session de l'agent a échoué${raw ? ` : ${raw}` : "."}`;
}

function fromAnswer(
  raw: unknown,
  { confirmed, delivery, bank }: { confirmed: boolean; delivery: boolean; bank: boolean },
): SessionState {
  const parsed = OrderAnswerSchema.safeParse(raw);
  if (!parsed.success) return { statut: "echec", message: "Réponse de l'agent illisible." };
  const a = parsed.data;
  switch (a.etape) {
    case "added_to_cart":
      return {
        statut: "au_panier",
        message: a.resume,
        ...(a.prixTotal ? { total: a.prixTotal } : {}),
      };
    case "blocked":
      return {
        statut: "echec",
        message: a.raison ?? a.resume,
        motif: MOTIFS[a.motif ?? "other"] ?? "autre",
      };
    case "delivery_choice":
      // Choix envoyé mais le 2e tour n'a pas encore produit de réponse : on attend.
      return delivery || !a.livraisons?.length
        ? { statut: "en_cours", message: "L'agent finalise la commande…" }
        : {
            statut: "confirmation_requise",
            etape: "livraison",
            livraisons: a.livraisons,
            message: a.resume,
          };
    case "ready_to_pay":
      // Confirmé mais le 2e tour n'a pas encore produit de réponse : on attend.
      return confirmed
        ? { statut: "en_cours", message: "Validation du paiement…" }
        : {
            statut: "confirmation_requise",
            etape: "paiement",
            message: a.resume,
            ...(a.prixTotal ? { total: a.prixTotal } : {}),
          };
    case "bank_validation":
      return bank
        ? { statut: "en_cours", message: "Vérification du paiement…" }
        : {
            statut: "confirmation_requise",
            etape: "banque",
            message: "Valide le paiement dans ton application bancaire.",
          };
    case "order_placed":
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
  if (s.bankAt) {
    return since(s.bankAt) > 3000
      ? { statut: "commandee", message: "Commande n° MOCK-1234" }
      : { statut: "en_cours", message: "Vérification du paiement…" };
  }
  if (s.confirmedAt) {
    return since(s.confirmedAt) > 3000
      ? {
          statut: "confirmation_requise",
          etape: "banque",
          message: "Valide le paiement dans ton application bancaire.",
        }
      : { statut: "en_cours", message: "Validation du paiement…" };
  }
  if (s.deliveryAt) {
    return since(s.deliveryAt) > 4000
      ? {
          statut: "confirmation_requise",
          etape: "paiement",
          message: "Veste croisée beige, taille L",
          total: "75,90 €",
        }
      : { statut: "en_cours", message: "L'agent finalise la commande…" };
  }
  const elapsed = since(s.startedAt);
  if (elapsed < 2000) return { statut: "en_attente" };
  if (s.site?.includes("mango") && elapsed > 4000) {
    return {
      statut: "echec",
      motif: "site_bloque",
      message: "Vérification anti-robot affichée par le site.",
    };
  }
  if (s.taille === "XXL" && elapsed > 4000) {
    return {
      statut: "echec",
      motif: "rupture",
      message: "Taille XXL indisponible : « Rupture de stock » affichée sur la page produit.",
    };
  }
  if (elapsed < 8000) return { statut: "en_cours", message: "L'agent ajoute l'article au panier…" };
  return {
    statut: "au_panier",
    message: `Article ajouté au panier, taille ${s.taille}`,
    total: "39,95 €",
  };
}
