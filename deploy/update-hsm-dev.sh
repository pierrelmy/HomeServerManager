#!/usr/bin/env bash
set -euo pipefail

ROOT=/srv/homeservermanager-dev
BRANCH=dev

echo "==> Updating $ROOT on branch $BRANCH"

sudo -u ubuntu bash -lc "
  cd '$ROOT' &&
  git fetch origin &&
  git switch '$BRANCH' &&
  git reset --hard 'origin/$BRANCH'
"

echo "==> Refreshing update script"
install -m 0755 -o root -g root "$ROOT/deploy/update-hsm-dev.sh" /usr/local/bin/update-hsm-dev.sh

echo "==> Backend install/build"
sudo -u ubuntu bash -lc "
  cd '$ROOT/backend' &&
  npm ci --no-audit --no-fund &&
  npm run build
"

echo "==> Frontend install/build"
sudo -u ubuntu bash -lc "
  mkdir -p '$ROOT/frontend/node_modules/.vite-temp' &&
  cd '$ROOT/frontend' &&
  npm ci --no-audit --no-fund &&
  npm run build
"

echo "==> Syncing root-owned helper scripts"
install -m 0755 -o root -g root "$ROOT/deploy/scripts/scan-network.mjs" /usr/local/libexec/homeservermanager/scan-network

echo "==> Syncing sudoers and systemd units"
install -m 0440 -o root -g root "$ROOT/deploy/homelab-sudoers" /etc/sudoers.d/homeservermanager
visudo -cf /etc/sudoers.d/homeservermanager >/dev/null
install -m 0644 -o root -g root "$ROOT/deploy/homelab-backend-dev.service" /etc/systemd/system/homeservermanager-backend-dev.service
install -m 0644 -o root -g root "$ROOT/deploy/homelab-frontend-dev.service" /etc/systemd/system/homeservermanager-frontend-dev.service
systemctl daemon-reload

echo "==> Restarting services"
sudo systemctl restart homeservermanager-backend-dev
sudo systemctl restart homeservermanager-frontend-dev

echo "==> Health checks"
curl --fail --silent http://127.0.0.1:3000/health >/dev/null
curl --fail --silent http://127.0.0.1:3000/ready >/dev/null
curl --fail --silent http://127.0.0.1:4173 >/dev/null

echo "==> Deployed revision"
sudo -u ubuntu bash -lc "cd '$ROOT' && git rev-parse --short HEAD"

sudo systemctl --no-pager --full status homeservermanager-backend-dev
sudo systemctl --no-pager --full status homeservermanager-frontend-dev
