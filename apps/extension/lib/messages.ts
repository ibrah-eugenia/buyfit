import type { InspirationCapture } from "@buyfit/shared";

/** Background → content script : récupère l'image grand format de l'épingle cliquée. */
export interface ResolveImageMessage {
  type: "buyfit:resolve-image";
  srcUrl: string;
}

export type ResolveImageResponse = Pick<InspirationCapture, "imageUrl" | "pinUrl" | "description">;

/** Clé storage.session où le background dépose la dernière capture (lue par le side panel). */
export const CAPTURE_STORAGE_KEY = "buyfit:capture";
