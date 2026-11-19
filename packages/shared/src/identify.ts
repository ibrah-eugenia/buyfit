import { z } from "zod";

/** Zone de l'épingle sélectionnée par l'utilisateur, découpée par l'extension (JPEG/PNG/WebP en base64). */
export const SelectionImageSchema = z
  .string()
  .max(3_000_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Image base64 attendue");

// POST /identify : un modèle de vision (Hugging Face) nomme la pièce sélectionnée.
export const IdentifyRequestSchema = z.object({
  userId: z.string().min(1),
  imageDataUrl: SelectionImageSchema,
});
export type IdentifyRequest = z.infer<typeof IdentifyRequestSchema>;

export const IdentifiedItemSchema = z.object({
  /** Nom lisible de l'article, ex. « Blazer croisé en laine à carreaux bleu ». */
  nom: z.string().min(1).max(160),
  /** Requête courte pour Google Shopping, ex. « blazer croisé laine carreaux bleu homme ». */
  requete: z.string().min(1).max(160),
  /** Requêtes de repli, de plus en plus génériques (Google ne renvoie rien sur certaines formulations). */
  requetesSecours: z.array(z.string().min(1).max(100)).max(3).default([]),
  categorie: z.string().max(60).optional(),
  couleur: z.string().max(60).optional(),
  matiere: z.string().max(60).optional(),
  /** Rayon de la pièce : ajouté à la requête s'il n'y figure pas. */
  genre: z.enum(["homme", "femme", "mixte"]).optional(),
});
export type IdentifiedItem = z.infer<typeof IdentifiedItemSchema>;
