import { ExternalLink, UserRound, UserRoundCheck } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import type { WebOrder } from "@/lib/types";
import { formatPrix } from "@/lib/utils";
import { OrderStatusBadge, OrderTimeline } from "./order-status";

export function OrderCard({ order }: { order: WebOrder }) {
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(order.createdAt));
  return (
    <article
      className="flex flex-col gap-4 rounded-[24px] border border-ink/10 bg-white p-4"
      aria-label={`Commande ${order.marchand}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">{order.marchand}</span>
          <span className="text-caption text-grey">{date}</span>
        </div>
        <OrderStatusBadge statut={order.statut} />
      </div>
      <OrderTimeline statut={order.statut} />
      <ul className="flex flex-col gap-2">
        {order.articles.map((a) => (
          <li key={`${a.nom}-${a.taille}`} className="flex items-center gap-3">
            <ProductImage src={a.imageUrl} alt={a.nom} className="h-12 w-10 shrink-0 rounded-lg" />
            <span className="flex-1 text-sm">
              {a.nom} · <span className="text-grey">{a.taille}</span>
            </span>
            <span className="text-sm font-semibold">{formatPrix(a.prix)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3 text-caption text-grey">
        <span className="flex items-center gap-1.5">
          {order.mode === "compte" ? (
            <UserRoundCheck className="size-3.5" aria-hidden="true" />
          ) : (
            <UserRound className="size-3.5" aria-hidden="true" />
          )}
          {order.mode === "compte" ? `Sur ton compte ${order.marchand}` : "Commande en invité"}
        </span>
        <span>
          {order.livraison.mode === "domicile" ? "Domicile" : "Point relais"} ·{" "}
          {order.livraison.libelle} · {formatPrix(order.livraison.prix)}
        </span>
      </div>
      {order.message && (
        <p className="rounded-[10px] bg-linen p-3 text-sm text-copy">{order.message}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-bold">Total {formatPrix(order.total)}</span>
        {order.agentViewUrl && (
          <a
            href={order.agentViewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand underline-offset-4 hover:underline"
          >
            Voir ce qu&apos;a fait l&apos;agent
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
        )}
      </div>
    </article>
  );
}
