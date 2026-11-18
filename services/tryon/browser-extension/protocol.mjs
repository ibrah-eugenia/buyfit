export const SERVER = 'http://127.0.0.1:8000';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const EXTENSIONS = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' });

export function parseMode(body) {
  if (!body || !['local', 'huggingface', 'mock'].includes(body.mode)) {
    throw new Error('Version du service incompatible. Redémarre le serveur avec le code à jour.');
  }
  return body.mode;
}

export function parseResult(body) {
  if (!body || typeof body.resultImageUrl !== 'string'
      || !Number.isFinite(body.latencyMs) || body.latencyMs < 0) {
    throw new Error('Le service n’a pas retourné un résultat valide.');
  }
  let url;
  try { url = new URL(body.resultImageUrl); } catch { /* Validated below. */ }
  if (!url || url.origin !== SERVER || url.username || url.password || url.search || url.hash
      || !/^\/results\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(url.pathname)) {
    throw new Error('Le lien du résultat ne correspond pas au serveur BuyFit local.');
  }
  return { url, latencyMs: body.latencyMs };
}

export async function imageMime(blob) {
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) {
    throw new Error('Chaque image doit faire entre 1 octet et 8 Mo.');
  }
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const startsWith = (signature, offset = 0) => signature.every((byte, i) => bytes[offset + i] === byte);
  if (startsWith([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (startsWith([255, 216, 255])) return 'image/jpeg';
  if (startsWith([82, 73, 70, 70]) && startsWith([87, 69, 66, 80], 8)) return 'image/webp';
  throw new Error('Choisis une image JPEG, PNG ou WebP. Exporte les photos HEIC en JPEG avant l’import.');
}

export async function readResultImage(response) {
  const declaredType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (!Object.hasOwn(EXTENSIONS, declaredType)) {
    throw new Error('Le fichier reçu n’est pas une image JPEG, PNG ou WebP.');
  }
  if (Number(response.headers.get('Content-Length')) > MAX_IMAGE_BYTES) {
    throw new Error('L’image reçue dépasse 8 Mo.');
  }
  if (!response.body) throw new Error('L’image reçue est vide.');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error('L’image reçue dépasse 8 Mo.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const blob = new Blob(chunks, { type: declaredType });
  if (await imageMime(blob) !== declaredType) throw new Error('Le contenu de l’image reçue est invalide.');
  return blob;
}
