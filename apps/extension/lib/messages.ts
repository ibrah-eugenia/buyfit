import type { InspirationCapture } from "@buyfit/shared";

/** Background → content script : récupère l'image grand format de l'épingle cliquée. */
export interface ResolveImageMessage {
  type: "buyfit:resolve-image";
  srcUrl: string;
}

export type ResolveImageResponse = Pick<InspirationCapture, "imageUrl" | "pinUrl" | "description">;

/** Clé storage.session où le background dépose la dernière capture (lue par le side panel). */
export const CAPTURE_STORAGE_KEY = "buyfit:capture";

/** Aperçu d'un lien d'épingle : image (og:image), titre, URL de la page. */
export interface PagePreview {
  url: string;
  imageUrl?: string;
  title?: string;
}

/** Panneau → content script : démarre la sélection d'une pièce sur la page. */
export interface StartSelectMessage {
  type: "buyfit:start-select";
}

/** Content script → panneau : zone choisie (image + rectangle normalisé) ou annulation. */
export type SelectionMessage =
  | {
      type: "buyfit:selection";
      imageUrl: string;
      rect: { x: number; y: number; w: number; h: number };
    }
  | { type: "buyfit:selection-cancel" };
