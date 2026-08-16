// routes/auth.js
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');

// POST /api/auth/login-teacher
router.post('/login-teacher', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    if (!email || !mot_de_passe)
      return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const [rows] = await db.query(
      'SELECT * FROM enseignants WHERE email = ?', [email]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

    const enseignant = rows[0];
    const valid = await bcrypt.compare(mot_de_passe, enseignant.mot_de_passe);
    if (!valid)
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

    req.session.enseignantId  = enseignant.id;
    req.session.enseignantNom = enseignant.nom;
    res.json({ success: true, nom: enseignant.nom });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/auth/login-eleve  (massar + date_naissance)
router.post('/login-eleve', async (req, res) => {
  try {
    const { massar, date_naissance } = req.body;
    if (!massar || !date_naissance)
      return res.status(400).json({ error: 'Numéro Massar et date de naissance requis.' });

    const [rows] = await db.query(
      `SELECT e.*, c.nom AS classe_nom
       FROM eleves e
       JOIN classes c ON e.classe_id = c.id
       WHERE e.massar = ? AND e.date_naissance = ?`,
      [massar.toUpperCase(), date_naissance]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Numéro Massar ou date de naissance incorrect.' });

    const eleve = rows[0];
    // Récupérer les remarques
    const [remarques] = await db.query(
      `SELECT r.texte, r.created_at
       FROM remarques r
       WHERE r.eleve_id = ?
       ORDER BY r.created_at DESC`, [eleve.id]
    );
    res.json({ success: true, eleve: { ...eleve, remarques } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// PUT /api/auth/change-password
router.put('/change-password', async (req, res) => {
  try {
    if (!req.session.enseignantId)
      return res.status(401).json({ error: 'Non authentifié.' });

    const { nouveau_mot_de_passe } = req.body;
    if (!nouveau_mot_de_passe || nouveau_mot_de_passe.length < 6)
      return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères).' });

    const hash = await bcrypt.hash(nouveau_mot_de_passe, 10);
    await db.query(
      'UPDATE enseignants SET mot_de_passe = ? WHERE id = ?',
      [hash, req.session.enseignantId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});


// GET /api/auth/session-eleve
router.get('/session-eleve', async (req, res) => {
  try {
    if (!req.session.eleveId)
      return res.status(401).json({ error: 'Non connecté.' });
    const [rows] = await db.query(
      `SELECT e.*, c.nom AS classe_nom FROM eleves e
       JOIN classes c ON e.classe_id = c.id WHERE e.id = ?`,
      [req.session.eleveId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Élève introuvable.' });
    const eleve = rows[0];
    const [remarques] = await db.query(
      `SELECT texte, created_at FROM remarques WHERE eleve_id = ? ORDER BY created_at DESC`,
      [eleve.id]
    );
    res.json({ success: true, eleve: { ...eleve, remarques } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

// GET /api/auth/acces/:token
router.get('/acces/:token', async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT e.*, c.nom AS classe_nom FROM eleves e
       JOIN classes c ON e.classe_id = c.id
       JOIN tokens_acces t ON t.eleve_id = e.id WHERE t.token = ?`,
      [req.params.token]
    );
    if (!row) return res.redirect('/eleve?erreur=lien_invalide');
    req.session.eleveId  = row.id;
    req.session.eleveNom = row.prenom + ' ' + row.nom;
    res.redirect('/eleve?connecte=1');
  } catch (err) { console.error(err); res.redirect('/eleve?erreur=serveur'); }
});

// POST /api/auth/generer-tokens
router.post('/generer-tokens', async (req, res) => {
  try {
    if (!req.session.enseignantId)
      return res.status(401).json({ error: 'Non authentifié.' });
    const crypto = require('crypto');
    const [eleves] = await db.query('SELECT id FROM eleves');
    let generes = 0;
    for (const e of eleves) {
      const token = crypto.randomBytes(32).toString('hex');
      await db.query(
        `INSERT INTO tokens_acces (eleve_id, token) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE token = token`,
        [e.id, token]
      );
      generes++;
    }
    res.json({ success: true, generes });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

// GET /api/auth/liens-eleves
router.get('/liens-eleves', async (req, res) => {
  try {
    if (!req.session.enseignantId)
      return res.status(401).json({ error: 'Non authentifié.' });
    const [rows] = await db.query(
      `SELECT e.nom, e.prenom, c.nom AS classe_nom, t.token
       FROM tokens_acces t
       JOIN eleves e ON e.id = t.eleve_id
       JOIN classes c ON c.id = e.classe_id
       ORDER BY c.nom, e.numero_classe`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

// GET /api/auth/verify  ← vérifier si la session enseignant est active
router.get('/verify', (req, res) => {
  if (req.session && req.session.enseignantId) {
    res.json({ connecte: true, nom: req.session.enseignantNom });
  } else {
    res.json({ connecte: false });
  }
});
                  
module.exports = router;