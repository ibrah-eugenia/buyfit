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

export const OrderStatusSchema = z.object({
  orderId: z.string().min(1),
  statut: OrderStatutSchema,
  h_session_id: z.string().nullable(),
  /** Lien de replay H Company (agent-view) pour suivre l'agent en direct. */
  agentViewUrl: z.url().optional(),
  message: z.string().optional(),
  updatedAt: IsoDateTimeSchema,
});
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
