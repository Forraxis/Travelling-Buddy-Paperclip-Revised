#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/travelling-buddy"
REPO_URL="git@github.com:Forraxis/Travelling-Buddy-Paperclip-Revised.git"
BRANCH="${DEPLOY_BRANCH:-develop}"
LOG_FILE="/var/log/travelling-buddy/deploy.log"

log() { echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*" | tee -a "$LOG_FILE"; }

cd "$APP_DIR"

if [ ! -d .git ]; then
  log "Initial clone from $REPO_URL"
  git clone --branch "$BRANCH" "$REPO_URL" .
fi

git fetch origin "$BRANCH" --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

log "Deploying $BRANCH: ${LOCAL:0:7} → ${REMOTE:0:7}"

git reset --hard "origin/$BRANCH"

npm ci 2>&1 | tail -1 | tee -a "$LOG_FILE"

npx next build 2>&1 | tail -5 | tee -a "$LOG_FILE"

npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE" || log "No migrations to run"

pm2 reload ecosystem.config.cjs --env production 2>/dev/null || \
  pm2 start ecosystem.config.cjs --env production

pm2 save --force 2>/dev/null

sleep 3
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  log "Health check passed"
else
  log "WARNING: Health check failed — app may not be responding on port 3000"
fi

log "Deploy complete: $(git rev-parse --short HEAD)"
