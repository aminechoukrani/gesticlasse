// middleware/auth.js
function requireTeacher(req, res, next) {
  if (req.session && req.session.enseignantId) return next();
  res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
}

module.exports = { requireTeacher };
