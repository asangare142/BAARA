const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../auth');
const { CATEGORIES } = require('../categories');

const router = express.Router();

// Le numéro d'un prestataire qui a proposé n'est renvoyé qu'au client
// propriétaire de la mission — pas à tout le monde qui parcourt la liste.
router.get('/', optionalAuth, (req, res) => {
  const missions = db.getAll('missions').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const enriched = missions.map((m) => {
    const isOwner = req.user && req.user.id === m.userId;
    const proposals = (m.proposals || []).map((p) => {
      if (!isOwner) return { ...p, telephone: null };
      const listing = db.findById('listings', p.listingId);
      return { ...p, telephone: listing ? listing.telephone : null };
    });
    return { ...m, proposals };
  });
  res.json({ missions: enriched });
});

router.post('/', requireAuth, (req, res) => {
  const { titre, categorie, description, quartier, budget } = req.body || {};
  if (!titre || !description || !quartier || !CATEGORIES.includes(categorie)) {
    return res.status(400).json({ error: 'Titre, catégorie, description et quartier sont obligatoires.' });
  }

  const mission = db.insert('missions', {
    userId: req.user.id,
    titre: String(titre).trim(),
    categorie,
    description: String(description).trim(),
    quartier: String(quartier).trim(),
    budget: budget ? String(budget).trim() : '',
    proposals: [],
    status: 'open'
  });

  res.status(201).json({ mission });
});

// Envoyer une proposition — nécessite un profil prestataire (listingId)
// appartenant à l'utilisateur connecté, et vérifie le quota de connexions
// EN BASE, côté serveur (impossible à contourner depuis le frontend).
router.post('/:id/proposals', requireAuth, (req, res) => {
  const { listingId, prix, message } = req.body || {};
  const mission = db.findById('missions', req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission introuvable.' });

  const listing = db.findById('listings', listingId);
  if (!listing) return res.status(404).json({ error: 'Profil prestataire introuvable.' });
  if (listing.userId !== req.user.id) {
    return res.status(403).json({ error: "Ce profil ne t'appartient pas." });
  }
  if (!prix) return res.status(400).json({ error: 'Le prix est obligatoire.' });

  const used = listing.connexionsUsed || 0;
  const limit = listing.connexionsLimit || 3;
  if (used >= limit) {
    return res.status(402).json({ error: 'Connexions épuisées pour ce profil — achète un pack pour continuer.' });
  }

  const proposal = {
    id: `p_${Date.now()}`,
    listingId: listing.id,
    nom: listing.nom,
    prix: String(prix).trim(),
    message: message ? String(message).trim() : '',
    createdAt: Date.now()
  };

  const updatedMission = db.updateById('missions', mission.id, {
    proposals: [...(mission.proposals || []), proposal]
  });
  db.updateById('listings', listing.id, { connexionsUsed: used + 1 });

  res.status(201).json({ mission: updatedMission });
});

// Supprimer sa propre mission — vérifié en base, pas seulement le token.
router.delete('/:id', requireAuth, (req, res) => {
  const mission = db.findById('missions', req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission introuvable.' });
  if (mission.userId !== req.user.id) {
    return res.status(403).json({ error: 'Tu ne peux supprimer que tes propres missions.' });
  }
  db.deleteById('missions', mission.id);
  res.json({ ok: true });
});

module.exports = router;
