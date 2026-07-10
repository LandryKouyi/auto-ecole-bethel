// Couche d'accès à la base de données (node:sqlite, aucune dépendance native).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/autoecole.db';

// S'assurer que le dossier de la base existe (utile sur disque Render /var/data).
try {
  mkdirSync(dirname(DB_PATH), { recursive: true });
} catch { /* déjà présent */ }

export const db = new DatabaseSync(DB_PATH);

// Réglages robustesse/perf pour un petit service.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// Schéma. Créé une seule fois (IF NOT EXISTS) — sert aussi de "migration 001".
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nom           TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'moniteur',   -- 'admin' | 'moniteur'
  moniteur_id   INTEGER,                             -- lien optionnel vers moniteurs.id
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eleves (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nom              TEXT NOT NULL,
  prenom           TEXT NOT NULL,
  telephone        TEXT NOT NULL DEFAULT '',          -- format international pour WhatsApp, ex 24177000000
  adresse          TEXT NOT NULL DEFAULT '',
  id_identite      TEXT NOT NULL DEFAULT '',          -- numéro CNI / passeport
  date_inscription TEXT NOT NULL DEFAULT (date('now')),
  statut           TEXT NOT NULL DEFAULT 'en_cours',  -- en_cours | examen_reussi | examen_echoue | suspendu
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS moniteurs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nom                TEXT NOT NULL,
  prenom             TEXT NOT NULL,
  licence_num        TEXT NOT NULL DEFAULT '',
  certificat         TEXT NOT NULL DEFAULT '',        -- intitulé / référence du certificat
  telephone          TEXT NOT NULL DEFAULT '',
  disponibilites_json TEXT NOT NULL DEFAULT '{}',      -- ex {"lundi":["08:00-12:00"], ...}
  actif              INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicules (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  immatriculation    TEXT UNIQUE NOT NULL,
  marque             TEXT NOT NULL DEFAULT '',
  modele             TEXT NOT NULL DEFAULT '',
  statut_maintenance TEXT NOT NULL DEFAULT 'ok',       -- ok | revision_due | controle_technique_du | hors_service
  date_prochaine_revision TEXT,
  moniteur_id        INTEGER REFERENCES moniteurs(id) ON DELETE SET NULL,  -- affectation
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lecons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id     INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  moniteur_id  INTEGER REFERENCES moniteurs(id) ON DELETE SET NULL,
  vehicule_id  INTEGER REFERENCES vehicules(id) ON DELETE SET NULL,
  date_heure   TEXT NOT NULL,                          -- ISO 'YYYY-MM-DD HH:MM'
  duree_min    INTEGER NOT NULL DEFAULT 60,
  type_lecon   TEXT NOT NULL DEFAULT 'conduite',       -- theorie | conduite_circulation | conduite_route | conduite_autoroute
  presence     TEXT NOT NULL DEFAULT 'prevue',         -- prevue | present | absent
  observations TEXT NOT NULL DEFAULT '',
  note_perf    INTEGER,                                -- 0-20 optionnel
  status       TEXT NOT NULL DEFAULT 'prevue',         -- prevue | effectuee | annulee
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paiements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id       INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  montant        INTEGER NOT NULL,                     -- en FCFA (entier)
  type           TEXT NOT NULL DEFAULT 'lecon',        -- inscription | lecon | examen | pack
  libelle        TEXT NOT NULL DEFAULT '',
  moyen          TEXT NOT NULL DEFAULT 'especes',      -- especes | airtel | moov | cinetpay
  statut         TEXT NOT NULL DEFAULT 'en_attente',   -- en_attente | paye | echoue | annule
  reference      TEXT NOT NULL DEFAULT '',             -- transaction_id CinetPay
  date_paiement  TEXT NOT NULL DEFAULT (datetime('now')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS examens (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id     INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  moniteur_id  INTEGER REFERENCES moniteurs(id) ON DELETE SET NULL,
  type_examen  TEXT NOT NULL DEFAULT 'code',           -- code | permis_conduire
  date_examen  TEXT NOT NULL,
  resultat     TEXT NOT NULL DEFAULT 'en_attente',     -- en_attente | reussi | echoue
  observations TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lecons_eleve   ON lecons(eleve_id);
CREATE INDEX IF NOT EXISTS idx_lecons_moniteur ON lecons(moniteur_id);
CREATE INDEX IF NOT EXISTS idx_lecons_date    ON lecons(date_heure);
CREATE INDEX IF NOT EXISTS idx_paiements_eleve ON paiements(eleve_id);
CREATE INDEX IF NOT EXISTS idx_examens_eleve  ON examens(eleve_id);
`);

// Helpers pratiques.
export const q = {
  all: (sql, ...p) => db.prepare(sql).all(...p),
  get: (sql, ...p) => db.prepare(sql).get(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
};

export default db;
