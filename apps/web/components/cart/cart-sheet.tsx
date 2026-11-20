"use client";

import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/app-providers";
import { ProductImage } from "@/components/product-image";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatPrix } from "@/lib/utils";
import { SizeSelect } from "./size-select";

export function CartButton() {
  const { items, count, subtotal, remove, setTaille } = useCart();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
        >
          <ShoppingBag className="size-5" aria-hidden="true" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-line-soft">
          <SheetTitle className="font-display text-[34px] leading-none font-normal text-ink">
            Ton panier<span className="text-brand">.</span>
          </SheetTitle>
          <SheetDescription>
            Tous tes articles, toutes marques confondues. L&apos;agent passe une commande par
            marque.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Ton panier est vide"
              description="Cherche une pièce et ajoute-la au panier pour la commander."
              action={
                <SheetClose asChild>
                  <Button asChild size="sm">
                    <Link href="/search">Rechercher un vêtement</Link>
                  </Button>
                </SheetClose>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li
                  key={item.lineId}
                  className="flex gap-3 rounded-[20px] border border-ink/10 p-2.5"
                >
                  <ProductImage
                    src={item.product.imageUrl}
                    alt={item.product.nom}
                    categorie={item.product.categorie}
                    className="h-[84px] w-[68px] shrink-0 rounded-[10px]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="overline-label text-[11px]">{item.product.marque}</p>
                    <p className="truncate text-sm font-semibold">{item.product.nom}</p>
                    <p className="text-sm font-bold text-brand">
                      {formatPrix(item.product.prix * item.quantite, item.product.devise)}
                      {item.quantite > 1 && (
                        <span className="font-medium text-grey"> · ×{item.quantite}</span>
                      )}
                    </p>
                    <SizeSelect
                      id={`taille-${item.lineId}`}
                      value={item.taille}
                      options={item.product.tailleDisponibles}
                      onChange={(t) => setTaille(item.lineId, t)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(item.lineId)}
                    aria-label={`Retirer ${item.product.nom} du panier`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <SheetFooter className="border-t border-line-soft">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold">Sous-total</span>
              <span className="text-xl font-bold">{formatPrix(subtotal)}</span>
            </div>
            <p className="text-caption text-grey">Livraison choisie à l&apos;étape suivante.</p>
            <SheetClose asChild>
              <Button asChild size="lg" className="w-full">
                <Link href="/checkout">Commander</Link>
              </Button>
            </SheetClose>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
