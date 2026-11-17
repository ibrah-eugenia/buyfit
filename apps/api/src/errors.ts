import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Erreur d'une brique en aval (Bright Data, H Company, try-on, Supabase). */
export const upstream = (service: string, err: unknown) =>
  new HttpError(502, `${service} a échoué`, err instanceof Error ? err.message : err);
