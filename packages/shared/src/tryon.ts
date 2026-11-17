import { z } from "zod";

/** Contrat du service d'essayage (services/tryon, Félix). */
export const TryOnRequestSchema = z.object({
  userPhotoUrl: z.url(),
  garmentImageUrl: z.url(),
});
export type TryOnRequest = z.infer<typeof TryOnRequestSchema>;

export const TryOnResultSchema = z.object({
  resultImageUrl: z.url(), // URL publique (ex. Supabase Storage) ou data URL
  latencyMs: z.number().nonnegative().optional(),
});
export type TryOnResult = z.infer<typeof TryOnResultSchema>;
