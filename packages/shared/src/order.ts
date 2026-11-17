import { z } from "zod";
import { IsoDateTimeSchema } from "./common.js";

export const OrderRequestSchema = z.object({
  userId: z.string().min(1),
  productId: z.string().min(1),
  /** Page produit : l'agent H Company en a besoin pour naviguer. */
  productUrl: z.url(),
  taille: z.string().min(1),
});
export type OrderRequest = z.infer<typeof OrderRequestSchema>;

/**
 * Cycle de vie d'une commande.
 * `confirmation_requise` : l'agent s'arrête avant le paiement final et attend
 * le feu vert explicite de l'utilisateur (garde-fou obligatoire).
 */
export const OrderStatutSchema = z.enum([
  "en_attente",
  "en_cours",
  "confirmation_requise",
  "commandee",
  "echec",
]);
export type OrderStatut = z.infer<typeof OrderStatutSchema>;

export const ORDER_TERMINAL_STATUTS: readonly OrderStatut[] = ["commandee", "echec"];

/** Mode de livraison proposé par le marchand, relevé par l'agent. */
export const LivraisonOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  prix: z.string().nullable().optional(),
  delai: z.string().nullable().optional(),
});
export type LivraisonOption = z.infer<typeof LivraisonOptionSchema>;

/**
 * Pause de l'agent quand statut = `confirmation_requise` :
 * - `livraison` : l'utilisateur choisit un mode de livraison (`livraisons`) ;
 * - `paiement` : récapitulatif + total, l'utilisateur confirme le paiement.
 */
export const OrderEtapeSchema = z.enum(["livraison", "paiement"]);
export type OrderEtape = z.infer<typeof OrderEtapeSchema>;

export const OrderStatusSchema = z.object({
  orderId: z.string().min(1),
  statut: OrderStatutSchema,
  h_session_id: z.string().nullable(),
  /** Lien de replay H Company (agent-view) pour suivre l'agent en direct. */
  agentViewUrl: z.url().optional(),
  message: z.string().optional(),
  etape: OrderEtapeSchema.optional(),
  livraisons: z.array(LivraisonOptionSchema).optional(),
  /** Total affiché par le marchand avant paiement (devise incluse). */
  total: z.string().optional(),
  updatedAt: IsoDateTimeSchema,
});
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// POST /order/:id/confirm : `livraison` (id d'option) à l'étape livraison, rien à l'étape paiement.
export const OrderConfirmRequestSchema = z.object({
  livraison: z.string().min(1).optional(),
});
export type OrderConfirmRequest = z.infer<typeof OrderConfirmRequestSchema>;
