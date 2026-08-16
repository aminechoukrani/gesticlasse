// routes/photos.js
const router = require('express').Router();
const db     = require('../config/db');
const { requireTeacher } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────
// POST /api/photos/submit
// Élève soumet une nouvelle photo (en attente de validation)
// ─────────────────────────────────────────────────────────
router.post('/submit', async (req, res) => {
  try {
    const { eleve_id, photo_data } = req.body;

    if (!eleve_id || !photo_data)
      return res.status(400).json({ error: 'eleve_id et photo_data requis.' });

    // Vérifier que l'élève existe
    const [[eleve]] = await db.query(
      'SELECT id FROM eleves WHERE id = ?', [eleve_id]
    );
    if (!eleve)
      return res.status(404).json({ error: 'Élève introuvable.' });

    // Limite 2 Mo (base64 ~ 1.37x la taille originale)
    if (photo_data.length > 2 * 1024 * 1024 * 1.37)
      return res.status(400).json({ error: 'Image trop grande (max 2 Mo).' });

    // Supprimer l'ancienne demande en attente si elle existe
    await db.query(
      'DELETE FROM photos_pending WHERE eleve_id = ?', [eleve_id]
    );

    // Insérer la nouvelle demande
    await db.query(
      'INSERT INTO photos_pending (eleve_id, photo_data) VALUES (?, ?)',
      [eleve_id, photo_data]
    );

    console.log(`📷 Photo reçue — eleve_id: ${eleve_id}, taille: ${photo_data.length} caractères`);
    res.json({ success: true, message: 'Photo envoyée, en attente de validation.' });

  } catch (err) {
    console.error('Erreur photos/submit:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/photos/pending
// Admin : récupérer toutes les photos en attente
// ─────────────────────────────────────────────────────────
router.get('/pending', requireTeacher, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT pp.id, pp.eleve_id, pp.photo_data, pp.submitted_at,
              e.nom, e.prenom, e.photo AS photo_actuelle,
              c.nom AS classe_nom
       FROM photos_pending pp
       JOIN eleves e  ON e.id  = pp.eleve_id
       JOIN classes c ON c.id  = e.classe_id
       ORDER BY pp.submitted_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur photos/pending:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/photos/:id/approve
// Admin : valider une photo → copier vers eleves.photo
// ─────────────────────────────────────────────────────────
router.post('/:id/approve', requireTeacher, async (req, res) => {
  try {
    const [[photo]] = await db.query(
      'SELECT * FROM photos_pending WHERE id = ?', [req.params.id]
    );
    if (!photo)
      return res.status(404).json({ error: 'Photo introuvable.' });

    // Copier la photo vers le profil de l'élève
    await db.query(
      'UPDATE eleves SET photo = ? WHERE id = ?',
      [photo.photo_data, photo.eleve_id]
    );

    // Supprimer de la file d'attente
    await db.query(
      'DELETE FROM photos_pending WHERE id = ?', [req.params.id]
    );

    console.log(`✅ Photo validée — eleve_id: ${photo.eleve_id}`);
    res.json({ success: true });

  } catch (err) {
    console.error('Erreur photos/approve:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/photos/:id/reject
// Admin : refuser une photo → supprimer de la file
// ─────────────────────────────────────────────────────────
router.post('/:id/reject', requireTeacher, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM photos_pending WHERE id = ?', [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur photos/reject:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/photos/admin/:eleve_id
// Admin : modifier directement la photo d'un élève
// sans passer par la validation
// ─────────────────────────────────────────────────────────
router.post('/admin/:eleve_id', requireTeacher, async (req, res) => {
  try {
    const { photo_data } = req.body;
    const { eleve_id }   = req.params;

    if (!photo_data)
      return res.status(400).json({ error: 'photo_data requis.' });

    const [[eleve]] = await db.query(
      'SELECT id FROM eleves WHERE id = ?', [eleve_id]
    );
    if (!eleve)
      return res.status(404).json({ error: 'Élève introuvable.' });

    await db.query(
      'UPDATE eleves SET photo = ? WHERE id = ?',
      [photo_data, eleve_id]
    );

    // Supprimer aussi toute demande en attente pour cet élève
    await db.query(
      'DELETE FROM photos_pending WHERE eleve_id = ?', [eleve_id]
    );

    console.log(`🖼️ Photo modifiée par admin — eleve_id: ${eleve_id}`);
    res.json({ success: true });

  } catch (err) {
    console.error('Erreur photos/admin:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/photos/admin/:eleve_id
// Admin : supprimer la photo d'un élève
// ─────────────────────────────────────────────────────────
router.delete('/admin/:eleve_id', requireTeacher, async (req, res) => {
  try {
    await db.query(
      'UPDATE eleves SET photo = NULL WHERE id = ?', [req.params.eleve_id]
    );
    await db.query(
      'DELETE FROM photos_pending WHERE eleve_id = ?', [req.params.eleve_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur photos/delete:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;