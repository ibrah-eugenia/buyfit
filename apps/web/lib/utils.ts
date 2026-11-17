import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formate un prix en euros (ou autre devise ISO) à la française. */
export function formatPrix(montant: number, devise = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise }).format(montant);
}

/** Minuscules sans accents : sert aux recherches tolérantes (« hm » trouve « H&M »). */
export function normaliser(texte: string) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
