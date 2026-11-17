/**
 * Types et schémas propres au site web.
 *
 * Ils ÉTENDENT le contrat partagé `@buyfit/shared` (géré par Ibrahim) avec ce que l'équipe a validé
 * pour le site et qui n'existe pas encore dans le contrat : genre, deux photos, poids, morphologie,
 * contact, adresse, daltonisme, panier, livraison domicile / point relais, commande en invité,
 * recherche texte. La proposition de changements est dans `apps/web/PROPOSITION-shared.md`.
 */
import {
  CompteMarchandSchema,
  MensurationsSchema,
  OrderStatusSchema,
  ProductMatchSchema,
  TaillesSchema,
  TryOnResultSchema,
  InspirationCaptureSchema,
} from "@buyfit/shared";
import { z } from "zod";

export type {
  CompteMarchand,
  InspirationCapture,
  OrderStatus,
  OrderStatut,
  ProductMatch,
  TryOnResult,
  UserProfile,
} from "@buyfit/shared";

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */

export const PASSWORD_RULES = [
  { id: "longueur", label: "8 caractères minimum", test: (v: string) => v.length >= 8 },
  { id: "majuscule", label: "Une majuscule", test: (v: string) => /[A-Z]/.test(v) },
  { id: "minuscule", label: "Une minuscule", test: (v: string) => /[a-z]/.test(v) },
  { id: "chiffre", label: "Un chiffre", test: (v: string) => /\d/.test(v) },
] as const;

export const SignupSchema = z
  .object({
    email: z.email("Adresse email invalide"),
    password: z
      .string()
      .min(1, "Choisis un mot de passe")
      .refine(
        (v) => PASSWORD_RULES.every((r) => r.test(v)),
        "Le mot de passe ne respecte pas les règles",
      ),
    confirmation: z.string().min(1, "Confirme ton mot de passe"),
  })
  .refine((v) => v.password === v.confirmation, {
    path: ["confirmation"],
    message: "Les deux mots de passe ne correspondent pas",
  });
export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.email("Adresse email invalide"),
  password: z.string().min(1, "Saisis ton mot de passe"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export type Session = { userId: string; email: string };

/* ------------------------------------------------------------------ */
/* Profil                                                             */
/* ------------------------------------------------------------------ */

export const GENRES = [
  { value: "femme", label: "Femme" },
  { value: "homme", label: "Homme" },
  { value: "non_precise", label: "Je préfère ne pas préciser" },
] as const;
export const GenreSchema = z.enum(["femme", "homme", "non_precise"]);
export type Genre = z.infer<typeof GenreSchema>;

export const GenreStepSchema = z.object({ genre: GenreSchema });

export const PhotosStepSchema = z.object({
  photoCorpsUrl: z.string().min(1, "Ajoute une photo en pied"),
  photoTeteUrl: z.string().min(1, "Ajoute une photo de ta tête de profil"),
});
export type PhotosStep = z.infer<typeof PhotosStepSchema>;

const nombre = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label} : saisis un nombre` })
    .min(min, `${label} : minimum ${min}`)
    .max(max, `${label} : maximum ${max}`);
const nombreOptionnel = (label: string, min: number, max: number) =>
  nombre(label, min, max).optional();

/** Mensurations du contrat partagé + entrejambe (absent du contrat). */
export const MensurationsWebSchema = MensurationsSchema.extend({
  hauteurCm: nombre("Taille", 120, 230),
  poitrineCm: nombreOptionnel("Tour de poitrine", 50, 180),
  tourDeTailleCm: nombreOptionnel("Tour de taille", 40, 180),
  hanchesCm: nombreOptionnel("Tour de hanches", 50, 190),
  entrejambeCm: nombreOptionnel("Entrejambe", 50, 110),
});
export type MensurationsWeb = z.infer<typeof MensurationsWebSchema>;

export const CorpsStepSchema = z.object({
  mensurations: MensurationsWebSchema,
  poidsKg: nombre("Poids", 30, 250),
  pointure: z.string().trim().min(1, "Indique ta pointure"),
});
export type CorpsStep = z.infer<typeof CorpsStepSchema>;

export const MORPHO_ZONES = [
  {
    key: "epaules",
    label: "Épaules",
    options: [
      { value: "etroites", label: "Étroites" },
      { value: "moyennes", label: "Moyennes" },
      { value: "larges", label: "Larges" },
    ],
  },
  {
    key: "ventre",
    label: "Ventre",
    options: [
      { value: "plat", label: "Plat" },
      { value: "moyen", label: "Moyen" },
      { value: "arrondi", label: "Arrondi" },
    ],
  },
  {
    key: "hanches",
    label: "Hanches",
    options: [
      { value: "etroites", label: "Étroites" },
      { value: "moyennes", label: "Moyennes" },
      { value: "larges", label: "Larges" },
    ],
  },
  {
    key: "coupe",
    label: "Coupe préférée",
    options: [
      { value: "ajustee", label: "Ajustée" },
      { value: "normale", label: "Normale" },
      { value: "ample", label: "Ample" },
    ],
  },
] as const;

export const MorphologieSchema = z.object({
  epaules: z.enum(["etroites", "moyennes", "larges"], {
    error: "Choisis une option pour les épaules",
  }),
  ventre: z.enum(["plat", "moyen", "arrondi"], { error: "Choisis une option pour le ventre" }),
  hanches: z.enum(["etroites", "moyennes", "larges"], {
    error: "Choisis une option pour les hanches",
  }),
  coupe: z.enum(["ajustee", "normale", "ample"], { error: "Choisis ta coupe préférée" }),
});
export type Morphologie = z.infer<typeof MorphologieSchema>;
export const MorphologieStepSchema = z.object({ morphologie: MorphologieSchema });

export const MarquesStepSchema = z.object({
  marquesPreferees: z.array(z.string().min(1)).min(1, "Choisis au moins une marque"),
});

export const DALTONISME_TYPES = [
  {
    value: "protanopie",
    label: "Protanopie",
    description: "Le rouge est peu perçu, il paraît sombre.",
    palette: ["#8C7A3B", "#5B6E9E", "#B8B07A", "#2F3F66"],
  },
  {
    value: "deuteranopie",
    label: "Deutéranopie",
    description: "Le vert est peu perçu : rouges et verts se confondent.",
    palette: ["#A08A3C", "#4F6BA8", "#C8B98A", "#344A80"],
  },
  {
    value: "tritanopie",
    label: "Tritanopie",
    description: "Le bleu et le jaune se confondent.",
    palette: ["#C24A5A", "#3E8C93", "#E8A9B0", "#1F5C61"],
  },
  {
    value: "achromatopsie",
    label: "Achromatopsie",
    description: "Les couleurs sont perçues en nuances de gris.",
    palette: ["#4A4A4A", "#8A8A8A", "#C4C4C4", "#1E1E1E"],
  },
] as const;
export const DaltonismeTypeSchema = z.enum([
  "protanopie",
  "deuteranopie",
  "tritanopie",
  "achromatopsie",
]);
export type DaltonismeType = z.infer<typeof DaltonismeTypeSchema>;

export const DaltonismeSchema = z
  .object({ actif: z.boolean(), type: DaltonismeTypeSchema.optional() })
  .refine((d) => !d.actif || d.type, { path: ["type"], message: "Choisis ton type de daltonisme" });
export type Daltonisme = z.infer<typeof DaltonismeSchema>;

export const ContactSchema = z.object({
  prenom: z.string().trim().min(1, "Indique ton prénom"),
  nom: z.string().trim().min(1, "Indique ton nom"),
  email: z.email("Adresse email invalide"),
  telephone: z
    .string()
    .trim()
    .regex(
      /^(\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/,
      "Numéro de téléphone invalide (ex. 06 12 34 56 78)",
    ),
});
export type Contact = z.infer<typeof ContactSchema>;

export const AdresseSchema = z.object({
  numeroEtRue: z
    .string()
    .trim()
    .min(1, "Indique ton adresse")
    .regex(/^\d+\s*(bis|ter|[a-z])?\b/i, "Commence par le numéro de rue (ex. 12 rue de Rivoli)"),
  codePostal: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Code postal à 5 chiffres"),
  ville: z.string().trim().min(1, "Indique ta ville"),
});
export type Adresse = z.infer<typeof AdresseSchema>;

export const ContactStepSchema = z.object({
  contact: ContactSchema,
  adresse: AdresseSchema,
  daltonisme: DaltonismeSchema,
});
export type ContactStep = z.infer<typeof ContactStepSchema>;

/** Compte marchand du contrat + statut d'affichage. Jamais de mot de passe : seulement `vaultId`. */
export const CompteMarchandWebSchema = CompteMarchandSchema.extend({
  statut: z.enum(["connecte", "non_connecte"]),
  logoTexte: z.string(),
});
export type CompteMarchandWeb = z.infer<typeof CompteMarchandWebSchema>;

/**
 * Profil complet côté web. Reprend `UserProfile` (sauf `photos` et `budgetMax`, remplacés par
 * deux photos nommées et un budget non demandé) et ajoute les champs validés par l'équipe.
 */
export const WebProfileSchema = z.object({
  id: z.string().min(1),
  genre: GenreSchema.optional(),
  photoCorpsUrl: z.string().optional(),
  photoTeteUrl: z.string().optional(),
  taille: TaillesSchema,
  mensurations: MensurationsWebSchema.partial(),
  poidsKg: z.number().optional(),
  morphologie: MorphologieSchema.partial(),
  devise: z.string().length(3),
  marquesPreferees: z.array(z.string()),
  contact: ContactSchema.partial(),
  adresse: AdresseSchema.partial(),
  daltonisme: z.object({ actif: z.boolean(), type: DaltonismeTypeSchema.optional() }),
  comptesMarchands: z.array(CompteMarchandWebSchema),
  onboardingTermine: z.boolean(),
});
export type WebProfile = z.infer<typeof WebProfileSchema>;

/* ------------------------------------------------------------------ */
/* Recherche, essayage                                                */
/* ------------------------------------------------------------------ */

export const SearchQuerySchema = z.object({
  texte: z.string().trim().min(2, "Décris le vêtement en quelques mots").max(200),
  source: z.enum(["texte", "voix"]),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/** Produit trouvé + taille conseillée par le guide des tailles du marchand + essayage. */
export const SearchResultSchema = ProductMatchSchema.extend({
  categorie: z.string(),
  tailleConseillee: z.string(),
  essayage: TryOnResultSchema.optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

/* ------------------------------------------------------------------ */
/* Panier, livraison, commande                                        */
/* ------------------------------------------------------------------ */

export type CartItem = {
  /** id unique de la ligne (produit + taille) */
  lineId: string;
  product: SearchResult;
  taille: string;
  quantite: number;
};

export type RelayPoint = {
  id: string;
  nom: string;
  adresse: string;
  distanceKm: number;
  horaires: string;
};

export type DeliveryQuote = {
  domicile: { prix: number; delai: string };
  relais: { prix: number; delai: string };
};

export type Livraison =
  | { mode: "domicile"; adresse: Adresse; prix: number }
  | { mode: "relais"; point: RelayPoint; prix: number };

/** Une commande par marchand : l'agent passe commande en invité ou sur le compte connecté. */
export const WebOrderSchema = OrderStatusSchema.extend({
  marchand: z.string(),
  mode: z.enum(["invite", "compte"]),
  articles: z.array(
    z.object({
      nom: z.string(),
      marque: z.string(),
      taille: z.string(),
      prix: z.number(),
      imageUrl: z.string(),
    }),
  ),
  livraison: z.object({
    mode: z.enum(["domicile", "relais"]),
    libelle: z.string(),
    prix: z.number(),
  }),
  total: z.number(),
  createdAt: z.string(),
});
export type WebOrder = z.infer<typeof WebOrderSchema>;

/* ------------------------------------------------------------------ */
/* Tableau de bord                                                    */
/* ------------------------------------------------------------------ */

export const LookCaptureSchema = InspirationCaptureSchema.extend({
  id: z.string(),
  description: z.string().optional(),
  statut: z.enum(["analyse", "produits_trouves", "aucun_resultat", "erreur"]),
});
export type LookCapture = z.infer<typeof LookCaptureSchema>;

export type FoundProduct = SearchResult & { captureId: string };

export type TryOnEntry = {
  id: string;
  productId: string;
  produit: string;
  marque: string;
  statut: "en_cours" | "pret" | "echec";
  resultImageUrl?: string;
  latencyMs?: number;
  createdAt: string;
};

export type DashboardData = {
  looks: LookCapture[];
  produits: FoundProduct[];
  essayages: TryOnEntry[];
  commandes: WebOrder[];
};

/** Statuts où le suivi s'arrête côté site : l'agent s'arrête avant le paiement (`confirmation_requise`). */
export const ORDER_FINAL: readonly OrderStatutType[] = [
  "confirmation_requise",
  "commandee",
  "echec",
];
type OrderStatutType = z.infer<typeof OrderStatusSchema>["statut"];
