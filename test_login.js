const bcrypt  = require('bcryptjs');
const db      = require('./config/db');

async function test() {
  try {
    const [rows] = await db.query('SELECT * FROM enseignants');
    if (!rows.length) {
      console.log('❌ Aucun enseignant trouvé dans la base de données !');
      process.exit();
    }
    const e = rows[0];
    console.log('✅ Enseignant trouvé');
    console.log('   Email :', e.email);
    console.log('   Hash  :', e.mot_de_passe);

    const ok = await bcrypt.compare('admin123', e.mot_de_passe);
    console.log('   Mot de passe admin123 valide :', ok ? '✅ OUI' : '❌ NON');

    if (!ok) {
      // Générer un nouveau hash et mettre à jour directement
      const newHash = await bcrypt.hash('admin123', 10);
      await db.query('UPDATE enseignants SET mot_de_passe = ? WHERE email = ?', [newHash, e.email]);
      console.log('🔧 Hash corrigé automatiquement — réessayez admin123');
    }

    process.exit();
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit();
  }
}

test();
