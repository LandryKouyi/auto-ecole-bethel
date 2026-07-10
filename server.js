// Auto-École Béthel — serveur Express + node:sqlite.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import './src/db.js';                    // initialise la base (schéma)
import { ensureSeed } from './src/seed.js';

import authRoutes from './src/routes/auth.js';
import elevesRoutes from './src/routes/eleves.js';
import moniteursRoutes from './src/routes/moniteurs.js';
import vehiculesRoutes from './src/routes/vehicules.js';
import leconsRoutes from './src/routes/lecons.js';
import paiementsRoutes from './src/routes/paiements.js';
import examensRoutes from './src/routes/examens.js';
import dashboardRoutes from './src/routes/dashboard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// En-têtes de sécurité minimalistes (pas de dépendance helmet).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Santé (pour le health check Render).
app.get('/api/sante', (req, res) => res.json({ ok: true, service: 'auto-ecole', ts: Date.now() }));

// API
app.use('/api/auth', authRoutes);
app.use('/api/eleves', elevesRoutes);
app.use('/api/moniteurs', moniteursRoutes);
app.use('/api/vehicules', vehiculesRoutes);
app.use('/api/lecons', leconsRoutes);
app.use('/api/paiements', paiementsRoutes);
app.use('/api/examens', examensRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Frontend statique
app.use(express.static(join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

// Gestion d'erreurs JSON
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = process.env.PORT || 3000;
ensureSeed(); // crée l'admin + jeu de démo si base vide
app.listen(PORT, () => console.log(`Auto-École Béthel en écoute sur http://localhost:${PORT}`));
