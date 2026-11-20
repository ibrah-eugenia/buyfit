import { createClient } from "@/lib/supabase/server";
import { listUserPhotos } from "@/lib/supabase/profile";
import { toProfile } from "@/lib/supabase/schemas";

// Compte connecté, lu par l'extension (panneau latéral) avec les cookies du site : même principe
// que /api/fitting. L'en-tête personnalisé force un preflight pour les pages web d'autres
// origines, et aucune autorisation CORS n'est émise : seule l'extension (permission d'hôte) lit.
export async function GET(request: Request) {
  if (request.headers.get("X-BuyFit-Request") !== "fitting")
    return Response.json({ error: "Requête invalide." }, { status: 403 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Non connecté." }, { status: 401 });
  const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const profile = data ? toProfile(data) : null;
  // Photo de profil : la plus récente de face, sinon le mannequin (URL signée 1 h).
  const photos = await listUserPhotos();
  const recentes = photos.ok
    ? [...photos.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const avatar = recentes.find((p) => p.type === "face" && p.url) ?? recentes.find((p) => p.url);
  return Response.json(
    {
      userId: user.id,
      email: user.email ?? null,
      prenom: profile?.contact.prenom ?? null,
      genre: profile?.genre ?? null,
      tailles: profile?.taille ?? {},
      avatarUrl: avatar?.url ?? null,
      onboardingTermine: profile?.onboardingTermine ?? false,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
