/**
 * Corps de requête / réponse de chaque endpoint de apps/api.
 * Voir packages/shared/api-contract.md.
 */
import { z } from "zod";
import { InspirationCaptureSchema } from "./capture.js";
import { SelectionImageSchema } from "./identify.js";
import { ProductMatchSchema } from "./product.js";
import { TryOnRequestSchema } from "./tryon.js";

// POST /capture
export const CaptureRequestSchema = z.object({
  userId: z.string().min(1),
  capture: InspirationCaptureSchema,
  /** Budget max pour CETTE pièce (choisi dans l'extension). Absent → budget du profil. */
  budgetMax: z.number().positive().max(100_000).optional(),
  /** Requêtes de repli (pièce identifiée) si `capture.description` ne donne rien. */
  requetesSecours: z.array(z.string().min(1).max(100)).max(3).optional(),
});
export type CaptureRequest = z.infer<typeof CaptureRequestSchema>;
export const CaptureResponseSchema = z.array(ProductMatchSchema);
export type CaptureResponse = z.infer<typeof CaptureResponseSchema>;

// POST /serp : recherche Google Shopping brute via Bright Data SERP (comme la console SERP).
export const SerpRequestSchema = z.object({
  userId: z.string().min(1),
  requete: z.string().min(1).max(160),
  requetesSecours: z.array(z.string().min(1).max(100)).max(3).optional(),
});
export type SerpRequest = z.infer<typeof SerpRequestSchema>;
export const SerpResponseSchema = z.object({
  /** Requête qui a effectivement donné des résultats (principale ou repli). */
  requete: z.string(),
  resultats: z.array(ProductMatchSchema),
});
export type SerpResponse = z.infer<typeof SerpResponseSchema>;

// POST /search : pièce identifiée → une recherche Google Shopping par magasin test
// (Zara, Uniqlo), puis filtre IA de similarité visuelle avec la pièce sélectionnée.
export const SearchRequestSchema = z.object({
  userId: z.string().min(1),
  requete: z.string().min(1).max(160),
  genre: z.enum(["homme", "femme", "mixte"]).optional(),
  taille: z.string().max(10).optional(),
  /** Pièce sélectionnée (crop) : référence pour le filtre de similarité. */
  imageDataUrl: SelectionImageSchema.optional(),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export const SearchResponseSchema = z.object({
  /** Produits retenus, du plus ressemblant au moins ressemblant (score = similarité 0–1). */
  resultats: z.array(ProductMatchSchema),
  /** false si le filtre IA n'a pas pu tourner (résultats bruts). */
  filtreIA: z.boolean(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// POST /tryon — userPhotoUrl optionnel : sinon 1re photo du profil.
export const TryOnApiRequestSchema = TryOnRequestSchema.partial({ userPhotoUrl: true }).extend({
  userId: z.string().min(1),
  /** « Marque - nom du produit » : aide le modèle à reproduire couleur et coupe. */
  garmentName: z.string().max(300).optional(),
  /** Fiche produit : on y récupère packshot et photo portée pour un essayage plus fidèle. */
  productUrl: z.url().max(2048).optional(),
});
export type TryOnApiRequest = z.infer<typeof TryOnApiRequestSchema>;

// POST /order → OrderRequestSchema / OrderStatusSchema
// GET  /order/:id → OrderStatusSchema
