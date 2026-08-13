const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const { listingId, rating, comment } = req.body || {};
  const listing = db.findById('listings', listingId);
  if (!listing) return res.status(404).json({ error: 'Profil introuvable.' });

  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Note invalide (1 à 5).' });

  const review = db.insert('reviews', {
    listingId,
    reviewerUserId: req.user.id,
    reviewerNom: req.user.nom,
    rating: r,
    comment: comment ? String(comment).trim() : '',
    status: 'visible' // visible | flagged | hidden (hidden = seul l'admin peut le faire)
  });

  db.updateById('listings', listing.id, {
    ratingSum: (listing.ratingSum || 0) + r,
    reviewCount: (listing.reviewCount || 0) + 1
  });

  res.status(201).json({ review });
});

router.get('/listing/:listingId', (req, res) => {
  const reviews = db.getAll('reviews').filter((r) => r.listingId === req.params.listingId && r.status !== 'hidden');
  res.json({ reviews });
});

// N'importe quel utilisateur connecté peut signaler un avis abusif.
// Ça ne le cache pas immédiatement — ça le met dans la file de modération
// admin, pour éviter qu'un signalement malveillant censure un avis légitime.
router.post('/:id/flag', requireAuth, (req, res) => {
  const review = db.findById('reviews', req.params.id);
  if (!review) return res.status(404).json({ error: 'Avis introuvable.' });
  const updated = db.updateById('reviews', review.id, { status: 'flagged' });
  res.json({ review: updated });
});

module.exports = router;
