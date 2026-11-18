"use client";

import { Footprints, Shirt, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Image produit. Les URLs fictives (example.com) et les images en erreur affichent un visuel
 * neutre aux couleurs de la charte, comme sur les maquettes.
 */
export function ProductImage({
  src,
  alt,
  categorie,
  className,
}: {
  src?: string;
  alt: string;
  categorie?: string;
  className?: string;
}) {
  const [erreur, setErreur] = useState(false);
  const fictive = !src || src.includes("example.com");
  if (fictive || erreur) {
    const Icone =
      categorie === "Chaussures" ? Footprints : categorie === "Essayage" ? Sparkles : Shirt;
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("flex items-center justify-center bg-line-soft text-grey", className)}
      >
        <Icone className="size-[38%] max-h-10 max-w-10 stroke-[1.4]" aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErreur(true)}
      className={cn("object-cover", className)}
    />
  );
}
