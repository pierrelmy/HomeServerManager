# Homelab backend

API Fastify pour le frontend du homelab. Elle fournit les snapshots HTTP, les mutations d'administration, une session signée, un journal d'audit et le canal WebSocket `/live`.

## Démarrage local

Prérequis : Node.js 22 ou plus récent.

```bash
cp .env.example .env
npm install
npm run dev
```

Le serveur écoute par défaut sur `http://localhost:3000`.

Variables à fournir au frontend :

```dotenv
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/live
```

Les cookies de session nécessitent `credentials: "include"` lorsque le frontend et l'API n'utilisent pas exactement la même origine. En production, servir les deux derrière la même origine est recommandé.

## Contrats principaux

- `GET|POST|DELETE /session`
- `GET /overview|services|docker|nas|tools|terminal|account|settings`
- `PATCH /settings`
- `POST /services/:id/start|stop|restart`
- `POST /docker/containers/:id/start|stop|restart`
- `POST /docker/images/:id/pull|run`
- `POST /nas/scrub`
- `POST /terminal/execute`
- `POST /tools/:id/run` (identifiant normalisé, par exemple `scan-reseau`)
- `GET /audit`
- `GET /health`, `GET /ready`
- `WS /live`

Les lectures sont publiques par défaut pour rester compatibles avec le bootstrap actuel du frontend. Mettre `READ_AUTH_REQUIRED=true` lorsque le frontend charge d'abord `/session` avant les autres snapshots.

Le terminal n'exécute pas de shell arbitraire. Les commandes autorisées sont `uptime`, `docker ps`, `df -h` et `journalctl -p err -n 5`.

## Vérification

```bash
npm run typecheck
npm test
npm run build
```

## Conteneur de développement

```bash
cd infra
SESSION_SECRET="$(openssl rand -hex 32)" \
ADMIN_EMAIL="admin@localhost.test" \
ADMIN_PASSWORD="development-password" \
METRICS_TOKEN="development-metrics-token" \
docker compose up --build
```

Ce Compose utilise volontairement l’adaptateur simulé. Pour piloter le système réel sans exposer des interfaces privilégiées dans un conteneur, utiliser le service systemd et la stack Caddy/frontend décrits dans `../deploy/README.md`.

L'état métier est actuellement fourni par un repository en mémoire, isolé derrière une interface. Les snapshots correspondent exactement au contrat du frontend ; le branchement ultérieur sur PostgreSQL, Docker Engine, systemd ou un NAS ne modifie pas les routes.
