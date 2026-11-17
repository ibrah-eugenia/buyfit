/**
 * Variables d'environnement Supabase de apps/web, validées avec zod.
 *
 * Next.js n'injecte dans le bundle navigateur que les variables NEXT_PUBLIC_* lues
 * littéralement (`process.env.NEXT_PUBLIC_X`) : ne pas remplacer par un accès dynamique.
 */
import { z } from "zod";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/** URL + clé anon : publiques par nature (protégées par le RLS), utilisables partout. */
export function publicEnv() {
  return PublicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

/** Clé service_role : serveur UNIQUEMENT (jamais de préfixe NEXT_PUBLIC_). */
export function serverEnv() {
  return ServerEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
