import { z } from "zod";
import { IsoDateTimeSchema } from "./common.js";

/** Image de tenue capturée par l'extension sur Pinterest. */
export const InspirationCaptureSchema = z.object({
  imageUrl: z.url(), // image de l'épingle en grand format
  pinUrl: z.url(), // URL de l'épingle (ou de la page) d'origine
  capturedAt: IsoDateTimeSchema,
});
export type InspirationCapture = z.infer<typeof InspirationCaptureSchema>;
