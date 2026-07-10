# Déploiement & migration Render

## Contexte : pourquoi pas le free tier ?

Le **plan gratuit de Render n'offre PAS de disque persistant**. Comme l'application
stocke ses données dans un fichier SQLite, ce fichier serait **effacé à chaque
redémarrage** (toutes les ~15 min d'inactivité, ou à chaque déploiement) → **perte de
données**. Pour une auto-école réelle, c'est inacceptable.

➡️ On déploie donc directement sur le **plan Starter (~7 $/mois)** avec un **disque
persistant** de 1 Go monté sur `/var/data`. Le `render.yaml` fourni est déjà configuré
ainsi.

> Le free tier reste utile uniquement pour une **démo jetable** (données non
> conservées). Si vous y tenez pour une démo, mettez `plan: free` et retirez le bloc
> `disk`, en sachant que la base repartira à zéro régulièrement.

## Étape A — Dépôt GitHub

```bash
cd "Documents/Claude/Projects/Auto-Ecole-Lambarene"
git init
git add .
git commit -m "Auto-École Lambaréné — MVP"
# Créez un repo (public ou privé) puis :
git remote add origin https://github.com/<votre-compte>/auto-ecole-lambarene.git
git branch -M main
git push -u origin main
```

## Étape B — Créer le service sur Render (Blueprint)

1. Render → **New** → **Blueprint** → connectez le repo GitHub.
2. Render lit `render.yaml` et propose le service `auto-ecole-lambarene` (Starter + disque).
3. Renseignez les variables marquées `sync: false` :
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (choisissez un mot de passe fort)
   - `PUBLIC_URL` = `https://auto-ecole-lambarene.onrender.com` (adaptez au nom réel)
   - `EBILLING_USERNAME`, `EBILLING_SHARED_KEY` (quand vous les avez de Digitech Africa)
4. `JWT_SECRET` est généré automatiquement par Render.
5. **Create** → Render build (`npm install`) puis lance (`npm start`).
   Le health check `/api/sante` doit passer au vert.

## Étape C — Paiement Mobile Money (E-Billing)

Tant que `EBILLING_USERNAME` / `EBILLING_SHARED_KEY` ne sont pas renseignés, le bouton
« Paiement Mobile Money » renvoie une erreur 503 explicite et vous utilisez le
**paiement manuel** (espèces / Mobile Money encaissé au guichet), qui fonctionne sans
aucune clé.

Quand vous obtenez les identifiants marchands **E-Billing / SHAP** (Digitech Africa) :
1. Saisissez-les dans **Environment** du service Render.
2. Déclarez l'URL de notification côté marchand : `https://<votre-domaine>/api/paiements/webhook`.
3. Vérifiez un paiement de test de bout en bout (petit montant).

## Étape D — Domaine personnalisé (optionnel)

Service Render → **Settings → Custom Domains** → ajoutez votre domaine, puis créez
l'enregistrement DNS (CNAME) indiqué par Render.

## Sauvegardes

Le disque `/var/data` est persistant, mais **pensez à sauvegarder** régulièrement le
fichier `autoecole.db` (téléchargement manuel via un shell Render, ou une tâche
planifiée d'export). Une évolution possible : export CSV/Drive automatique.

## Passage à l'échelle

- Le plan Starter suffit largement pour une auto-école (quelques centaines d'élèves).
- Si le volume grossit fortement, envisager PostgreSQL (Render Postgres) : la couche
  d'accès `src/db.js` devrait alors être adaptée (requêtes déjà en SQL standard).
