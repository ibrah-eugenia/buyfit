import type {
  ContactStep,
  CorpsStep,
  Genre,
  Morphologie,
  PhotosStep,
  WebProfile,
} from "@/lib/types";

/** Conversions profil ⇄ valeurs de chaque étape (partagées par l'onboarding et les réglages). */
export const versEtape = {
  genre: (p: WebProfile): { genre?: Genre } => ({ genre: p.genre }),
  photos: (p: WebProfile): Partial<PhotosStep> => ({
    photoCorpsUrl: p.photoCorpsUrl,
    mannequinUrl: p.mannequinUrl,
  }),
  corps: (p: WebProfile): Partial<CorpsStep> => ({
    mensurations: p.mensurations as CorpsStep["mensurations"],
    poidsKg: p.poidsKg as number,
    pointure: p.taille.pointure ?? "",
  }),
  morpho: (p: WebProfile): { morphologie?: Morphologie } => ({
    morphologie: p.morphologie as Morphologie,
  }),
  marques: (p: WebProfile) => ({ budgetMax: p.budgetMax, marquesPreferees: p.marquesPreferees }),
  contact: (p: WebProfile, emailSession: string): Partial<ContactStep> => ({
    contact: { email: emailSession, ...p.contact } as ContactStep["contact"],
    adresse: p.adresse as ContactStep["adresse"],
    daltonisme: p.daltonisme,
  }),
};

export const versProfil = {
  corps: (p: WebProfile, v: CorpsStep): Partial<WebProfile> => ({
    mensurations: v.mensurations,
    poidsKg: v.poidsKg,
    taille: { ...p.taille, pointure: v.pointure },
  }),
};
