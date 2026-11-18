"use server";
/**
 * Comptes marchands (server actions appelées par les pages d'Antonin).
 *
 * Relier un compte :
 *   1. l'utilisateur saisit email + mot de passe sur la plateforme ;
 *   2. cette action les envoie au vault H Company de l'utilisateur, puis oublie le mot de passe ;
 *   3. en base, merchant_accounts ne garde que les références (h_vault_id, h_vault_item_id).
 *
 * Le mot de passe ne fait que traverser ce serveur, en mémoire : jamais écrit en base, jamais
 * loggé, jamais renvoyé au navigateur. Les références H sont écrites avec la clé service_role :
 * le RLS interdit à l'utilisateur de les modifier lui-même.
 */
import {
  deleteMerchantLogin,
  ensureUserVault,
  HCompanyError,
  upsertMerchantLogin,
} from "./h-vault";
import {
  ConnectMerchantInputSchema,
  merchantFor,
  toMerchantAccountView,
  type ActionResult,
  type ConnectMerchantInput,
  type MerchantAccountView,
} from "./merchant-accounts.schema";
import { createAdminClient, createClient } from "./server";

const VIEW_COLUMNS = "id, marchand, domaine, email, statut, updated_at";

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  return user?.id ?? null;
}

const errorMessage = (err: unknown) =>
  err instanceof HCompanyError ? err.message : "Erreur inattendue, réessaie dans un instant.";

/** Comptes marchands de l'utilisateur connecté (via RLS). */
export async function listMerchantAccounts(): Promise<ActionResult<MerchantAccountView[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merchant_accounts")
    .select(VIEW_COLUMNS)
    .order("marchand");
  if (error) return { ok: false, error: "Impossible de charger tes comptes marchands." };
  return { ok: true, data: data.map(toMerchantAccountView) };
}

/** Relie (ou met à jour) le compte de l'utilisateur chez un marchand. */
export async function connectMerchantAccount(
  input: ConnectMerchantInput,
): Promise<ActionResult<MerchantAccountView>> {
  const parsed = ConnectMerchantInputSchema.safeParse(input);
  // Message du schéma uniquement : jamais la valeur saisie.
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  const { domaine, email, password } = parsed.data;

  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Connecte-toi d'abord." };

  const admin = createAdminClient();
  const { data: rows, error: readError } = await admin
    .from("merchant_accounts")
    .select("id, domaine, statut, h_vault_id, h_vault_item_id")
    .eq("user_id", userId);
  if (readError) return { ok: false, error: "Impossible de lire tes comptes marchands." };

  const existing = rows.find((r) => r.domaine === domaine);

  // 1. Ligne en base (sans aucune référence H pour l'instant).
  const { data: row, error: upsertError } = await admin
    .from("merchant_accounts")
    .upsert(
      { user_id: userId, marchand: merchantFor(domaine).marchand, domaine, email },
      { onConflict: "user_id,domaine" },
    )
    .select("id")
    .single();
  if (upsertError) return { ok: false, error: "Impossible d'enregistrer le compte marchand." };

  // 2. Identifiants → vault H de l'utilisateur.
  let vaultId: string;
  let itemId: string;
  try {
    vaultId = rows.find((r) => r.h_vault_id)?.h_vault_id ?? (await ensureUserVault(userId));
    itemId = await upsertMerchantLogin({
      vaultId,
      itemId: existing?.h_vault_item_id ?? null,
      domaine,
      email,
      password,
    });
  } catch (err) {
    // Un compte déjà relié garde ses anciens identifiants (toujours valides chez H).
    if (existing?.statut !== "connecte") {
      await admin.from("merchant_accounts").update({ statut: "erreur" }).eq("id", row.id);
    }
    return { ok: false, error: errorMessage(err) };
  }

  // 3. On ne stocke que les références.
  const { data: saved, error: saveError } = await admin
    .from("merchant_accounts")
    .update({
      statut: "connecte",
      auth_kind: "vault",
      h_vault_id: vaultId,
      h_vault_item_id: itemId,
      h_browser_profile_id: null,
    })
    .eq("id", row.id)
    .eq("user_id", userId)
    .select(VIEW_COLUMNS)
    .single();
  if (saveError)
    return { ok: false, error: "Identifiants enregistrés chez H, mais pas en base. Réessaie." };

  return { ok: true, data: toMerchantAccountView(saved) };
}

/** Délie un compte : supprime l'entrée du vault H puis la ligne en base. */
export async function disconnectMerchantAccount(accountId: string): Promise<ActionResult<null>> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Connecte-toi d'abord." };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("merchant_accounts")
    .select("id, h_vault_id, h_vault_item_id")
    .eq("id", accountId)
    .eq("user_id", userId) // la clé service_role ignore le RLS : on filtre nous-mêmes
    .maybeSingle();
  if (error || !row) return { ok: false, error: "Compte marchand introuvable." };

  try {
    if (row.h_vault_id && row.h_vault_item_id) {
      await deleteMerchantLogin(row.h_vault_id, row.h_vault_item_id);
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  const { error: deleteError } = await admin
    .from("merchant_accounts")
    .delete()
    .eq("id", row.id)
    .eq("user_id", userId);
  if (deleteError) return { ok: false, error: "Impossible de supprimer le compte marchand." };
  return { ok: true, data: null };
}
