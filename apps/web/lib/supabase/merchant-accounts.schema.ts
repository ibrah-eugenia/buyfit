/**
 * Comptes marchands : marchands pris en charge, validation des formulaires, vue renvoyée aux pages.
 * Séparé de merchant-accounts.ts, car un fichier "use server" ne peut exporter que des fonctions async.
 */
import { z } from "zod";
import type { Enums, Tables } from "./database.types";

/**
 * Marchands que l'agent sait gérer. Liste fermée : on n'enregistre pas d'identifiants pour un
 * domaine arbitraire (l'entrée du vault ne sert que sur ce domaine).
 */
export const SUPPORTED_MERCHANTS = [
  { marchand: "Zara", domaine: "zara.com" },
  { marchand: "Mango", domaine: "mango.com" },
  { marchand: "COS", domaine: "cos.com" },
  { marchand: "Uniqlo", domaine: "uniqlo.com" },
  { marchand: "H&M", domaine: "hm.com" },
  { marchand: "Bershka", domaine: "bershka.com" },
] as const;

export type SupportedDomain = (typeof SUPPORTED_MERCHANTS)[number]["domaine"];

const DOMAINS = SUPPORTED_MERCHANTS.map((m) => m.domaine) as [
  SupportedDomain,
  ...SupportedDomain[],
];

export function merchantFor(domaine: SupportedDomain) {
  const m = SUPPORTED_MERCHANTS.find((x) => x.domaine === domaine);
  if (!m) throw new Error(`Marchand non pris en charge : ${domaine}`);
  return m;
}

/** Formulaire « Relier mon compte ». Le mot de passe part chez H et n'est jamais stocké chez nous. */
export const ConnectMerchantInputSchema = z.object({
  domaine: z.enum(DOMAINS, "Marchand non pris en charge"),
  email: z.email("Adresse email invalide").transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1, "Mot de passe requis").max(256, "Mot de passe trop long"),
});
export type ConnectMerchantInput = z.input<typeof ConnectMerchantInputSchema>;

/** Ce que les pages reçoivent : aucun id H Company, aucun secret. */
export interface MerchantAccountView {
  id: string;
  marchand: string;
  domaine: string;
  email: string | null;
  statut: Enums<"merchant_account_statut">;
  /** true si l'agent peut acheter avec ce compte. */
  utilisable: boolean;
  updatedAt: string;
}

export function toMerchantAccountView(
  row: Pick<
    Tables<"merchant_accounts">,
    "id" | "marchand" | "domaine" | "email" | "statut" | "updated_at"
  >,
): MerchantAccountView {
  return {
    id: row.id,
    marchand: row.marchand,
    domaine: row.domaine,
    email: row.email,
    statut: row.statut,
    utilisable: row.statut === "connecte",
    updatedAt: row.updated_at,
  };
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
