/**
 * Rafraîchit la session Supabase à chaque requête et protège les pages privées.
 *
 * Next.js 16 : à brancher dans `proxy.ts` à la racine de apps/web (ex-middleware.ts) :
 *
 *   import type { NextRequest } from "next/server";
 *   import { updateSession } from "@/lib/supabase/proxy";
 *   export const proxy = (request: NextRequest) =>
 *     updateSession(request, { protectedPaths: ["/profil", "/historique", "/extension"] });
 *   export const config = {
 *     matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
 *   };
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { publicEnv } from "./env";

export interface UpdateSessionOptions {
  /** Préfixes de chemins qui exigent un utilisateur connecté. */
  protectedPaths?: string[];
  /** Page de connexion (reçoit `?next=<chemin demandé>`). */
  loginPath?: string;
}

export async function updateSession(
  request: NextRequest,
  { protectedPaths = [], loginPath = "/login" }: UpdateSessionOptions = {},
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Ne rien mettre entre createServerClient et getClaims : c'est cet appel qui
  // rafraîchit le token si besoin et réécrit les cookies.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims.sub);

  const path = request.nextUrl.pathname;
  const isProtected = protectedPaths.some((p) => path === p || path.startsWith(`${p}/`));
  if (!isLoggedIn && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.search = "";
    url.searchParams.set("next", path + request.nextUrl.search);
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
