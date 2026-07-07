# Plan de mise en place du serveur

> Note : ce document est un plan d’architecture historique. Pour l’état réel du backend et les instructions de développement, utiliser en priorité `backend/README.md`, `deploy/README.md` et `docs/OPERATIONS.md`.

Ce document décrit la base serveur à mettre en place pour alimenter le front actuel du homelab.
L’objectif est de garder une architecture simple au départ, mais suffisamment propre pour absorber les
flux temps réel via WebSocket et les futures évolutions sans casser le client.

## 1. Objectif produit

Le front expose déjà les écrans suivants:

- Overview
- Services
- Docker
- NAS
- Terminal
- Tools
- Account
- Settings
- Login

Le serveur doit fournir:

- l’authentification et la session
- les snapshots initiaux pour chaque page
- les mutations de base
- un canal temps réel pour les logs, alertes, métriques, services, terminal et éventuels jobs

Le principe à garder est le suivant:

1. le front charge un snapshot initial via HTTP
2. le front ouvre une connexion WebSocket
3. le serveur pousse ensuite les deltas et événements

## 2. Stack recommandée

### Option cible

- Runtime: Node.js 22+ ou 24+
- Framework HTTP: Fastify
- WebSocket: `ws` ou le support natif du framework si le montage est propre
- Validation: Zod
- Auth: cookies de session signés + CSRF pour les mutations sensibles
- Data layer: Prisma si base relationnelle, sinon module repository maison au départ
- Base de données: PostgreSQL
- Cache/queue: Redis si on veut du pub/sub multi-instance ou des jobs en arrière-plan
- Logs: pino
- Tests: Vitest + Supertest

### Pourquoi cette stack

- Fastify est léger, rapide, et simple à découper en routes + plugins
- Zod permet de verrouiller les contrats sans multiplier les types implicites
- PostgreSQL couvre les états persistés du dashboard
- Redis devient utile dès qu’on a plusieurs producteurs d’événements ou plusieurs instances du serveur

## 3. Architecture serveur

### Découpage conseillé

- `apps/api` pour l’API HTTP et WebSocket
- `packages/shared` pour les schémas, types et constantes communes
- `packages/domain` pour les règles métier si la logique grossit
- `infra/` pour docker-compose, reverse proxy, monitoring

### Couche logique

1. `routes`
   - expose HTTP et WebSocket
2. `services`
   - contient les règles métier
3. `repositories`
   - parle à la base de données, au système, ou à des providers externes
4. `events`
   - normalise les événements envoyés au front
5. `auth`
   - gère login, session, refresh, logout, permissions

### Règle importante

Le front ne doit jamais dépendre de détails internes du serveur.
Le serveur expose des snapshots stables et des événements typés, pas des objets de base de données bruts.

## 4. Modèle fonctionnel attendu

### Overview

Doit fournir:

- nom de l’hôte
- uptime
- métriques CPU, mémoire, réseau
- liste des disques
- alertes récentes
- derniers logs agrégés

### Services

Doit fournir:

- liste des services
- statut courant
- description
- localisation
- logs par service

### Docker

Doit fournir:

- conteneurs
- images
- volumes
- lien entre conteneur, image et volume

### NAS

Doit fournir:

- capacité utilisée
- santé globale
- état des pools
- température
- état des disques
- backups récents

### Terminal

Doit fournir:

- sessions de terminal
- prompt courant
- historique de lignes
- commandes rapides
- streaming de sortie ligne par ligne

### Tools

Doit fournir:

- raccourcis d’actions
- jobs récents

### Account

Doit fournir:

- profil
- fournisseurs connectés
- clés SSH
- sessions actives

### Settings

Doit fournir:

- thème
- densité d’interface
- alertes activées
- sidebar compacte

## 5. Endpoints HTTP

### Auth

- `GET /session`
  - retourne la session courante
- `POST /session`
  - login avec provider ou identifiants
- `DELETE /session`
  - logout

### Snapshots

- `GET /overview`
- `GET /services`
- `GET /docker`
- `GET /nas`
- `GET /tools`
- `GET /terminal`
- `GET /account`
- `GET /settings`

### Mutations

- `PATCH /settings`
  - met à jour les réglages utilisateur
- `POST /services/:id/start`
- `POST /services/:id/stop`
- `POST /services/:id/restart`
- `POST /docker/containers/:id/start`
- `POST /docker/containers/:id/stop`
- `POST /docker/containers/:id/restart`
- `POST /docker/images/:id/pull`
- `POST /docker/images/:id/run`
- `POST /nas/scrub`
- `POST /terminal/execute`
- `POST /tools/:id/run`

### Règle d’API

Le serveur doit renvoyer des réponses simples et cohérentes:

- `200` pour les lectures et opérations réussies
- `201` pour les créations
- `204` pour les actions sans payload utile
- `400` pour les données invalides
- `401` pour l’auth
- `403` pour les permissions
- `404` pour les ressources inconnues
- `409` pour les conflits d’état
- `500` pour les erreurs inattendues

## 6. WebSocket

### Rôle du socket

Le WebSocket sert à pousser:

- logs
- alertes
- métriques
- statut de services
- état Docker
- état NAS
- sorties terminal
- événements de job
- état de connexion/session

### Connexion

- `WS /live`
  - canal unique conseillé au début
  - le front reçoit un snapshot initial puis des événements

### Stratégie de flux

Le socket doit envoyer deux sortes de messages:

1. `bundle.synced`
   - snapshot initial ou resynchronisation
2. événements unitaires
   - patchs fins sur un service, une ligne de log, une métrique, etc.

### Événements recommandés

- `session.updated`
- `overview.updated`
- `services.updated`
- `service.updated`
- `service.removed`
- `service.log.appended`
- `docker.updated`
- `nas.updated`
- `tools.updated`
- `account.updated`
- `settings.updated`
- `terminal.updated`
- `terminal.line.appended`
- `terminal.session.updated`
- `terminal.session.removed`
- `connection.status`

### Commandes entrantes

- `terminal.execute`
- `refresh.request`

Le serveur peut aussi accepter plus tard:

- `service.action`
- `docker.action`
- `nas.action`
- `tool.run`

## 7. Authentification et autorisation

### Auth recommandée

Pour ce type de dashboard, le plus robuste est:

- cookie de session signé
- CSRF sur les mutations
- refresh de session si nécessaire
- rôles simples au départ

### Rôles

Minimum:

- `admin`
- `viewer`

### Règles

- les lectures de snapshot peuvent être publiques derrière une session valide
- les mutations sont réservées à `admin`
- le terminal et les actions système doivent être protégés strictement

### Providers

Le front supporte déjà:

- Google
- GitHub
- mot de passe

Le serveur peut implémenter:

- login local en premier
- OAuth ensuite
- abstraction `AuthProvider` commune pour le front

## 8. Données persistées

### À stocker en base

- utilisateurs
- sessions
- préférences utilisateur
- clés SSH
- historique des actions
- jobs
- mappage des services
- métadonnées NAS
- état des outils

### À ne pas stocker au début

- les métriques brutes très fréquentes
- le flux complet du terminal
- les logs système lourds

Ces éléments peuvent rester en mémoire courte durée, dans un index temps réel, ou dans un système de logs dédié.

## 9. Contrats de données

### Recommandation

Mettre les schémas partagés dans un package commun:

- `OverviewSnapshot`
- `ServiceRecord`
- `DockerSnapshot`
- `NasSnapshot`
- `ToolsSnapshot`
- `TerminalSnapshot`
- `AccountProfile`
- `SettingsState`
- `AuthSession`

### Principe

Le front et le serveur doivent partager les mêmes formes de données.
Les noms de champ doivent rester stables.

### Évolution

Si un champ doit changer, versionner le message ou ajouter un champ nouveau sans casser l’ancien.

## 10. Observabilité

### Logs

- logs structurés JSON
- correlation id par requête
- trace des actions critiques

### Métriques serveur

- nombre de connexions WebSocket
- nombre de messages par seconde
- latence des endpoints
- taux d’erreur auth
- durée des jobs

### Santé

- `GET /health`
- `GET /ready`

### Audit

- journal des actions utilisateur
- journal des actions système
- conservation limitée mais exploitable

## 11. Sécurité

### À prévoir

- validation stricte de toutes les entrées
- limitation de débit sur login et WebSocket
- vérification des droits sur chaque mutation
- protection CSRF sur les routes sensibles
- séparation claire entre lecture et action
- fermeture des commandes terminal non autorisées

### Terminal

Le terminal ne doit pas exécuter des commandes arbitraires sans garde-fou.
Il faut au minimum:

- allowlist de commandes
- paramètres validés
- timeout d’exécution
- taille max de sortie

## 12. Plan d’implémentation

### Phase 1

- mettre en place Fastify
- créer les schémas partagés
- exposer les endpoints snapshot
- exposer `/session`
- brancher `GET /settings`

### Phase 2

- ajouter WebSocket `/live`
- pousser le snapshot initial
- pousser les updates de services, overview, NAS, Docker, tools

### Phase 3

- brancher le terminal temps réel
- brancher les actions de services
- brancher les actions Docker
- brancher le scrub NAS

### Phase 4

- persistance PostgreSQL
- authentification complète
- audit trail
- jobs en arrière-plan
- multi-instance via Redis pub/sub

## 13. Déploiement

### Local

- `docker-compose` pour API + PostgreSQL + Redis
- reverse proxy optionnel
- variables `.env`

### Production

- API derrière un proxy TLS
- WebSocket en WSS
- cookies sécurisés
- rotation des secrets
- sauvegarde base de données

## 14. Variables d’environnement

- `PORT`
- `NODE_ENV`
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `CSRF_SECRET`
- `JWT_SECRET` si JWT utilisé plus tard
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `VITE_API_BASE_URL` côté front
- `VITE_WS_URL` côté front

## 15. Critères de qualité

Le serveur est prêt quand:

- le front charge sans mock
- l’auth fonctionne
- les snapshots sont cohérents
- le WebSocket pousse des updates réelles
- le terminal reçoit des lignes en live
- les mutations renvoient un état immédiatement réconciliable
- les logs d’audit existent pour les actions sensibles

## 16. Priorités concrètes pour commencer

1. figer le contrat des snapshots
2. implémenter `/session`, `/overview`, `/services`, `/docker`, `/nas`, `/tools`, `/account`, `/settings`
3. ajouter `/live`
4. brancher la synchronisation initiale
5. faire passer les logs et services en temps réel
6. brancher le terminal
7. sécuriser les actions d’administration
