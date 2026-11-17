import { cn } from "@/lib/utils";

/** Tracé de la marque « b » de BuyFit (viewBox 15 -8 100 176). */
const MARK_PATH = "M30 140 V20 H64 A30 30 0 0 1 64 80 H30 H70 A30 30 0 0 1 70 140 Z";

export function LogoMark({
  className,
  strokeWidth = 26,
  lineWidth = 13,
}: {
  className?: string;
  strokeWidth?: number;
  lineWidth?: number;
}) {
  return (
    <svg viewBox="15 -8 100 176" aria-hidden="true" className={className}>
      <path
        d={MARK_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <line x1="62" y1="-6" x2="62" y2="166" stroke="currentColor" strokeWidth={lineWidth} />
    </svg>
  );
}

/** Logotype « buyfit » : la marque remplace le b. Taille pilotée par la font-size (text-*). */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="BuyFit"
      className={cn(
        "inline-flex items-baseline leading-none font-bold tracking-[-0.05em] whitespace-nowrap text-brand",
        className,
      )}
    >
      <LogoMark className="mr-[0.01em] h-[0.876em] w-[0.498em] self-center translate-y-[0.03em]" />
      <span aria-hidden="true">uyfit</span>
    </span>
  );
}

/** Icône d'application : carré bordeaux, coins à ~22 %, marque blanche. */
export function AppIcon({ size = 48, className }: { size?: number; className?: string }) {
  const fin = size <= 32;
  return (
    <span
      className={cn("inline-flex items-center justify-center bg-brand text-white", className)}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      aria-hidden="true"
    >
      <LogoMark strokeWidth={fin ? 30 : 24} lineWidth={fin ? 15 : 12} className="h-[58%] w-[33%]" />
    </span>
  );
}

export const SLOGAN = "If you love this fit, buy it";
