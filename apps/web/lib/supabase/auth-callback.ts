/**
 * Retour de Google OAuth et des liens de confirmation d'email : échange le `code`
 * contre une session (cookies), puis redirige vers `next`.
 *
 * À brancher dans `app/auth/callback/route.ts` :
 *   export { GET } from "@/lib/supabase/auth-callback";
 */
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "./paths";
import { createClient } from "./server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth_callback");
  return NextResponse.redirect(loginUrl);
}
