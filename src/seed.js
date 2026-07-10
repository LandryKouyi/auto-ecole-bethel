// Seed : compte admin + données de démonstration (auto-école de Lambaréné).
import { q, db } from './db.js';
import { hashPassword } from './auth.js';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@autoecole.ga').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';

export function ensureSeed() {
  // Toujours garantir un compte admin.
  const admin = q.get('SELECT id FROM users WHERE email = ?', ADMIN_EMAIL);
  if (!admin) {
    q.run('INSERT INTO users (email, password_hash, nom, role) VALUES (?,?,?,?)',
      ADMIN_EMAIL, hashPassword(ADMIN_PASSWORD), 'Administrateur', 'admin');
    console.log(`[seed] Compte admin créé : ${ADMIN_EMAIL}`);
  }

  // Ne semer les données de démo que si la base est vide (et pas en prod si SEED_DEMO=0).
  const nbEleves = q.get('SELECT COUNT(*) AS c FROM eleves').c;
  if (nbEleves > 0 || process.env.SEED_DEMO === '0') return;

  console.log('[seed] Insertion des données de démonstration...');
  const tx = db.exec.bind(db);

  // Moniteurs
  const mon = [
    ['NDONG', 'Jean', 'LIC-GA-1021', 'Moniteur agréé catégorie B', '074110022',
      JSON.stringify({ lundi: ['08:00-12:00', '14:00-17:00'], mardi: ['08:00-12:00'], mercredi: ['08:00-12:00'], jeudi: ['14:00-17:00'], vendredi: ['08:00-12:00'] })],
    ['MBADINGA', 'Sylvie', 'LIC-GA-1044', 'Monitrice agréée catégorie B', '066220033',
      JSON.stringify({ lundi: ['14:00-17:00'], mercredi: ['08:00-12:00', '14:00-17:00'], vendredi: ['14:00-17:00'], samedi: ['08:00-12:00'] })],
  ];
  const monIds = mon.map(m =>
    q.run('INSERT INTO moniteurs (nom, prenom, licence_num, certificat, telephone, disponibilites_json) VALUES (?,?,?,?,?,?)', ...m).lastInsertRowid);

  // Comptes de connexion pour les moniteurs (role moniteur)
  q.run('INSERT INTO users (email, password_hash, nom, role, moniteur_id) VALUES (?,?,?,?,?)',
    'jean.ndong@autoecole.ga', hashPassword('moniteur2026'), 'Jean NDONG', 'moniteur', monIds[0]);
  q.run('INSERT INTO users (email, password_hash, nom, role, moniteur_id) VALUES (?,?,?,?,?)',
    'sylvie.mbadinga@autoecole.ga', hashPassword('moniteur2026'), 'Sylvie MBADINGA', 'moniteur', monIds[1]);

  // Véhicules
  const veh = [
    ['LBV-4821', 'Toyota', 'Yaris', 'ok', '2026-10-15', monIds[0]],
    ['LBV-9033', 'Renault', 'Clio', 'revision_due', '2026-07-20', monIds[1]],
    ['LBV-1177', 'Peugeot', '208', 'ok', '2026-12-01', null],
  ];
  const vehIds = veh.map(v =>
    q.run('INSERT INTO vehicules (immatriculation, marque, modele, statut_maintenance, date_prochaine_revision, moniteur_id) VALUES (?,?,?,?,?,?)', ...v).lastInsertRowid);

  // Élèves
  const el = [
    ['OBAME', 'Grâce', '077001010', 'Quartier Isaac, Lambaréné', 'CNI-0455120', 'en_cours'],
    ['KOMBILA', 'Patrick', '066002020', 'Quartier Bord de Mer, Lambaréné', 'CNI-0455121', 'en_cours'],
    ['NZE', 'Aline', '074003030', 'Quartier Adouma, Lambaréné', 'CNI-0455122', 'examen_reussi'],
    ['MOUSSAVOU', 'Éric', '066004040', 'Quartier Dominique, Lambaréné', 'CNI-0455123', 'examen_echoue'],
    ['BOUANGA', 'Fabrice', '077005050', 'Quartier Château, Lambaréné', 'CNI-0455124', 'en_cours'],
  ];
  const elIds = el.map(e =>
    q.run('INSERT INTO eleves (nom, prenom, telephone, adresse, id_identite, statut) VALUES (?,?,?,?,?,?)', ...e).lastInsertRowid);

  // Leçons (quelques passées + à venir)
  const auj = new Date();
  const jour = (delta, h) => {
    const d = new Date(auj); d.setDate(d.getDate() + delta);
    return `${d.toISOString().slice(0, 10)} ${h}`;
  };
  const lecons = [
    [elIds[0], monIds[0], vehIds[0], jour(-3, '09:00'), 60, 'conduite_circulation', 'present', 'Bon contrôle du véhicule, à travailler : créneaux.', 14, 'effectuee'],
    [elIds[1], monIds[1], vehIds[1], jour(-2, '10:00'), 60, 'theorie', 'present', 'Code : révision des panneaux.', 16, 'effectuee'],
    [elIds[0], monIds[0], vehIds[0], jour(0, '09:00'), 60, 'conduite_route', '', '', null, 'prevue'],
    [elIds[4], monIds[1], vehIds[2], jour(0, '11:00'), 60, 'conduite_circulation', '', '', null, 'prevue'],
    [elIds[1], monIds[0], vehIds[0], jour(1, '14:00'), 60, 'conduite_autoroute', '', '', null, 'prevue'],
  ];
  for (const l of lecons)
    q.run(`INSERT INTO lecons (eleve_id, moniteur_id, vehicule_id, date_heure, duree_min, type_lecon, presence, observations, note_perf, status)
           VALUES (?,?,?,?,?,?,?,?,?,?)`, ...l);

  // Paiements
  const paie = [
    [elIds[0], 50000, 'inscription', "Frais d'inscription", 'especes', 'paye'],
    [elIds[0], 10000, 'lecon', 'Forfait 2 leçons', 'airtel', 'paye'],
    [elIds[1], 50000, 'inscription', "Frais d'inscription", 'moov', 'paye'],
    [elIds[2], 50000, 'inscription', "Frais d'inscription", 'especes', 'paye'],
    [elIds[2], 25000, 'examen', 'Frais examen permis', 'especes', 'paye'],
    [elIds[3], 50000, 'inscription', "Frais d'inscription", 'especes', 'paye'],
    [elIds[4], 25000, 'inscription', "Acompte inscription", 'especes', 'paye'],
    [elIds[4], 25000, 'inscription', "Solde inscription", 'especes', 'en_attente'],
  ];
  for (const p of paie)
    q.run('INSERT INTO paiements (eleve_id, montant, type, libelle, moyen, statut) VALUES (?,?,?,?,?,?)', ...p);

  // Examens
  const ex = [
    [elIds[2], monIds[0], 'code', jour(-20, '08:00'), 'reussi', 'Bon score au code.'],
    [elIds[2], monIds[0], 'permis_conduire', jour(-10, '08:00'), 'reussi', 'Conduite maîtrisée.'],
    [elIds[3], monIds[1], 'code', jour(-15, '08:00'), 'reussi', ''],
    [elIds[3], monIds[1], 'permis_conduire', jour(-5, '08:00'), 'echoue', 'À retravailler : priorités.'],
    [elIds[0], monIds[0], 'code', jour(7, '08:00'), 'en_attente', 'Inscrit à la session.'],
  ];
  for (const x of ex)
    q.run('INSERT INTO examens (eleve_id, moniteur_id, type_examen, date_examen, resultat, observations) VALUES (?,?,?,?,?,?)', ...x);

  console.log('[seed] Données de démonstration insérées.');
}

// Exécution directe : `npm run seed`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.js')) {
  ensureSeed();
  console.log('[seed] Terminé.');
}
