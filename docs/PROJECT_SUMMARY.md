# HomeServerManager - Synthese Projet

## Vue d'ensemble

HomeServerManager est un monorepo qui fournit un tableau de bord pour superviser et administrer un homelab.

Le projet est compose de :

- un frontend React/Vite
- un backend Fastify
- une persistance SQLite
- un canal temps reel WebSocket
- des integrations systeme controlees pour Docker, `systemd`, le NAS et des outils internes
- une chaine CI/CD GitHub Actions
- un socle de deploiement production avec Caddy, Docker Compose, systemd et monitoring

## Structure du repo

- `frontend/` : application React, mode mock local, tests unitaires et E2E
- `backend/` : API, auth, sessions, audit, SQLite, WebSocket, adaptateurs systeme
- `deploy/` : fichiers de deploiement, Caddy, Compose production, service systemd, `sudoers`, monitoring
- `docs/` : documentation transverse et runbook
- `.github/workflows/` : CI, CodeQL, publication d'images GHCR, deploiement manuel

## Fonctionnalites produit

### Dashboard et snapshots

- vue d'ensemble du homelab
- liste et etat des services
- vue Docker
- vue NAS
- vue outils
- vue terminal
- vue compte
- vue settings

### Authentification et sessions

- connexion par email / mot de passe
- cookie de session signe
- gestion des sessions utilisateur
- changement de mot de passe
- protection admin / lecture

### Administration

- actions sur services `start|stop|restart`
- actions sur conteneurs Docker `start|stop|restart`
- actions sur images Docker `pull|run`
- lancement d'un scrub NAS
- execution de commandes terminal autorisees
- lancement d'outils declares par allowlist

### Temps reel et observabilite

- bootstrap HTTP + synchronisation live via WebSocket `/live`
- endpoints `/health`, `/ready`, `/metrics`
- journal d'audit persistant
- integration Prometheus optionnelle en production

## Architecture technique

### Frontend

- React 19
- Vite
- React Router
- Bootstrap / React-Bootstrap
- Chart.js
- Playwright pour les E2E

Le frontend supporte deux modes :

- mode connecte a l'API via `VITE_API_BASE_URL` et `VITE_WS_URL`
- mode mock automatique si ces variables ne sont pas definies

### Backend

- Fastify 5
- `@fastify/cookie`
- `@fastify/cors`
- `@fastify/rate-limit`
- `@fastify/websocket`
- Zod pour la validation
- SQLite pour la persistance

Le backend supporte deux modes :

- `SYSTEM_ADAPTER=simulation` pour le developpement local
- `SYSTEM_ADAPTER=local` pour l'hote prepare de production

### Persistance

La persistance SQLite couvre :

- snapshots metier
- settings utilisateur
- sessions
- audit trail

## Developpement local

Le projet supporte aujourd'hui trois flux locaux principaux :

1. backend + frontend en local
2. frontend seul en mode mock
3. backend seul via `backend/infra/compose.yaml`

References :

- [README racine](../README.md)
- [README backend](../backend/README.md)
- [README frontend](../frontend/README.md)

## Securite et garde-fous

- session signee par cookie
- checks d'origine pour les mutations
- headers de securite
- rate limiting global et cible sur les routes sensibles
- rate limiting dedie aux commandes terminal WebSocket
- commandes systeme strictement allowlistees
- integration `sudoers` dediee a l'utilisateur de production
- scans GitHub : CodeQL, Secret Scanning, Push Protection, Dependabot
- workflows GitHub Actions epingles par SHA

## CI/CD

### Workflows GitHub

- `CI`
  - lint
  - tests backend
  - tests frontend
  - E2E frontend
  - build backend
  - build frontend
  - build images Docker backend/frontend
- `CodeQL`
- `Publish container images`
- `Deploy production`

### Etat GitHub verifie

Etat verifie sur `main` au commit `b6222cf` :

- `CI` : success
- `CodeQL` : success
- `Publish container images` : success
- `Dependabot Updates` : success

Le workflow `Deploy production` est manuel et a ete durci pour :

- verifier la presence des secrets GitHub `production`
- copier les artefacts backend et les fichiers `deploy/`
- activer la release sur l'hote
- executer un smoke test backend `/health` et `/ready`
- executer un smoke test frontend `/healthz`

## Deploiement production

Le modele cible est le suivant :

- backend sur l'hote, sous utilisateur restreint
- frontend dans un conteneur Nginx
- Caddy en reverse proxy TLS
- Prometheus en option
- service systemd pour l'API

Documentation associee :

- [Guide de deploiement](../deploy/README.md)
- [Runbook d'exploitation](./OPERATIONS.md)

## Avancement reel

### Termine

- authentification par mot de passe
- gestion des sessions
- persistance SQLite
- audit trail
- adaptateur systeme local + simulation
- allowlists systeme
- protections HTTP de base
- rate limiting sur les routes et le terminal live
- healthcheck, readiness, metrics
- Dockerfiles backend/frontend
- stack Compose de production
- Caddyfile
- service systemd
- fichier `sudoers`
- monitoring Prometheus
- CI GitHub
- CodeQL
- publication GHCR
- documentation de dev local
- documentation de deploiement et d'exploitation

### Valide

- checks locaux historiques executes au fil du chantier :
  - `npm run check`
  - `npm run test:e2e`
  - builds Docker backend/frontend
- checks GitHub sur `main` au commit `b6222cf` :
  - `CI`
  - `CodeQL`
  - `Publish container images`

### Bloque a ce jour

Le seul blocage restant pour considerer le projet totalement deploye en production n'est plus dans le code.

Blocage externe actuel :

- l'environnement GitHub `production` ne contient encore aucun secret configure

Secrets requis :

- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_SSH_PRIVATE_KEY`
- `PRODUCTION_SSH_KNOWN_HOSTS`
- `PRODUCTION_GHCR_USERNAME`
- `PRODUCTION_GHCR_TOKEN`

Tant que ces secrets ne sont pas presents et que l'hote cible n'est pas prepare selon `deploy/README.md`, le deploiement GitHub Actions ne peut pas etre lance ni valide reellement.

## Prochaines etapes

1. Configurer les six secrets GitHub de l'environnement `production`
2. Finaliser la preparation de l'hote cible si necessaire
3. Lancer `Deploy production`
4. Verifier les smoke tests de deploiement
5. Effectuer la validation finale post-deploiement

## Documents de reference

- [README racine](../README.md)
- [Backend](../backend/README.md)
- [Frontend](../frontend/README.md)
- [Deploiement production](../deploy/README.md)
- [Runbook d'exploitation](./OPERATIONS.md)
- [Politique de securite](../SECURITY.md)
