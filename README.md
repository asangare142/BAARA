# Baara — backend + frontend

Marketplace de services entre particuliers au Mali, sur le modèle de Jobbers.ma.
Zéro commission — Baara se rémunère via des packs de visibilité et de crédits, validés manuellement par l'admin après paiement Mobile Money.

## Ce qu'il y a dedans

- **Backend** : Node.js + Express, stockage en fichier JSON (simple et suffisant pour un pilote — facilement remplaçable par une vraie base plus tard).
- **Authentification réelle** : mots de passe hashés (bcrypt), sessions par token (JWT).
- **Un seul compte admin**, créé automatiquement au démarrage à partir de `.env`. Personne ne peut devenir admin via l'inscription publique — c'est vérifié côté serveur, pas juste caché côté écran.
- **Modération** : avis signalables, profils à vérifier, demandes de packs/crédits en attente — tout passe par l'espace admin avant d'être actif.
- **Frontend** : une page HTML/JS simple, servie directement par le serveur (pas de build à faire).

## Lancer en local (pour tester dès maintenant)

Il te faut [Node.js](https://nodejs.org) installé (version 18 ou plus récente).

```bash
# 1. Installer les dépendances
npm install

# 2. Créer ton fichier de configuration
cp .env.example .env
```

Ouvre `.env` et remplis :
- `JWT_SECRET` : une longue chaîne aléatoire (n'importe quoi, du moment que c'est long et unique)
- `ADMIN_PHONE` : ton numéro de téléphone, ce sera ton identifiant admin
- `ADMIN_PASSWORD` : **change-le absolument**, c'est le mot de passe qui protège tout l'espace admin

```bash
# 3. Démarrer le serveur
npm start
```

Le message `✅ Compte admin créé` confirme que ton compte admin existe. Ouvre ensuite **http://localhost:3000** dans ton navigateur, connecte-toi avec `ADMIN_PHONE` / `ADMIN_PASSWORD`, et l'onglet **Admin** apparaît automatiquement — lui seul y a accès.

Pour tester avec d'autres personnes sur le même réseau Wi-Fi, remplace `localhost` par l'adresse IP locale de ta machine (ex : `http://192.168.1.42:3000`).

## Comment ça reste sécurisé

- Les mots de passe ne sont jamais stockés en clair.
- Le rôle admin n'est déterminé qu'en base de données, jamais par ce qu'envoie le navigateur — impossible à falsifier depuis le frontend.
- Les numéros de téléphone des prestataires non boostés sont masqués **côté serveur** : même en inspectant le trafic réseau, un visiteur non autorisé ne les voit pas tant qu'il n'a pas de crédit.
- Chaque quota (connexions gratuites, crédits) est vérifié et décrémenté côté serveur, jamais fait confiance au frontend.

Ce qui reste volontairement simple pour un pilote d'une semaine (à muscler avant un vrai lancement public) :
- Stockage en fichier JSON plutôt qu'une vraie base de données — largement suffisant pour quelques dizaines/centaines d'utilisateurs de test, mais à migrer vers Postgres avant une montée en charge sérieuse.
- Pas de vérification par SMS du numéro de téléphone à l'inscription (juste déclaratif) — le badge "Vérifié" est donc entièrement manuel, décidé par toi dans l'espace admin.
- Pas de limitation de débit (rate limiting) sur les routes publiques — à ajouter si l'app devient publique et à fort trafic.

## Déployer pour un lien public partageable

Ce backend est un serveur Node.js standard — tu peux le déployer sur n'importe quel hébergeur qui supporte Node.js. Les plus simples pour démarrer :

**Railway** (railway.app) ou **Render** (render.com) — les deux ont un plan gratuit/pas cher, se connectent directement à un dépôt GitHub, détectent automatiquement `npm start`, et te donnent une URL publique en quelques clics. Il suffira d'ajouter les mêmes variables d'environnement que dans `.env` (JWT_SECRET, ADMIN_PHONE, ADMIN_PASSWORD) dans les réglages de la plateforme.

Étapes générales :
1. Crée un dépôt GitHub avec ce dossier (le `.gitignore` exclut déjà `node_modules`, `.env` et les données — c'est voulu, ne les pousse jamais).
2. Connecte ce dépôt à Railway ou Render.
3. Ajoute les variables d'environnement dans leur interface (jamais dans le code).
4. Déploie — tu obtiens une URL du type `https://baara-production.up.railway.app`.

⚠️ Une fois en ligne publiquement, le fichier `data/data.json` vit sur le serveur distant — pense à vérifier que la plateforme choisie garde bien un disque persistant (Railway et Render le font par défaut sur leurs plans payants ; sur le tier gratuit, vérifie que les données ne sont pas effacées à chaque redéploiement).

## Structure du projet

```
baara-app/
├── src/
│   ├── server.js          # point d'entrée, assemble tout
│   ├── db.js               # stockage JSON + création du compte admin
│   ├── auth.js              # hashage mots de passe, JWT, middlewares de sécurité
│   ├── categories.js        # taxonomie des métiers, packs de visibilité
│   └── routes/
│       ├── auth.js          # inscription / connexion
│       ├── listings.js      # profils prestataires, déblocage de contact
│       ├── missions.js      # missions publiées + propositions (avec quota connexions)
│       ├── reviews.js       # avis + signalement
│       ├── packs.js         # demandes de packs de visibilité
│       ├── credits.js       # demandes de crédits contact/message
│       └── admin.js         # TOUT l'espace admin — protégé, accès restreint
└── public/
    ├── index.html
    ├── app.js               # toute la logique frontend
    └── styles.css
```
