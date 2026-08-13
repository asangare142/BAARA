const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../auth');
const { CATEGORIES, PACKS, FREE_CONNEXIONS } = require('../categories');

const router = express.Router();

function escapeForClient(l, viewerUnlockedSet) {
  // Le numéro n'est renvoyé que si le profil est boosté (pack payant)
  // ou si le visiteur a déjà débloqué ce contact. Sinon on le masque
  // côté SERVEUR (pas juste côté affichage) — c'est la vraie sécurité :
  // même quelqu'un qui inspecte le réseau ne voit pas le numéro.
  const isPaidPack = l.pack && l.pack !== 'standard';
  const isUnlocked = viewerUnlockedSet && viewerUnlockedSet.has(l.id);
  const canSeePhone = isPaidPack || isUnlocked;
  return {
    ...l,
    telephone: canSeePhone ? l.telephone : null,
    contactLocked: !canSeePhone
  };
}

// Liste / recherche — accessible sans connexion (comme sur Jobbers,
// parcourir est public), mais le numéro reste masqué si non débloqué.
router.get('/', optionalAuth, (req, res) => {
  const { q, categorie } = req.query;
  let listings = db.getAll('listings').filter((l) => l.status !== 'hidden');

  if (categorie && categorie !== 'Tout') {
    listings = listings.filter((l) => l.categorie === categorie);
  }
  if (q) {
    const needle = String(q).toLowerCase();
    listings = listings.filter((l) =>
      l.nom.toLowerCase().includes(needle) ||
      l.competence.toLowerCase().includes(needle) ||
      l.quartier.toLowerCase().includes(needle) ||
      (l.description || '').toLowerCase().includes(needle)
    );
  }

  listings.sort((a, b) => {
    const rankDiff = (PACKS[b.pack]?.rank || 0) - (PACKS[a.pack]?.rank || 0);
    if (rankDiff !== 0) return rankDiff;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const unlockedSet = new Set(req.user ? (req.user.unlockedContacts || []) : []);
  res.json({ listings: listings.map((l) => escapeForClient(l, unlockedSet)), categories: CATEGORIES });
});

// Mes profils — y compris ceux non vérifiés ou masqués par un admin,
// puisque le propriétaire doit toujours pouvoir les retrouver et les gérer.
router.get('/mine', requireAuth, (req, res) => {
  const listings = db.getAll('listings').filter((l) => l.userId === req.user.id);
  res.json({ listings });
});

router.get('/:id', optionalAuth, (req, res) => {
  const listing = db.findById('listings', req.params.id);
  if (!listing) return res.status(404).json({ error: 'Profil introuvable.' });
  const unlockedSet = new Set(req.user ? (req.user.unlockedContacts || []) : []);
  res.json({ listing: escapeForClient(listing, unlockedSet) });
});

// Créer un profil prestataire — nécessite d'être connecté (c'est TON compte
// qui publie, donc on peut appliquer les quotas de connexions correctement).
router.post('/', requireAuth, (req, res) => {
  const { categorie, competence, quartier, tarif, telephone, description } = req.body || {};

  if (!competence || !quartier || !CATEGORIES.includes(categorie)) {
    return res.status(400).json({ error: 'Catégorie, compétence et quartier sont obligatoires.' });
  }

  const listing = db.insert('listings', {
    userId: req.user.id,
    nom: req.user.nom,
    categorie,
    competence: String(competence).trim(),
    quartier: String(quartier).trim(),
    tarif: tarif ? String(tarif).trim() : '',
    telephone: telephone ? String(telephone).trim() : req.user.telephone,
    description: description ? String(description).trim() : '',
    pack: 'standard',
    connexionsUsed: 0,
    connexionsLimit: FREE_CONNEXIONS,
    ratingSum: 0,
    reviewCount: 0,
    status: 'approved'
  });

  res.status(201).json({ listing });
});

// Débloquer le contact d'un profil standard — consomme 1 crédit contact
// de L'UTILISATEUR CONNECTÉ. Vérifié côté serveur, impossible à tricher
// depuis le frontend.
router.post('/:id/unlock-contact', requireAuth, (req, res) => {
  const listing = db.findById('listings', req.params.id);
  if (!listing) return res.status(404).json({ error: 'Profil introuvable.' });

  if (listing.pack && listing.pack !== 'standard') {
    return res.json({ listing, message: 'Ce profil est déjà visible sans crédit (pack payant).' });
  }

  const unlockedKey = `unlocked_${listing.id}`;
  if (req.user.unlockedContacts && req.user.unlockedContacts.includes(listing.id)) {
    return res.json({ listing, message: 'Déjà débloqué.' });
  }

  if ((req.user.creditsContact || 0) <= 0) {
    return res.status(402).json({ error: 'Plus de crédits contact — achète un pack.' });
  }

  const unlockedContacts = [...(req.user.unlockedContacts || []), listing.id];
  const updatedUser = db.updateById('users', req.user.id, {
    creditsContact: req.user.creditsContact - 1,
    unlockedContacts
  });

  res.json({ listing, creditsContact: updatedUser.creditsContact });
});

// Modifier son propre profil — vérifié en base (pas seulement le token),
// pour empêcher qu'on modifie le profil de quelqu'un d'autre en devinant son id.
router.put('/:id', requireAuth, (req, res) => {
  const listing = db.findById('listings', req.params.id);
  if (!listing) return res.status(404).json({ error: 'Profil introuvable.' });
  if (listing.userId !== req.user.id) {
    return res.status(403).json({ error: 'Tu ne peux modifier que tes propres profils.' });
  }

  const { categorie, competence, quartier, tarif, telephone, description } = req.body || {};
  if (!competence || !quartier || !CATEGORIES.includes(categorie)) {
    return res.status(400).json({ error: 'Catégorie, compétence et quartier sont obligatoires.' });
  }

  const updated = db.updateById('listings', listing.id, {
    categorie,
    competence: String(competence).trim(),
    quartier: String(quartier).trim(),
    tarif: tarif ? String(tarif).trim() : '',
    telephone: telephone ? String(telephone).trim() : listing.telephone,
    description: description ? String(description).trim() : ''
  });

  res.json({ listing: updated });
});

// Supprimer son propre profil — même vérification de propriété que pour PUT.
router.delete('/:id', requireAuth, (req, res) => {
  const listing = db.findById('listings', req.params.id);
  if (!listing) return res.status(404).json({ error: 'Profil introuvable.' });
  if (listing.userId !== req.user.id) {
    return res.status(403).json({ error: 'Tu ne peux supprimer que tes propres profils.' });
  }

  db.deleteById('listings', listing.id);
  res.json({ ok: true });
});

module.exports = router;
