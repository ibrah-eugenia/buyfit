import { ArrowLeftRight, Check, Loader2, Sparkles } from "lucide-react";
import { PHOTO_AVANT, PHOTO_LOOK } from "@/components/landing/photos";
import { cn } from "@/lib/utils";

/**
 * Visuels de la landing, dessinés en CSS aux couleurs de la charte (pas de photos produit :
 * le site n'en embarque aucune). Purement décoratifs : aria-hidden sur les compositions.
 */

/** Tenue « à plat » stylisée : veste, pantalon, chaussures. */
export function Flatlay({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-[#e9e3db]", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_10%,#f7f5f2_0%,transparent_60%)]" />
      {/* veste : manches + col en V */}
      <div className="absolute top-[7%] left-1/2 h-[40%] w-[70%] -translate-x-1/2">
        <div className="absolute inset-0 bg-ink [clip-path:polygon(22%_6%,40%_0%,50%_34%,60%_0%,78%_6%,100%_84%,87%_88%,77%_42%,77%_100%,23%_100%,23%_42%,13%_88%,0%_84%)]" />
        <div className="absolute top-[34%] left-1/2 h-[66%] w-px -translate-x-1/2 bg-white/15" />
        <div className="absolute top-[52%] left-[54%] size-1 rounded-full bg-white/40" />
        <div className="absolute top-[68%] left-[54%] size-1 rounded-full bg-white/40" />
      </div>
      {/* pantalon */}
      <div className="absolute top-[50%] left-1/2 h-[34%] w-[38%] -translate-x-1/2 bg-[#3a3a3a] [clip-path:polygon(6%_0%,94%_0%,100%_100%,58%_100%,50%_22%,42%_100%,0%_100%)]" />
      {/* chaussures */}
      <div className="absolute bottom-[6%] left-1/2 flex w-[46%] -translate-x-1/2 justify-between">
        <div className="h-3 w-[40%] rounded-l-full rounded-r-md bg-brand-deep" />
        <div className="h-3 w-[40%] rounded-l-md rounded-r-full bg-brand-deep" />
      </div>
    </div>
  );
}

/** Puce en verre posée sur une photo. */
function Verre({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "absolute rounded-[20px] border border-white/50 bg-white/35 shadow-[0_14px_40px_rgba(17,17,17,0.10)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Essayage : avant (ta photo) / après (avec le look), séparés par une poignée de comparaison. */
export function TryOnVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]" aria-hidden="true">
      <div className="relative grid aspect-[4/5] grid-cols-2 overflow-hidden rounded-[32px] bg-line-soft">
        <img src={PHOTO_AVANT} alt="" className="h-full w-full object-cover object-top" />
        <img src={PHOTO_LOOK} alt="" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent" />
        <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white" />
        <span className="absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-[0_10px_30px_rgba(17,17,17,0.18)]">
          <ArrowLeftRight className="size-5" />
        </span>
        <span className="absolute bottom-5 left-5 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-ink">
          Ta photo
        </span>
        <span className="absolute right-5 bottom-5 flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white">
          <Sparkles className="size-3.5" />
          Avec le look
        </span>
      </div>

      <Verre className="top-[8%] -right-3 hidden items-center sm:flex gap-3 p-3 pr-4 sm:-right-8">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white text-brand">
          <Check className="size-4 stroke-[2.5]" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[14px] font-semibold text-ink">Blazer coupe droite</span>
          <span className="text-[12px] text-ink/70">Taille M · 69,95 €</span>
        </span>
      </Verre>
    </div>
  );
}

const AGENT_ETAPES = [
  { texte: "Ouverture de zara.com", etat: "fait" },
  { texte: "Connexion à ton compte", etat: "fait" },
  { texte: "Blazer taille M ajouté au panier", etat: "fait" },
  { texte: "Livraison en point relais choisie", etat: "fait" },
  { texte: "En attente de ta validation", etat: "attente" },
] as const;

/** Agent de commande : suivi en direct sur panneau dégradé, s'arrête avant le paiement. */
export function AgentVisual() {
  return (
    <div
      className="relative rounded-[28px] bg-[linear-gradient(160deg,#bdb8b2_0%,#dcd8d3_50%,#f4f2ef_100%)] p-5 sm:p-10"
      aria-hidden="true"
    >
      <div className="overflow-hidden rounded-[22px] border border-white/60 bg-white/60 shadow-[0_18px_44px_rgba(17,17,17,0.10)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <span className="text-[15px] font-semibold text-ink">Commande en cours</span>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-brand">
            <span className="landing-pulse size-1.5 rounded-full bg-brand" />
            En direct
          </span>
        </div>
        <ol className="flex flex-col px-5 py-4">
          {AGENT_ETAPES.map(({ texte, etat }, i) => (
            <li key={texte} className="relative flex items-center gap-3 py-2">
              {i < AGENT_ETAPES.length - 1 && (
                <span className="absolute top-[calc(50%+12px)] left-[11px] h-[calc(100%-16px)] w-px bg-ink/15" />
              )}
              {etat === "fait" ? (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-ink text-white">
                  <Check className="size-3.5 stroke-[3]" />
                </span>
              ) : (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-white">
                  <Loader2 className="size-3.5 animate-spin" />
                </span>
              )}
              <span
                className={cn(
                  "text-[14px]",
                  etat === "fait" ? "text-copy" : "font-semibold text-brand",
                )}
              >
                {texte}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex gap-2 border-t border-ink/10 p-4">
          <div className="flex h-11 flex-1 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
            Valider et payer
          </div>
          <div className="flex h-11 items-center justify-center rounded-full border-[1.5px] border-ink px-5 text-sm font-semibold text-ink">
            Annuler
          </div>
        </div>
      </div>
    </div>
  );
}
