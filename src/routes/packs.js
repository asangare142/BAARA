const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { PACKS } = require('../categories');

const router = express.Router();

// Le prestataire soumet sa demande de boost + référence de paiement Orange
// Money/Wave. Le pack N'EST PAS activé ici — il reste "pending" jusqu'à
// validation manuelle par l'admin (voir routes/admin.js). C'est volontaire :
// Baara n'a pas d'intégration Mobile Money automatique pour l'instant.
router.post('/', requireAuth, (req, res) => {
  const { listingId, pack, amount, reference } = req.body || {};

  if (!PACKS[pack] || pack === 'standard') {
    return res.status(400).json({ error: 'Pack invalide.' });
  }
  const listing = db.findById('listings', listingId);
  if (!listing) return res.status(404).json({ error: 'Profil introuvable.' });
  if (listing.userId !== req.user.id) {
    return res.status(403).json({ error: "Ce profil ne t'appartient pas." });
  }
  if (!reference) {
    return res.status(400).json({ error: 'Référence de transaction obligatoire.' });
  }

  const request = db.insert('packRequests', {
    listingId,
    userId: req.user.id,
    pack,
    amount: amount || null,
    reference: String(reference).trim(),
    status: 'pending' // pending | approved | rejected
  });

  res.status(201).json({ request });
});

router.get('/mine', requireAuth, (req, res) => {
  const requests = db.getAll('packRequests').filter((r) => r.userId === req.user.id);
  res.json({ requests });
});

module.exports = router;
