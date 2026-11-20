/**
 * Profil, photos et comptes marchands lus et écrits dans Supabase (soumis au RLS).
 * Convertit le profil en base (`Profile`) vers le profil du site (`WebProfile`) et inversement.
 */
import type { CompteMarchandWeb, WebProfile } from "@/lib/types";
import {
  connectMerchantAccount,
  disconnectMerchantAccount,
  listMerchantAccounts,
} from "@/lib/supabase/merchant-accounts";
import {
  SUPPORTED_MERCHANTS,
  type ActionResult,
  type MerchantAccountView,
} from "@/lib/supabase/merchant-accounts.schema";
import { deleteUserPhoto, uploadUserPhoto } from "@/lib/supabase/photos";
import { getProfile as getDbProfile, listUserPhotos, upsertProfile } from "@/lib/supabase/profile";
import type { PhotoType, Profile, ProfileUpdate, UserPhoto } from "@/lib/supabase/schemas";

function donnees<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

const STATUT_WEB: Record<MerchantAccountView["statut"], CompteMarchandWeb["statut"]> = {
  connecte: "connecte",
  expire: "a_reconnecter",
  erreur: "a_reconnecter",
  en_attente: "non_connecte",
};

/** Un compte par marchand pris en charge, relié ou non. Jamais d'identifiant H Company. */
function versComptes(comptes: MerchantAccountView[]): CompteMarchandWeb[] {
  return SUPPORTED_MERCHANTS.map((m) => {
    const compte = comptes.find((c) => c.domaine === m.domaine);
    const statut = compte ? STATUT_WEB[compte.statut] : "non_connecte";
    return {
      marchand: m.marchand,
      domaine: m.domaine,
      logoTexte: m.marchand,
      statut,
      ...(statut !== "non_connecte" && compte?.email ? { email: compte.email } : {}),
    };
  });
}

/** Photo la plus récente de chaque type (URL signée 1 h). */
function dernierePhoto(photos: UserPhoto[], type: PhotoType): UserPhoto | undefined {
  return photos
    .filter((p) => p.type === type && p.url)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
}

const isMannequin = (p: UserPhoto) =>
  p.type === "pied" && p.storagePath.split("/")[1] === "mannequin";
/** Photos d'origine (visage, corps) qui servent à générer le mannequin : `<user>/sources/`. */
const isSource = (p: UserPhoto) => p.storagePath.split("/")[1] === "sources";

function versWebProfile(p: Profile, photos: UserPhoto[], comptes: MerchantAccountView[]) {
  const profil: WebProfile = {
    id: p.userId,
    genre: p.genre ?? undefined,
    mannequinUrl: dernierePhoto(photos.filter(isMannequin), "pied")?.url ?? undefined,
    photoCorpsUrl:
      dernierePhoto(
        photos.filter((photo) => !isMannequin(photo) && !isSource(photo)),
        "pied",
      )?.url ?? undefined,
    photoTeteUrl: dernierePhoto(photos.filter((photo) => !isSource(photo)), "face")?.url ?? undefined,
    taille: p.taille,
    mensurations: p.mensurations,
    poidsKg: p.poidsKg ?? undefined,
    morphologie: p.morphologie,
    devise: p.devise,
    budgetMax: p.budgetMax,
    marquesPreferees: p.marquesPreferees,
    contact: p.contact,
    adresse: p.adresse,
    daltonisme: p.daltonisme,
    comptesMarchands: versComptes(comptes),
    onboardingTermine: p.onboardingTermine,
  };
  return profil;
}

export async function getProfile(_userId: string): Promise<WebProfile> {
  const [profil, photos, comptes] = await Promise.all([
    getDbProfile(),
    listUserPhotos(),
    listMerchantAccounts(),
  ]);
  return versWebProfile(donnees(profil), donnees(photos), donnees(comptes));
}

/** Data URL produite par PhotoDrop → fichier JPEG envoyé au bucket privé. */
async function envoyerPhoto(
  dataUrl: string,
  type: PhotoType,
  anciennes: UserPhoto[],
  mannequin = false,
) {
  const blob = await (await fetch(dataUrl)).blob();
  const fichier = new File([blob], `${type}.jpg`, { type: blob.type || "image/jpeg" });
  donnees(await uploadUserPhoto(fichier, type, mannequin));
  // Une seule photo par type : on supprime les précédentes (minimisation des données).
  await Promise.all(
    anciennes
      .filter((p) => p.type === type && isMannequin(p) === mannequin && !isSource(p))
      .map((p) => deleteUserPhoto(p.id)),
  );
}

export type SourcePhoto = { id: string; type: PhotoType; url: string };

/** Photos d'origine enregistrées (visage et corps), plus anciennes d'abord. */
export async function listSourcePhotos(): Promise<SourcePhoto[]> {
  return donnees(await listUserPhotos())
    .filter((p) => isSource(p) && p.url)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((p) => ({ id: p.id, type: p.type, url: p.url! }));
}

/** Enregistre une photo d'origine dans le bucket privé (dossier `sources/`). */
export async function addSourcePhoto(file: File, type: PhotoType): Promise<SourcePhoto> {
  const photo = donnees(await uploadUserPhoto(file, type, "sources"));
  if (!photo.url) throw new Error("Photo enregistrée mais illisible.");
  return { id: photo.id, type: photo.type, url: photo.url };
}

export async function removeSourcePhoto(id: string): Promise<void> {
  donnees(await deleteUserPhoto(id));
}

const estNouvellePhoto = (v: string | undefined): v is string => !!v?.startsWith("data:");

export async function saveProfile(userId: string, patch: Partial<WebProfile>): Promise<WebProfile> {
  if (
    estNouvellePhoto(patch.mannequinUrl) ||
    estNouvellePhoto(patch.photoCorpsUrl) ||
    estNouvellePhoto(patch.photoTeteUrl)
  ) {
    const anciennes = donnees(await listUserPhotos());
    if (estNouvellePhoto(patch.mannequinUrl))
      await envoyerPhoto(patch.mannequinUrl, "pied", anciennes, true);
    if (estNouvellePhoto(patch.photoCorpsUrl))
      await envoyerPhoto(patch.photoCorpsUrl, "pied", anciennes);
    if (estNouvellePhoto(patch.photoTeteUrl))
      await envoyerPhoto(patch.photoTeteUrl, "face", anciennes);
  }

  const maj: ProfileUpdate = {
    ...(patch.taille !== undefined && { taille: patch.taille }),
    ...(patch.mensurations !== undefined && { mensurations: patch.mensurations }),
    ...(patch.budgetMax !== undefined && { budgetMax: patch.budgetMax }),
    ...(patch.devise !== undefined && { devise: patch.devise }),
    ...(patch.marquesPreferees !== undefined && { marquesPreferees: patch.marquesPreferees }),
    ...(patch.genre !== undefined && { genre: patch.genre }),
    ...(patch.poidsKg !== undefined && { poidsKg: patch.poidsKg }),
    ...(patch.morphologie !== undefined && { morphologie: patch.morphologie }),
    ...(patch.contact !== undefined && { contact: patch.contact }),
    ...(patch.adresse !== undefined && { adresse: patch.adresse }),
    ...(patch.daltonisme !== undefined && { daltonisme: patch.daltonisme }),
    ...(patch.onboardingTermine !== undefined && { onboardingTermine: patch.onboardingTermine }),
  };
  if (Object.keys(maj).length > 0) donnees(await upsertProfile(maj));
  return getProfile(userId);
}

function domaineDe(marchand: string) {
  const m = SUPPORTED_MERCHANTS.find((x) => x.marchand === marchand);
  if (!m) throw new Error(`${marchand} n'est pas encore pris en charge.`);
  return m.domaine;
}

/**
 * Relie un compte marchand : email + mot de passe partent dans le vault H Company de
 * l'utilisateur. Le mot de passe traverse notre serveur en mémoire, sans être enregistré.
 */
export async function connectMerchant(
  _userId: string,
  marchand: string,
  email: string,
  password: string,
): Promise<CompteMarchandWeb[]> {
  donnees(await connectMerchantAccount({ domaine: domaineDe(marchand), email, password }));
  return versComptes(donnees(await listMerchantAccounts()));
}

export async function disconnectMerchant(
  _userId: string,
  marchand: string,
): Promise<CompteMarchandWeb[]> {
  const domaine = domaineDe(marchand);
  const compte = donnees(await listMerchantAccounts()).find((c) => c.domaine === domaine);
  if (compte) donnees(await disconnectMerchantAccount(compte.id));
  return versComptes(donnees(await listMerchantAccounts()));
}
