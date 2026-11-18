/**
 * Connexion à la plateforme via Supabase Auth (navigateur). Mêmes signatures que les mocks,
 * pour que les pages n'aient qu'un import à changer.
 */
import type { LoginInput, Session, SignupInput } from "@/lib/types";
import { signOut as supabaseSignOut } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";

/** Messages Supabase (en anglais) → messages affichables. */
function traduire(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Un compte existe déjà avec cet email. Connecte-toi.";
  if (m.includes("email not confirmed"))
    return "Confirme d'abord ton email : clique sur le lien reçu par mail.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Trop de tentatives. Patiente une minute puis réessaie.";
  if (m.includes("email address") && m.includes("invalid"))
    return "Cette adresse email est refusée. Utilise une autre adresse.";
  if (m.includes("signups not allowed")) return "Les inscriptions sont fermées pour le moment.";
  if (m.includes("password")) return "Mot de passe refusé : choisis-en un plus solide.";
  return "Le service de connexion ne répond pas. Réessaie.";
}

export async function getSession(): Promise<Session | null> {
  // getUser() vérifie le token auprès de Supabase (getSession() lit seulement le cookie).
  const {
    data: { user },
  } = await createClient().auth.getUser();
  return user?.email ? { userId: user.id, email: user.email } : null;
}

/**
 * Inscription. Renvoie `null` si Supabase exige la confirmation de l'email :
 * l'utilisateur doit alors cliquer sur le lien reçu (retour par /auth/callback).
 */
export async function signUp(input: SignupInput): Promise<Session | null> {
  const redirect = new URL("/auth/callback", window.location.origin);
  redirect.searchParams.set("next", "/onboarding");
  const { data, error } = await createClient().auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { emailRedirectTo: redirect.toString() },
  });
  if (error) throw new Error(traduire(error.message));
  // Email déjà inscrit : Supabase renvoie un utilisateur sans identité (anti-énumération).
  if (data.user && data.user.identities?.length === 0)
    throw new Error("Un compte existe déjà avec cet email. Connecte-toi.");
  if (!data.session || !data.user?.email) return null;
  return { userId: data.user.id, email: data.user.email };
}

export async function signIn(input: LoginInput): Promise<Session> {
  const { data, error } = await createClient().auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error || !data.user.email) throw new Error(traduire(error?.message ?? ""));
  return { userId: data.user.id, email: data.user.email };
}

export async function signOut() {
  const result = await supabaseSignOut();
  if (!result.ok) throw new Error("La déconnexion a échoué. Réessaie.");
}
