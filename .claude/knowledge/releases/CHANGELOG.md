# Changelog

## Unreleased (dev branch — PR #14 pending merge to main)

### Features
- Terminal session clear persisté via API (`POST /terminal/sessions/:id/clear`) — admin-only, audité, broadcast WebSocket
- Backup SQLite automatisé : script `deploy/backup-sqlite.sh` + systemd timer quotidien (02h00, 7 derniers backups conservés)

### Tests
- 28 tests E2E Playwright ajoutés : auth, navigation (7 pages), terminal, services

### Documentation
- `docs/SECRET_ROTATION.md` : runbook de rotation pour SESSION_SECRET, ADMIN_PASSWORD, METRICS_TOKEN
- `CLAUDE.md` + `.claude/agents/` (7 agents) + `.claude/knowledge/` (standards, architecture, 6 ADRs)

### CI / Infrastructure
- GitHub Actions workflows : SHA-pinned (supply chain security, depuis main)
- Merge dev ↔ main : divergence de 64 commits résolue
- Corrections CI : react-hooks/purity, react-hooks/set-state-in-effect, TS2345, unused-vars

### Fixes précédents (sur dev)
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
