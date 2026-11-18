"use server";
/**
 * Profil et photos de l'utilisateur connecté (server actions, soumises au RLS).
 * Appelables depuis un Server Component comme depuis un composant client.
 * L'upload des photos se fait côté navigateur : voir photos.ts.
 */
import {
  ProfileUpdateSchema,
  toProfile,
  UserPhotoSchema,
  type ActionResult,
  type Profile,
  type ProfileUpdate,
  type UserPhoto,
} from "./schemas";
import { createClient } from "./server";
import { BUCKETS, signPaths } from "./storage";

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

const NOT_LOGGED_IN = { ok: false, error: "Connecte-toi d'abord." } as const;

export async function getProfile(): Promise<ActionResult<Profile>> {
  const { supabase, userId } = await session();
  if (!userId) return NOT_LOGGED_IN;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: "Impossible de charger ton profil." };
  if (!data) return { ok: false, error: "Profil introuvable." };
  return { ok: true, data: toProfile(data) };
}

/** Met à jour les champs fournis (les autres ne changent pas). */
export async function upsertProfile(patch: ProfileUpdate): Promise<ActionResult<Profile>> {
  const parsed = ProfileUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Profil invalide" };
  }
  const { supabase, userId } = await session();
  if (!userId) return NOT_LOGGED_IN;

  const p = parsed.data;
  const columns = {
    ...(p.taille !== undefined && { taille: p.taille }),
    ...(p.mensurations !== undefined && { mensurations: p.mensurations }),
    ...(p.budgetMax !== undefined && { budget_max: p.budgetMax }),
    ...(p.devise !== undefined && { devise: p.devise }),
    ...(p.marquesPreferees !== undefined && { marques_preferees: p.marquesPreferees }),
    ...(p.genre !== undefined && { genre: p.genre }),
    ...(p.poidsKg !== undefined && { poids_kg: p.poidsKg }),
    ...(p.morphologie !== undefined && { morphologie: p.morphologie }),
    ...(p.contact !== undefined && { contact: p.contact }),
    ...(p.adresse !== undefined && { adresse: p.adresse }),
    ...(p.daltonisme !== undefined && { daltonisme: p.daltonisme }),
    ...(p.onboardingTermine !== undefined && { onboarding_termine: p.onboardingTermine }),
  };

  // Le profil est créé à l'inscription (trigger) : update, et insert seulement en secours.
  const { data: updated, error } = await supabase
    .from("profiles")
    .update(columns)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: "Impossible d'enregistrer ton profil." };
  if (updated) return { ok: true, data: toProfile(updated) };

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({ user_id: userId, ...columns })
    .select("*")
    .single();
  if (insertError) return { ok: false, error: "Impossible d'enregistrer ton profil." };
  return { ok: true, data: toProfile(inserted) };
}

/** Photos de l'utilisateur, plein pied d'abord, avec une URL signée valable 1 h. */
export async function listUserPhotos(): Promise<ActionResult<UserPhoto[]>> {
  const { supabase, userId } = await session();
  if (!userId) return NOT_LOGGED_IN;
  const { data, error } = await supabase
    .from("user_photos")
    .select("id, type, storage_path, created_at")
    .order("created_at");
  if (error) return { ok: false, error: "Impossible de charger tes photos." };

  const urls = await signPaths(
    supabase,
    BUCKETS.userPhotos,
    data.map((p) => p.storage_path),
  );
  const photos = data
    .map((p) =>
      UserPhotoSchema.parse({
        id: p.id,
        type: p.type,
        storagePath: p.storage_path,
        url: urls.get(p.storage_path) ?? null,
        createdAt: p.created_at,
      }),
    )
    .sort((a, b) => Number(b.type === "pied") - Number(a.type === "pied"));
  return { ok: true, data: photos };
}
