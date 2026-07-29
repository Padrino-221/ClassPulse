#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# ClassPulse — Oracle Cloud Always Free Server Setup
# Run this ONCE after creating your ARM instance.
# Usage: ssh into your instance, then:
#   curl -sL <raw-url-to-this-file> | bash
#   — or —
#   scp this file to the instance and run: bash setup.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

APP_USER="ubuntu"
APP_DIR="/opt/classpulse"
NODE_MAJOR=20

echo "╔══════════════════════════════════════════════╗"
echo "║  ClassPulse — Oracle Cloud Server Setup      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. System updates ──────────────────────────────────────────────
echo "[1/7] Updating system packages..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# ── 2. Install Node.js (via NodeSource) ───────────────────────────
echo "[2/7] Installing Node.js ${NODE_MAJOR}.x..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != "v${NODE_MAJOR}"* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
echo "  Node $(node -v)  |  npm $(npm -v)"

# ── 3. Install Nginx ──────────────────────────────────────────────
echo "[3/7] Installing Nginx..."
sudo apt-get install -y -qq nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ── 4. Install PM2 ────────────────────────────────────────────────
echo "[4/7] Installing PM2 globally..."
sudo npm install -g pm2
# Auto-start PM2 on boot
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | sudo bash -

# ── 5. Install Git ────────────────────────────────────────────────
echo "[5/7] Installing Git..."
sudo apt-get install -y -qq git

# ── 6. Create app directory ──────────────────────────────────────
echo "[6/7] Preparing application directory..."
sudo mkdir -p "$APP_DIR"
sudo chown "$APP_USER:$APP_USER" "$APP_DIR"

# ── 7. Configure firewall ────────────────────────────────────────
echo "[7/7] Configuring UFW firewall..."
sudo ufw allow OpenSSH >/dev/null 2>&1 || true
sudo ufw allow 'Nginx Full' >/dev/null 2>&1 || true
sudo ufw --force enable >/dev/null 2>&1 || true

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Server setup complete!                      ║"
echo "║                                              ║"
echo "║  Next steps:                                 ║"
echo "║  1. Clone your repo into /opt/classpulse     ║"
echo "║  2. Configure .env                           ║"
echo "║  3. Run deploy.sh                            ║"
echo "╚══════════════════════════════════════════════╝"
