"use server";
/**
 * Crée une session Supabase PROPRE à l'extension pour l'utilisateur connecté.
 *
 * Pourquoi pas simplement transmettre la session du site ? Supabase fait tourner les
 * refresh tokens : si le site et l'extension partagent la même session, le premier qui
 * rafraîchit invalide le token de l'autre (et la détection de réutilisation peut
 * déconnecter les deux). Une session distincte évite ça, et l'extension peut être
 * déconnectée sans toucher au site.
 *
 * Méthode : lien magique généré côté serveur (clé service_role, rien n'est envoyé par
 * email) puis vérifié immédiatement par un client sans stockage → nouvelle session.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicEnv } from "./env";
import { ExtensionSessionSchema, type ExtensionSession } from "./extension-protocol";
import { createAdminClient, createClient } from "./server";

export async function createExtensionSession(): Promise<ExtensionSession> {
  // 1. Qui est connecté sur le site ? (vérifié auprès de Supabase Auth, pas juste le cookie)
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Connecte-toi sur BuyFit avant de relier l'extension.");
  if (!user.email) throw new Error("Ce compte n'a pas d'email : impossible de relier l'extension.");

  // 2. Lien magique pour CET utilisateur (aucun email envoyé).
  const { data: link, error: linkError } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (linkError)
    throw new Error(`Création de la session extension impossible : ${linkError.message}`);

  // 3. Vérification immédiate par un client isolé → session neuve, indépendante du site.
  const env = publicEnv();
  const isolated = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data: verified, error: verifyError } = await isolated.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  const session = verified.session;
  if (verifyError || !session) {
    throw new Error(
      `Création de la session extension impossible : ${verifyError?.message ?? "pas de session"}`,
    );
  }
  if (session.user.id !== user.id) throw new Error("Incohérence d'utilisateur, abandon.");

  return ExtensionSessionSchema.parse({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    userId: user.id,
    email: user.email,
  });
}
