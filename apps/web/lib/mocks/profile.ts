import type { CompteMarchandWeb, WebProfile } from "@/lib/types";
import { MARCHANDS } from "./brands";
import { attendre, ecrire, erreurSimulee, id, lire, MockError } from "./storage";

const cle = (userId: string) => `profil:${userId}`;

export function profilVide(userId: string): WebProfile {
  return {
    id: userId,
    taille: {},
    mensurations: {},
    morphologie: {},
    devise: "EUR",
    marquesPreferees: [],
    contact: {},
    adresse: {},
    daltonisme: { actif: false },
    comptesMarchands: MARCHANDS.map((m) => ({
      ...m,
      statut: "non_connecte" as const,
      logoTexte: m.marchand,
    })),
    onboardingTermine: false,
  };
}

export async function getProfile(userId: string): Promise<WebProfile> {
  await attendre(400);
  if (erreurSimulee()) throw new MockError("Impossible de charger ton profil.");
  return lire<WebProfile>(cle(userId), profilVide(userId));
}

export async function saveProfile(userId: string, patch: Partial<WebProfile>): Promise<WebProfile> {
  await attendre(500);
  if (erreurSimulee()) throw new MockError("L'enregistrement a échoué. Réessaie.");
  const actuel = lire<WebProfile>(cle(userId), profilVide(userId));
  const suivant = { ...actuel, ...patch, id: userId };
  ecrire(cle(userId), suivant);
  return suivant;
}

/**
 * Connexion d'un compte marchand. L'utilisateur saisit ses identifiants dans le coffre
 * H Company : BuyFit ne reçoit qu'une référence `vaultId`, jamais le mot de passe.
 */
export async function connectMerchant(
  userId: string,
  marchand: string,
  email: string,
): Promise<CompteMarchandWeb[]> {
  await attendre(900);
  if (erreurSimulee()) throw new MockError(`Connexion à ${marchand} impossible.`);
  const profil = lire<WebProfile>(cle(userId), profilVide(userId));
  const comptes = profil.comptesMarchands.map((c) =>
    c.marchand === marchand
      ? { ...c, email, vaultId: id("vault"), statut: "connecte" as const }
      : c,
  );
  ecrire(cle(userId), { ...profil, comptesMarchands: comptes });
  return comptes;
}

export async function disconnectMerchant(
  userId: string,
  marchand: string,
): Promise<CompteMarchandWeb[]> {
  await attendre(500);
  const profil = lire<WebProfile>(cle(userId), profilVide(userId));
  const comptes = profil.comptesMarchands.map((c) =>
    c.marchand === marchand
      ? {
          marchand: c.marchand,
          domaine: c.domaine,
          logoTexte: c.logoTexte,
          statut: "non_connecte" as const,
        }
      : c,
  );
  ecrire(cle(userId), { ...profil, comptesMarchands: comptes });
  return comptes;
}
