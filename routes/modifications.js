// routes/modifications.js
const router = require('express').Router();
const db     = require('../config/db');
const { requireTeacher } = require('../middleware/auth');

// Seul champ modifiable par l'élève
const CHAMPS_ELEVE = ['classe_id'];

// ─────────────────────────────────────────────────────────
// POST /api/modifications/submit
// Élève soumet une demande de modification
// ─────────────────────────────────────────────────────────
router.post('/submit', async (req, res) => {
  try {
    const { eleve_id, champ, nouvelle_val } = req.body;

    if (!eleve_id || !champ || !nouvelle_val)
      return res.status(400).json({ error: 'Données manquantes.' });

    if (!CHAMPS_ELEVE.includes(champ))
      return res.status(403).json({ error: 'Modification non autorisée.' });

    // Récupérer l'élève avec sa classe actuelle
    const [[eleve]] = await db.query(
      `SELECT e.*, c.nom AS classe_nom
       FROM eleves e
       JOIN classes c ON e.classe_id = c.id
       WHERE e.id = ?`,
      [eleve_id]
    );
    if (!eleve)
      return res.status(404).json({ error: 'Élève introuvable.' });

    // Vérifier qu'une demande n'est pas déjà en attente pour ce champ
    const [[existing]] = await db.query(
      `SELECT id FROM modifications_pending
       WHERE eleve_id = ? AND champ = ? AND statut = 'en_attente'`,
      [eleve_id, champ]
    );
    if (existing)
      return res.status(400).json({
        error: 'Une demande est déjà en attente pour ce champ.'
      });

    // Pour classe_id : stocker le NOM lisible de la classe
    const ancienne_val = champ === 'classe_id'
      ? eleve.classe_nom
      : eleve[champ];

    await db.query(
      `INSERT INTO modifications_pending (eleve_id, champ, ancienne_val, nouvelle_val)
       VALUES (?, ?, ?, ?)`,
      [eleve_id, champ, ancienne_val, nouvelle_val]
    );

    res.json({ success: true, message: 'Demande envoyée, en attente de validation.' });

  } catch (err) {
    console.error('Erreur modifications/submit:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/modifications/pending
// Admin : récupérer toutes les demandes en attente
// ─────────────────────────────────────────────────────────
router.get('/pending', requireTeacher, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT mp.id, mp.eleve_id, mp.champ, mp.ancienne_val,
              mp.nouvelle_val, mp.statut, mp.submitted_at,
              e.nom, e.prenom, c.nom AS classe_nom
       FROM modifications_pending mp
       JOIN eleves e  ON e.id  = mp.eleve_id
       JOIN classes c ON c.id  = e.classe_id
       WHERE mp.statut = 'en_attente'
       ORDER BY mp.submitted_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur modifications/pending:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/modifications/:id/approve
// Admin : valider une demande
// ─────────────────────────────────────────────────────────
router.post('/:id/approve', requireTeacher, async (req, res) => {
  try {
    const [[mod]] = await db.query(
      'SELECT * FROM modifications_pending WHERE id = ?', [req.params.id]
    );
    if (!mod)
      return res.status(404).json({ error: 'Demande introuvable.' });

    let valeur = mod.nouvelle_val;

    // Pour classe_id : résoudre le nom → id
    if (mod.champ === 'classe_id') {
      const [[cls]] = await db.query(
        'SELECT id FROM classes WHERE nom = ?', [mod.nouvelle_val]
      );
      if (!cls) {
        // Créer la classe si elle n'existe pas
        const [r] = await db.query(
          'INSERT INTO classes (nom) VALUES (?)', [mod.nouvelle_val]
        );
        valeur = r.insertId;
      } else {
        valeur = cls.id;
      }
    }

    // Appliquer la modification
    await db.query(
      `UPDATE eleves SET ${mod.champ} = ? WHERE id = ?`,
      [valeur, mod.eleve_id]
    );

    // Marquer comme approuvé
    await db.query(
      `UPDATE modifications_pending SET statut = 'approuve' WHERE id = ?`,
      [req.params.id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error('Erreur modifications/approve:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/modifications/:id/reject
// Admin : refuser une demande
// ─────────────────────────────────────────────────────────
router.post('/:id/reject', requireTeacher, async (req, res) => {
  try {
    await db.query(
      `UPDATE modifications_pending SET statut = 'refuse' WHERE id = ?`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur modifications/reject:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/modifications/admin/:eleve_id
// Admin : modifier directement tous les champs d'un élève
// ─────────────────────────────────────────────────────────
router.put('/admin/:eleve_id', requireTeacher, async (req, res) => {
  try {
    const { nom, prenom, classe_id, numero_classe, massar, date_naissance } = req.body;
    const { eleve_id } = req.params;

    const [[eleve]] = await db.query(
      'SELECT id FROM eleves WHERE id = ?', [eleve_id]
    );
    if (!eleve)
      return res.status(404).json({ error: 'Élève introuvable.' });

    await db.query(
      `UPDATE eleves
       SET nom = ?, prenom = ?, classe_id = ?,
           numero_classe = ?, massar = ?, date_naissance = ?
       WHERE id = ?`,
      [nom, prenom, classe_id, numero_classe, massar, date_naissance, eleve_id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error('Erreur modifications/admin:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;