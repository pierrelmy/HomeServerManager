# HomeServerManager backend

API Fastify du dashboard homelab. Elle expose :

- les snapshots HTTP consommés par le frontend
- les mutations d’administration
- les sessions signées par cookie
- le journal d’audit
- le canal WebSocket `/live`
- les endpoints d’exploitation `/health`, `/ready` et `/metrics`

## Prérequis

- Node.js 24
- npm

Installation :

```bash
npm ci
```

## Démarrage local

Le backend n’embarque pas de fichier `.env.example` dédié au développement. Pour le local, passez les variables d’environnement directement dans la commande ou via votre shell.

Exemple minimal en mode simulation :

```bash
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

Le serveur écoute alors sur `http://127.0.0.1:3000`.

### Variables utiles pour le frontend

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:3000
VITE_WS_URL=ws://127.0.0.1:3000/live
```

Le frontend envoie les requêtes avec `credentials: "include"`. Si les origines diffèrent, `CORS_ORIGINS` doit inclure l’origine exacte du frontend.

### Auth locale

L’utilisateur administrateur initial correspond à :

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Le cookie de session est signé. En `NODE_ENV=production`, il est aussi marqué `secure`.

## Modes supportés

### `SYSTEM_ADAPTER=simulation`

Mode recommandé en local. Les snapshots sont réalistes mais aucune commande système réelle n’est exécutée.

### `SYSTEM_ADAPTER=local`

Mode réservé à l’hôte de production ou à une machine explicitement préparée. Il permet d’agir sur :

- `systemctl` via une allowlist
- Docker
- les scripts NAS
- les outils déclarés dans `TOOL_COMMANDS`

Exemple pour exposer le script de mise à jour VM dans l’onglet Tools :

```dotenv
TOOL_COMMANDS={"scan-reseau":["/usr/local/libexec/homeservermanager/scan-network"],"update-hsm":["sudo","-n","/bin/bash","/srv/homeservermanager-dev/deploy/update-hsm-dev.sh"]}
```

Le script `update-hsm-dev.sh` publie aussi un état de progression dans `/var/lib/homeservermanager/update-hsm-status.json`, utilisé par le frontend pour afficher un toast de suivi pendant le redéploiement.

Ne pas utiliser ce mode sur une machine de développement standard sans avoir configuré `sudoers`, les scripts et les mappings système.

Le flux d'ajout de service via `POST /services` accepte :

- `serviceUnit` pour l'unité systemd cible
- `servicePath` pour rattacher un service déjà installé
- `installCommand` pour exécuter directement une commande bash d'installation
- `startAfterInstall` pour démarrer le service juste après l'installation

`installCommand` est exécuté via `sudo -n /bin/bash -lc ...`. Cette option donne un pouvoir d'exécution root très large et doit être réservée à un environnement administré.
Dans ce mode, l’unité systemd du backend ne peut pas rester avec `ProtectSystem=strict`, sinon `apt`, `dpkg` et les écritures système nécessaires aux installateurs échoueront.

Pour la VM Ubuntu de validation :

- la mémoire affichée dans `/overview` suit la colonne `used` de `free -h`
- les disques affichés dans `/overview` sont dérivés de `df`
- les scripts système (`scan-network`, `nas-status`) restent installés hors du repo, dans `/usr/local/libexec/homeservermanager/`

## Persistance

Le backend persiste son état dans SQLite via `SqliteHomelabRepository`.

Contenu persistant :

- snapshots métier
- paramètres utilisateur
- sessions
- journal d’audit

En local, vous pouvez utiliser par exemple :

- `DATABASE_PATH=./data/homelab.dev.db`
- `DATABASE_PATH=:memory:` pour certains tests ou essais jetables

## Endpoints principaux

### Session et compte

- `GET /session`
- `POST /session`
- `DELETE /session`
- `GET /account`
- `PATCH /account/password`

### Snapshots

- `GET /overview`
- `GET /services`
- `GET /docker`
- `GET /nas`
- `GET /tools`
- `GET /terminal`
- `GET /settings`

### Administration

- `POST /services`
- `PATCH /settings`
- `POST /services/:id/start|stop|restart`
- `POST /docker/containers/:id/start|stop|restart`
- `POST /docker/images/:id/pull|run`
- `POST /nas/scrub`
- `POST /terminal/execute`
- `POST /terminal/sessions/:id/clear`
- `POST /tools/:id/run`
- `GET /audit`

### Exploitation

- `GET /health`
- `GET /ready`
- `GET /metrics` avec `Authorization: Bearer $METRICS_TOKEN`
- `WS /live`

## Auth et exposition locale

- `READ_AUTH_REQUIRED=false` : mode pratique pour le dev local, les snapshots restent lisibles sans session
- `READ_AUTH_REQUIRED=true` : requis en production

En production, la configuration est validée au démarrage. Les valeurs faibles ou incomplètes sont rejetées, notamment pour :

- `SESSION_SECRET`
- `ADMIN_PASSWORD`
- `CORS_ORIGINS`
- `READ_AUTH_REQUIRED`
- `SYSTEM_ADAPTER`
- `SYSTEM_SERVICE_MAP`
- `NAS_SCRUB_COMMAND`
- `NAS_STATUS_COMMAND`
- `METRICS_TOKEN`

Variables optionnelles avec valeur par défaut :

- `LOG_LEVEL` (défaut : `"info"`) — niveau de log pino (`"silent"` en test)
- `METRICS_INTERVAL_MS` (défaut : `5000`) — fréquence de collecte des métriques internes

## Rate limiting

- Global : 100 req/min par IP
- `POST /session` : 10 req/min (protection bruteforce)
- `POST /terminal/execute` : 10 commandes/min par session (fenêtre glissante côté WebSocket)
- Actions d’administration (start/stop/restart, nas/scrub, etc.) : 5–20 req/min selon l’endpoint

Les en-têtes `cookie` et `authorization` sont systématiquement **redactés** des logs (pino `redact`) afin que les tokens de session n’apparaissent jamais dans les sorties de journaux.

## Commandes simulées

En `SYSTEM_ADAPTER=simulation`, l’adaptateur retourne des réponses prédéfinies pour certaines commandes (`uptime`, `docker ps`, `df -h`, `journalctl -p err -n 5`) et une réponse générique pour toutes les autres. En `SYSTEM_ADAPTER=local`, le terminal exécute les commandes shell réelles sur l’hôte sans restriction côté API.

## Scripts npm

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:watch
npm run build
```

## Vérification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Conteneur de développement

Le dossier `backend/infra/` contient une stack Docker locale pour lancer l’API en mode simulation :

```bash
cd infra
SESSION_SECRET="$(openssl rand -hex 32)" \
ADMIN_EMAIL="admin@localhost.test" \
ADMIN_PASSWORD="development-password" \
METRICS_TOKEN="development-metrics-token" \
docker compose up --build
```

Ce Compose :

- force `SYSTEM_ADAPTER=simulation`
- persiste SQLite dans un volume Docker
- expose `http://localhost:3000`
- vérifie la readiness via `/ready`

## Références

- [Guide de déploiement production](../deploy/README.md)
- [Runbook d’exploitation](../docs/OPERATIONS.md)
