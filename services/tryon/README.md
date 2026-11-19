# services/tryon — Essayage virtuel 2D

**Responsable : Félix.** Langage et framework au choix (Python/FastAPI conseillé pour les modèles
Hugging Face). Dans le parcours produit, le service est appelé **uniquement par `apps/api`**.
L'[extension de test locale](browser-extension/README.md) appelle directement la route d'import
pour vérifier le service sur le Mac, sans modifier ce parcours ni les contrats partagés.

## Démarrer le prototype

Implémentation : Python 3.12 conseillé, FastAPI, adaptateur Gradio IDM-VTON local ou distant.
Les étapes et critères de validation sont dans [MILESTONES.md](MILESTONES.md).

**Le serveur HTTP n'est pas le modèle.** Aucun moteur IDM-VTON ni poids n'est installé par ce
service. Le mode local nécessite un moteur Gradio compatible lancé séparément, normalement
sur une machine CUDA/NVIDIA. Le Mac M4 16 Go de Félix n'est pas validé pour cette implémentation.

Depuis la racine du répo :

```bash
cd services/tryon
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
```

Par défaut, `TRYON_MODE=local` : aucun appel à Hugging Face. Sans moteur configuré, une demande
d'essayage échoue explicitement. La page reste accessible pour consulter son état.
Pour tester seulement l'affichage sans modèle, lancer avec `TRYON_MODE=mock` : le résultat
est l'image du vêtement, clairement étiquetée **simulation**, jamais un essayage IA.
Dans un autre terminal :

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/tryon \
  -H 'Content-Type: application/json' \
  -d '{"userPhotoUrl":"https://i.pinimg.com/person.jpg","garmentImageUrl":"https://i.pinimg.com/garment.jpg"}'
```

Ces URL sont des exemples fictifs : le mock ne les télécharge pas. Remplacer par de vraies
images pour le mode Hugging Face. La documentation interactive est sur http://localhost:8000/docs.

### Voir et télécharger le résultat

Ouvrir http://localhost:8000/tryon/upload (ou http://localhost:8000).
Choisir les deux images, cliquer sur **Essayer**. La page affiche les aperçus, l'état du calcul,
l'image reçue, puis **Télécharger l'image** et **Ouvrir l'image**. Les erreurs restent visibles
sur cette même page. Un envoi au Space distant demande une confirmation dans ce formulaire.

Chaque image retournée en data URL est exportée dans `.results/` (ignoré par Git/Docker),
avec un nom aléatoire et des permissions privées. `resultImageUrl` devient une URL absolue
`http://localhost:8000/results/<identifiant>.png` (ou jpg/webp). Elle fonctionne dans un navigateur
et dans l'interface BuyFit existante, qui lit déjà ce champ, si le serveur est accessible.
`?download=true` force le téléchargement. Conservation : 24 h et 20 exports maximum, nettoyage
à chaque nouvel export ; les fichiers expirés ne sont jamais servis. Aucun fichier d'entrée
n'est conservé par notre service. Il faut refaire l'import des essais ayant déjà échoué.

Les URL localhost sont adaptées au développement sur la même machine. Pour un déploiement,
prévoir une URL accessible aux clients, idéalement Supabase Storage, et l'autorisation d'accès.

### Tester depuis l'extension Chrome / Edge

Une extension Manifest V3 prête à charger se trouve dans [`browser-extension/`](browser-extension/README.md).
Elle ne nécessite ni `pnpm install` ni compilation. Dans `chrome://extensions`, activer le mode
développeur puis **Charger l'extension non empaquetée** et sélectionner ce dossier.
Cliquer ensuite sur **BuyFit — Test d'essayage** dans le menu Extensions.

L'onglet permet de choisir les deux fichiers, voir le mode du serveur, lancer le test,
afficher le résultat et le télécharger. Garder le serveur à jour ouvert sur `127.0.0.1:8000`.
L'accès hôte de l'extension évite d'ajouter un CORS général au serveur. Aucun token n'est saisi
dans l'extension. Le calcul utilise toujours le moteur configuré côté Python : cette interface
ne fournit pas de modèle/GPU supplémentaire. Le mode simulation reste explicitement étiqueté.
Les [instructions détaillées et la vérification manuelle](browser-extension/README.md) sont incluses.

### Importer deux fichiers depuis Swagger

Après mise à jour du code, arrêter le serveur avec Ctrl+C, réexécuter
`python -m pip install -r requirements.txt` (nouvelle dépendance `python-multipart`), puis
relancer Uvicorn avec le mode souhaité.

Sur http://localhost:8000/docs, actualiser puis ouvrir **POST /tryon/upload** → **Try it out** :

1. `person` : sélectionner la photo de la personne.
2. `garment` : sélectionner l'image du vêtement.
3. Cliquer sur **Execute**. En mode Hugging Face les deux images sont transmises au Space.

JPEG, PNG ou WebP, 8 Mo maximum par fichier. L'extension du nom ne suffit pas : la signature
du fichier est vérifiée (ce contrôle ne garantit pas qu'une image est entièrement décodable).
Les fichiers HEIC/PDF doivent être exportés en JPEG/PNG avant envoi. Aucun chemin local n'est
accepté dans les champs URL de l'autre route : ils servent uniquement aux liens HTTPS.
Le résultat garde le format JSON `resultImageUrl` (URL d'export locale), `latencyMs`.
Cette route additionnelle de test ne modifie pas le contrat `/tryon` utilisé par BuyFit.

### Brancher un moteur local installé par vos soins

```bash
export TRYON_MODE=local
export TRYON_LOCAL_URL=http://127.0.0.1:7860
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
```

Le moteur doit déjà exécuter IDM-VTON avec l'API Gradio `/tryon` et les mêmes 7 entrées que le
Space officiel. Ce réglage ne télécharge pas les poids et n'installe pas CUDA. Les calculs et
uploads passent uniquement par ce moteur local ; aucun token Hugging Face ne lui est envoyé.
Le moteur doit également être configuré hors ligne après téléchargement de ses poids.
Dans Docker, `127.0.0.1` désigne le conteneur : le moteur doit être dans le même espace réseau ;
l'adaptateur local n'accepte volontairement pas d'adresse externe.

### Activer Hugging Face

Tester d'abord https://huggingface.co/spaces/yisol/IDM-VTON dans le navigateur.
L'adaptateur vise son API Gradio `/tryon` (photo, vêtement, description, masque auto,
recadrage, nombre d'étapes et seed). Il vise les **hauts**, pas un choix automatique haut/bas/robe.
La compatibilité de cet appel doit encore être validée sur un Space en fonctionnement.

Arrêter le serveur puis, dans le même terminal :

```bash
export TRYON_MODE=huggingface
export HF_SPACE_ID=yisol/IDM-VTON
# Ajouter le vrai domaine du projet Supabase si les photos y sont stockées.
export TRYON_IMAGE_HOSTS=i.pinimg.com,votre-projet.supabase.co
# Seulement si l'accès au Space exige un token : saisie masquée, hors historique.
read -s HF_TOKEN
export HF_TOKEN
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
```

Le token doit appartenir à un compte autorisé à accéder au Space ; un token seul ne fournit pas
de GPU. `HF_SPACE_ID` doit désigner un Space Gradio compatible, pas le dépôt des poids du modèle.
Un Space public peut être en veille, saturé ou imposer une authentification/quotas ; un Space
dédié avec GPU peut être nécessaire pour la démo. Aucun GPU payant n'est créé par ce service.

`.env.example` documente les variables. Le service ne charge pas automatiquement les fichiers
`.env` ; utiliser les variables exportées ci-dessus ou `docker --env-file`.
Ne jamais commiter de token. Les photos/vêtements sont transmis au Space choisi : n'utiliser
que des images autorisées. Les fichiers locaux temporaires sont supprimés à la fin de l'appel,
mais cela ne garantit pas l'effacement côté fournisseur.

Le résultat est exporté localement pour pouvoir être ouvert et téléchargé.
Les images d'entrée et de sortie sont limitées à 8 Mo chacune. Les URL doivent utiliser HTTPS,
un port standard et un domaine **exact** de confiance ; les redirections sont refusées.
Ajouter uniquement des hôtes publics contrôlés/de confiance à `TRYON_IMAGE_HOSTS`.

### Tests locaux sans GPU

Après installation des dépendances, depuis `services/tryon` :

```bash
python -m unittest discover -s tests -v
```

Les tests couvrent le contrat en mock, entrées invalides, taille des requêtes, erreurs du modèle,
concurrence et refus des URL non autorisées/redirections. Aucun appel Hugging Face n'est effectué.
Ils ne valident pas la qualité du modèle ni la compatibilité réelle du Space.

### Docker et exposition réseau

```bash
docker build -t buyfit-tryon .
docker run --rm -p 127.0.0.1:8000:8000 buyfit-tryon
# Pour les variables réelles : ajouter --env-file .env avant buyfit-tryon.
```

Service réservé à la machine locale ou au réseau privé de l'API. Pas d'authentification
applicative à ce stade : **ne pas l'exposer publiquement** sans authentification entre services
et limite de débit. Utiliser un seul worker ; une seule génération simultanée est acceptée.

`/health` confirme que le serveur a démarré, pas qu'un moteur/GPU est disponible.
`/tryon/status` indique local/distant/simulation sans exposer de token ni de configuration privée.
La connexion au modèle est réalisée à la première demande. Accès refusé, quota GPU, moteur local
absent et erreurs réseau ont des messages distincts. Les exceptions brutes ne sont pas exposées.
Le job Gradio attend au maximum 55 s après soumission ; téléchargements et uploads ajoutent
du délai. L'annulation distante est best effort. Mesurer le temps total au milestone 3 :
la limite de 90 s de l'API doit être vérifiée sur le Space retenu.

Le client Gradio utilise un délai de lecture de **70 s**, une connexion de 10 s et une écriture
de 20 s. Le délai de lecture dépasse volontairement les 55 s d'attente du job : Gradio applique
ce réglage au flux SSE qui attend le résultat, et l'ancien réglage uniforme de 10 s pouvait le
couper pendant un calcul silencieux. Le journal fourni par Félix confirme un `httpx.ReadTimeout`.
Gradio peut ensuite convertir la fermeture de ce flux en `CancelledError`, ce qui produisait le
message générique. Les interruptions et délais dépassés ont désormais des messages spécifiques,
sans exposer les erreurs brutes. Ce correctif n'augmente pas le quota GPU et ne garantit pas
la disponibilité du Space à chaque demande.

## État de vérification

Syntaxes Python/JavaScript et `git diff --check` vérifiés. Tests préparés pour import, erreurs,
export, téléchargement, expiration, rétention, moteur absent et client Gradio.
La configuration publique du Space confirme Gradio 4.24 et l'API `/tryon` à 7 entrées.
Le paramètre Gradio Client 2 est `token`, anciennement `hf_token`.
Les 9 tests initiaux avaient été exécutés avec succès par Félix ; les tests mis à jour doivent
être relancés : le sandbox macOS refuse la limitation mémoire requise pour leur exécution par
l'agent. Docker n'est pas installé ; build Docker non vérifié. Aucune nouvelle génération réelle
n'a été exécutée par l'agent. Après correction du délai de lecture responsable d'une coupure
possible du flux Gradio, **Félix confirme le 17 novembre 2026 que la dernière version est fonctionnelle**.
Ce retour valide son essai manuel ; il ne remplace pas les suites automatisées, la mesure de
latence ni la validation d'un moteur entièrement local.
Les 27 tests Python préparés couvrent aussi les délais des deux clients, le message après
coupure du flux et le maintien de la limite du job, même si son annulation échoue.
Extension autonome : manifeste MV3, assets, imports, sélecteurs DOM, permissions/CSP et syntaxe
JavaScript vérifiés statiquement. Sept tests de protocole préparés (`node --test tests/test_extension.mjs`)
mais non exécutés. Chargement de l'extension confirmé par la capture Chrome de Félix ;
retour utilisateur positif après le correctif réseau. Le téléchargement et les autres scénarios
de la liste de vérification restent à contrôler explicitement.
Statut : **essai manuel utilisateur validé ; vérifications automatisées à compléter**.

## Contrat HTTP à exposer

Formats définis dans [`packages/shared/src/tryon.ts`](../../packages/shared/src/tryon.ts).

### `POST /tryon`

Requête (`TryOnRequest`) :

```json
{
  "userPhotoUrl": "https://…/user.jpg",
  "garmentImageUrl": "https://…/vetement.jpg"
}
```

Réponse `200` (`TryOnResult`) :

```json
{
  "resultImageUrl": "https://…/resultat.jpg",
  "latencyMs": 8400
}
```

- `resultImageUrl` : URL publique (idéalement Supabase Storage, bucket `tryon-results`) ou data URL
  `data:image/jpeg;base64,…` pour démarrer.
- Erreur : code `4xx/5xx` + `{ "error": "message" }`.
- Timeout côté API : **90 s**. Viser < 20 s pour la démo.

### `GET /health`

Renvoie `200 { "ok": true }` (utile pour vérifier que le modèle est chargé).

## Intégration

- En local, lancer le service sur `http://localhost:8000` et mettre
  `TRYON_SERVICE_URL=http://localhost:8000` dans le `.env` racine.
- Tant que `TRYON_SERVICE_URL` est vide, l'API utilise un mock (renvoie l'image du vêtement).
- Mettre les dépendances (requirements.txt / pyproject) et un `Dockerfile` dans ce dossier.
- Si le service est en Python, il est exclu du lint/typecheck TS (déjà ignoré dans la config).

## Mannequin de compte et essayages

Dans le site BuyFit, l’étape Photos de l’inscription et des réglages accepte une photo en pied.
**Générer mon mannequin** l’envoie à FLUX.1 Kontext. La validation sauvegarde le résultat dans
le bucket privé existant `user-photos` sous `<user_id>/mannequin/`, avec une ligne de type
`pied` dans `user_photos`. Les anciennes photos en pied restent disponibles comme source.
Les deux tables et les buckets privés proviennent des migrations Supabase existantes.

Pour lancer la démo depuis la racine du projet, avec les variables du projet Supabase déjà créé :

1. Dans le terminal Python avec `HF_TOKEN` exporté, redémarrer le service en
   `TRYON_MODE=huggingface` (commande de la section « Activer Hugging Face »). FLUX et
   IDM-VTON partagent ce token. `HF_SPACE_ID` reste celui d’IDM-VTON.
2. Dans le `.env` racine, configurer `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `TRYON_SERVICE_URL=http://127.0.0.1:8000` et `WEB_URL=http://localhost:3000`.
   Lancer `pnpm dev:api`. Dans `apps/web/.env.local`, utiliser les clés publiques du même
   projet et `API_URL=http://localhost:8787`, puis lancer `pnpm --filter @buyfit/web dev`.
3. Se connecter sur le site et valider un mannequin. Sur une carte produit web, **Sur moi**
   lance IDM-VTON. Le catalogue fictif demande une vraie photo du vêtement. Pour le panneau
   Chrome, lancer `pnpm build:ext` et recharger l’extension produit. Utiliser la même origine
   web et le même profil Chrome que pour la connexion. Le mode extension mock est réservé aux
   réponses simulées. Pour les images produit distantes, autoriser leurs hôtes HTTPS exacts dans
   `TRYON_IMAGE_HOSTS` côté Python (par exemple `i.pinimg.com,images.unsplash.com` pour la démo).

Le serveur vérifie le token Supabase avant de résoudre le mannequin du compte. Il transmet
l’image à IDM-VTON et stocke le rendu dans `tryon-results`. L’historique utilise une URL signée
renouvelée à la lecture. Pour un vêtement importé, son identifiant dans l’historique est un
URN UUID. Si le quota Hugging Face est épuisé, une nouvelle tentative est possible avec la
même photo. En hébergement, régler les URL sur les origines déployées et prévoir un délai
HTTP d’au moins 215 secondes entre le site et l’API.
