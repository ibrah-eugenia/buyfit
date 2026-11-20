import Link from "next/link";
import { ArrowUpRight, Check, Hand, Play, Sparkles } from "lucide-react";
import { AppIcon } from "@/components/brand/logo";
import { PHOTO_LOOK, PHOTO_PRODUIT } from "@/components/landing/photos";
import { SiteHeader } from "@/components/layout/site-header";
import { LogoMarquee } from "@/components/landing/logo-marquee";
import { cn } from "@/lib/utils";

/** Hero de la landing : cadre blanc arrondi (en-tête + panneau + marques). */

/** Puce « case cochée » posée sur la photo. */
function PuceCochee({
  children,
  ton,
  className,
}: {
  children: React.ReactNode;
  ton: "brand" | "success";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute flex items-center gap-3 rounded-full bg-white py-2.5 pr-5 pl-2.5 shadow-[0_10px_30px_rgba(17,17,17,0.10)]",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-md text-white",
          ton === "brand" ? "bg-brand" : "bg-success",
        )}
      >
        <Check className="size-3.5 stroke-[3]" />
      </span>
      <span className="text-[14px] whitespace-nowrap text-ink sm:text-[15px]">{children}</span>
    </div>
  );
}

function VisuelMannequin() {
  return (
    <div
      className="relative mx-auto h-[440px] w-full max-w-[520px] sm:h-[560px]"
      aria-hidden="true"
    >
      {/* Carte photo */}
      <div className="absolute top-0 right-[14%] bottom-0 left-[18%] overflow-hidden rounded-[36px] bg-brand sm:right-[18%] sm:left-[22%]">
        <img src={PHOTO_LOOK} alt="" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand via-brand/10 to-transparent" />
      </div>

      <PuceCochee ton="brand" className="top-[17%] left-[6%] sm:left-[4%]">
        Look repéré sur Pinterest
      </PuceCochee>
      <PuceCochee ton="success" className="top-[28%] left-0">
        Taille M conseillée
      </PuceCochee>

      {/* Stat en verre */}
      <div className="absolute top-[6%] right-0 hidden w-[176px] flex-col gap-2 rounded-[24px] border border-white/50 bg-white/30 p-5 shadow-[0_10px_30px_rgba(17,17,17,0.06)] backdrop-blur-xl sm:flex">
        <span className="text-[11px] font-semibold tracking-[0.04em] text-ink/80">
          — PAYÉ SANS TOI
        </span>
        <span className="text-[44px] leading-none font-bold tracking-[-0.04em] text-ink">0 €</span>
        <span className="text-[14px] leading-snug text-ink/80">Tu valides chaque commande</span>
      </div>

      {/* Lecture */}
      <a
        href="#comment"
        aria-hidden="false"
        aria-label="Voir comment ça marche"
        className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-[0_10px_30px_rgba(17,17,17,0.15)] transition-transform hover:scale-105"
      >
        <Play className="size-5 translate-x-px fill-current" />
      </a>

      {/* Produit en verre */}
      <div className="absolute right-0 bottom-[4%] flex w-[78%] items-center gap-4 rounded-[24px] border border-white/50 bg-white/35 p-3 shadow-[0_14px_40px_rgba(17,17,17,0.10)] backdrop-blur-xl sm:w-[340px]">
        <div className="size-[88px] shrink-0 overflow-hidden rounded-2xl bg-white sm:size-[110px]">
          <img src={PHOTO_PRODUIT} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[17px] leading-tight text-ink sm:text-[19px]">
            Babies cuir
            <br />à boucles
          </span>
          <span className="text-[22px] font-bold tracking-[-0.03em] text-ink sm:text-[26px]">
            59,95 €
          </span>
          <span className="flex w-fit items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-ink">
            <Check className="size-3 stroke-[3] text-success" />
            <span className="whitespace-nowrap">
              <span className="hidden sm:inline">Taille </span>38 en stock
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function LandingHero() {
  return (
    <div className="overflow-hidden rounded-[28px] bg-white">
      <SiteHeader framed />

      {/* Panneau */}
      <section className="mx-2 rounded-[24px] bg-[linear-gradient(180deg,#bdb8b2_0%,#dcd8d3_45%,#f4f2ef_100%)] sm:mx-3">
        <div className="grid items-center gap-10 px-5 pt-10 pb-10 sm:px-10 sm:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-6 lg:px-16 lg:pt-20 lg:pb-16">
          <div className="flex flex-col">
            {/* Preuve */}
            <div className="flex items-center gap-3">
              <AppIcon size={44} className="rounded-full!" />
              <div className="flex flex-col leading-tight">
                <span className="text-[16px] font-bold text-ink">Agents IA H Company</span>
                <span className="text-[14px] text-copy">
                  Découvre{" "}
                  <a href="#comment" className="font-bold text-ink underline underline-offset-2">
                    comment ça marche
                  </a>
                </span>
              </div>
            </div>

            <h1 className="mt-8 flex flex-col">
              <span className="text-[20px] font-semibold tracking-[-0.02em] text-ink sm:text-[24px]">
                If you love this fit,
              </span>
              <span className="-mt-1 font-display text-[96px] leading-[0.95] tracking-[-0.03em] text-ink sm:text-[140px] lg:text-[156px]">
                buy it<span className="text-brand">.</span>
              </span>
            </h1>

            <div className="mt-6 border-t border-ink/15 pt-6">
              <p className="max-w-[30rem] text-[18px] leading-[1.6] font-light text-ink sm:text-[20px]">
                Retrouve la tenue qui t&apos;a tapé dans l&apos;œil, essaie-la sur toi — un agent
                prépare la commande à ta taille.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-copy">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-white text-brand">
                    <Sparkles className="size-4" aria-hidden="true" />
                  </span>
                  <span className="leading-tight">
                    Essayage virtuel
                    <br />
                    <span className="text-grey">avant d&apos;acheter</span>
                  </span>
                </span>
                <span className="hidden text-ink/30 sm:inline" aria-hidden="true">
                  /
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-white text-brand">
                    <Hand className="size-4" aria-hidden="true" />
                  </span>
                  <span className="leading-tight">
                    Paiement
                    <br />
                    <span className="text-grey">toujours validé par toi</span>
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-ink/15 pt-8">
              <Link
                href="/signup"
                className="inline-flex h-[52px] items-center rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Commencer
                <span className="ml-1 font-normal text-white/80">— c&apos;est gratuit</span>
              </Link>
              <a
                href="#comment"
                className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink underline underline-offset-4 hover:text-brand"
              >
                Comment ça marche
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <VisuelMannequin />
        </div>
      </section>

      {/* Marques */}
      <LogoMarquee className="py-8 sm:py-10" />
    </div>
  );
}
