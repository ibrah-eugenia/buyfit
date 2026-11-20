import Link from "next/link";
import {
  Hand,
  ImageOff,
  KeyRound,
  MousePointerClick,
  PackageCheck,
  Plus,
  Puzzle,
  Shirt,
  Sparkles,
} from "lucide-react";
import { Logo, LogoMark, SLOGAN } from "@/components/brand/logo";
import { LandingHero } from "@/components/landing/hero";
import { PHOTO_PRODUIT } from "@/components/landing/photos";
import { AgentVisual, TryOnVisual } from "@/components/landing/visuals";
import { cn } from "@/lib/utils";

const ETAPES = [
  {
    icon: MousePointerClick,
    titre: "Tu repères un look",
    texte:
      "Sur Pinterest, un clic sur l'extension suffit. Ou décris-le, à l'écrit comme à la voix.",
  },
  {
    icon: Shirt,
    titre: "On le trouve pour toi",
    texte: "Les pièces équivalentes chez tes marques, avec la taille conseillée par leur guide.",
  },
  {
    icon: Sparkles,
    titre: "Tu l'essaies sur toi",
    texte: "Ton avatar porte la tenue avant que tu décides. Plus de doute sur la coupe.",
  },
  {
    icon: PackageCheck,
    titre: "L'agent prépare la commande",
    texte: "Panier, taille, livraison : il s'arrête juste avant le paiement.",
  },
] as const;

const GARANTIES = [
  {
    icon: Hand,
    titre: "Tu valides chaque paiement",
    texte:
      "L'agent remplit le panier et la livraison, puis s'arrête. Rien n'est payé sans ton feu vert.",
  },
  {
    icon: KeyRound,
    titre: "Tes identifiants restent au coffre",
    texte:
      "Tes comptes marchands sont stockés dans un coffre chiffré. BuyFit ne voit jamais tes mots de passe.",
  },
  {
    icon: ImageOff,
    titre: "Tes photos restent à toi",
    texte:
      "Elles servent uniquement à l'essayage. Tu les supprimes quand tu veux depuis ton profil.",
  },
] as const;

const FAQ = [
  {
    q: "C'est gratuit ?",
    r: "Oui. Tu paies uniquement tes vêtements, au prix affiché par la boutique.",
  },
  {
    q: "Avec quelles boutiques ça marche ?",
    r: "Les grandes enseignes mode comme Zara, H&M, Mango ou COS. Tu choisis tes marques préférées pendant l'inscription, et la recherche les privilégie.",
  },
  {
    q: "Comment BuyFit choisit ma taille ?",
    r: "À partir de tes mesures et de ta morphologie, comparées au guide des tailles de chaque marque. Tu peux toujours changer la taille avant de commander.",
  },
  {
    q: "Et si je n'utilise pas Pinterest ?",
    r: "Tu peux décrire la tenue que tu cherches directement sur le site, ou importer une capture d'écran.",
  },
] as const;

/** Cadre blanc arrondi, comme celui du hero. */
function Cadre({ children, className, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("overflow-hidden rounded-[28px] bg-white", className)} {...props}>
      {children}
    </section>
  );
}

/** Sur-titre façon « — UP TO » de la maquette. */
function SurTitre({ children, clair = false }: { children: React.ReactNode; clair?: boolean }) {
  return (
    <p
      className={cn(
        "text-[12px] font-semibold tracking-[0.08em] uppercase",
        clair ? "text-white/70" : "text-ink/70",
      )}
    >
      — {children}
    </p>
  );
}

const TITRE_SERIF =
  "font-display text-[52px] leading-[0.95] tracking-[-0.02em] sm:text-[72px] lg:text-[84px]";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col gap-3 bg-canvas p-2 sm:gap-4 sm:p-4 lg:gap-6 lg:p-6">
      <LandingHero />

      <main className="flex flex-col gap-3 sm:gap-4 lg:gap-6">
        {/* ---------- Comment ça marche ---------- */}
        <Cadre id="comment" aria-labelledby="comment-titre" className="scroll-mt-6">
          <div className="px-5 py-14 sm:px-10 lg:px-16 lg:py-20">
            <div className="grid gap-6 border-b border-ink/15 pb-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
              <div className="flex flex-col gap-4">
                <SurTitre>Comment ça marche</SurTitre>
                <h2 id="comment-titre" className={cn(TITRE_SERIF, "text-ink")}>
                  De l&apos;épingle
                  <br />à ta porte<span className="text-brand">.</span>
                </h2>
              </div>
              <p className="max-w-md text-[18px] leading-[1.6] font-light text-ink lg:justify-self-end">
                Quatre étapes, un seul geste de ta part au départ — et une validation à la fin.
              </p>
            </div>
            <ol className="grid sm:grid-cols-2 lg:grid-cols-4">
              {ETAPES.map(({ icon: Icon, titre, texte }, i) => (
                <li
                  key={titre}
                  className={cn(
                    "flex flex-col gap-4 border-ink/15 py-8 sm:px-6 lg:py-10",
                    i > 0 && "border-t sm:border-t-0",
                    i % 2 === 1 && "sm:border-l",
                    i >= 2 && "sm:border-t lg:border-t-0",
                    i === 2 && "lg:border-l",
                    i === 0 && "sm:pl-0",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-display text-[64px] leading-none text-ink">0{i + 1}</span>
                    <span className="flex size-10 items-center justify-center rounded-full bg-linen text-brand">
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">{titre}</h3>
                  <p className="text-[15px] leading-relaxed text-copy">{texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </Cadre>

        {/* ---------- Essayage ---------- */}
        <Cadre aria-labelledby="essayage">
          <div className="grid items-center gap-12 px-5 py-14 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:px-16 lg:py-20">
            <div className="flex flex-col">
              <SurTitre>Essayage virtuel</SurTitre>
              <h2 id="essayage" className={cn(TITRE_SERIF, "mt-4 scroll-mt-10 text-ink")}>
                Vois-le
                <br />
                sur toi<span className="text-brand">.</span>
              </h2>
              <div className="mt-8 border-t border-ink/15 pt-6">
                <p className="max-w-[30rem] text-[18px] leading-[1.6] font-light text-ink">
                  À partir d&apos;une photo en pied, BuyFit habille ton avatar avec les pièces
                  trouvées. Tu juges la coupe et les couleurs sur ta silhouette, pas sur un
                  mannequin.
                </p>
              </div>
              <ul className="mt-6 flex flex-col border-t border-ink/15">
                {[
                  "La taille conseillée selon le guide de chaque marque",
                  "Plusieurs pièces combinées en une seule tenue",
                  "Un mode adapté au daltonisme pour les couleurs",
                ].map((t, i) => (
                  <li
                    key={t}
                    className="flex items-center gap-4 border-b border-ink/15 py-4 text-[15px] text-ink"
                  >
                    <span className="w-6 text-[13px] font-semibold text-ink/50">0{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <TryOnVisual />
          </div>
        </Cadre>

        {/* ---------- Agent ---------- */}
        <Cadre aria-labelledby="agent">
          <div className="grid items-center gap-12 px-5 py-14 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:px-16 lg:py-20">
            <div className="order-2 lg:order-1">
              <AgentVisual />
            </div>
            <div className="order-1 flex flex-col lg:order-2">
              <SurTitre>Agent de commande</SurTitre>
              <h2 id="agent" className={cn(TITRE_SERIF, "mt-4 scroll-mt-10 text-ink")}>
                Il remplit,
                <br />
                tu décides<span className="text-brand">.</span>
              </h2>
              <div className="mt-8 border-t border-ink/15 pt-6">
                <p className="max-w-[30rem] text-[18px] leading-[1.6] font-light text-ink">
                  Un agent ouvre la boutique, se connecte à ton compte, choisit ta taille et ta
                  livraison. Tu suis chaque étape en direct, puis tu valides le paiement toi-même.
                </p>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 rounded-[24px] bg-linen p-5">
                  <span className="text-[11px] font-semibold tracking-[0.04em] text-ink/70">
                    — PAYÉ SANS TOI
                  </span>
                  <span className="text-[40px] leading-none font-bold tracking-[-0.04em] text-ink">
                    0 €
                  </span>
                  <span className="text-[14px] text-ink/70">Tu valides chaque commande</span>
                </div>
                <div className="flex flex-col gap-1 rounded-[24px] bg-linen p-5">
                  <span className="text-[11px] font-semibold tracking-[0.04em] text-ink/70">
                    — SUIVI
                  </span>
                  <span className="text-[40px] leading-none font-bold tracking-[-0.04em] text-ink">
                    Live
                  </span>
                  <span className="text-[14px] text-ink/70">Chaque étape, en direct</span>
                </div>
              </div>
            </div>
          </div>
        </Cadre>

        {/* ---------- Confiance ---------- */}
        <Cadre aria-labelledby="confiance" className="bg-brand-deep text-white">
          <div className="px-5 py-14 sm:px-10 lg:px-16 lg:py-20">
            <div className="grid gap-6 border-b border-white/15 pb-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
              <div className="flex flex-col gap-4">
                <SurTitre clair>Ta confiance d&apos;abord</SurTitre>
                <h2 id="confiance" className={TITRE_SERIF}>
                  Tu gardes
                  <br />
                  la main<span className="text-blush">.</span>
                </h2>
              </div>
              <p className="max-w-md text-[18px] leading-[1.6] font-light text-white/80 lg:justify-self-end">
                Du premier clic au paiement, rien ne se passe sans toi.
              </p>
            </div>
            <ul className="grid md:grid-cols-3">
              {GARANTIES.map(({ icon: Icon, titre, texte }, i) => (
                <li
                  key={titre}
                  className={cn(
                    "flex flex-col gap-4 border-white/15 py-8 md:px-6 lg:py-10",
                    i > 0 && "border-t md:border-t-0 md:border-l",
                    i === 0 && "md:pl-0",
                  )}
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-white/10 text-blush">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-[18px] font-semibold">{titre}</h3>
                  <p className="text-[15px] leading-relaxed text-white/70">{texte}</p>
                </li>
              ))}
            </ul>
          </div>
        </Cadre>

        {/* ---------- FAQ ---------- */}
        <Cadre aria-labelledby="faq">
          <div className="grid gap-10 px-5 py-14 sm:px-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16 lg:px-16 lg:py-20">
            <div className="flex flex-col gap-4">
              <SurTitre>FAQ</SurTitre>
              <h2 id="faq" className={cn(TITRE_SERIF, "scroll-mt-10 text-ink")}>
                Questions<span className="text-brand">.</span>
              </h2>
              <p className="max-w-sm text-[16px] leading-relaxed text-copy">
                Une autre question ? Crée ton compte : tout se règle depuis ton profil.
              </p>
            </div>
            <div className="flex flex-col border-t border-ink/15">
              {FAQ.map(({ q, r }) => (
                <details key={q} className="group border-b border-ink/15">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-[18px] font-semibold tracking-[-0.01em] text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/20 transition-colors group-open:bg-ink group-open:text-white">
                      <Plus
                        className="size-4 transition-transform group-open:rotate-45"
                        aria-hidden="true"
                      />
                    </span>
                  </summary>
                  <p className="max-w-xl pb-6 text-[16px] leading-relaxed text-copy">{r}</p>
                </details>
              ))}
            </div>
          </div>
        </Cadre>

        {/* ---------- CTA final ---------- */}
        <Cadre
          id="extension"
          aria-labelledby="ext"
          className="relative scroll-mt-6 bg-brand text-white"
        >
          <LogoMark
            className="pointer-events-none absolute -top-16 right-[30%] hidden h-[420px] w-[240px] rotate-12 text-white/[0.06] lg:block"
            strokeWidth={22}
            lineWidth={11}
          />
          <div className="relative grid items-center gap-10 px-5 py-14 sm:px-10 lg:grid-cols-[1.4fr_1fr] lg:px-16 lg:py-20">
            <div className="flex flex-col">
              <SurTitre clair>Prêt·e ?</SurTitre>
              <h2 id="ext" className={cn(TITRE_SERIF, "mt-4")}>
                Ton prochain look
                <br />
                est à un clic<span className="text-blush">.</span>
              </h2>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/20 pt-8">
                <Link
                  href="/signup"
                  className="inline-flex h-[52px] items-center rounded-full bg-white px-7 text-[15px] font-semibold text-brand transition-colors hover:bg-blush hover:text-brand-deep"
                >
                  Créer mon compte
                  <span className="ml-1 font-normal text-brand/70">— c&apos;est gratuit</span>
                </Link>
                <span className="inline-flex items-center gap-2 text-[14px] text-white/75">
                  <Puzzle className="size-4" aria-hidden="true" />
                  Extension Chrome : bientôt sur le Chrome Web Store
                </span>
              </div>
            </div>

            <div
              className="flex items-center gap-4 rounded-[24px] border border-white/25 bg-white/10 p-3 backdrop-blur-xl lg:justify-self-end"
              aria-hidden="true"
            >
              <div className="size-[96px] shrink-0 overflow-hidden rounded-2xl bg-white">
                <img src={PHOTO_PRODUIT} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-col gap-1.5 pr-3">
                <span className="text-[17px] leading-tight">Ton profil sera prêt</span>
                <span className="text-[13px] text-white/70">
                  Tailles, marques et photo
                  <br />
                  enregistrées une fois pour toutes
                </span>
              </div>
            </div>
          </div>
        </Cadre>
      </main>

      <footer className="flex flex-col gap-6 px-3 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[24px]">
            <Logo />
          </span>
          <span className="text-[13px] text-copy">/ {SLOGAN}</span>
        </div>
        <nav aria-label="Pied de page" className="flex flex-wrap items-center text-sm">
          {(
            [
              ["/login", "Se connecter"],
              ["/signup", "Créer un compte"],
              ["/design", "Système de design"],
            ] as const
          ).map(([href, label], i) => (
            <span key={href} className="flex items-center">
              {i > 0 && (
                <span className="px-2 text-ink/40" aria-hidden="true">
                  ·
                </span>
              )}
              <Link
                href={href}
                className="inline-flex items-center gap-1 rounded-md px-1 py-1 font-semibold text-ink underline-offset-4 hover:underline"
              >
                {label}
              </Link>
            </span>
          ))}
        </nav>
        <span className="text-[13px] text-copy">© {new Date().getFullYear()} BuyFit</span>
      </footer>
    </div>
  );
}
