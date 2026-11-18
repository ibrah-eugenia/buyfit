import Link from "next/link";
import { ArrowRight, Puzzle, MousePointerClick, PackageCheck, Shirt, Sparkles } from "lucide-react";
import { AppIcon, Logo, SLOGAN } from "@/components/brand/logo";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

const ETAPES = [
  {
    icon: MousePointerClick,
    titre: "Tu repères un look",
    texte:
      "Sur Pinterest, un clic sur l'extension BuyFit suffit. Ou décris-le à l'écrit, à la voix.",
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
    texte:
      "Panier, taille, livraison à domicile ou en point relais : il s'arrête juste avant le paiement.",
  },
] as const;

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-24">
          <div className="flex flex-col gap-6">
            <p className="overline-label">De Pinterest à ta porte</p>
            <h1 className="text-[40px] leading-[1.05] font-bold tracking-[-0.03em] text-ink sm:text-[56px]">
              If you love this fit,
              <br />
              <span className="text-brand">buy it.</span>
            </h1>
            <p className="max-w-md text-body text-copy">
              BuyFit retrouve la tenue qui t&apos;a tapé dans l&apos;œil chez tes marques préférées,
              te la montre sur toi, puis un agent prépare la commande à ta taille.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="#extension">
                  <Puzzle aria-hidden="true" />
                  Installer l&apos;extension
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/signup">
                  Créer mon compte
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <p className="text-caption text-grey">
              Gratuit. Tes photos servent uniquement à l&apos;essayage.
            </p>
          </div>

          {/* Aperçu façon panneau d'extension */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 -z-10 rounded-[32px] bg-linen" aria-hidden="true" />
            <div className="overflow-hidden rounded-2xl border border-line-soft bg-white shadow-[0_24px_60px_rgba(17,17,17,0.12)]">
              <div className="flex h-14 items-center border-b border-line-soft px-5 text-[22px]">
                <Logo />
              </div>
              <div className="flex flex-col gap-3 p-5">
                <p className="text-title font-bold">Ton look, en vrai</p>
                <p className="text-sm text-grey">3 pièces trouvées en stock, à ta taille.</p>
                {[
                  ["VESTE · ZARA", "Blazer noir coupe droite", "69,95 €", true],
                  ["PANTALON · H&M", "Pantalon noir à pinces", "29,99 €", false],
                  ["CHAUSSURES · ZARA", "Derbies cuir noir", "59,95 €", false],
                ].map(([sur, nom, prix, actif]) => (
                  <div
                    key={String(nom)}
                    className={`flex items-center gap-3 rounded-[14px] p-2.5 ${actif ? "border-[1.5px] border-brand" : "border border-line-soft"}`}
                  >
                    <div className="flex h-[60px] w-[50px] items-center justify-center rounded-[10px] bg-line-soft text-grey">
                      <Shirt className="size-5" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-semibold tracking-[0.04em] text-grey">
                        {sur}
                      </span>
                      <span className="text-sm font-semibold">{nom}</span>
                      <span className="text-sm font-bold text-brand">{prix}</span>
                    </div>
                  </div>
                ))}
                <div className="mt-1 flex h-12 items-center justify-center rounded-xl bg-brand text-[15px] font-semibold text-white">
                  Essayer le look sur moi
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="comment" className="border-t border-line-soft bg-linen">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="comment" className="mb-8 text-[28px] font-bold tracking-[-0.03em]">
              Comment ça marche
            </h2>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ETAPES.map(({ icon: Icon, titre, texte }, i) => (
                <li key={titre} className="flex flex-col gap-3 rounded-2xl bg-white p-6">
                  <span className="flex size-10 items-center justify-center rounded-full bg-blush text-brand-deep">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="text-caption font-semibold text-grey">Étape {i + 1}</p>
                  <p className="text-[17px] font-semibold">{titre}</p>
                  <p className="text-sm text-copy">{texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="extension"
          aria-labelledby="ext"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
        >
          <div className="flex flex-col items-start gap-6 rounded-2xl bg-brand p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <AppIcon size={64} className="shrink-0 bg-white text-brand" />
            <div className="flex flex-1 flex-col gap-2">
              <h2 id="ext" className="text-title font-bold">
                L&apos;extension Chrome arrive sur le Chrome Web Store
              </h2>
              <p className="text-sm text-white/85">
                En attendant, crée ton compte : ton profil sera prêt dès que tu l&apos;installes.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-white text-brand hover:bg-blush hover:text-brand-deep"
            >
              <Link href="/signup">Créer mon compte</Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-caption text-grey sm:flex-row sm:justify-between sm:px-6">
          <span>
            © {new Date().getFullYear()} BuyFit · {SLOGAN}
          </span>
          <Link href="/design" className="underline-offset-4 hover:underline">
            Système de design
          </Link>
        </div>
      </footer>
    </>
  );
}
