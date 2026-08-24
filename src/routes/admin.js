const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();

// Toutes les routes ci-dessous exigent : (1) être connecté, (2) être admin.
// requireAdmin re-vérifie en base — pas seulement le contenu du token —
// donc même un token modifié à la main ne donne pas accès ici.
router.use(requireAuth, requireAdmin);

// --- Vue d'ensemble ---
router.get('/stats', (req, res) => {
  const users = db.getAll('users');
  const listings = db.getAll('listings');
  const missions = db.getAll('missions');
  res.json({
    totalUsers: users.length,
    totalListings: listings.length,
    verifiedListings: listings.filter((l) => l.status === 'approved').length,
    totalMissions: missions.length,
    pendingPackRequests: db.getAll('packRequests').filter((r) => r.status === 'pending').length,
    pendingCreditRequests: db.getAll('creditRequests').filter((r) => r.status === 'pending').length,
    flaggedReviews: db.getAll('reviews').filter((r) => r.status === 'flagged').length,
    byCategorie: listings.reduce((acc, l) => {
      acc[l.categorie] = (acc[l.categorie] || 0) + 1;
      return acc;
    }, {})
  });
});

// --- Vérification des profils prestataires (badge "Vérifié") ---
router.get('/listings/pending-verification', (req, res) => {
  const listings = db.getAll('listings').filter((l) => !l.verified);
  res.json({ listings });
});
router.post('/listings/:id/verify', (req, res) => {
  const listing = db.updateById('listings', req.params.id, { verified: true });
  if (!listing) return res.status(404).json({ error: 'Profil introuvable.' });
  res.json({ listing });
});

// --- Demandes de packs de visibilité (paiement Mobile Money manuel) ---
router.get('/pack-requests', (req, res) => {
  const requests = db.getAll('packRequests');
  res.json({ requests });
});
router.post('/pack-requests/:id/approve', (req, res) => {
  const request = db.findById('packRequests', req.params.id);
  if (!request) return res.status(404).json({ error: 'Demande introuvable.' });
  db.updateById('listings', request.listingId, { pack: request.pack });
  const updated = db.updateById('packRequests', request.id, { status: 'approved' });
  res.json({ request: updated });
});
router.post('/pack-requests/:id/reject', (req, res) => {
  const updated = db.updateById('packRequests', req.params.id, { status: 'rejected' });
  if (!updated) return res.status(404).json({ error: 'Demande introuvable.' });
  res.json({ request: updated });
});

// --- Demandes de crédits (contact / message) ---
router.get('/credit-requests', (req, res) => {
  const requests = db.getAll('creditRequests');
  res.json({ requests });
});
router.post('/credit-requests/:id/approve', (req, res) => {
  const request = db.findById('creditRequests', req.params.id);
  if (!request) return res.status(404).json({ error: 'Demande introuvable.' });
  const user = db.findById('users', request.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const field = request.type === 'contact' ? 'creditsContact' : 'creditsMessage';
  db.updateById('users', user.id, { [field]: (user[field] || 0) + request.qty });
  const updated = db.updateById('creditRequests', request.id, { status: 'approved' });
  res.json({ request: updated });
});
router.post('/credit-requests/:id/reject', (req, res) => {
  const updated = db.updateById('creditRequests', req.params.id, { status: 'rejected' });
  if (!updated) return res.status(404).json({ error: 'Demande introuvable.' });
  res.json({ request: updated });
});

// --- Modération des avis signalés ---
router.get('/reviews/flagged', (req, res) => {
  const reviews = db.getAll('reviews').filter((r) => r.status === 'flagged');
  res.json({ reviews });
});
router.post('/reviews/:id/hide', (req, res) => {
  const updated = db.updateById('reviews', req.params.id, { status: 'hidden' });
  if (!updated) return res.status(404).json({ error: 'Avis introuvable.' });
  res.json({ review: updated });
});
router.post('/reviews/:id/restore', (req, res) => {
  const updated = db.updateById('reviews', req.params.id, { status: 'visible' });
  if (!updated) return res.status(404).json({ error: 'Avis introuvable.' });
  res.json({ review: updated });
});

// --- Liste des utilisateurs (lecture seule) ---
router.get('/users', (req, res) => {
  const users = db.getAll('users').map(({ passwordHash, ...safe }) => safe);
  res.json({ users });
});

// --- Suppression d'un utilisateur (nettoyage de comptes test/spam) ---
router.delete('/users/:id', (req, res) => {
  const target = db.findById('users', req.params.id);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  if (target.isAdmin) return res.status(403).json({ error: 'Impossible de supprimer un compte admin.' });

  db.getAll('listings')
    .filter((l) => l.userId === target.id)
    .forEach((l) => db.deleteById('listings', l.id));
  db.deleteById('users', target.id);
  res.json({ ok: true });
});

module.exports = router;
