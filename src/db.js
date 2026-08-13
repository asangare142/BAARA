// db.js — petite couche de persistance basée sur un fichier JSON.
// Suffisant pour un pilote/test avec un nombre limité d'utilisateurs.
// Pour une vraie montée en charge, remplacer par Postgres/MySQL plus tard
// (la forme des fonctions ci-dessous — getAll/insert/update/find — reste
// la même, seul le contenu changerait).

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const EMPTY_DB = {
  users: [],
  listings: [],
  missions: [],
  reviews: [],
  packRequests: [],
  creditRequests: []
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(EMPTY_DB, null, 2));
  }
}

function load() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('data.json corrompu, réinitialisation.', e);
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }
}

function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// --- Génériques ---
function getAll(collection) {
  const db = load();
  return db[collection] || [];
}

function insert(collection, record) {
  const db = load();
  const withId = { id: record.id || uuid(), createdAt: Date.now(), ...record };
  db[collection].push(withId);
  save(db);
  return withId;
}

function findById(collection, id) {
  const db = load();
  return (db[collection] || []).find((r) => r.id === id) || null;
}

function findOne(collection, predicate) {
  const db = load();
  return (db[collection] || []).find(predicate) || null;
}

function updateById(collection, id, patch) {
  const db = load();
  const idx = (db[collection] || []).findIndex((r) => r.id === id);
  if (idx === -1) return null;
  db[collection][idx] = { ...db[collection][idx], ...patch };
  save(db);
  return db[collection][idx];
}

function deleteById(collection, id) {
  const db = load();
  const idx = (db[collection] || []).findIndex((r) => r.id === id);
  if (idx === -1) return false;
  db[collection].splice(idx, 1);
  save(db);
  return true;
}

// --- Amorçage : crée le compte admin unique au premier démarrage ---
function seedAdmin() {
  const db = load();
  const alreadyHasAdmin = db.users.some((u) => u.isAdmin);
  if (alreadyHasAdmin) return;

  const phone = process.env.ADMIN_PHONE || '+22300000000';
  const password = process.env.ADMIN_PASSWORD || 'changeme';
  const nom = process.env.ADMIN_NOM || 'Admin Baara';

  if (password === 'changeme') {
    console.warn(
      '\n⚠️  ATTENTION : aucun ADMIN_PASSWORD défini dans .env — un mot de passe par défaut ("changeme") a été utilisé.\n' +
      '   Change-le immédiatement dans .env et relance le serveur avant de partager le lien à qui que ce soit.\n'
    );
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const admin = {
    id: uuid(),
    nom,
    telephone: phone,
    email: null,
    passwordHash,
    isAdmin: true,
    isVerified: true,
    creditsContact: 0,
    creditsMessage: 0,
    createdAt: Date.now()
  };
  db.users.push(admin);
  save(db);
  console.log(`✅ Compte admin créé : ${phone} (mot de passe défini via .env)`);
}

module.exports = {
  load,
  save,
  getAll,
  insert,
  findById,
  findOne,
  updateById,
  deleteById,
  seedAdmin
};
