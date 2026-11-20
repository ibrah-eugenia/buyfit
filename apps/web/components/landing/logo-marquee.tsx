import { cn } from "@/lib/utils";

/**
 * Bande de logos qui défile. Fichiers dans public/brands/ :
 * Zara, H&M, Uniqlo = Simple Icons (CC0) ; les autres = Wikimedia Commons (SVG, COS en PNG).
 * Les logos restent la propriété de leurs marques : affichés pour indiquer où BuyFit cherche
 * et commande, sans partenariat implicite.
 *
 * `h` équilibre la taille optique (un wordmark large paraît plus gros qu'un monogramme).
 */
const LOGOS = [
  { nom: "Zara", src: "/brands/zara.svg", h: "h-14" },
  { nom: "H&M", src: "/brands/hm.svg", h: "h-10" },
  { nom: "Uniqlo", src: "/brands/uniqlo.svg", h: "h-9" },
  { nom: "COS", src: "/brands/cos.png", h: "h-6" },
  { nom: "Mango", src: "/brands/mango.svg", h: "h-5" },
  { nom: "Ralph Lauren", src: "/brands/ralphlauren.svg", h: "h-3.5" },
  { nom: "Lacoste", src: "/brands/lacoste.svg", h: "h-4" },
  { nom: "Levi's", src: "/brands/levis.svg", h: "h-8" },
  { nom: "Massimo Dutti", src: "/brands/massimodutti.svg", h: "h-5" },
  { nom: "Sandro", src: "/brands/sandro.svg", h: "h-4" },
  { nom: "Bershka", src: "/brands/bershka.svg", h: "h-4" },
] as const;

function Rangee({ doublon = false }: { doublon?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center gap-14 pr-14 sm:gap-20 sm:pr-20"
      aria-hidden={doublon || undefined}
    >
      {LOGOS.map(({ nom, src, h }) => (
        <li key={nom} className="flex h-14 shrink-0 items-center">
          <img
            src={src}
            alt={doublon ? "" : nom}
            className={cn(
              "w-auto max-w-none opacity-80 brightness-0 transition-opacity hover:opacity-100",
              h,
            )}
            loading="lazy"
            draggable={false}
          />
        </li>
      ))}
    </ul>
  );
}

/** Deux rangées identiques côte à côte : translate de -50 % = boucle sans couture. */
export function LogoMarquee({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]",
        className,
      )}
      role="region"
      aria-label="Boutiques où BuyFit cherche et commande"
    >
      <div className="landing-marquee flex w-max group-hover:[animation-play-state:paused]">
        <Rangee />
        <Rangee doublon />
      </div>
    </div>
  );
}
