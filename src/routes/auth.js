const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword, signToken, publicUser, requireAuth } = require('../auth');

const router = express.Router();

// Inscription publique. isAdmin est TOUJOURS false ici, en dur — aucune façon
// pour un utilisateur normal de s'auto-promouvoir admin via cette route.
router.post('/signup', (req, res) => {
  const { nom, telephone, email, password } = req.body || {};

  if (!nom || !telephone || !password) {
    return res.status(400).json({ error: 'Nom, téléphone et mot de passe sont obligatoires.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
  }

  const existing = db.findOne('users', (u) => u.telephone === telephone);
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec ce numéro.' });
  }

  const user = db.insert('users', {
    nom: String(nom).trim(),
    telephone: String(telephone).trim(),
    email: email ? String(email).trim() : null,
    passwordHash: hashPassword(password),
    isAdmin: false,
    isVerified: false,
    creditsContact: 0,
    creditsMessage: 0
  });

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { telephone, password } = req.body || {};
  if (!telephone || !password) {
    return res.status(400).json({ error: 'Téléphone et mot de passe requis.' });
  }

  const user = db.findOne('users', (u) => u.telephone === telephone);
  // Message volontairement identique que le numéro existe ou non,
  // pour ne pas révéler quels numéros sont inscrits.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Mot de passe oublié : crée une demande vue par l'admin (pas d'email/SMS
// configuré) — l'admin vérifie l'identité (WhatsApp, etc.) puis approuve.
router.post('/request-password-reset', (req, res) => {
  const { telephone } = req.body || {};
  if (!telephone) {
    return res.status(400).json({ error: 'Numéro de téléphone requis.' });
  }
  const user = db.findOne('users', (u) => u.telephone === String(telephone).trim());
  if (user) {
    const alreadyPending = db.findOne(
      'passwordResetRequests',
      (r) => r.userId === user.id && r.status === 'pending'
    );
    if (!alreadyPending) {
      db.insert('passwordResetRequests', {
        userId: user.id,
        nom: user.nom,
        telephone: user.telephone,
        status: 'pending'
      });
    }
  }
  // Message identique que le numéro existe ou non, pour ne pas révéler
  // quels numéros sont inscrits.
  res.json({ ok: true, message: 'Si ce numéro est inscrit, ta demande a été transmise à l’administration.' });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères.' });
  }
  if (!verifyPassword(currentPassword, req.user.passwordHash)) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }
  db.updateById('users', req.user.id, { passwordHash: hashPassword(newPassword) });
  res.json({ ok: true });
});

module.exports = router;
