import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Rafraîchit la session Supabase (cookies) à chaque requête. Les pages privées sont aussi
 * protégées côté client par <RequireAuth> (redirection vers /onboarding si profil incomplet).
 */
export const proxy = (request: NextRequest) =>
  updateSession(request, {
    protectedPaths: ["/dashboard", "/onboarding", "/search", "/checkout", "/settings"],
  });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
