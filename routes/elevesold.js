// routes/eleves.js
const router  = require('express').Router();
const db      = require('../config/db');
const multer  = require('multer');
const { parse } = require('csv-parse/sync');
const { requireTeacher } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/eleves?classe_id=&search=
router.get('/', requireTeacher, async (req, res) => {
  try {
    const { classe_id, search } = req.query;
    let sql = `
      SELECT e.id, e.nom, e.prenom, e.massar, e.date_naissance,
             e.numero_classe, e.points, e.photo, c.nom AS classe_nom, c.id AS classe_id
      FROM eleves e
      JOIN classes c ON e.classe_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (classe_id) { sql += ' AND e.classe_id = ?'; params.push(classe_id); }
    if (search)    { sql += ' AND (e.nom LIKE ? OR e.prenom LIKE ? OR e.massar LIKE ?)';
                     const q = `%${search}%`; params.push(q, q, q); }
    sql += ' ORDER BY c.nom, e.numero_classe';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

// GET /api/eleves/:id  (profil complet + remarques + historique)
router.get('/:id', requireTeacher, async (req, res) => {
  try {
    const [[eleve]] = await db.query(
      `SELECT e.*, c.nom AS classe_nom FROM eleves e
       JOIN classes c ON e.classe_id = c.id WHERE e.id = ?`, [req.params.id]
    );
    if (!eleve) return res.status(404).json({ error: 'Élève introuvable.' });

    const [remarques]  = await db.query(
      'SELECT * FROM remarques WHERE eleve_id = ? ORDER BY created_at DESC', [eleve.id]);
    const [historique] = await db.query(
      'SELECT * FROM historique_points WHERE eleve_id = ? ORDER BY created_at DESC LIMIT 20', [eleve.id]);

    res.json({ ...eleve, remarques, historique });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

// PATCH /api/eleves/:id/points
router.patch('/:id/points', requireTeacher, async (req, res) => {
  try {
    const { delta, motif } = req.body;
    if (delta === undefined) return res.status(400).json({ error: 'delta requis.' });

    const [[eleve]] = await db.query('SELECT * FROM eleves WHERE id = ?', [req.params.id]);
    if (!eleve) return res.status(404).json({ error: 'Élève introuvable.' });

    const ancienne = parseFloat(eleve.points);
    const nouvelle = Math.max(0, Math.min(20, ancienne + parseFloat(delta)));

    await db.query('UPDATE eleves SET points = ? WHERE id = ?', [nouvelle, eleve.id]);

    // Historique
    await db.query(
      `INSERT INTO historique_points (eleve_id, enseignant_id, ancienne_note, nouvelle_note, delta, motif)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [eleve.id, req.session.enseignantId, ancienne, nouvelle, delta, motif || null]
    );

    res.json({ success: true, points: nouvelle });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

// POST /api/eleves/:id/remarques
router.post('/:id/remarques', requireTeacher, async (req, res) => {
  try {
    const { texte } = req.body;
    if (!texte || !texte.trim()) return res.status(400).json({ error: 'Texte requis.' });

    await db.query(
      'INSERT INTO remarques (eleve_id, enseignant_id, texte) VALUES (?, ?, ?)',
      [req.params.id, req.session.enseignantId, texte.trim()]
    );
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

// DELETE /api/eleves/:id/remarques/:rid
router.delete('/:id/remarques/:rid', requireTeacher, async (req, res) => {
  try {
    await db.query('DELETE FROM remarques WHERE id = ? AND eleve_id = ?',
      [req.params.rid, req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

// POST /api/eleves/import  (CSV upload)
router.post('/import', requireTeacher, upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier CSV requis.' });

    let content = req.file.buffer.toString('utf-8');
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
    const sep = content.includes(';') ? ';' : ',';
    const records = parse(content, {
      delimiter: sep,
      skip_empty_lines: true,
      trim: true,
      from_line: 1,
    });

    // Détecter si la première ligne est un en-tête
    const firstRow = records[0].map(v => v.toLowerCase());
    const hasHeader = firstRow.includes('nom') || firstRow.includes('massar');
    const dataRows  = hasHeader ? records.slice(1) : records;

    // Récupérer toutes les classes
    const [classes] = await db.query('SELECT * FROM classes');
    const classeMap = {};
    classes.forEach(c => { classeMap[c.nom.toLowerCase()] = c.id; });

    let imported = 0, errors = [];

    for (const [i, row] of dataRows.entries()) {
      // Format: nom;prenom;classe;numero_classe;massar;date_naissance
      if (row.length < 6) { errors.push(`Ligne ${i+2}: colonnes insuffisantes`); continue; }
      const [nom, prenom, classeNom, numero_classe, massar, date_naissance] = row;

      let classe_id = classeMap[classeNom.toLowerCase()];
      if (!classe_id) {
        // Créer la classe automatiquement si elle n'existe pas
        const [r] = await db.query('INSERT INTO classes (nom) VALUES (?)', [classeNom]);
        classe_id = r.insertId;
        classeMap[classeNom.toLowerCase()] = classe_id;
      }

      try {
        await db.query(
          `INSERT INTO eleves (nom, prenom, massar, date_naissance, numero_classe, classe_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             nom=VALUES(nom), prenom=VALUES(prenom),
             date_naissance=VALUES(date_naissance),
             numero_classe=VALUES(numero_classe), classe_id=VALUES(classe_id)`,
          [nom.toUpperCase(), prenom, massar.toUpperCase(), date_naissance,
           parseInt(numero_classe) || 0, classe_id]
        );
        imported++;
      } catch (e) {
        errors.push(`Ligne ${i+2} (${massar}): ${e.message}`);
      }
    }
    res.json({ success: true, imported, errors });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur import: ' + err.message }); }
});

// GET /api/eleves/export/csv
router.get('/export/csv', requireTeacher, async (req, res) => {
  try {
    const { classe_id } = req.query;
    let sql = `SELECT e.nom, e.prenom, c.nom AS classe, e.numero_classe, e.massar,
                      e.date_naissance, e.points
               FROM eleves e JOIN classes c ON e.classe_id = c.id WHERE 1=1`;
    const params = [];
    if (classe_id) { sql += ' AND e.classe_id = ?'; params.push(classe_id); }
    sql += ' ORDER BY c.nom, e.numero_classe';
    const [rows] = await db.query(sql, params);

    const header = 'nom;prenom;classe;numero_classe;massar;date_naissance;points\n';
    const csv = rows.map(r =>
      [r.nom, r.prenom, r.classe, r.numero_classe, r.massar, r.date_naissance, r.points].join(';')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gesticlasse_export.csv"');
    res.send('\ufeff' + header + csv); // BOM pour Excel
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); }
});

module.exports = router;