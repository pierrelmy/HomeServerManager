# HomeServerManager — Pitch technique

> Préparé pour une présentation devant une audience technique. Basé sur l'état réel du dépôt (branche `main`) au 2026-07-31, croisé avec un graphe de connaissances généré du code (880 nœuds / 1795 arêtes, 58 communautés).

---

## 1. Le pitch en une phrase

**HomeServerManager est un dashboard auto-hébergé (React + Fastify) qui centralise l'administration d'un homelab — services systemd, conteneurs Docker, NAS, terminal — avec du temps réel via WebSocket, une architecture en ports/adapters qui permet de développer sans jamais toucher à la machine réelle, et un socle CI/CD + observabilité prêt pour la prod.**

---

## 2. Le problème

Administrer un homelab (serveur perso qui héberge des services : media server, NAS, VMs, outils divers) veut souvent dire :
- SSH + `systemctl status` / `docker ps` en boucle
- Pas de vue d'ensemble unifiée (état des services, santé du NAS, métriques)
- Pas d'audit de qui a fait quoi
- Pas de garde-fous : un mauvais `rm` ou une commande mal tapée en SSH root

HomeServerManager remplace ça par une interface web unique, avec authentification, journal d'audit, et une exécution des commandes système strictement encadrée par des allowlists.

---

## 3. Architecture générale

```
frontend/   React 19 + Vite — HTTP (REST) + WebSocket (live)
backend/    Fastify 5 + SQLite — routes, sessions signées, audit, EventHub
deploy/     Caddy, systemd, Docker Compose, backup SQLite, scripts
docs/       Runbook d'exploitation, rotation des secrets
```

Point clé d'architecture : **le backend tourne sur l'hôte** (pas conteneurisé), car il a besoin d'un accès direct à Docker, systemd et au NAS. **Le frontend et Caddy, eux, sont conteneurisés.** C'est une décision assumée et documentée (voir §6), pas un oubli.

### Flux temps réel

Le canal WebSocket `/live` :
1. envoie un **bundle complet** à la connexion (snapshot de tout l'état)
2. puis des **événements granulaires** à chaque mutation (`EventHub` broadcast)

→ pas de polling. Le nœud le plus central du graphe (le "god node" `backend`, degré 50) est justement ce point de convergence entre HTTP, WebSocket, SQLite et les adaptateurs système.

---

## 4. Stack technique (versions réelles du repo)

| Couche | Techno | Version |
|---|---|---|
| Frontend | React | 19.2.6 |
| Frontend | Vite | 8.1.3 |
| Frontend | React Router | 7.18.1 |
| Frontend | Tailwind CSS | 4.3.2 |
| Frontend | Chart.js / react-chartjs-2 | 4.5.1 / 5.3.1 |
| Frontend | Tests | Vitest + Testing Library + Playwright (E2E) |
| Backend | Fastify | 5.10.0 |
| Backend | Validation | Zod 4.3.6 |
| Backend | Plugins | `@fastify/cookie`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/websocket` |
| Backend | Persistance | SQLite (via `SqliteHomelabRepository`, driver custom, pas d'ORM) |
| Backend | Runtime | Node.js ≥ 24 (package.json indique `>=22` mais README/CI ciblent 24) |
| Déploiement | Caddy (reverse proxy TLS), Docker Compose, systemd, Nginx (frontend) | — |
| Observabilité | Prometheus + Alertmanager (profil optionnel) | — |
| CI/CD | GitHub Actions : CI, CodeQL, release-please, publication GHCR, déploiement SSH manuel | — |

**⚠️ Point à clarifier avant la présentation :** `docs/PROJECT_SUMMARY.md` mentionne encore "Bootstrap / React-Bootstrap" dans la stack frontend, mais `frontend/package.json` n'a plus cette dépendance — le frontend est en réalité sur **Tailwind CSS v4**. C'est un résidu de doc pas mis à jour, à corriger si on vous pose la question.

---

## 5. Les modules fonctionnels

| Module | Capacités |
|---|---|
| **Services** | start / stop / restart d'unités systemd, logs |
| **Docker** | conteneurs, images, volumes |
| **NAS** | santé des pools, températures, backups, scrub |
| **Terminal** | shell interactif via WebSocket, historique persisté |
| **Live** | updates temps réel sans polling (EventHub) |
| **Audit** | journal chronologique de toutes les mutations admin |
| **Métriques** | `/metrics` compatible Prometheus |

---

## 6. Décisions d'architecture qui méritent d'être défendues

Ce sont les points où une audience technique va creuser. Préparez-vous à les justifier.

### 6.1 Backend sur l'hôte, pas conteneurisé
**Pourquoi :** le backend doit piloter Docker, systemd et le NAS directement. Le conteneuriser forcerait à exposer le socket Docker, à donner des capacités élevées au conteneur, et à gérer systemd depuis l'intérieur d'un conteneur (fragile, anti-pattern). Le compromis choisi : hôte + utilisateur système restreint + `sudoers` avec allowlist stricte.
**Contre-argument attendu :** "ça casse l'homogénéité conteneurs partout". Réponse : le frontend et le proxy, eux, sont conteneurisés — seul le composant qui a besoin d'un accès système direct sort du conteneur.

### 6.2 Deux implémentations du System Adapter : `local` vs `simulation`
Le code a une interface `SystemAdapter` avec (au moins) deux implémentations concrètes : `LocalSystemAdapter` (exécute vraiment des commandes systemd/Docker/NAS) et `SimulationSystemAdapter` (retourne des snapshots réalistes sans toucher au système). C'est un vrai pattern **ports & adapters (hexagonal)** appliqué à l'intégration système, pas juste au niveau data.
**Pourquoi c'est fort :** ça permet de développer et tester toute la UI/logique métier sans jamais risquer de casser une vraie machine. `SYSTEM_ADAPTER=simulation` est le mode recommandé en local.

### 6.3 Trois modes de dev, un seul frontend
1. Backend + frontend connectés (`SYSTEM_ADAPTER=simulation`)
2. **Frontend seul, mode mock** — s'active automatiquement si `VITE_API_BASE_URL`/`VITE_WS_URL` sont absentes ; repositories mockés côté client
3. Backend conteneurisé via `backend/infra/compose.yaml`

Le repository frontend suit le même pattern hexagonal côté client : `HomelabRepository` (interface) → implémentations `HttpHomelabRepository`, `MockHomelabRepository`. Le graphe montre bien deux communautés séparées et cohérentes pour ça.

### 6.4 Exécution système strictement allowlistée — mais avec un flux qui déroge à la règle
Les commandes système (`TOOL_COMMANDS`, `NAS_SCRUB_COMMAND`, `SYSTEM_SERVICE_MAP`) passent par des allowlists explicites en config + `sudoers`. **Mais** le flux `POST /services` avec `installCommand` exécute directement `sudo -n /bin/bash -lc ...` — un accès root large, documenté comme un compromis assumé dans `SECURITY.md` et `backend/README.md`. Ça implique que l'unité systemd du backend **ne peut pas** utiliser `NoNewPrivileges=true` ni `ProtectSystem=strict` en prod.
**C'est LA question de sécurité à anticiper** : "pourquoi donner un accès root aussi large ?" Réponse honnête : c'est un trade-off explicite pour permettre l'installation de nouveaux services depuis l'UI, documenté et isolé sur un utilisateur système dédié — pas caché.

### 6.5 Sessions cookie signées, pas de JWT
Auth par cookie de session signé (`SESSION_SECRET`), pas de JWT. `secure` activé en `NODE_ENV=production`. Rate limiting global + ciblé sur les routes sensibles + un rate limiting dédié aux commandes terminal WebSocket (surface d'attaque particulière : exécution de commandes).

### 6.6 SQLite, pas de Postgres/ORM — pour l'instant
Persistance SQLite via un repository custom (`SqliteHomelabRepository`), sans ORM. `backend/docs/backend-server-plan.md` évoque Prisma et PostgreSQL/Redis comme **pistes futures**, pas comme décidées. À date, c'est SQLite + repository pattern maison, cohérent avec un déploiement single-host.

---

## 7. Le graphe du projet — ce qu'il révèle

Un knowledge-graph a été extrait du repo (AST du code + extraction sémantique de la doc/config) : **880 nœuds, 1795 arêtes, 58 communautés**.

### God nodes (les points de plus forte connectivité — les vraies colonnes vertébrales)
1. `backend` — degré 50 (Fastify + SQLite, le hub central)
2. `SqliteHomelabRepository` — degré 32
3. `LocalSystemAdapter` — degré 32
4. `HomelabLiveManager` (frontend) — degré 32
5. `HomelabRepository` (backend, interface) — degré 31
6. `useHomelabLiveManager()` (frontend hook) — degré 31
7. `buildApp()` — degré 29
8. `HomelabRepository` (frontend, interface) — degré 29

**Lecture :** le graphe confirme structurellement le pattern ports/adapters décrit en §6.2/6.3 — les deux `HomelabRepository` (backend et frontend) et leurs implémentations concrètes sont bien les points de convergence de chaque côté.

### Connexions "surprenantes" détectées (ponts inter-communautés)
- Frontend ↔ Playwright (couverture E2E, pas juste unitaire)
- Alert `HomeServerManagerDown` (Prometheus/Alertmanager) ↔ Backend — le monitoring est câblé jusqu'au code, pas juste de la doc
- Backend ↔ chaque dépendance Fastify individuellement (cohérence stack)

### Zones à cohésion faible (candidates à un refactor si la question vient)
Les communautés "Frontend Pages & UI" et "Backend Core" ont les scores de cohésion les plus faibles (~0.05–0.07) — attendu pour du code d'assemblage (beaucoup de petits composants/routes qui touchent tous le même hub), pas un signal d'alarme en soi.

---

## 8. Statut réel du projet (pas du marketing)

D'après `docs/PROJECT_SUMMARY.md`, au commit `b6222cf` sur `main` :
- ✅ CI, CodeQL, publication GHCR, Dependabot — tous verts
- ✅ Fonctionnellement complet : auth, sessions, SQLite, audit, adaptateurs local + simulation, allowlists, rate limiting, healthcheck/readiness/metrics, Dockerfiles, stack Compose prod, Caddyfile, service systemd, monitoring Prometheus
- 🔴 **Seul blocage restant : les secrets GitHub de l'environnement `production` ne sont pas encore configurés** (6 secrets : host, user, clé SSH, known_hosts, GHCR user/token). Le déploiement automatisé ne peut donc pas encore être déclenché réellement.

C'est une bonne chose à dire tel quel devant une audience technique : le code est prêt, le blocage est opérationnel/config, pas technique.

---

## 9. Questions techniques probables — préparez vos réponses

| Question probable | Angle de réponse |
|---|---|
| Pourquoi le backend n'est pas conteneurisé ? | §6.1 — accès direct Docker/systemd/NAS, trade-off assumé |
| Comment vous testez sans casser la vraie machine ? | §6.2 — `SimulationSystemAdapter`, mode dev par défaut |
| `sudo -n /bin/bash -lc` pour l'installation de services, c'est pas dangereux ? | §6.4 — oui, assumé, documenté, isolé par utilisateur système + `sudoers` dédié, à peser selon le contexte |
| Pourquoi pas de JWT/OAuth ? | §6.5 — cookie de session signé suffit pour un dashboard mono-tenant self-hosted ; `authProvider`/`role` existent déjà dans les contrats partagés pour évoluer |
| Pourquoi SQLite et pas Postgres ? | §6.6 — cohérent avec un déploiement single-host, Postgres/Redis explorés dans `backend-server-plan.md` comme évolution possible |
| Comment le live fonctionne sans polling ? | §3 — bundle initial + événements granulaires via `EventHub`/WebSocket `/live` |
| Quelle est la couverture de tests ? | Vitest (unit, front + back) + Playwright E2E (auth, dashboard, navigation, services, terminal) + CodeQL (SAST) |
| Comment gérez-vous les secrets ? | Env vars locales, environnement GitHub `production` protégé + reviewer obligatoire, rotation documentée (`docs/SECRET_ROTATION.md`) |
| Le projet est-il déployé en prod aujourd'hui ? | Non — bloqué uniquement sur la configuration des 6 secrets GitHub, tout le reste est prêt (§8) |
| Pourquoi Fastify plutôt qu'Express/Nest ? | Perf, plugin ecosystem officiel (`cookie`, `cors`, `rate-limit`, `websocket`), validation Zod native au niveau route |

---

## 10. Ressources pour aller plus loin

- `README.md` — vue d'ensemble et quickstart
- `docs/PROJECT_SUMMARY.md` — synthèse projet et état d'avancement réel
- `docs/OPERATIONS.md` — runbook (contrôles, backup, restauration, rollback, incidents)
- `deploy/README.md` — procédure de déploiement complète
- `SECURITY.md` — politique de sécurité et compromis documentés
- `backend/docs/backend-server-plan.md` — plan d'évolution backend (auth providers, Prisma/Postgres/Redis envisagés)
- Graphe interactif du code : `graphify-out/graph.html` (généré pour cette prépa)
