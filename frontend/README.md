# HomeServerManager frontend

Application React + Vite du dashboard homelab. Elle consomme l’API Fastify et maintient un état live via `/live`.

## Prérequis

- Node.js 24
- npm

## Démarrage local

Installation :

```bash
npm ci
```

### Mode connecté au backend local

```bash
VITE_API_BASE_URL=http://127.0.0.1:3000 \
VITE_WS_URL=ws://127.0.0.1:3000/live \
npm run dev
```

Le frontend écoute alors sur `http://localhost:5173`.

### Mode VM Ubuntu validé

Pour le workflow `Mac -> git push origin dev -> VM update`, la version validée est :

- build frontend dans la VM avec `.env`
- service systemd `homelab-frontend-dev.service`
- `vite preview` exposé sur `http://192.168.64.6:4173`

Variables utilisées dans la VM :

```dotenv
VITE_API_BASE_URL=http://192.168.64.6:3000
VITE_WS_URL=ws://192.168.64.6:3000/live
```

Le service frontend dev tourne sous l'utilisateur `ubuntu` et n'a le droit d'écrire que dans `node_modules/.vite-temp`.

### Résolution automatique en dev local

Si `VITE_API_BASE_URL` et `VITE_WS_URL` ne sont pas définies :

- sur `127.0.0.1:5173` ou `127.0.0.1:4173`, le frontend cible automatiquement `127.0.0.1:3000`
- sur une origine non standard, il réutilise l’origine courante pour l’API et `/live` pour le WebSocket

Le frontend ne bascule plus automatiquement sur des données mock.

## Variables d’environnement

- `VITE_API_BASE_URL`
  - exemple local : `http://127.0.0.1:3000`
  - en production conteneurisée, l’image est buildée avec `/api`
- `VITE_WS_URL`
  - exemple local : `ws://127.0.0.1:3000/live`
  - en production conteneurisée, l’image est buildée avec `/live`
- `VITE_ALLOW_MOCKS`
  - réservé aux tests et au développement explicitement demandé
  - exemple : `VITE_ALLOW_MOCKS=true npm run dev`

Si `VITE_WS_URL` commence par `/`, le frontend reconstruit automatiquement une URL `ws://` ou `wss://` à partir de l’origine courante.

## Flux local recommandé

1. Démarrer le backend en `SYSTEM_ADAPTER=simulation`
2. Lancer le frontend avec `VITE_API_BASE_URL` et `VITE_WS_URL`
3. Se connecter avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`

## Tests

### Unitaires

```bash
npm test
```

### End-to-end

Installer Chromium si nécessaire :

```bash
npx playwright install --with-deps chromium
```

Puis lancer :

```bash
npm run test:e2e
```

Le setup Playwright démarre automatiquement un serveur Vite sur `http://127.0.0.1:4173`.

Important :

- les E2E activent explicitement `VITE_ALLOW_MOCKS=true`
- ils ne valident pas un backend réel

## Scripts npm

```bash
npm run dev
npm run lint
npm test
npm run test:watch
npm run build
npm run preview
npm run test:e2e
```

## Build et runtime

Le build de production est généré par Vite puis servi par Nginx.

Points utiles :

- `frontend/Dockerfile` injecte `VITE_API_BASE_URL` et `VITE_WS_URL` au build
- `frontend/nginx.conf` expose `/healthz`
- les assets statiques sont servis avec cache longue durée

## Références

- [README racine](../README.md)
- [Backend](../backend/README.md)
- [Déploiement production](../deploy/README.md)
