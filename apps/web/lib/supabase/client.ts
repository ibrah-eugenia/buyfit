/**
 * Client Supabase pour les composants client ("use client").
 * Clé anon + session de l'utilisateur (cookies) : soumis au RLS.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicEnv } from "./env";

export type BuyFitClient = SupabaseClient<Database>;

let browserClient: BuyFitClient | undefined;

export function createClient(): BuyFitClient {
  if (browserClient) return browserClient;
  const env = publicEnv();
  browserClient = createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}
