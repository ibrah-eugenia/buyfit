/**
 * Corps de requête / réponse de chaque endpoint de apps/api.
 * Voir packages/shared/api-contract.md.
 */
import { z } from "zod";
import { InspirationCaptureSchema } from "./capture.js";
import { ProductMatchSchema } from "./product.js";
import { TryOnRequestSchema } from "./tryon.js";

// POST /capture
export const CaptureRequestSchema = z.object({
  userId: z.string().min(1),
  capture: InspirationCaptureSchema,
});
export type CaptureRequest = z.infer<typeof CaptureRequestSchema>;
export const CaptureResponseSchema = z.array(ProductMatchSchema);
export type CaptureResponse = z.infer<typeof CaptureResponseSchema>;

// POST /tryon — userPhotoUrl optionnel : sinon 1re photo du profil.
export const TryOnApiRequestSchema = TryOnRequestSchema.partial({ userPhotoUrl: true }).extend({
  userId: z.string().min(1),
});
export type TryOnApiRequest = z.infer<typeof TryOnApiRequestSchema>;

// POST /order → OrderRequestSchema / OrderStatusSchema
// GET  /order/:id → OrderStatusSchema
