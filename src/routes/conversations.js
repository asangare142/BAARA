const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function assertParticipant(conversation, userId) {
  return conversation.clientUserId === userId || conversation.providerUserId === userId;
}

// Démarre (ou retrouve) une conversation avec un profil prestataire.
// Coûte 1 crédit message la première fois ; gratuit ensuite pour
// continuer à échanger avec la même personne — on ne révèle jamais son
// numéro, tout se passe dans l'app.
router.post('/', requireAuth, (req, res) => {
  const { listingId } = req.body || {};
  const listing = db.findById('listings', listingId);
  if (!listing) return res.status(404).json({ error: 'Profil introuvable.' });
  if (listing.userId === req.user.id) {
    return res.status(400).json({ error: 'Tu ne peux pas démarrer une conversation avec toi-même.' });
  }

  const existing = db.findOne(
    'conversations',
    (c) => c.listingId === listing.id && c.clientUserId === req.user.id
  );
  if (existing) return res.json({ conversation: existing });

  if ((req.user.creditsMessage || 0) <= 0) {
    return res.status(402).json({ error: 'Plus de crédits message — achète un pack pour continuer.' });
  }
  const updatedUser = db.updateById('users', req.user.id, { creditsMessage: req.user.creditsMessage - 1 });

  const conversation = db.insert('conversations', {
    listingId: listing.id,
    listingNom: listing.nom,
    clientUserId: req.user.id,
    clientNom: req.user.nom,
    providerUserId: listing.userId
  });

  res.status(201).json({ conversation, creditsMessage: updatedUser.creditsMessage });
});

// Mes conversations, que je sois le client ou le prestataire contacté.
router.get('/', requireAuth, (req, res) => {
  const conversations = db.getAll('conversations')
    .filter((c) => c.clientUserId === req.user.id || c.providerUserId === req.user.id)
    .sort((a, b) => (b.lastMessageAt || b.createdAt || 0) - (a.lastMessageAt || a.createdAt || 0));
  res.json({ conversations });
});

router.get('/:id/messages', requireAuth, (req, res) => {
  const conversation = db.findById('conversations', req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation introuvable.' });
  if (!assertParticipant(conversation, req.user.id)) {
    return res.status(403).json({ error: "Tu ne fais pas partie de cette conversation." });
  }
  const messages = db.getAll('messages')
    .filter((m) => m.conversationId === conversation.id)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  res.json({ conversation, messages });
});

router.post('/:id/messages', requireAuth, (req, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Message vide.' });
  const conversation = db.findById('conversations', req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation introuvable.' });
  if (!assertParticipant(conversation, req.user.id)) {
    return res.status(403).json({ error: "Tu ne fais pas partie de cette conversation." });
  }
  const message = db.insert('messages', {
    conversationId: conversation.id,
    senderId: req.user.id,
    senderNom: req.user.nom,
    text: String(text).trim()
  });
  db.updateById('conversations', conversation.id, { lastMessageAt: message.createdAt, lastMessage: message.text });
  res.status(201).json({ message });
});

module.exports = router;
