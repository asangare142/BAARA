const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const { type, qty, amount, reference } = req.body || {};

  if (!['contact', 'message'].includes(type)) {
    return res.status(400).json({ error: 'Type de crédit invalide.' });
  }
  const quantity = Number(qty);
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Quantité invalide.' });
  }
  if (!reference) {
    return res.status(400).json({ error: 'Référence de transaction obligatoire.' });
  }

  const request = db.insert('creditRequests', {
    userId: req.user.id,
    type,
    qty: quantity,
    amount: amount || null,
    reference: String(reference).trim(),
    status: 'pending'
  });

  res.status(201).json({ request });
});

router.get('/mine', requireAuth, (req, res) => {
  const requests = db.getAll('creditRequests').filter((r) => r.userId === req.user.id);
  res.json({ requests });
});

module.exports = router;
