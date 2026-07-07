# HomeServerManager

Dashboard React + Fastify pour superviser et administrer un homelab. Le monorepo contient :

- `frontend/` : application React/Vite
- `backend/` : API Fastify, sessions, audit, persistance SQLite, WebSocket `/live`
- `deploy/` : fichiers de déploiement, Caddy, systemd, monitoring et workflow GitHub Actions
- `docs/` : runbook d’exploitation

## Stack

- Node.js 24 pour le développement et la CI
- React 19 + Vite côté frontend
- Fastify 5 + SQLite côté backend
- WebSocket pour le live
- Docker / Caddy pour la partie frontend et le reverse proxy en production

## Développement local

Prérequis :

- Node.js 24
- npm
- Chromium installé via Playwright si vous voulez lancer les E2E

Installation :

```bash
cd backend && npm ci
cd ../frontend && npm ci
```

### Option 1 : backend + frontend en local

Terminal 1, backend :

```bash
cd backend
HOST=127.0.0.1 \
PORT=3000 \
NODE_ENV=development \
SESSION_SECRET=development-only-session-secret-change-me \
CORS_ORIGINS=http://localhost:5173 \
READ_AUTH_REQUIRED=false \
DATABASE_PATH=./data/homelab.dev.db \
ADMIN_EMAIL=admin@localhost.test \
ADMIN_PASSWORD=development-password \
ADMIN_DISPLAY_NAME="Homelab Admin" \
SYSTEM_ADAPTER=simulation \
SYSTEM_SERVICE_MAP='{}' \
NAS_SCRUB_COMMAND='[]' \
NAS_STATUS_COMMAND='[]' \
TOOL_COMMANDS='{"update-hsm":["sudo","-n","/bin/bash","/srv/homeservermanager-dev/deploy/update-hsm-dev.sh"]}' \
METRICS_TOKEN=development-metrics-token \
npm run dev
```

Terminal 2, frontend branché sur le backend :

```bash
cd frontend
VITE_API_BASE_URL=http://127.0.0.1:3000 \
VITE_WS_URL=ws://127.0.0.1:3000/live \
npm run dev
```

Application :

- frontend : `http://localhost:5173`
- backend : `http://127.0.0.1:3000`
- identifiants admin initiaux : `ADMIN_EMAIL` / `ADMIN_PASSWORD`

En local, `SYSTEM_ADAPTER=simulation` évite toute action réelle sur Docker, systemd ou le NAS.

Si vous voulez tester le bouton de mise à jour depuis l’onglet Tools avec `SYSTEM_ADAPTER=local`, ajoutez aussi `update-hsm` dans `TOOL_COMMANDS`. L’appel recommandé pointe vers le script du repo pour éviter d’exécuter une copie installée obsolète.

### Option 2 : frontend seul en mode mock

Le frontend peut tourner sans backend si `VITE_API_BASE_URL` et `VITE_WS_URL` ne sont pas définies.

```bash
cd frontend
npm run dev
```

Dans ce mode, les données et actions proviennent des repositories mock et du transport live mock.

### Option 3 : backend local conteneurisé

Une stack Docker de développement existe pour l’API seule, toujours en mode simulation :

```bash
cd backend/infra
SESSION_SECRET="$(openssl rand -hex 32)" \
ADMIN_EMAIL="admin@localhost.test" \
ADMIN_PASSWORD="development-password" \
METRICS_TOKEN="development-metrics-token" \
docker compose up --build
```

Le backend écoute alors sur `http://localhost:3000`.

## Vérification locale

Depuis la racine :

```bash
npm run check
```

Détail :

- `npm run lint` : lint backend + frontend
- `npm run test` : tests backend + frontend
- `npm run build` : builds backend + frontend

Commandes ciblées :

```bash
cd backend && npm run typecheck && npm run lint && npm test && npm run build
cd frontend && npm run lint && npm test && npm run build
cd frontend && npx playwright install --with-deps chromium && npm run test:e2e
```

## Modes d’exécution

- Développement local : backend en `SYSTEM_ADAPTER=simulation`, base SQLite locale
- Production : backend sur l’hôte, frontend et Caddy en conteneurs, monitoring Prometheus optionnel

## Production

Le backend s’exécute sur l’hôte avec un utilisateur système restreint parce qu’il pilote Docker, systemd et le NAS. Le frontend et Caddy sont conteneurisés.

Références :

- [Guide de déploiement](deploy/README.md)
- [Runbook d’exploitation](docs/OPERATIONS.md)
- [Politique de sécurité](SECURITY.md)

GitHub Actions couvre :

- CI
- CodeQL
- publication des images GHCR
- déploiement manuel via l’environnement protégé `production`
