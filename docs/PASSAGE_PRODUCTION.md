# ✅ Checklist — Passage en production (Auto-École Béthel)

À suivre **le jour où l'application est ouverte au vrai public** (élèves, personnel).
Tant qu'on développe/démontre, on peut ignorer cette liste.

L'ordre est important. Coche au fur et à mesure.

---

## 1. Couper l'accès développement 🔧

Pendant le développement, un bouton **« 🔧 Gestion (dev) »** sur la page d'accueil
ouvre le tableau de bord **sans mot de passe**. Il faut le neutraliser.

- [ ] Sur Render → service `auto-ecole-bethel` → **Environment** : **supprimer** la
      variable `DEV_ACCESS` (ou la mettre à `0`).
- [ ] Redéployer, puis vérifier : sur la page d'accueil, le bouton « 🔧 Gestion (dev) »
      **ne doit plus apparaître**, et `…/app?dev=1` doit afficher l'écran de connexion
      normal (pas de connexion automatique).

> ℹ️ Aucune modification de code n'est nécessaire : tout est piloté par cette seule
> variable. L'endpoint `/api/config` renvoie alors `{"devAccess": false}`.

## 2. Sécuriser le compte administrateur 🔑

- [ ] Se connecter, aller dans **⚙️ Mon compte → Changer mon mot de passe**, et
      remplacer `admin2026` par un mot de passe fort (≥ 10 caractères, unique).
- [ ] Sur Render, mettre à jour `ADMIN_PASSWORD` avec ce même mot de passe (au cas où
      la base serait recréée) et vérifier que `JWT_SECRET` est bien une longue chaîne
      aléatoire (pas la valeur par défaut).

## 3. Retirer les identifiants de démo affichés 👀

- [ ] Dans `public/index.html`, supprimer le bloc « Démo — admin@… / admin2026 … »
      sous le formulaire de connexion (il donne le mot de passe à tout visiteur).
- [ ] Supprimer/changer les comptes moniteurs de démonstration (`jean.ndong@…`,
      `sylvie.mbadinga@…`) depuis **👤 Utilisateurs**, ou réinitialiser leurs mots de passe.

## 4. Créer les vrais comptes 👥

- [ ] Dans **👤 Utilisateurs**, créer un compte pour chaque personne réelle
      (admin/secrétaire, moniteurs) et **lier** chaque moniteur à sa fiche.
- [ ] Désactiver (plutôt que supprimer) les comptes qui ne servent plus.

## 5. Données réelles qui durent 💾 (optionnel mais recommandé)

Sur le **plan gratuit Render**, la base est **effacée à chaque redémarrage** : c'est bon
pour une démo, pas pour de vraies données.

- [ ] Pour conserver les données : passer en **plan Starter + disque persistant**
      (voir [`MIGRATION_RENDER_PAYANT.md`](MIGRATION_RENDER_PAYANT.md)) et pointer
      `DB_PATH` vers `/var/data/autoecole.db`.
- [ ] Empêcher la réinsertion des données de démo : variable `SEED_DEMO=0`.

## 6. Coordonnées & paiement 📞

- [ ] Remplacer le numéro WhatsApp de la vitrine (`public/accueil.html`,
      `WHATSAPP_NUMERO = '24100000000'`) par le vrai numéro de l'école.
- [ ] Confirmer les tarifs indicatifs de la page d'accueil.
- [ ] Pour l'encaissement Mobile Money en ligne : renseigner les clés
      `EBILLING_USERNAME` / `EBILLING_SHARED_KEY` (Digitech Africa). Sans elles, seul
      le paiement manuel au guichet fonctionne (ce qui est déjà suffisant au démarrage).

## 7. Vérifications finales 🧪

- [ ] Le bouton dev a bien disparu de l'accueil.
- [ ] Connexion admin OK avec le nouveau mot de passe ; l'ancien ne marche plus.
- [ ] Un compte désactivé ne peut plus se connecter.
- [ ] Un moniteur ne voit que ses propres élèves/leçons.
- [ ] Le journal (🕵️) enregistre bien les actions sensibles.

---

**Rappel** : ces étapes ne changent presque aucun code — surtout des variables
d'environnement et quelques clics dans l'app. Le plus important est le **point 1**
(couper l'accès dev) et le **point 2** (mot de passe fort).
