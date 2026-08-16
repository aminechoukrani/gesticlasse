// routes/classes.js
const router = require('express').Router();
const db     = require('../config/db');
const { requireTeacher } = require('../middleware/auth');

// GET /api/classes
router.get('/', requireTeacher, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, COUNT(e.id) AS nb_eleves,
              ROUND(AVG(e.points), 2) AS moyenne
       FROM classes c
       LEFT JOIN eleves e ON e.classe_id = c.id
       GROUP BY c.id ORDER BY c.nom`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

// POST /api/classes
router.post('/', requireTeacher, async (req, res) => {
  try {
    const { nom, niveau } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom requis.' });
    const [r] = await db.query('INSERT INTO classes (nom, niveau) VALUES (?, ?)', [nom, niveau || null]);
    res.json({ success: true, id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Cette classe existe déjà.' });
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/classes/:id
router.delete('/:id', requireTeacher, async (req, res) => {
  try {
    await db.query('DELETE FROM classes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

module.exports = router;
