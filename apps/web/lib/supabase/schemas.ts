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
  type Mensurations,
  type Tailles,
} from "@buyfit/shared";
import { z } from "zod";
import type { Tables } from "./database.types";

export type { ActionResult } from "./merchant-accounts.schema";

// ---------------------------------------------------------------- profil

export const ProfileSchema = z.object({
  userId: z.uuid(),
  taille: TaillesSchema,
  mensurations: MensurationsSchema,
  budgetMax: z.number().nonnegative(),
  devise: CurrencySchema,
  marquesPreferees: z.array(z.string()),
  updatedAt: IsoDateTimeSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

/** Champs modifiables du profil (tous optionnels : on n'envoie que ce qui change). */
export const ProfileUpdateSchema = z
  .object({
    taille: TaillesSchema,
    mensurations: MensurationsSchema,
    budgetMax: z.number().nonnegative("Budget négatif").max(100_000, "Budget trop élevé"),
    devise: CurrencySchema,
    marquesPreferees: z
      .array(z.string().trim().min(1).max(50))
      .max(30, "30 marques maximum")
      .transform((ms) => [...new Set(ms)]),
  })
  .partial();
export type ProfileUpdate = z.input<typeof ProfileUpdateSchema>;

/** Le jsonb en base peut avoir été écrit par un autre client : on lit sans planter. */
const readTailles = (v: unknown): Tailles => TaillesSchema.catch({}).parse(v);
const readMensurations = (v: unknown): Mensurations => MensurationsSchema.catch({}).parse(v);

export function toProfile(row: Tables<"profiles">): Profile {
  return ProfileSchema.parse({
    userId: row.user_id,
    taille: readTailles(row.taille),
    mensurations: readMensurations(row.mensurations),
    budgetMax: Number(row.budget_max),
    devise: row.devise,
    marquesPreferees: row.marques_preferees,
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
