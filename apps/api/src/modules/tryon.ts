/** Client HTTP vers le service d'essayage de Félix (services/tryon). */
import { TryOnResultSchema, type TryOnRequest, type TryOnResult } from "@buyfit/shared";
import { config } from "../config.js";

export async function tryOn(req: TryOnRequest): Promise<TryOnResult> {
  if (config.mocks.tryon) {
    await new Promise((r) => setTimeout(r, 1200));
    // Mock : renvoie l'image du vêtement telle quelle.
    return { resultImageUrl: req.garmentImageUrl, latencyMs: 1200 };
  }
  const res = await fetch(new URL("/tryon", config.TRYON_SERVICE_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`tryon HTTP ${res.status}: ${await res.text()}`);
  return TryOnResultSchema.parse(await res.json());
}
