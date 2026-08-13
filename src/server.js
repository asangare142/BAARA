require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Amorçage : crée le compte admin unique si aucun n'existe encore.
db.seedAdmin();

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
app.listen(PORT, () => {
  console.log(`\n🚀 Baara tourne sur http://localhost:${PORT}\n`);
});
