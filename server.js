// server.js — Point d'entrée GestiClasse
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ═══════════════════════════════════════════════════════════
// 1. MIDDLEWARES DE BASE
// ═══════════════════════════════════════════════════════════

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({ origin: true, credentials: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'gesticlasse-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,  // 8 heures
  }
}));

// ═══════════════════════════════════════════════════════════
// 2. FICHIERS STATIQUES (CSS, JS, images uniquement)
// ═══════════════════════════════════════════════════════════
// Le dossier public/ ne contient PAS de fichiers HTML
// Seulement des ressources statiques (images, polices, etc.)
app.use('/static', express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════
// 3. ROUTES API
// ═══════════════════════════════════════════════════════════

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/eleves',        require('./routes/eleves'));
app.use('/api/classes',       require('./routes/classes'));
app.use('/api/photos',        require('./routes/photos'));
app.use('/api/modifications', require('./routes/modifications'));
app.use('/api/cahier',        require('./routes/cahier'));

// ═══════════════════════════════════════════════════════════
// 4. ROUTES DES PAGES HTML
// ═══════════════════════════════════════════════════════════
// Les fichiers HTML sont dans views/ — jamais servis en statique
// Chaque route renvoie explicitement le bon fichier

// ── Route connexion via token élève ──────────────────────
app.get('/acces/:token', async (req, res) => {
  // Déléguer à la route API qui gère la session puis redirige
  const db = require('./config/db');
  try {
    const [[row]] = await db.query(
      `SELECT e.id, e.prenom, e.nom
       FROM eleves e
       JOIN tokens_acces t ON t.eleve_id = e.id
       WHERE t.token = ?`,
      [req.params.token]
    );
    if (!row) return res.redirect('/eleve?erreur=lien_invalide');
    req.session.eleveId  = row.id;
    req.session.eleveNom = row.prenom + ' ' + row.nom;
    res.redirect('/eleve?connecte=1');
  } catch (err) {
    console.error(err);
    res.redirect('/eleve?erreur=serveur');
  }
});

// ── Page élève : /eleve ───────────────────────────────────
app.get('/eleve', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'eleve.html'));
});

// ── Page enseignant : / ───────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ── Fallback ──────────────────────────────────────────────
// Toute URL inconnue → page enseignant
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ═══════════════════════════════════════════════════════════
// 5. DÉMARRAGE
// ═══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       GestiClasse — Serveur démarré      ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Enseignant : http://localhost:${PORT}       ║`);
  console.log(`║  Élèves     : http://localhost:${PORT}/eleve ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Réseau local :                          ║');
  console.log('║  Trouvez votre IP avec "ipconfig"        ║');
  console.log('║  puis remplacez localhost par votre IP   ║');
  console.log('╚══════════════════════════════════════════╝\n');
});