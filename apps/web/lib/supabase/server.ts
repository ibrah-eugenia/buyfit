/**
 * Clients Supabase côté serveur (Server Components, Server Actions, Route Handlers).
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { BuyFitClient } from "./client";
import type { Database } from "./database.types";
import { publicEnv, serverEnv } from "./env";

/**
 * Client de l'utilisateur connecté (clé anon + cookies de session) : soumis au RLS.
 * À créer à chaque requête, jamais en variable globale.
 */
export async function createClient(): Promise<BuyFitClient> {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component : les cookies sont en lecture seule.
            // Sans risque, le proxy (proxy.ts) rafraîchit la session à chaque requête.
          }
        },
      },
    },
  );
}

/**
 * Client admin (clé service_role) : CONTOURNE le RLS.
 * Réservé aux actions que l'utilisateur ne doit pas pouvoir faire lui-même
 * (relier un compte marchand à H Company, créer la session de l'extension).
 * Toujours vérifier l'utilisateur avec createClient() avant de s'en servir.
 */
export function createAdminClient(): BuyFitClient {
  return createSupabaseClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
