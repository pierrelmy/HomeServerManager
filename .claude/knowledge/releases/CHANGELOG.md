# Changelog

## Unreleased (dev branch)

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
