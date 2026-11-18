# Milestones — essayage de Félix

1. **Service et réception du résultat** — dernière version déclarée fonctionnelle par Félix le 17 novembre 2026 ; tests automatisés à relancer.
   Routes compatibles, import local, aperçu et téléchargement sur `/tryon/upload`.
   Export image dans `.results/`, lien retourné à BuyFit, expiration 24 h / 20 images maximum.
   Extension Chrome/Edge autonome prête à charger dans `browser-extension/` : deux imports,
   aperçu, mode local/distant/simulation, résultat dans l'onglet et téléchargement.
   Contrôles statiques OK et chargement Chrome confirmé ; sept tests de protocole à exécuter.
2. **Moteur d'essayage** — essai manuel déclaré fonctionnel ; mode exact et critères détaillés à consigner.
   Mode local par défaut : moteur IDM-VTON compatible à installer/lancer séparément.
   Mac vérifié : Apple M4, 16 Go ; pas de moteur IDM-VTON ni de runtime PyTorch dans la venv.
   Adaptateur local Gradio (`TRYON_LOCAL_URL`) préparé, mais il ne remplace pas le moteur.
   Mode Hugging Face distant disponible explicitement, quota/accès à vérifier si retenu.
   Succès : une vraie image générée, ouverte et téléchargée depuis notre service.
3. **Qualité et latence** — à réaliser après le milestone 2.
   Tester 5 couples personne/vêtement (hauts), noter fidélité, artefacts et durée.
   Cible démo : < 20 s, limite API BuyFit : 90 s. Un Space public peut dépasser cette limite.
4. **Intégration BuyFit** — à réaliser après le milestone 2.
   API → service → modèle → résultat visible dans l'extension.
   L'extension locale de test appelle directement le service ; elle ne remplace pas ce parcours produit.
   Vérifier erreurs et indisponibilité ; PR felix → dev avec review d'un équipier.

## Livraison de l'extension de test

- Modifications limitées à `services/tryon/browser-extension/`, test de protocole et documentation.
- Revue : import, double clic, changement de fichiers, indisponibilité, timeout et mode simulation traités dans le code.
- Sécurité : hôte loopback seulement, CSP sur le port 8000, résultat local validé, redirections refusées,
  aucun script distant, accès aux sites, cookie ou token dans l'extension.
- Vérifications exécutées : `node --check` des quatre fichiers JS/MJS, analyse statique du manifeste,
  des fichiers référencés et des sélecteurs, `git diff --check` ; succès.
- Non exécutés : sept tests Node et chargement du navigateur, car les limites d'exécution exigées par
  le skill security-audit ne sont pas disponibles dans le sandbox de l'agent. Chargement Chrome confirmé
  côté utilisateur ; Félix déclare la dernière version fonctionnelle après le correctif réseau.
- Statut : **essai manuel utilisateur validé ; suites automatisées à compléter**.

## Décisions nécessaires de Félix

- Confirmer le moteur de calcul : uniquement le Mac, GPU NVIDIA contrôlé, ou Space distant pour le prototype.
- Si Hugging Face est choisi : compte/Space accessibles et conditions applicables.
- Budget explicite avant tout GPU ou endpoint payant.
- Images autorisées à transmettre au fournisseur (commencer par les exemples publics).
- Ne jamais transmettre le token dans le chat ou le versionner ; utiliser `.env` local.

IDM-VTON utilise une licence CC BY-NC-SA 4.0 : vérifier son adéquation à l'usage envisagé.
Les adaptateurs local/distant ciblent le contrat Gradio du Space officiel.
Le nouvel échec remonté par Félix présente `httpx.ReadTimeout` : le client appliquait une lecture
de 10 s au flux SSE Gradio. Lecture corrigée à 70 s, connexion 10 s, écriture 20 s ; limite du job
conservée à 55 s. Les fermetures du flux (converties en `CancelledError` par Gradio) et les erreurs
de lecture encapsulées reçoivent un message spécifique et expurgé.
Revue : aucun changement au contrat HTTP, aux permissions de l'extension ou aux secrets ;
pas de nouvelle tentative automatique. Syntaxes des deux fichiers Python et câblage des délais
contrôlés statiquement, `git diff --check` OK. Les 27 tests Python préparés restent non exécutés
pour la même limite de sandbox. Félix confirme le 17 novembre 2026 que la dernière version fonctionne.
Aucune génération ni transmission de photo n'a été lancée par l'agent.
