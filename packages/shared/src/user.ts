import { z } from "zod";
import { CurrencySchema } from "./common.js";

export const MensurationsSchema = z.object({
  hauteurCm: z.number().positive().optional(),
  poitrineCm: z.number().positive().optional(),
  tourDeTailleCm: z.number().positive().optional(),
  hanchesCm: z.number().positive().optional(),
});
export type Mensurations = z.infer<typeof MensurationsSchema>;

/** Tailles habituelles de l'utilisateur, au format marchand (ex. "M", "38", "42"). */
export const TaillesSchema = z.object({
  haut: z.string().optional(),
  bas: z.string().optional(),
  pointure: z.string().optional(),
});
export type Tailles = z.infer<typeof TaillesSchema>;

/**
 * Compte chez un marchand sur lequel l'agent H Company passe commande.
 * ⚠️ Jamais de mot de passe ici : les identifiants vivent dans un vault H Company
 * (référencé par `vaultId`), jamais dans Supabase ni dans l'extension.
 */
export const CompteMarchandSchema = z.object({
  marchand: z.string().min(1), // ex. "Zara"
  domaine: z.string().min(1), // ex. "zara.com"
  email: z.email().optional(),
  vaultId: z.string().optional(),
});
export type CompteMarchand = z.infer<typeof CompteMarchandSchema>;

export const UserProfileSchema = z.object({
  id: z.string().min(1),
  photos: z.array(z.url()).default([]), // photos plein pied pour l'essayage
  taille: TaillesSchema.default({}),
  mensurations: MensurationsSchema.default({}),
  budgetMax: z.number().nonnegative(),
  devise: CurrencySchema.default("EUR"),
  marquesPreferees: z.array(z.string().min(1)).default([]),
  comptesMarchands: z.array(CompteMarchandSchema).default([]),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
