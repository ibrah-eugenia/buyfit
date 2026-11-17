"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { useSession } from "@/components/app-providers";
import { Logo } from "@/components/brand/logo";
import { CartButton } from "@/components/cart/cart-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/search", label: "Rechercher", icon: Search },
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutGrid },
  { href: "/settings", label: "Mon profil", icon: Settings },
] as const;

export function SiteHeader() {
  const { session, profile, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const connecte = !!session && !!profile?.onboardingTermine;

  async function deconnexion() {
    await logout();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={connecte ? "/dashboard" : "/"}
          className="rounded-md text-[26px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>

        {connecte && (
          <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "rounded-[10px] px-3 py-2 text-sm font-semibold text-grey transition-colors hover:bg-linen hover:text-ink",
                  pathname === href &&
                    "bg-blush text-brand-deep hover:bg-blush hover:text-brand-deep",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1">
          {connecte ? (
            <>
              <Button variant="ghost" size="icon" asChild className="md:hidden">
                <Link href="/search" aria-label="Rechercher">
                  <Search className="size-5" aria-hidden="true" />
                </Link>
              </Button>
              <CartButton />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Menu du compte">
                    <Menu className="size-5 md:hidden" aria-hidden="true" />
                    <User className="hidden size-5 md:block" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate text-xs text-grey">
                    {session?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {NAV.map(({ href, label, icon: Icon }) => (
                    <DropdownMenuItem key={href} asChild>
                      <Link href={href}>
                        <Icon className="size-4" aria-hidden="true" />
                        {label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void deconnexion()}>
                    <LogOut className="size-4" aria-hidden="true" />
                    Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild size="sm">
                <Link href="/login">Se connecter</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Créer mon compte</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10", className)}>
      {children}
    </main>
  );
}

export function PageTitle({
  overline,
  title,
  description,
}: {
  overline?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:mb-8">
      {overline && <p className="overline-label">{overline}</p>}
      <h1 className="text-[28px] leading-tight font-bold tracking-[-0.03em] sm:text-display">
        {title}
      </h1>
      {description && <p className="max-w-2xl text-body text-copy">{description}</p>}
    </div>
  );
}
