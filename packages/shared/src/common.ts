import { z } from "zod";

/** Code devise ISO 4217 (EUR, USD, GBP…). */
export const CurrencySchema = z
  .string()
  .length(3)
  .transform((s) => s.toUpperCase());
export type Currency = z.infer<typeof CurrencySchema>;

/** Date ISO 8601 avec fuseau (ex. 2026-11-17T10:00:00.000Z). */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

/** Erreur renvoyée par apps/api pour tout code HTTP >= 400. */
export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
