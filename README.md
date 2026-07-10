# 🚗 Auto-École Béthel — Application de gestion

Application web de gestion complète pour l'**Auto-École Béthel** à Lambaréné (Gabon) :
élèves, moniteurs, véhicules, leçons, paiements et examens, avec tableau de bord.

## Stack

- **Backend** : Node.js + Express (ESM)
- **Base de données** : `node:sqlite` (intégré à Node ≥ 22.5, aucune dépendance native)
- **Frontend** : HTML rendu côté serveur + Tailwind CSS (CDN) + JavaScript natif (aucune étape de build)
- **Authentification** : JWT HS256 (fait main, `node:crypto`) + mots de passe scrypt
- **Paiements** : **E-Billing / SHAP** (Digitech Africa) — Mobile Money Gabon (Airtel Money, Moov Money)
- **Hébergement** : Render.com (plan Starter + disque persistant)

> ℹ️ **Pourquoi pas CinetPay ?** CinetPay ne couvre pas le Gabon. Le rail de paiement
> réel utilisé ici est **E-Billing / SHAP**, comme pour les autres services de l'auteur.

## Démarrage local

```bash
npm install
cp .env.example .env      # puis éditer .env
npm start                 # http://localhost:3000
```

Au premier démarrage, la base est créée, un compte admin est généré et un jeu de
données de démonstration (auto-école de Lambaréné) est inséré.

**Comptes de démo :**
| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@autoecole.ga` | `admin2026` |
| Moniteur | `jean.ndong@autoecole.ga` | `moniteur2026` |
| Moniteur | `sylvie.mbadinga@autoecole.ga` | `moniteur2026` |

> ⚠️ Changez `ADMIN_PASSWORD` en production (variable d'environnement).

## Fonctionnalités

- **Élèves** : inscription (identité, téléphone WhatsApp, adresse), dossier complet
  (historique leçons / paiements / examens), statut, lien WhatsApp de rappel.
- **Moniteurs** : licence, certificat, disponibilités, historique, note moyenne reçue.
- **Véhicules** : immatriculation, état de maintenance, prochaine révision, affectation moniteur.
- **Leçons** : réservation (élève / moniteur / véhicule / créneau), types (théorie,
  circulation, route, autoroute), **détection automatique des conflits de créneau**,
  présence, observations, note de performance.
- **Paiements** : enregistrement manuel (espèces / Mobile Money au guichet) **et** en
  ligne via E-Billing (push USSD), reçus imprimables, relances WhatsApp, statuts.
- **Examens** : code / permis, résultats, notification WhatsApp, statistiques par moniteur.
- **Tableau de bord** : CA du mois, élèves actifs, leçons à venir, taux de réussite,
  revenus (6 mois), alertes maintenance, réussite par moniteur.
- **Rôles** : `admin` (tout) et `moniteur` (son planning, ses élèves, ses examens).

## Structure

```
server.js              Point d'entrée Express
src/db.js              Schéma + accès node:sqlite
src/auth.js            JWT + scrypt
src/middleware.js      requireAuth / requireRole
src/ebilling.js        Paiement Mobile Money (E-Billing / SHAP)
src/whatsapp.js        Liens wa.me pré-remplis
src/seed.js            Admin + données de démo
src/routes/*.js        API REST (auth, eleves, moniteurs, vehicules, lecons, paiements, examens, dashboard)
public/index.html      Application (shell)
public/app.js          Logique frontend (SPA vanilla)
docs/                  Guides admin/moniteur + migration
```

## API (résumé)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/login` | public |
| CRUD | `/api/eleves` | auth (suppr. admin) |
| CRUD | `/api/moniteurs` | admin (lecture auth) |
| CRUD | `/api/vehicules` | admin (lecture auth) |
| CRUD | `/api/lecons` | auth (moniteur = ses leçons) |
| GET/POST | `/api/paiements` | auth |
| POST | `/api/paiements/ebilling/init` | auth |
| POST | `/api/paiements/webhook` | public (E-Billing) |
| CRUD | `/api/examens` | auth |
| GET | `/api/dashboard` | auth |

## Déploiement Render

Voir [`docs/MIGRATION_RENDER_PAYANT.md`](docs/MIGRATION_RENDER_PAYANT.md).
Le fichier `render.yaml` est un Blueprint prêt à l'emploi (plan Starter + disque `/var/data`).

## Évolutions prévues

- Envoi automatique SMS/WhatsApp (API Cloud) au lieu des liens manuels
- Reçus et bulletins en PDF serveur
- Rapports mensuels exportables (Excel/PDF)
- Application installable (PWA)
