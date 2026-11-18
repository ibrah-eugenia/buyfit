import { AlertTriangle, CheckCircle2, Clock, Hand, Loader2 } from "lucide-react";
import type { OrderStatut } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUTS: Record<
  OrderStatut,
  { label: string; className: string; icon: typeof Clock }
> = {
  en_attente: { label: "En attente", className: "bg-linen text-grey", icon: Clock },
  en_cours: { label: "Agent en cours", className: "bg-blush text-brand-deep", icon: Loader2 },
  confirmation_requise: {
    label: "Prête, avant paiement",
    className: "bg-warning-soft text-warning",
    icon: Hand,
  },
  commandee: { label: "Commandée", className: "bg-success-soft text-success", icon: CheckCircle2 },
  echec: { label: "Échec", className: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

export function OrderStatusBadge({
  statut,
  className,
}: {
  statut: OrderStatut;
  className?: string;
}) {
  const s = STATUTS[statut];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-caption font-semibold",
        s.className,
        className,
      )}
    >
      <Icon
        className={cn("size-3.5", statut === "en_cours" && "animate-spin")}
        aria-hidden="true"
      />
      {s.label}
    </span>
  );
}

const ORDRE: OrderStatut[] = ["en_attente", "en_cours", "confirmation_requise"];

/** Frise des étapes de l'agent. Il s'arrête toujours avant le paiement. */
export function OrderTimeline({ statut }: { statut: OrderStatut }) {
  if (statut === "echec" || statut === "commandee") return null;
  const index = ORDRE.indexOf(statut);
  const libelles = ["Préparation", "Panier et livraison", "Arrêt avant paiement"];
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Avancement de l'agent">
      {libelles.map((l, i) => (
        <li
          key={l}
          className="flex flex-col gap-1.5"
          aria-current={i === index ? "step" : undefined}
        >
          <span className={cn("h-1.5 rounded-full", i <= index ? "bg-brand" : "bg-line-soft")} />
          <span className={cn("text-[11px] font-semibold", i <= index ? "text-ink" : "text-grey")}>
            {l}
          </span>
        </li>
      ))}
    </ol>
  );
}
