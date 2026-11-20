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

/** Ancres de la landing, affichées dans l'en-tête flottant aux visiteurs non connectés. */
const ANCRES = [
  { href: "#comment", label: "Comment ça marche" },
  { href: "#essayage", label: "Essayage" },
  { href: "#agent", label: "Agent" },
  { href: "#faq", label: "FAQ" },
] as const;

/** `framed` : variante de la landing, posée dans le cadre blanc au-dessus du hero. */
export function SiteHeader({ framed = false }: { framed?: boolean }) {
  const { session, profile, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const connecte = !!session && !!profile?.onboardingTermine;

  async function deconnexion() {
    await logout();
    router.push("/");
  }

  return (
    <header
      className={cn(
        "z-40",
        framed
          ? "relative"
          : "sticky top-0 bg-gradient-to-b from-canvas from-60% to-transparent px-2 pt-2 sm:px-4 sm:pt-4 lg:px-6",
      )}
    >
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-4",
          framed
            ? "h-[72px] px-4 sm:h-20 sm:px-8 lg:px-12"
            : "h-16 rounded-[20px] bg-white/90 pr-2 pl-4 shadow-[0_6px_24px_rgba(17,17,17,0.06)] backdrop-blur-md sm:h-[72px] sm:pr-3 sm:pl-6",
        )}
      >
        <div className="flex items-center gap-3">
          <Link
            href={connecte ? "/dashboard" : "/"}
            className="rounded-md text-[26px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo />
          </Link>
          {framed && (
            <span className="hidden text-sm font-medium text-copy xl:inline">
              / De Pinterest à ta porte
            </span>
          )}
        </div>

        {framed && !connecte && (
          <nav aria-label="Sections" className="hidden items-center lg:flex">
            {ANCRES.map(({ href, label }, i) => (
              <span key={href} className="flex items-center">
                {i > 0 && (
                  <span className="px-2 text-ink/40" aria-hidden="true">
                    ·
                  </span>
                )}
                <a
                  href={href}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-ink underline-offset-4 hover:underline"
                >
                  {label}
                </a>
              </span>
            ))}
          </nav>
        )}

        {connecte && (
          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-1 rounded-full bg-linen p-1 md:flex"
          >
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold text-copy transition-colors hover:text-ink",
                  pathname === href &&
                    "bg-white text-ink shadow-[0_2px_8px_rgba(17,17,17,0.08)] hover:text-ink",
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
          ) : framed ? (
            <>
              <span className="mr-3 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
              <Link
                href="/login"
                className="mr-2 hidden rounded-md px-2 py-1 text-sm font-semibold text-ink hover:text-brand sm:inline"
              >
                Se connecter
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-11 items-center rounded-full border-[1.5px] border-ink px-5 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-white"
              >
                Créer mon compte
                <span className="ml-1 hidden font-normal sm:inline">— c&apos;est gratuit</span>
              </Link>
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
    <main className="mx-2 my-2 flex flex-1 flex-col rounded-[28px] bg-white sm:mx-4 sm:my-4 lg:mx-6 lg:my-6">
      <div className={cn("mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12", className)}>
        {children}
      </div>
    </main>
  );
}

export function PageTitle({
  overline,
  title,
  description,
  leading,
}: {
  overline?: string;
  title: string;
  description?: string;
  /** Élément affiché devant le sur-titre (ex. avatar). */
  leading?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 border-b border-ink/15 pb-8 sm:mb-10">
      {(overline || leading) && (
        <div className="flex items-center gap-3">
          {leading}
          {overline && (
            <p className="text-[12px] font-semibold tracking-[0.08em] text-ink/70 uppercase">
              — {overline}
            </p>
          )}
        </div>
      )}
      <h1 className="font-display text-[44px] leading-[0.98] tracking-[-0.02em] text-ink sm:text-[60px]">
        {title}
      </h1>
      {description && (
        <p className="max-w-2xl text-[17px] leading-[1.6] font-light text-ink">{description}</p>
      )}
    </div>
  );
}
