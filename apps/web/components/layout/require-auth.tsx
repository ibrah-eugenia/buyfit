"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/app-providers";
import { ErrorState, LoadingState } from "@/components/states";

/**
 * Protège une page : redirige vers /login sans session, et vers /onboarding tant que
 * l'inscription n'est pas terminée (sauf `allowIncomplete`).
 */
export function RequireAuth({
  children,
  allowIncomplete = false,
}: {
  children: React.ReactNode;
  allowIncomplete?: boolean;
}) {
  const { session, profile, loading, error, reload } = useSession();
  const router = useRouter();

  const doitSeConnecter = !loading && !error && !session;
  const doitFinirOnboarding =
    !loading && !!profile && !profile.onboardingTermine && !allowIncomplete;

  useEffect(() => {
    if (doitSeConnecter) router.replace("/login");
    else if (doitFinirOnboarding) router.replace("/onboarding");
  }, [doitSeConnecter, doitFinirOnboarding, router]);

  if (error) return <ErrorState message={error} onRetry={() => void reload()} className="m-6" />;
  if (loading || doitSeConnecter || doitFinirOnboarding || !profile) return <LoadingState />;
  return <>{children}</>;
}
