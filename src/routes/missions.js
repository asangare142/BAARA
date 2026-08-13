const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { CATEGORIES } = require('../categories');

const router = express.Router();

router.get('/', (req, res) => {
  const missions = db.getAll('missions').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json({ missions });
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

module.exports = router;
