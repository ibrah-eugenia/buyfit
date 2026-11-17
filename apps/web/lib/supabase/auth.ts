/**
 * Authentification de la plateforme, côté navigateur (composants "use client").
 * Email + mot de passe, et Google (si activé dans supabase/config.toml).
 *
 * Toutes les fonctions renvoient un AuthResult au lieu de lancer une exception,
 * pour un affichage simple dans les formulaires.
 */
import { z } from "zod";
import { createClient } from "./client";
import { disconnectExtension } from "./extension-bridge";
import { safeNextPath } from "./paths";

export { safeNextPath };

export type AuthResult = { ok: true } | { ok: false; error: string };

export const CredentialsSchema = z.object({
  email: z.email("Adresse email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
});
export type Credentials = z.infer<typeof CredentialsSchema>;

function callbackUrl(next?: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  if (next) url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}

function fail(error: unknown): AuthResult {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Données invalides" };
  }
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function signUpWithPassword(credentials: Credentials): Promise<AuthResult> {
  try {
    const { email, password } = CredentialsSchema.parse(credentials);
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl("/profil") },
    });
    return error ? fail(error) : { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signInWithPassword(credentials: Credentials): Promise<AuthResult> {
  try {
    const { email, password } = CredentialsSchema.parse(credentials);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    return error ? fail(error) : { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Redirige vers Google ; au retour, /auth/callback ouvre la session puis renvoie vers `next`. */
export async function signInWithGoogle(next = "/"): Promise<AuthResult> {
  const { error } = await createClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  return error ? fail(error) : { ok: true };
}

/**
 * Déconnexion partout : `scope: "global"` révoque aussi la session de l'extension
 * (son prochain refresh échouera). On prévient l'extension sans l'attendre, pour
 * qu'elle oublie ses tokens tout de suite si elle est installée.
 */
export async function signOut(): Promise<AuthResult> {
  void disconnectExtension().catch(() => undefined);
  const { error } = await createClient().auth.signOut({ scope: "global" });
  return error ? fail(error) : { ok: true };
}
