import { z } from "zod";
import { IsoDateTimeSchema } from "./common.js";

/** Image de tenue capturée par l'extension sur Pinterest. */
export const InspirationCaptureSchema = z.object({
  imageUrl: z.url(), // image de l'épingle en grand format
  pinUrl: z.url(), // URL de l'épingle (ou de la page) d'origine
  /** Titre / texte alternatif de l'épingle : sert de requête texte à la recherche produits. */
  description: z.string().max(500).optional(),
  capturedAt: IsoDateTimeSchema,
});
export type InspirationCapture = z.infer<typeof InspirationCaptureSchema>;
