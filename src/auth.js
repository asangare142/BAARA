// auth.js — tout ce qui touche à la sécurité des comptes.
//
// Points clés :
// - Les mots de passe ne sont JAMAIS stockés en clair (bcrypt, 10 rounds).
// - Le rôle admin n'est JAMAIS assignable via l'inscription publique.
//   Le SEUL compte admin est celui créé au démarrage du serveur via .env
//   (voir db.js -> seedAdmin). Aucune route ne permet de devenir admin.
// - requireAdmin vérifie le token ET re-vérifie en base que isAdmin === true
//   (pas seulement ce que dit le token), pour éviter qu'un token trafiqué
//   donne un accès admin.

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET manquant dans .env — génère une longue chaîne aléatoire avant de démarrer.');
}
const TOKEN_TTL = '30d';

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

// Middleware : exige un utilisateur connecté (n'importe quel rôle).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non connecté.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.findById('users', payload.sub);
    if (!user) return res.status(401).json({ error: 'Session invalide.' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expirée ou invalide.' });
  }
}

// Middleware : exige que l'utilisateur soit l'admin.
// Toujours utilisé APRÈS requireAuth. Re-vérifie en base, pas seulement le token.
function requireAdmin(req, res, next) {
  if (!req.user || req.user.isAdmin !== true) {
    return res.status(403).json({ error: "Accès refusé — réservé à l'administration." });
  }
  next();
}

// Middleware : si un token valide est présent, attache req.user ; sinon
// continue sans erreur (route reste accessible aux visiteurs non connectés).
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.findById('users', payload.sub);
    if (user) req.user = user;
  } catch (e) {
    // token invalide/expiré : on ignore silencieusement, visiteur anonyme
  }
  next();
}

module.exports = { hashPassword, verifyPassword, signToken, publicUser, requireAuth, requireAdmin, optionalAuth };
