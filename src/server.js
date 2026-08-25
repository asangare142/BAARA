require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/missions', require('./routes/missions'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/packs', require('./routes/packs'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api/admin', require('./routes/admin'));

// Frontend statique (public/index.html, app.js, styles.css)
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route introuvable.' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Gestionnaire d'erreurs générique — ne fuite jamais la stack trace au client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur.' });
});

const PORT = process.env.PORT || 3000;

// Migration ponctuelle : le pack de bienvenue automatique pour les 15
// premiers prestataires a été retiré (remplacé par des crédits contact
// gratuits) — repasse en standard les profils qui l'avaient déjà reçu.
// Ne fait plus rien une fois que ces profils sont nettoyés.
function migrateAwayFromWelcomePack() {
  const toReset = db.getAll('listings').filter((l) => l.welcomePack);
  toReset.forEach((l) => db.updateById('listings', l.id, { pack: 'standard', welcomePack: false, packExpiresAt: null }));
  if (toReset.length) {
    console.log(`🧹 ${toReset.length} profil(s) repassé(s) en standard (retrait du pack de bienvenue).`);
  }
}

(async () => {
  await db.init();
  db.seedAdmin(); // crée le compte admin unique si aucun n'existe encore
  migrateAwayFromWelcomePack();
  app.listen(PORT, () => {
    console.log(`\n🚀 Baara tourne sur http://localhost:${PORT}\n`);
  });
})();
