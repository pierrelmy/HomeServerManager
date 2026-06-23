# HomeServerManager

Tableau de bord React/Fastify pour superviser et administrer un homelab. Le monorepo contient le frontend, l’API, la persistance SQLite, les adaptateurs système et les fichiers de déploiement.

## Développement

Prérequis : Node.js 24.

```bash
cp backend/.env.example backend/.env
cd backend && npm ci && npm run dev
```

Dans un second terminal :

```bash
cd frontend
npm ci
VITE_API_BASE_URL=http://localhost:3000 VITE_WS_URL=ws://localhost:3000/live npm run dev
```

L’administrateur initial correspond à `ADMIN_EMAIL` et `ADMIN_PASSWORD`. Le mode `SYSTEM_ADAPTER=simulation` est réservé au développement.

## Vérification

```bash
cd backend && npm run typecheck && npm test && npm run build
cd frontend && npm run lint && npm test && npm run build
```

## Production

Le backend s’exécute sur l’hôte avec un utilisateur système restreint, car il pilote Docker, systemd et le NAS. Le frontend et Caddy sont conteneurisés. Voir [le guide de déploiement](deploy/README.md) et [le runbook](docs/OPERATIONS.md).

Les workflows GitHub assurent la CI, l’analyse CodeQL, la publication dans GHCR et le déploiement manuel via un environnement GitHub protégé.
