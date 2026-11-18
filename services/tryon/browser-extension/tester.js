import { SERVER, EXTENSIONS, parseMode, parseResult, imageMime, readResultImage } from './protocol.mjs';

const $ = (id) => document.getElementById(id);
const form = $('tryon-form');
const files = new Map();
const previewUrls = new Map();
const revisions = { person: 0, garment: 0 };
let connected = false;
let checking = false;
let busy = false;
let mode = null;
let resultUrl = null;

const modeDetails = {
  local: {
    label: 'Calcul local',
    description: 'Mode local : le calcul utilise le moteur configuré sur ton serveur.',
    notice: 'En cliquant sur Générer, tu envoies les images au service et au moteur locaux.',
    action: 'Générer l’essayage',
  },
  huggingface: {
    label: 'Hugging Face',
    description: 'Mode distant : le calcul est réalisé par le Space Hugging Face configuré sur ton serveur.',
    notice: 'En cliquant sur le bouton ci-dessous, tu envoies les deux images à Hugging Face pour générer l’essayage.',
    action: 'Envoyer à Hugging Face et générer',
  },
  mock: {
    label: 'Simulation',
    description: 'Mode simulation : le service renvoie le vêtement pour tester l’affichage. Aucun essayage IA n’est généré.',
    notice: 'Ce test renvoie seulement l’image du vêtement. Il permet de vérifier l’import, l’affichage et le téléchargement.',
    action: 'Tester l’affichage (simulation)',
  },
};

function showError(message) {
  $('error').textContent = message;
  $('error').hidden = false;
}

function clearError() {
  $('error').textContent = '';
  $('error').hidden = true;
}

function updateControls() {
  $('generate').disabled = busy || checking || !connected || files.size !== 2;
  $('generate').textContent = busy ? 'Traitement en cours…' : (modeDetails[mode]?.action || 'Générer l’essayage');
  $('reconnect').disabled = busy || checking;
  $('clear').disabled = busy;
  $('images').disabled = busy;
  if (connected) $('send-notice').textContent = modeDetails[mode].notice;
  else $('send-notice').textContent = 'Sélectionne les deux images et connecte le service pour commencer.';
}

function setBusy(value) {
  busy = value;
  if (value) form.setAttribute('aria-busy', 'true');
  else form.removeAttribute('aria-busy');
  updateControls();
}

function clearResult() {
  $('result').hidden = true;
  $('result-image').removeAttribute('src');
  $('download').removeAttribute('href');
  $('open-image').removeAttribute('href');
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
}

function clearPreview(name) {
  const preview = $(`${name}-preview`);
  preview.removeAttribute('src');
  preview.hidden = true;
  $(`${name}-placeholder`).hidden = false;
  if (previewUrls.has(name)) URL.revokeObjectURL(previewUrls.get(name));
  previewUrls.delete(name);
  files.delete(name);
}

function offline() {
  connected = false;
  mode = null;
  $('connection-badge').textContent = 'Service indisponible';
  $('connection-badge').dataset.state = 'offline';
  $('mode-message').textContent = 'Vérifie que le serveur BuyFit à jour tourne sur le port 8000 de ton Mac.';
  $('server-help').open = true;
  updateControls();
}

function request(path, options = {}) {
  return fetch(`${SERVER}${path}`, {
    ...options,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  });
}

async function jsonResponse(response) {
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Réponse inattendue du service. Vérifie que le serveur BuyFit à jour utilise bien le port 8000.');
  }
  let body;
  try { body = await response.json(); }
  catch { throw new Error('La réponse du service est illisible. Redémarre le serveur et réessaie.'); }
  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error.slice(0, 600) : `Erreur du service (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return body;
}

async function readStatus() {
  try {
    const response = await request('/tryon/status', { signal: AbortSignal.timeout(5000) });
    if (response.status === 404) throw new Error('Le serveur utilise une ancienne version. Arrête-le avec Ctrl+C et relance-le avec le code à jour.');
    mode = parseMode(await jsonResponse(response));
    connected = true;
    $('connection-badge').textContent = `Serveur accessible · ${modeDetails[mode].label}`;
    $('connection-badge').dataset.state = mode === 'mock' ? 'mock' : 'online';
    $('mode-message').textContent = modeDetails[mode].description;
    $('server-help').open = false;
    updateControls();
    return mode;
  } catch (failure) {
    offline();
    if (failure instanceof TypeError || failure.name === 'TimeoutError') {
      throw new Error('Impossible de joindre BuyFit sur 127.0.0.1:8000. Démarre le serveur, puis clique sur Vérifier la connexion.');
    }
    throw failure;
  }
}

async function checkConnection() {
  if (checking || busy) return;
  checking = true;
  clearError();
  $('connection-badge').textContent = 'Vérification…';
  $('connection-badge').removeAttribute('data-state');
  updateControls();
  try { await readStatus(); }
  catch (failure) { showError(failure.message); }
  finally { checking = false; updateControls(); }
}

async function decodeImage(url) {
  const image = new Image();
  image.src = url;
  try { await image.decode(); }
  catch { throw new Error('Cette image ne peut pas être affichée. Essaie une autre image JPEG, PNG ou WebP.'); }
}

for (const name of ['person', 'garment']) {
  $(name).addEventListener('change', async () => {
    const revision = ++revisions[name];
    const file = $(name).files[0];
    clearPreview(name);
    clearResult();
    clearError();
    $('progress').textContent = '';
    $(`${name}-file`).textContent = file ? 'Vérification de l’image…' : 'Aucune image sélectionnée.';
    updateControls();
    if (!file) return;
    let url;
    try {
      const mime = await imageMime(file);
      url = URL.createObjectURL(file);
      await decodeImage(url);
      if (revision !== revisions[name]) { URL.revokeObjectURL(url); return; }
      previewUrls.set(name, url);
      files.set(name, { file, mime });
      $(`${name}-preview`).src = url;
      $(`${name}-preview`).hidden = false;
      $(`${name}-placeholder`).hidden = true;
      $(`${name}-file`).textContent = file.name;
    } catch (failure) {
      if (url) URL.revokeObjectURL(url);
      if (revision !== revisions[name]) return;
      $(name).value = '';
      $(`${name}-file`).textContent = 'Aucune image sélectionnée.';
      showError(failure.message);
    } finally { updateControls(); }
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || checking || !connected || files.size !== 2) return;
  const expectedMode = mode;
  const data = new FormData();
  for (const name of ['person', 'garment']) {
    const { file, mime } = files.get(name);
    // Original filenames stay in the extension UI.
    data.append(name, file, `${name}.${EXTENSIONS[mime]}`);
  }
  clearError();
  clearResult();
  setBusy(true);
  $('progress').textContent = 'Vérification du mode de calcul…';
  let timer;
  let pendingUrl;
  try {
    if (await readStatus() !== expectedMode) {
      throw new Error('Le mode du service a changé. Vérifie le mode affiché, puis clique à nouveau sur le bouton pour lancer le test.');
    }
    const startedAt = Date.now();
    const updateProgress = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      $('progress').textContent = `${mode === 'mock' ? 'Test d’affichage' : 'Essayage'} en cours… ${elapsed} s. Garde cet onglet ouvert.`;
    };
    updateProgress();
    timer = setInterval(updateProgress, 1000);
    const response = await request('/tryon/upload', {
      method: 'POST', body: data, signal: AbortSignal.timeout(120000),
    });
    const payload = await jsonResponse(response);
    if (response.headers.get('X-TryOn-Mode') !== expectedMode) {
      throw new Error('Le mode du résultat ne correspond pas au mode annoncé. Vérifie la configuration du serveur.');
    }
    const result = parseResult(payload);
    const imageResponse = await request(`${result.url.pathname}`, { signal: AbortSignal.timeout(15000) });
    if (!imageResponse.ok) throw new Error('L’image du résultat n’est plus disponible. Relance l’essayage.');
    const image = await readResultImage(imageResponse);
    pendingUrl = URL.createObjectURL(image);
    await decodeImage(pendingUrl);
    resultUrl = pendingUrl;
    pendingUrl = null;
    const simulation = expectedMode === 'mock';
    $('result-title').textContent = simulation ? 'Test d’affichage terminé' : 'Ton résultat';
    $('result-badge').textContent = simulation ? 'Simulation' : modeDetails[expectedMode].label;
    $('result-badge').dataset.state = simulation ? 'mock' : 'online';
    $('result-info').textContent = simulation
      ? 'Ceci est l’image du vêtement : l’import et l’affichage fonctionnent, mais aucun essayage IA n’a été généré.'
      : `Résultat reçu en ${(result.latencyMs / 1000).toFixed(1)} s. Tu peux maintenant l’ouvrir ou le télécharger.`;
    $('result-image').src = resultUrl;
    $('result-image').alt = simulation ? 'Image du vêtement renvoyée en simulation, sans génération IA' : 'Résultat de l’essayage BuyFit';
    $('download').href = resultUrl;
    $('download').download = `buyfit-${simulation ? 'simulation' : 'essayage'}-${Date.now()}.${EXTENSIONS[image.type]}`;
    $('open-image').href = resultUrl;
    $('result').hidden = false;
    $('progress').textContent = simulation ? 'Simulation terminée.' : 'Ton image est prête.';
    $('result').focus({ preventScroll: true });
    $('result').scrollIntoView({ behavior: 'instant', block: 'start' });
  } catch (failure) {
    $('progress').textContent = '';
    if (failure instanceof TypeError) {
      offline();
      showError('La connexion au service a échoué. Vérifie le terminal du serveur, puis reconnecte l’extension.');
    } else if (failure.name === 'TimeoutError') {
      showError('Le délai d’attente est dépassé. Vérifie le terminal avant de réessayer : le calcul peut encore être en cours.');
    } else {
      showError(failure.message);
    }
  } finally {
    clearInterval(timer);
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setBusy(false);
  }
});

$('clear').addEventListener('click', () => {
  if (busy) return;
  for (const name of ['person', 'garment']) {
    ++revisions[name];
    clearPreview(name);
    $(name).value = '';
    $(`${name}-file`).textContent = 'Aucune image sélectionnée.';
  }
  clearResult();
  clearError();
  $('progress').textContent = '';
  updateControls();
});

$('reconnect').addEventListener('click', checkConnection);
window.addEventListener('pagehide', () => {
  for (const url of previewUrls.values()) URL.revokeObjectURL(url);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
});
checkConnection();
