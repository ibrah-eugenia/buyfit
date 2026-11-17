/** Rectangle normalisé (0–1) dans l'image d'origine. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_SIDE = 768;

/**
 * Découpe la zone sélectionnée de l'image d'épingle et la renvoie en JPEG base64.
 * L'image est téléchargée par l'extension (host_permissions i.pinimg.com) : le canvas n'est
 * pas « tainted » et on peut l'exporter.
 */
export async function cropToDataUrl(imageUrl: string, r: NormRect): Promise<string> {
  const res = await fetch(imageUrl, { credentials: "omit" });
  if (!res.ok) throw new Error(`Image inaccessible (HTTP ${res.status})`);
  const bmp = await createImageBitmap(await res.blob());
  const sx = Math.round(r.x * bmp.width);
  const sy = Math.round(r.y * bmp.height);
  const sw = Math.max(1, Math.round(r.w * bmp.width));
  const sh = Math.max(1, Math.round(r.h * bmp.height));
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
