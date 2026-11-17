/**
 * Ce qui entre et sort des fonctions d'accès : schémas zod et vues renvoyées aux pages.
 * Les formats métier viennent de packages/shared (source de vérité commune avec l'API).
 * Colonnes snake_case en base → champs camelCase ici.
 */
import {
  CurrencySchema,
  IsoDateTimeSchema,
  MensurationsSchema,
  OrderStatusSchema,
  ProductMatchSchema,
  TaillesSchema,
  type Tailles,
} from "@buyfit/shared";
import { z } from "zod";
import type { Tables } from "./database.types";

export type { ActionResult } from "./merchant-accounts.schema";

// ---------------------------------------------------------------- profil

/** Mensurations du contrat + entrejambe (saisie sur le site). */
const MensurationsProfilSchema = MensurationsSchema.extend({
  entrejambeCm: z.number().positive().optional(),
});
type MensurationsProfil = z.infer<typeof MensurationsProfilSchema>;

export const GenreSchema = z.enum(["femme", "homme", "non_precise"]);
export const MorphologieSchema = z
  .object({
    epaules: z.enum(["etroites", "moyennes", "larges"]),
    ventre: z.enum(["plat", "moyen", "arrondi"]),
    hanches: z.enum(["etroites", "moyennes", "larges"]),
    coupe: z.enum(["ajustee", "normale", "ample"]),
  })
  .partial();
const texte = (max: number) => z.string().trim().max(max);
export const ContactSchema = z
  .object({
    prenom: texte(80),
    nom: texte(80),
    email: z.email("Adresse email invalide"),
    telephone: texte(30),
  })
  .partial();
export const AdresseSchema = z
  .object({ numeroEtRue: texte(200), codePostal: texte(10), ville: texte(100) })
  .partial();
export const DaltonismeSchema = z.object({
  actif: z.boolean(),
  type: z.enum(["protanopie", "deuteranopie", "tritanopie", "achromatopsie"]).optional(),
});

export const ProfileSchema = z.object({
  userId: z.uuid(),
  taille: TaillesSchema,
  mensurations: MensurationsProfilSchema,
  budgetMax: z.number().nonnegative(),
  devise: CurrencySchema,
  marquesPreferees: z.array(z.string()),
  genre: GenreSchema.nullable(),
  poidsKg: z.number().nullable(),
  morphologie: MorphologieSchema,
  contact: ContactSchema,
  adresse: AdresseSchema,
  daltonisme: DaltonismeSchema,
  onboardingTermine: z.boolean(),
  updatedAt: IsoDateTimeSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

/** Champs modifiables du profil (tous optionnels : on n'envoie que ce qui change). */
export const ProfileUpdateSchema = z
  .object({
    taille: TaillesSchema,
    mensurations: MensurationsProfilSchema,
    budgetMax: z.number().nonnegative("Budget négatif").max(100_000, "Budget trop élevé"),
    devise: CurrencySchema,
    marquesPreferees: z
      .array(z.string().trim().min(1).max(50))
      .max(30, "30 marques maximum")
      .transform((ms) => [...new Set(ms)]),
    genre: GenreSchema,
    poidsKg: z.number().min(30, "Poids : minimum 30").max(250, "Poids : maximum 250"),
    morphologie: MorphologieSchema,
    contact: ContactSchema,
    adresse: AdresseSchema,
    daltonisme: DaltonismeSchema,
    onboardingTermine: z.boolean(),
  })
  .partial();
export type ProfileUpdate = z.input<typeof ProfileUpdateSchema>;

/** Le jsonb en base peut avoir été écrit par un autre client : on lit sans planter. */
const readTailles = (v: unknown): Tailles => TaillesSchema.catch({}).parse(v);
const readMensurations = (v: unknown): MensurationsProfil =>
  MensurationsProfilSchema.catch({}).parse(v);
const read = <T extends z.ZodType>(schema: T, v: unknown, fallback: z.infer<T>): z.infer<T> =>
  schema.catch(fallback).parse(v);

export function toProfile(row: Tables<"profiles">): Profile {
  return ProfileSchema.parse({
    userId: row.user_id,
    taille: readTailles(row.taille),
    mensurations: readMensurations(row.mensurations),
    budgetMax: Number(row.budget_max),
    devise: row.devise,
    marquesPreferees: row.marques_preferees,
    genre: read(GenreSchema.nullable(), row.genre, null),
    poidsKg: row.poids_kg === null ? null : Number(row.poids_kg),
    morphologie: read(MorphologieSchema, row.morphologie, {}),
    contact: read(ContactSchema, row.contact, {}),
    adresse: read(AdresseSchema, row.adresse, {}),
    daltonisme: read(DaltonismeSchema, row.daltonisme, { actif: false }),
    onboardingTermine: row.onboarding_termine,
    updatedAt: row.updated_at,
  });
}

// ---------------------------------------------------------------- photos

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // = limite du bucket user-photos
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const PhotoTypeSchema = z.enum(["face", "pied"]);
export type PhotoType = z.infer<typeof PhotoTypeSchema>;

export const UserPhotoSchema = z.object({
  id: z.uuid(),
  type: PhotoTypeSchema,
  storagePath: z.string().min(1),
  /** URL signée (1 h) : le bucket est privé. null si la signature a échoué (fichier absent). */
  url: z.url().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type UserPhoto = z.infer<typeof UserPhotoSchema>;

// ---------------------------------------------------------------- produits / captures

/** ProductMatch du contrat + `matchId`, l'id en base (pour relier essayages et commandes). */
export const ProductMatchViewSchema = ProductMatchSchema.extend({ matchId: z.uuid() });
export type ProductMatchView = z.infer<typeof ProductMatchViewSchema>;

type ProductMatchRow = Pick<
  Tables<"product_matches">,
  | "id"
  | "external_id"
  | "marque"
  | "nom"
  | "prix"
  | "devise"
  | "url"
  | "image_url"
  | "tailles_disponibles"
  | "score"
>;
export const PRODUCT_MATCH_COLUMNS =
  "id, external_id, marque, nom, prix, devise, url, image_url, tailles_disponibles, score, rang";

export function toProductMatchView(row: ProductMatchRow): ProductMatchView {
  return ProductMatchViewSchema.parse({
    matchId: row.id,
    id: row.external_id,
    marque: row.marque,
    nom: row.nom,
    prix: Number(row.prix),
    devise: row.devise,
    url: row.url,
    imageUrl: row.image_url,
    tailleDisponibles: row.tailles_disponibles,
    score: Number(row.score),
  });
}

export const CaptureViewSchema = z.object({
  id: z.uuid(),
  imageUrl: z.url(),
  pinUrl: z.url(),
  capturedAt: IsoDateTimeSchema,
  /** Triés du meilleur au moins bon. */
  produits: z.array(ProductMatchViewSchema),
});
export type CaptureView = z.infer<typeof CaptureViewSchema>;

// ---------------------------------------------------------------- essayages

export const TryonViewSchema = z.object({
  id: z.uuid(),
  createdAt: IsoDateTimeSchema,
  garmentImageUrl: z.url(),
  /** URL signée (1 h) de l'image d'essayage, null si pas (encore) de résultat. */
  resultImageUrl: z.url().nullable(),
  latencyMs: z.number().nonnegative().nullable(),
  produit: ProductMatchViewSchema.nullable(),
});
export type TryonView = z.infer<typeof TryonViewSchema>;

// ---------------------------------------------------------------- commandes

/** OrderStatus du contrat (ce que voit aussi l'extension) + le détail pour l'historique. */
export const OrderViewSchema = OrderStatusSchema.extend({
  taille: z.string(),
  productUrl: z.url(),
  confirmed: z.boolean(),
  createdAt: IsoDateTimeSchema,
  marchand: z.string().nullable(),
  produit: ProductMatchViewSchema.nullable(),
});
export type OrderView = z.infer<typeof OrderViewSchema>;
