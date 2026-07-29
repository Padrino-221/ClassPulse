#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# ClassPulse — Deploy/Redeploy Script
# Run this after initial setup or on every code change.
# Usage: bash deploy.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/classpulse"
REPO_URL="https://github.com/Padrino-221/ClassPulse.git"
BRANCH="master"

echo "╔══════════════════════════════════════════════╗"
echo "║  ClassPulse — Deploy to Oracle Cloud         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Clone or pull ──────────────────────────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  echo "[1/6] Cloning repository..."
  sudo rm -rf "$APP_DIR"
  sudo git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  sudo chown -R "$(whoami):$(whoami)" "$APP_DIR"
else
  echo "[1/6] Pulling latest changes..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
fi
cd "$APP_DIR"

# ── 2. Check for .env ────────────────────────────────────────────
echo "[2/6] Checking environment..."
if [ ! -f "$APP_DIR/backend/.env" ]; then
  echo "  ERROR: $APP_DIR/backend/.env not found!"
  echo "  Copy the template and fill in your values:"
  echo "    cp .env.example backend/.env"
  echo "    nano backend/.env"
  exit 1
fi

# ── 3. Install backend dependencies ──────────────────────────────
echo "[3/6] Installing backend dependencies..."
cd "$APP_DIR/backend"
npm ci --omit=dev --silent

# ── 4. Install frontend & build ──────────────────────────────────
echo "[4/6] Building frontend..."
cd "$APP_DIR/frontend"
npm ci --silent

# Set API URL for production (Nginx proxies /api/* to backend)
echo "VITE_API_URL=" > .env
npm run build --silent

# ── 5. Run database migrations ───────────────────────────────────
echo "[5/6] Running database migrations..."
cd "$APP_DIR/backend"
node -e "const {runMigrations} = require('./db/migrate'); runMigrations().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })"

# ── 6. Restart PM2 ───────────────────────────────────────────────
echo "[6/6] Restarting application..."
mkdir -p /var/log/classpulse
pm2 delete classpulse-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# ── Setup Nginx if not already configured ────────────────────────
if [ ! -f /etc/nginx/sites-enabled/classpulse ]; then
  echo ""
  echo "  Setting up Nginx..."
  sudo cp "$APP_DIR/deployment/oracle-cloud/nginx.conf" /etc/nginx/sites-available/classpulse
  sudo ln -sf /etc/nginx/sites-available/classpulse /etc/nginx/sites-enabled/classpulse
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl reload nginx
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Deployment complete!                        ║"
echo "║                                              ║"
echo "║  API:   http://YOUR_IP/api/health            ║"
echo "║  App:   http://YOUR_IP/                      ║"
echo "║                                              ║"
echo "║  Logs:  pm2 logs classpulse-api              ║"
echo "║  Status: pm2 status                          ║"
echo "╚══════════════════════════════════════════════╝"
