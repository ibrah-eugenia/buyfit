import { TryOnResultSchema } from "@buyfit/shared";

async function fittingRequest(path: string, body: FormData | string) {
  const headers: Record<string, string> = { "X-BuyFit-Request": "fitting" };
  if (typeof body === "string") headers["Content-Type"] = "application/json";
  const response = await fetch("/api/fitting/" + path, { method: "POST", headers, body });
  if (!response.ok) {
    const message = await response.json().catch(() => ({}));
    throw new Error(message.error || "La génération a échoué. Réessaie dans un instant.");
  }
  return response;
}

/**
 * Assemble 1 à 4 photos en une planche JPEG (grille 1×1, 2×1 ou 2×2, cases 3:4 recadrées au
 * centre). Le modèle d'image n'accepte que 3 images : une planche visages + une planche corps
 * lui donnent quand même tous les angles.
 */
export async function buildSheet(files: Blob[]): Promise<Blob> {
  const images = await Promise.all(files.slice(0, 4).map((f) => createImageBitmap(f)));
  const cols = images.length === 1 ? 1 : 2;
  const rows = images.length <= 2 ? 1 : 2;
  const cw = 768;
  const ch = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cw;
  canvas.height = rows * ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  images.forEach((img, i) => {
    // Recadrage « cover » centré dans la case.
    const scale = Math.max(cw / img.width, ch / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (i % cols) * cw + (cw - w) / 2;
    const y = Math.floor(i / cols) * ch + (ch - h) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect((i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    img.close();
  });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Planche impossible."))),
      "image/jpeg",
      0.9,
    ),
  );
}

/** Mannequin dans une pose (0 de face, 1 trois-quarts, 2 en marche), en data URL. */
export async function generateMannequin(face: Blob, body: Blob, pose: number): Promise<string> {
  const form = new FormData();
  form.set("face", face, "face.jpg");
  form.set("person", body, "person.jpg");
  form.set("pose", String(pose));
  const image = await (await fittingRequest("avatar", form)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Impossible de lire le mannequin."));
    reader.readAsDataURL(image);
  });
}

export async function tryOnGarment(garment: string | File) {
  const form = new FormData();
  if (typeof garment !== "string") form.set("garment", garment);
  const response = await fittingRequest(
    "tryon",
    typeof garment === "string" ? JSON.stringify({ garmentImageUrl: garment }) : form,
  );
  return TryOnResultSchema.parse(await response.json()).resultImageUrl;
}
