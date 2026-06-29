#!/usr/bin/env bash
set -euo pipefail

ROOT=/srv/homeservermanager-dev
BRANCH=dev

cd "$ROOT"
git fetch origin
git switch "$BRANCH"
git reset --hard "origin/$BRANCH"

cd "$ROOT/backend"
npm ci --no-audit --no-fund
npm run build

cd "$ROOT/frontend"
npm ci --no-audit --no-fund
npm run build

sudo systemctl restart homeservermanager-backend-dev
sudo systemctl restart homeservermanager-frontend-dev

sudo systemctl --no-pager --full status homeservermanager-backend-dev
sudo systemctl --no-pager --full status homeservermanager-frontend-dev
