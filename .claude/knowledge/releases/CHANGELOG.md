# Changelog

## v1.1 — Production hardening (merged to main 2026-07-07)

### Security / Reliability
- Cookie et Authorization header redactés des logs pino (session tokens plus jamais visibles en clair dans journald)
- Rate limiting global 100 req/min + overrides par endpoint (auth 10/min, terminal 10 cmd/session)
- Resource limits Docker : frontend 0.5 CPU / 128 MB, Caddy 0.5 CPU / 128 MB, Prometheus 1 CPU / 512 MB
- Deploy workflow : skip gracieux si `PRODUCTION_HOST` est absent ou PLACEHOLDER

### Frontend
- Code splitting Vite : chunks séparés `vendor` (React + router) et `icons` (@tabler/icons-react)
- Source maps désactivées en build de production

### Tests
- 23 tests backend (vitest) — ajout test de structure des erreurs HTTP ({error, message, requestId})
- 5 fichiers E2E Playwright : auth, dashboard, navigation, services, terminal (récriture complète pour correspondre à l'UI réelle)

### Documentation
- `SECURITY.md` : liste des secrets GitHub critiques, contraintes NoNewPrivileges/ProtectSystem, stockage chiffré des backups
- `docs/OPERATIONS.md` : section backup automatisé (timer systemd, vérification, déclenchement manuel)
- `backend/README.md` : rate limiting, commandes simulées vs local, LOG_LEVEL, METRICS_INTERVAL_MS, POST /terminal/sessions/:id/clear
- `.claude/knowledge/architecture/backend.md` : rate limiting, terminal/clear route, audit route, log redaction

## v1.0 — Initial release (PR #14 → main, 2026-07-07)

### Features
- Terminal session clear persisté via API (`POST /terminal/sessions/:id/clear`) — admin-only, audité, broadcast WebSocket
- Backup SQLite automatisé : script `deploy/backup-sqlite.sh` + systemd timer quotidien (02h00, 7 derniers backups conservés)
- `docs/SECRET_ROTATION.md` : runbook de rotation pour SESSION_SECRET, ADMIN_PASSWORD, METRICS_TOKEN
- `CLAUDE.md` + `.claude/agents/` (7 agents) + `.claude/knowledge/` (standards, architecture, 6 ADRs)
- GitHub Actions workflows : SHA-pinned (supply chain security)
- Corrections CI : react-hooks/purity, react-hooks/set-state-in-effect, TS2345, unused-vars
- Terminal page: fix permissions errors, scroll behaviour, grid layout
- Update script (`update-hsm`): fix Ubuntu permissions error

## Initial release (main — commit b6222cf)

### Features

- Dashboard with overview, services, Docker, NAS, tools, terminal, account, settings pages
- Password-based authentication with signed cookie sessions
- Admin / viewer role separation
- Real-time updates via WebSocket `/live` with full bundle on connect and granular events on change
- Systemd service management (start / stop / restart, log streaming)
- Docker container, image, and volume management
- NAS pool health, drive status, backup summary, scrub trigger
- Allowlisted tool execution (update-hsm)
- Sandboxed terminal command execution via WebSocket
- Persistent audit trail
- User settings (theme, density, alerts, sidebar)
- `/health`, `/ready`, `/metrics` (Prometheus-compatible) endpoints

### Infrastructure

- Fastify 5 backend, React 19 + Vite frontend
- SQLite persistence via Node.js built-in `node:sqlite`
- `SimulationSystemAdapter` for dev/CI, `LocalSystemAdapter` for production
- Caddy reverse proxy with TLS
- Docker Compose production stack
- systemd unit with restricted user
- `sudoers` allowlist for system commands
- GitHub Actions: CI, CodeQL, GHCR image publish, manual deploy to protected `production` environment
- Prometheus monitoring stack (optional)

### CI status at release

- CI: success
- CodeQL: success
- Publish container images: success
- Dependabot: success
