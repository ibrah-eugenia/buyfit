import Link from "next/link";
import { Check } from "lucide-react";
import { Logo, SLOGAN } from "@/components/brand/logo";
import { PHOTO_LOOK } from "@/components/landing/photos";

/** Connexion / inscription : cadre blanc, formulaire à gauche, panneau photo à droite (≥ lg). */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 p-2 sm:p-4 lg:p-6">
      <div className="grid flex-1 overflow-hidden rounded-[28px] bg-white lg:grid-cols-[1fr_1.05fr]">
        <div className="flex flex-col px-5 py-6 sm:px-10 sm:py-8 lg:px-16">
          <Link href="/" className="w-fit rounded-md text-[26px]">
            <Logo />
          </Link>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
            <h1 className="font-display text-[52px] leading-[0.95] tracking-[-0.02em] text-ink sm:text-[64px]">
              {title}
            </h1>
            <p className="mt-3 mb-8 border-b border-ink/15 pb-8 text-[17px] font-light text-ink">
              {description}
            </p>
            {children}
            <div className="mt-8 text-sm text-copy">{footer}</div>
          </div>

          <p className="text-caption text-grey">{SLOGAN}</p>
        </div>

        {/* Panneau visuel */}
        <div className="relative m-3 hidden overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#bdb8b2_0%,#dcd8d3_45%,#f4f2ef_100%)] lg:block">
          <div className="absolute inset-x-[18%] top-[10%] bottom-[10%] overflow-hidden rounded-[36px]">
            <img src={PHOTO_LOOK} alt="" className="h-full w-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand via-brand/10 to-transparent" />
          </div>
          <div className="absolute top-[56%] left-[8%] flex items-center gap-3 rounded-full bg-white py-2.5 pr-5 pl-2.5 shadow-[0_10px_30px_rgba(17,17,17,0.10)]">
            <span className="flex size-6 items-center justify-center rounded-md bg-brand text-white">
              <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
            </span>
            <span className="text-[15px] text-ink">Tes tailles, enregistrées une fois</span>
          </div>
          <div className="absolute right-[8%] bottom-[16%] max-w-[230px] rounded-[24px] border border-white/50 bg-white/35 p-5 shadow-[0_14px_40px_rgba(17,17,17,0.10)] backdrop-blur-xl">
            <p className="font-display text-[34px] leading-none text-ink">
              If you love this fit, buy it<span className="text-brand">.</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
