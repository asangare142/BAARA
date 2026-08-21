// db.js — petite couche de persistance.
// Toutes les routes passent par getAll/insert/findById/findOne/updateById/
// deleteById, qui lisent et écrivent un objet unique tenu en mémoire
// (`cachedDb`). Ça garde tout le reste du code (routes, auth) inchangé.
//
// Deux modes de stockage durable pour cet objet, selon que DATABASE_URL
// est défini ou non :
//  - DATABASE_URL défini (production, Render Postgres) : l'objet entier est
//    persisté comme une seule ligne JSONB dans Postgres. Nécessaire car le
//    disque local d'un service web Render n'est pas persistant sans plan
//    payant — un simple fichier JSON local est effacé à chaque redémarrage.
//  - DATABASE_URL absent (dev local) : fichier data/data.json comme avant,
//    pratique pour tester sans dépendance externe.

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

const USE_POSTGRES = !!process.env.DATABASE_URL;
let pool = null;
if (USE_POSTGRES) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

let cachedDb = null; // objet unique tenu en mémoire, source de vérité pour les lectures synchrones

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(EMPTY_DB, null, 2));
  }
}

// Charge cachedDb au démarrage — à appeler une seule fois avant que le
// serveur commence à accepter des requêtes (voir server.js).
async function init() {
  if (USE_POSTGRES) {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value JSONB NOT NULL)'
    );
    const { rows } = await pool.query('SELECT value FROM kv_store WHERE key = $1', ['baara']);
    if (rows.length) {
      cachedDb = rows[0].value;
      console.log('✅ Données chargées depuis Postgres.');
    } else {
      cachedDb = JSON.parse(JSON.stringify(EMPTY_DB));
      await persistToPostgres(cachedDb);
      console.log('✅ Nouvelle base Postgres initialisée.');
    }
  } else {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    try {
      cachedDb = JSON.parse(raw);
    } catch (e) {
      console.error('data.json corrompu, réinitialisation.', e);
      cachedDb = JSON.parse(JSON.stringify(EMPTY_DB));
    }
    console.log('⚠️  DATABASE_URL non défini — stockage sur fichier local (data/data.json), non persistant sur Render sans disque payant.');
  }
}

function persistToPostgres(db) {
  return pool
    .query(
      'INSERT INTO kv_store (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['baara', JSON.stringify(db)]
    )
    .catch((e) => console.error('Erreur de sauvegarde Postgres :', e));
}

function load() {
  if (!cachedDb) throw new Error('db.init() doit être appelé avant toute lecture.');
  return cachedDb;
}

function save(db) {
  cachedDb = db;
  if (USE_POSTGRES) {
    persistToPostgres(db); // fire-and-forget : les lectures restent synchrones via cachedDb
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  }
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
  init,
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
