"use client";

import { Info, ShoppingBag, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/components/app-providers";
import { SizeSelect } from "@/components/cart/size-select";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { tryOnGarment } from "@/lib/data/fitting";
import type { SearchResult } from "@/lib/types";
import { cn, formatPrix } from "@/lib/utils";

export function ResultCard({
  result,
  avatarUrl,
  budgetMax,
}: {
  result: SearchResult;
  avatarUrl?: string;
  budgetMax?: number;
}) {
  const { add } = useCart();
  const [taille, setTaille] = useState(result.tailleConseillee);
  const [vue, setVue] = useState<"produit" | "essayage">("produit");
  const [image, setImage] = useState<string>();
  const [pending, setPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pourcentage = Math.round(result.score * 100);
  // The web demo catalogue has placeholder URLs; let users supply the real garment.
  const needsFile = new URL(result.imageUrl).hostname === "example.com";

  async function showFitting(file?: File) {
    if (pending) return;
    if (!avatarUrl) return toast.error("Crée ton mannequin dans Réglages → Photos.");
    if (image) {
      setVue("essayage");
      return;
    }
    if (!file && needsFile) {
      fileInput.current?.click();
      return;
    }
    if (file && file.size > 8 * 1024 * 1024) return toast.error("La photo dépasse 8 Mo.");
    setPending(true);
    try {
      setImage(await tryOnGarment(file ?? result.imageUrl));
      setVue("essayage");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Essayage impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="group/carte flex flex-col" aria-labelledby={`titre-${result.id}`}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-linen">
        {vue === "essayage" && image ? (
          <>
            <img
              src={image}
              alt={`Essayage de ${result.nom} sur ton avatar`}
              className="size-full object-cover"
            />
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-caption font-semibold text-ink">
              <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
              Sur toi
            </span>
          </>
        ) : (
          <ProductImage
            src={result.imageUrl}
            alt={result.nom}
            categorie={result.categorie}
            className="size-full"
          />
        )}
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="Photo du vêtement à essayer"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void showFitting(file);
          }}
        />
        <span className="absolute top-3 left-3 rounded-full border border-white/50 bg-white/40 px-3 py-1.5 text-caption font-semibold text-ink backdrop-blur-xl">
          {pourcentage} % ressemblant
        </span>
        {
          <div
            className="absolute top-3 right-3 flex rounded-full bg-white/95 p-0.5 text-caption font-semibold"
            role="group"
            aria-label="Affichage"
          >
            {(["essayage", "produit"] as const).map((v) => (
              <button
                key={v}
                type="button"
                disabled={pending}
                onClick={() => (v === "produit" ? setVue(v) : void showFitting())}
                aria-pressed={vue === v}
                className={cn(
                  "rounded-full px-2.5 py-1 transition-colors",
                  vue === v ? "bg-brand text-white" : "text-grey hover:text-ink",
                )}
              >
                {v === "essayage" ? (pending ? "Essayage…" : "Sur moi") : "Produit"}
              </button>
            ))}
          </div>
        }
      </div>
      <div className="flex flex-1 flex-col gap-3 px-1 pt-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-[0.04em] text-grey uppercase">
            {result.categorie} · {result.marque}
          </p>
          <h3 id={`titre-${result.id}`} className="text-[17px] leading-snug text-ink">
            {result.nom}
          </h3>
          <p className="text-[22px] font-bold tracking-[-0.03em] text-ink">
            {formatPrix(result.prix, result.devise)}
          </p>
          {budgetMax !== undefined && result.prix > budgetMax && (
            <p className="text-caption font-medium text-warning">
              Au-dessus de ton budget ({formatPrix(budgetMax)})
            </p>
          )}
        </div>
        <p className="flex items-start gap-2 border-t border-ink/15 pt-3 text-caption text-copy">
          <Info className="mt-px size-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span>
            D&apos;après le guide des tailles {result.marque} : taille conseillée{" "}
            <strong className="font-bold text-ink">{result.tailleConseillee}</strong>
          </span>
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink/15 pt-3">
          <SizeSelect
            id={`taille-${result.id}`}
            value={taille}
            options={result.tailleDisponibles}
            onChange={setTaille}
          />
          <Button
            onClick={() => {
              add(result, taille);
              toast.success("Ajouté au panier", {
                description: `${result.nom} · taille ${taille}`,
                duration: 2500,
              });
            }}
          >
            <ShoppingBag aria-hidden="true" />
            Ajouter au panier
          </Button>
        </div>
      </div>
    </article>
  );
}
