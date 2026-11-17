import type { LoginInput, Session, SignupInput } from "@/lib/types";
import { attendre, effacer, ecrire, erreurSimulee, id, lire, MockError } from "./storage";

type CompteMock = { userId: string; email: string; empreinte: string };

/** Empreinte SHA-256 : même en mock, on ne garde jamais le mot de passe en clair. */
async function empreinte(motDePasse: string) {
  const data = new TextEncoder().encode(motDePasse);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getSession(): Promise<Session | null> {
  return lire<Session | null>("session", null);
}

export async function signUp(input: SignupInput): Promise<Session> {
  await attendre(700);
  if (erreurSimulee()) throw new MockError("Le service d'inscription ne répond pas. Réessaie.");
  const comptes = lire<CompteMock[]>("comptes", []);
  const email = input.email.toLowerCase();
  if (comptes.some((c) => c.email === email)) {
    throw new MockError("Un compte existe déjà avec cet email. Connecte-toi.");
  }
  const compte: CompteMock = {
    userId: id("user"),
    email,
    empreinte: await empreinte(input.password),
  };
  ecrire("comptes", [...comptes, compte]);
  const session = { userId: compte.userId, email };
  ecrire("session", session);
  return session;
}

export async function signIn(input: LoginInput): Promise<Session> {
  await attendre(600);
  if (erreurSimulee()) throw new MockError("Connexion impossible pour le moment. Réessaie.");
  const comptes = lire<CompteMock[]>("comptes", []);
  const compte = comptes.find((c) => c.email === input.email.toLowerCase());
  if (!compte || compte.empreinte !== (await empreinte(input.password))) {
    throw new MockError("Email ou mot de passe incorrect.");
  }
  const session = { userId: compte.userId, email: compte.email };
  ecrire("session", session);
  return session;
}

export async function signOut() {
  await attendre(200);
  effacer("session");
}
