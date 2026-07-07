<div align="center">

# 🖥️ HomeServerManager

**Dashboard auto-hébergé pour superviser et administrer un homelab.**

[![CI](https://github.com/pierrelmy/HomeServerManager/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pierrelmy/HomeServerManager/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/pierrelmy/HomeServerManager?color=3b82f6&label=version)](https://github.com/pierrelmy/HomeServerManager/releases/latest)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A524-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![CodeQL](https://github.com/pierrelmy/HomeServerManager/actions/workflows/codeql.yml/badge.svg)](https://github.com/pierrelmy/HomeServerManager/actions/workflows/codeql.yml)

Interface React + API Fastify pour piloter services systemd, conteneurs Docker, NAS et terminal — le tout en temps réel via WebSocket.

</div>

---

## Fonctionnalités

| Module | Capacités |
|---|---|
| **Services** | Démarrer / arrêter / redémarrer des unités systemd, consulter les logs |
| **Docker** | Gérer conteneurs, images et volumes |
| **NAS** | Santé des pools, températures, résumé des sauvegardes, scrub |
| **Terminal** | Shell interactif via WebSocket avec historique persisté |
| **Live** | Mises à jour temps réel — pas de polling, EventHub WebSocket |
| **Audit** | Journal chronologique de toutes les mutations admin |
| **Métriques** | Endpoint `/metrics` compatible Prometheus + Alertmanager |

## Architecture

```
frontend/   React 19 + Vite — HTTP (REST) + WebSocket (live)
backend/    Fastify 5 + SQLite — routes, sessions signées, audit, EventHub
deploy/     Caddy, systemd, Docker Compose, backup SQLite, scripts
docs/       Runbook d'exploitation, rotation des secrets
```

Le backend s'exécute sur l'hôte (accès Docker, systemd, NAS). Le frontend et Caddy sont conteneurisés. Le live est assuré par un canal WebSocket `/live` qui envoie un bundle complet à la connexion puis des événements granulaires sur chaque mutation.

## Développement local

**Prérequis :** Node.js ≥ 24, npm.

```bash
cd backend && npm ci
cd ../frontend && npm ci
```

### Option 1 — backend + frontend

Terminal 1 — backend :

```bash
cd backend
HOST=127.0.0.1 PORT=3000 NODE_ENV=development \
SESSION_SECRET=dev-secret-at-least-32-chars \
CORS_ORIGINS=http://localhost:5173 \
READ_AUTH_REQUIRED=false \
DATABASE_PATH=./data/homelab.dev.db \
ADMIN_EMAIL=admin@localhost.test ADMIN_PASSWORD=dev-password \
ADMIN_DISPLAY_NAME="Admin" \
SYSTEM_ADAPTER=simulation \
SYSTEM_SERVICE_MAP='{}' NAS_SCRUB_COMMAND='[]' NAS_STATUS_COMMAND='[]' \
TOOL_COMMANDS='{}' METRICS_TOKEN=dev-metrics-token \
npm run dev
```

Terminal 2 — frontend branché sur le backend :

```bash
cd frontend
VITE_API_BASE_URL=http://127.0.0.1:3000 VITE_WS_URL=ws://127.0.0.1:3000/live npm run dev
```

Application : `http://localhost:5173` — identifiants : `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

> `SYSTEM_ADAPTER=simulation` évite toute action réelle sur Docker, systemd ou le NAS.

### Option 2 — frontend seul (mode mock)

Aucun backend requis. Données et actions proviennent des repositories mock :

```bash
cd frontend && npm run dev
```

Le mode mock s'active automatiquement quand `VITE_API_BASE_URL` et `VITE_WS_URL` ne sont pas définies. Pour l'activer explicitement : `VITE_ALLOW_MOCKS=true npm run dev`.

### Option 3 — backend conteneurisé

```bash
cd backend/infra
SESSION_SECRET="$(openssl rand -hex 32)" \
ADMIN_EMAIL="admin@localhost.test" ADMIN_PASSWORD="dev-password" \
METRICS_TOKEN="dev-metrics-token" \
docker compose up --build
```

## Vérification locale

```bash
npm run check          # lint + tests + build (backend + frontend)
cd frontend && npm run test:e2e   # E2E Playwright (nécessite Chromium)
```

Pour installer Chromium :

```bash
cd frontend && npx playwright install --with-deps chromium
```

## Production

Le backend s'exécute sur l'hôte avec un utilisateur système restreint. Le frontend et Caddy sont conteneurisés, avec ressources bornées.

**GitHub Actions couvre :**
- CI (lint, tests unitaires, E2E Playwright, builds Docker)
- CodeQL (analyse statique)
- Publication des images GHCR (`ghcr.io/pierrelmy/homeservermanager-*`)
- Release automatique via release-please (versioning sémantique depuis les commits conventionnels)
- Déploiement SSH vers l'environnement `production` (déclenché manuellement)

## Documentation

| Guide | Contenu |
|---|---|
| [Déploiement](deploy/README.md) | Préparation de l'hôte, secrets GitHub, premier démarrage, backup |
| [Runbook](docs/OPERATIONS.md) | Contrôles, sauvegarde, restauration, rollback, incidents |
| [Rotation des secrets](docs/SECRET_ROTATION.md) | SESSION_SECRET, ADMIN_PASSWORD, METRICS_TOKEN |
| [Backend](backend/README.md) | Variables d'env, endpoints, rate limiting, modes |
| [Frontend](frontend/README.md) | Variables, mode mock, tests E2E, build |
| [Sécurité](SECURITY.md) | Signalement de vulnérabilités, secrets GitHub, contraintes sudoers |
