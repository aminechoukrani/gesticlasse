// routes/cahier.js
const router = require('express').Router();
const db     = require('../config/db');
const { requireTeacher } = require('../middleware/auth');

// GET /api/cahier/:eleve_id — historique des vérifications
router.get('/:eleve_id', requireTeacher, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM cahiers
       WHERE eleve_id = ?
       ORDER BY date_verification DESC
       LIMIT 30`,
      [req.params.eleve_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur cahier GET:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/cahier/:eleve_id — enregistrer une vérification
router.post('/:eleve_id', requireTeacher, async (req, res) => {
  try {
    const { date_verification, exercices, pages_completes, proprete, delta_points } = req.body;
    const eleve_id = req.params.eleve_id;

    if (!date_verification || !exercices || !proprete)
      return res.status(400).json({ error: 'Données manquantes.' });

    // Vérifier que l'élève existe
    const [[eleve]] = await db.query(
      'SELECT id, points FROM eleves WHERE id = ?', [eleve_id]
    );
    if (!eleve)
      return res.status(404).json({ error: 'Élève introuvable.' });

    // Enregistrer la vérification
    await db.query(
      `INSERT INTO cahiers
         (eleve_id, enseignant_id, date_verification,
          exercices, pages_completes, proprete, delta_points)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        eleve_id,
        req.session.enseignantId,
        date_verification,
        exercices,
        parseInt(pages_completes) || 0,
        proprete,
        parseFloat(delta_points) || 0
      ]
    );

    // Appliquer l'impact sur les points si non nul
    const delta = parseFloat(delta_points) || 0;
    if (delta !== 0) {
      const ancienne = parseFloat(eleve.points);
      const nouvelle = Math.max(0, Math.min(20, ancienne + delta));

      await db.query(
        'UPDATE eleves SET points = ? WHERE id = ?',
        [nouvelle, eleve_id]
      );

      // Enregistrer dans l'historique des points
      await db.query(
        `INSERT INTO historique_points
           (eleve_id, enseignant_id, ancienne_note, nouvelle_note, delta, motif)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          eleve_id,
          req.session.enseignantId,
          ancienne,
          nouvelle,
          delta,
          `Cahier — Exercices: ${exercices}, Présentation: ${proprete}`
        ]
      );
    }

    res.json({ success: true, delta_points: delta });
  } catch (err) {
    console.error('Erreur cahier POST:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;