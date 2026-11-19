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

export async function generateMannequin(source: string): Promise<string> {
  const photo = await fetch(source);
  if (!photo.ok) throw new Error("Recharge ta photo en pied.");
  const form = new FormData();
  form.set("person", await photo.blob(), "person");
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
