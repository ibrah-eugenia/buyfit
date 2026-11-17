import { z } from "zod";
import { CurrencySchema } from "./common.js";

/** Produit équivalent trouvé chez un marchand (via Bright Data). */
export const ProductMatchSchema = z.object({
  id: z.string().min(1),
  marque: z.string().min(1),
  nom: z.string().min(1),
  prix: z.number().nonnegative(),
  devise: CurrencySchema,
  url: z.url(), // page produit chez le marchand
  imageUrl: z.url(),
  tailleDisponibles: z.array(z.string()).default([]),
  score: z.number().min(0).max(1), // similarité visuelle + adéquation profil
});
export type ProductMatch = z.infer<typeof ProductMatchSchema>;
