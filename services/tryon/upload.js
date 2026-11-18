const form = document.querySelector('#tryon-form');
const button = document.querySelector('#generate');
const error = document.querySelector('#error');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
let mode;
const previews = new Map();

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

for (const name of ['person', 'garment']) {
  const input = document.querySelector(`#${name}`);
  input.addEventListener('change', () => {
    const preview = document.querySelector(`#${name}-preview`);
    if (previews.has(name)) URL.revokeObjectURL(previews.get(name));
    preview.hidden = true;
    error.hidden = true;
    result.hidden = true;
    const file = input.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showError('Choisis une image JPEG, PNG ou WebP de 8 Mo maximum.');
      input.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    previews.set(name, url);
    preview.src = url;
    preview.hidden = false;
  });
}

async function init() {
  try {
    const response = await fetch('/tryon/status');
    if (!response.ok) throw new Error('Impossible de vérifier le moteur.');
    const config = await response.json();
    mode = config.mode;
    document.querySelector('#mode').textContent = config.message;
    button.textContent = mode === 'mock' ? 'Tester l’affichage (simulation)' : 'Essayer';
    button.disabled = false;
  } catch (failure) { showError(failure.message); }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (mode === 'huggingface' && !window.confirm('Ce mode transmet les deux images au Space Hugging Face. Continuer ?')) return;
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  error.hidden = true;
  result.hidden = true;
  status.textContent = 'Essayage en cours…';
  try {
    const response = await fetch('/tryon/upload', {
      method: 'POST', body: new FormData(form), signal: AbortSignal.timeout(100000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `Erreur HTTP ${response.status}`);
    const imageUrl = new URL(body.resultImageUrl, location.href);
    if (imageUrl.origin !== location.origin || !/^\/results\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(imageUrl.pathname)) {
      throw new Error('Lien de résultat inattendu.');
    }
    const image = document.querySelector('#result-image');
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('L’image reçue ne peut pas être affichée.'));
      image.src = imageUrl.href;
    });
    const simulation = response.headers.get('X-TryOn-Mode') === 'mock';
    document.querySelector('#result-title').textContent = simulation ? 'Simulation : image du vêtement' : 'Résultat de l’essayage';
    document.querySelector('#result-info').textContent = simulation
      ? 'Vérification de l’import et de l’affichage uniquement. Aucun essayage IA n’a été généré.'
      : `Image disponible · ${(body.latencyMs / 1000).toFixed(1)} secondes`;
    document.querySelector('#download').href = `${imageUrl.href}?download=true`;
    document.querySelector('#open-image').href = imageUrl.href;
    result.hidden = false;
    status.textContent = simulation ? 'Test d’affichage terminé.' : 'Ton image est prête.';
    result.scrollIntoView({ behavior: 'instant', block: 'start' });
  } catch (failure) {
    status.textContent = '';
    showError(failure.name === 'TimeoutError' ? 'Le calcul a dépassé le délai disponible.' : failure.message);
  } finally {
    button.disabled = false;
    form.removeAttribute('aria-busy');
  }
});

init();
