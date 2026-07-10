# Guide administrateur — Auto-École Béthel

Ce guide s'adresse au **gestionnaire** de l'auto-école (rôle `admin`).

## 1. Connexion

Ouvrez l'application, saisissez votre email et votre mot de passe.
Compte par défaut : `admin@autoecole.ga` / `admin2026` (**à changer**).

## 2. Tableau de bord

À l'ouverture, vous voyez :
- **Chiffre d'affaires du mois** (paiements encaissés du mois en cours)
- **Élèves actifs** / total
- **Leçons à venir**
- **Taux de réussite** aux examens
- **Revenus des 6 derniers mois** (graphique)
- **Alertes maintenance** des véhicules + **paiements en attente**
- **Leçons du jour** et **réussite par moniteur**

## 3. Élèves

- **+ Nouvel élève** : nom, prénom, téléphone (format WhatsApp, ex. `077…`), adresse,
  n° d'identité (CNI), statut.
- **Dossier** : historique complet (leçons, paiements, examens), total payé, et un
  bouton **💬 WhatsApp** qui ouvre une conversation pré-remplie avec l'élève.
- **Modifier** : met à jour les informations et le statut
  (*en cours*, *examen réussi*, *examen échoué*, *suspendu*).

## 4. Moniteurs

- Créez chaque moniteur avec son **n° de licence** et son **certificat**.
- Renseignez les **disponibilités** au format JSON, par exemple :
  ```json
  {"lundi":["08:00-12:00","14:00-17:00"],"mercredi":["08:00-12:00"]}
  ```
- La liste affiche le **nombre de leçons** données et la **note moyenne** reçue.

> Pour qu'un moniteur puisse se connecter, un compte utilisateur lié doit exister
> (rôle `moniteur`, champ `moniteur_id`). Les deux moniteurs de démonstration en ont un.

## 5. Véhicules

- Immatriculation, marque, modèle.
- **État de maintenance** : OK, révision due, contrôle technique dû, hors service.
  Les états ≠ OK apparaissent dans les **alertes** du tableau de bord.
- **Prochaine révision** (date) et **moniteur affecté**.

## 6. Leçons

- **+ Réserver une leçon** : élève, moniteur, véhicule, date/heure, type.
- Le système **refuse automatiquement** un créneau déjà pris par le même moniteur
  ou le même véhicule (évite les doubles réservations).
- **Suivi** : après la leçon, notez la **présence**, une **note /20** et les
  **observations** du moniteur, puis passez le statut à *Effectuée*.

## 7. Paiements

- **+ Paiement manuel** : pour les règlements en **espèces** ou Mobile Money encaissés
  au guichet. Enregistré immédiatement comme *payé*.
- **💳 Paiement Mobile Money** : lance un paiement **E-Billing** ; une demande **USSD**
  est poussée sur le téléphone de l'élève (Airtel/Moov), il valide avec son code.
  Le paiement passe *en attente* puis *payé* une fois confirmé (bouton **Vérifier**).
- **Reçu** : ouvre un reçu imprimable (bouton *Imprimer*).
- Types : inscription, leçon, examen, pack.

## 8. Examens

- **+ Nouvel examen** : élève, moniteur, type (**code** ou **permis**), date, résultat.
- Dès qu'un résultat est *réussi* ou *échoué*, le **statut de l'élève** est mis à jour.
- **💬 Notifier** : ouvre WhatsApp avec un message de résultat pré-rempli.
- Les statistiques par moniteur alimentent le tableau de bord.

## 9. Sécurité

- Changez le mot de passe admin par défaut (variable `ADMIN_PASSWORD`).
- Seul l'admin peut supprimer des élèves et gérer moniteurs/véhicules.
- Les moniteurs ont un accès restreint (voir `GUIDE_MONITEUR.md`).
