/**
 * Protocole plateforme ↔ extension (window.postMessage + content script de l'extension).
 * Voir docs/auth-extension.md.
 *
 * ⚠️ L'extension doit valider les mêmes schémas : à déplacer dans packages/shared
 * (proposition à Ibrahim) pour qu'il n'y ait qu'une seule source de vérité.
 */
import { z } from "zod";

/** Session PROPRE à l'extension (distincte de celle du site, voir createExtensionSession). */
export const ExtensionSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** Expiration de l'access token, en secondes depuis l'epoch (comme Supabase). */
  expiresAt: z.number().int().positive(),
  userId: z.uuid(),
  email: z.email().nullable(),
});
export type ExtensionSession = z.infer<typeof ExtensionSessionSchema>;

export const WEB_SOURCE = "buyfit-web";
export const EXTENSION_SOURCE = "buyfit-extension";

/** Messages envoyés par la plateforme (page) à l'extension. */
export const WebToExtensionMessageSchema = z.discriminatedUnion("type", [
  z.object({ source: z.literal(WEB_SOURCE), type: z.literal("buyfit:ping"), nonce: z.string() }),
  z.object({
    source: z.literal(WEB_SOURCE),
    type: z.literal("buyfit:session"),
    nonce: z.string(),
    session: ExtensionSessionSchema,
  }),
  z.object({ source: z.literal(WEB_SOURCE), type: z.literal("buyfit:logout"), nonce: z.string() }),
]);
export type WebToExtensionMessage = z.infer<typeof WebToExtensionMessageSchema>;

/** Réponse de l'extension (via son content script), une par message reçu. */
export const ExtensionAckSchema = z.object({
  source: z.literal(EXTENSION_SOURCE),
  type: z.literal("buyfit:ack"),
  nonce: z.string(),
  ok: z.boolean(),
  /** Email du compte actuellement relié dans l'extension (null = aucun). */
  connectedEmail: z.email().nullable().optional(),
  error: z.string().optional(),
});
export type ExtensionAck = z.infer<typeof ExtensionAckSchema>;
