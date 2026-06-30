#!/usr/bin/env bash
set -euo pipefail

ROOT=/srv/homeservermanager-dev
BRANCH=dev

if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_BLUE=$'\033[34m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
  C_GRAY=$'\033[90m'
else
  C_RESET=''
  C_BOLD=''
  C_BLUE=''
  C_GREEN=''
  C_YELLOW=''
  C_RED=''
  C_GRAY=''
fi

step() {
  printf '%s\n' "${C_BLUE}${C_BOLD}==>${C_RESET} ${C_BOLD}$*${C_RESET}"
}

info() {
  printf '%s\n' "${C_GREEN}•${C_RESET} $*"
}

warn() {
  printf '%s\n' "${C_YELLOW}WARNING:${C_RESET} $*" >&2
}

gray_stream() {
  while IFS= read -r line; do
    printf '%s%s%s\n' "$C_GRAY" "$line" "$C_RESET"
  done
}

run_gray() {
  "$@" 2>&1 | gray_stream
}

check_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-15}"
  local delay="${4:-1}"
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --fail --silent "$url" >/dev/null; then
      info "$label OK"
      return 0
    fi
    sleep "$delay"
  done

  printf '%s\n' "${C_RED}ERROR:${C_RESET} $label failed after ${attempts} attempts: $url" >&2
  return 1
}

show_service_status() {
  step "Service status (failure context)"
  run_gray sudo systemctl --no-pager --full status homeservermanager-backend-dev || true
  run_gray sudo systemctl --no-pager --full status homeservermanager-frontend-dev || true
}

trap 'printf "%s\n" "${C_RED}ERROR:${C_RESET} update-hsm-dev.sh failed at line ${LINENO}.${C_RESET}" >&2' ERR

step "Updating $ROOT on branch $BRANCH"

run_gray sudo -u ubuntu bash -lc "
  cd '$ROOT' &&
  git fetch origin &&
  git switch '$BRANCH' &&
  git reset --hard 'origin/$BRANCH'
"

step "Refreshing update script"
install -m 0755 -o root -g root "$ROOT/deploy/update-hsm-dev.sh" /usr/local/bin/update-hsm-dev.sh

step "Backend install/build"
run_gray sudo -u ubuntu bash -lc "
  cd '$ROOT/backend' &&
  npm ci --no-audit --no-fund &&
  npm run build
"

step "Frontend install/build"
run_gray sudo -u ubuntu bash -lc "
  mkdir -p '$ROOT/frontend/node_modules/.vite-temp' &&
  cd '$ROOT/frontend' &&
  npm ci --no-audit --no-fund &&
  npm run build
"

step "Syncing root-owned helper scripts"
install -m 0755 -o root -g root "$ROOT/deploy/scripts/scan-network.mjs" /usr/local/libexec/homeservermanager/scan-network

step "Syncing sudoers and systemd units"
install -m 0440 -o root -g root "$ROOT/deploy/homelab-sudoers" /etc/sudoers.d/homeservermanager
visudo -cf /etc/sudoers.d/homeservermanager >/dev/null
install -m 0644 -o root -g root "$ROOT/deploy/homelab-backend-dev.service" /etc/systemd/system/homeservermanager-backend-dev.service
install -m 0644 -o root -g root "$ROOT/deploy/homelab-frontend-dev.service" /etc/systemd/system/homeservermanager-frontend-dev.service
systemctl daemon-reload

step "Restarting services"
sudo systemctl restart homeservermanager-backend-dev
sudo systemctl restart homeservermanager-frontend-dev

step "Health checks"
check_url http://127.0.0.1:3000/health "Backend health" || { show_service_status; exit 1; }
check_url http://127.0.0.1:3000/ready "Backend readiness" || { show_service_status; exit 1; }
check_url http://127.0.0.1:4173 "Frontend preview" || { show_service_status; exit 1; }

step "Deployed revision"
REVISION=$(sudo -u ubuntu bash -lc "cd '$ROOT' && git rev-parse --short HEAD")
info "$REVISION"

step "Service status"
run_gray sudo systemctl --no-pager --full status homeservermanager-backend-dev
run_gray sudo systemctl --no-pager --full status homeservermanager-frontend-dev

info "Update completed successfully"
