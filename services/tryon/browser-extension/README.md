# BuyFit — extension de test d’essayage

Extension **Chrome / Edge, Manifest V3**, prête à charger sans compilation ni dépendances Node.
Un clic sur l’icône BuyFit ouvre un onglet dédié (ou retrouve l’onglet déjà ouvert). Tu peux
importer une photo et un vêtement, lancer le test, voir le résultat puis le télécharger.

## Installation dans Chrome

1. Saisir `chrome://extensions` dans la barre d’adresse.
2. Activer **Mode développeur** en haut à droite.
3. Cliquer sur **Charger l’extension non empaquetée**.
4. Sélectionner ce dossier, celui qui contient `manifest.json` :

   ```text
   /Users/felixmachenaud/eugenia/hackathon/buyfit/services/tryon/browser-extension
   ```

   Dans la fenêtre macOS, **Cmd + Maj + G** permet de coller ce chemin, puis de le sélectionner.

5. Ouvrir le menu **Extensions** (puzzle), épingler **BuyFit — Test d’essayage**, puis cliquer
   sur son icône rouge **B**. La page de test s’ouvre dans un onglet.

Dans Edge : mêmes étapes depuis `edge://extensions`. Cette extension n’est pas un paquet Safari.
Après une modification du code, cliquer sur **Actualiser** sur sa carte dans `chrome://extensions`,
puis actualiser l’onglet de test.

## Lancer un essai

Garder le serveur Python à jour ouvert dans son terminal, sur le port **8000** :

```bash
cd /Users/felixmachenaud/eugenia/hackathon/buyfit/services/tryon
source .venv/bin/activate
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
```

Le mode est choisi **dans le terminal du serveur**, avant son démarrage. Exemple pour le
prototype Hugging Face (arrêter le serveur actuel avec Ctrl+C avant de le relancer) :

```bash
export TRYON_MODE=huggingface
export HF_SPACE_ID=yisol/IDM-VTON
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
```

Pour tester uniquement l’import et le téléchargement sans modèle, utiliser `export TRYON_MODE=mock`.
Le mode `local` requiert un moteur IDM-VTON compatible déjà installé et lancé séparément,
avec `TRYON_LOCAL_URL` configuré ; démarrer FastAPI seul ne charge pas le modèle.
Les détails du moteur et du token éventuel figurent dans le [README du service](../README.md).

Dans l’onglet de l’extension :

1. Vérifier **Serveur accessible** et le mode affiché. Cela ne garantit pas la disponibilité du modèle.
2. Choisir la photo de la personne et l’image d’un haut. JPEG/PNG/WebP, 8 Mo maximum chacune.
3. Cliquer sur le bouton de génération et garder l’onglet ouvert.
4. Le résultat apparaît **sous les deux photos**, avec **Télécharger l’image** et **Ouvrir en grand**.

Le mode Hugging Face annonce l’envoi des deux images avant le clic. Le mode simulation affiche
explicitement l’image du vêtement ; il ne prouve pas qu’un essayage IA fonctionne.
Si une erreur survient, elle reste visible dans le même onglet. Aucune génération n’est relancée
automatiquement. Une erreur de moteur/quota/authentification nécessite de régler le serveur ou
le Space, puis de réessayer.

## Fonctionnement et limites

- `GET /tryon/status` vérifie le mode, puis `POST /tryon/upload` envoie les champs `person` et `garment`.
- Seul le résultat `http://127.0.0.1:8000/results/<id>.png|jpg|webp` est accepté, téléchargé
  comme image, puis affiché via une URL `blob:` de l’extension. Les redirections sont refusées.
- Les photos restent en mémoire dans l’onglet jusqu’au clic. Aucun stockage navigateur,
  cookie, compte ou token n’est utilisé. **Effacer les images** retire les aperçus et le résultat.
  Cela ne supprime pas un export déjà conservé par le serveur ou un fichier téléchargé.
- La permission hôte porte sur `127.0.0.1` (les match patterns Chrome ne restreignent pas les ports).
  La CSP et le code limitent les requêtes au port **8000**. Aucun accès aux pages marchandes,
  aux onglets consultés ou à Hugging Face depuis l’extension.
- Les appels partent d’une page de l’extension avec permission hôte : aucun ajout de CORS au
  serveur n’est nécessaire. Le serveur reste lié à `127.0.0.1`.
- Le résultat est récupéré en mémoire : il reste visible dans cet onglet après l’expiration
  de l’export serveur. Le fermer ou l’actualiser efface ces données. Télécharger pour conserver.
- L’extension de test est autonome, sous le périmètre `services/tryon`. Le parcours produit
  `apps/extension → apps/api → services/tryon` et les contrats partagés ne sont pas modifiés.

## Vérification

Vérifications statiques du manifeste, des liens de fichiers, des sélecteurs DOM, des syntaxes
JavaScript et des permissions/CSP effectuées. Les tests de protocole sont dans
`../tests/test_extension.mjs` et se lancent depuis `services/tryon` avec :

```bash
node --test tests/test_extension.mjs
```

Le chargement dans Chrome est confirmé par la capture de Félix. Le **17 novembre 2026**, après
le correctif du délai de lecture Gradio, Félix confirme que la dernière version est fonctionnelle.
Les tests exécutables restent à lancer : le sandbox de l’agent ne fournit pas tous les contrôles
d’exécution imposés par le skill security-audit. Aucun essai distant n’a été lancé par l’agent.
Ce retour manuel ne couvre pas automatiquement tous les scénarios ci-dessous.

Vérification manuelle recommandée : serveur arrêté → message et reconnexion ; mode mock →
import/aperçus/résultat étiqueté simulation/téléchargement ; changement de fichiers → effacement
de l’ancien résultat ; HEIC ou fichier > 8 Mo → refus ; mode Hugging Face ou moteur local
opérationnel → vraie image et téléchargement. Réduire la fenêtre pour vérifier la disposition mobile.
