#!/bin/bash
set -e

# Reticulum Web UI — install script
# Works on Debian/Raspberry Pi OS. Run as root after cloning:
#   git clone <repo> && cd <repo> && sudo bash install.sh

PORT=${PORT:-8080}
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
RNS_VERSION="1.1.3"

echo "=== Reticulum Web UI installer ==="
echo "Install dir : $INSTALL_DIR"
echo "Port        : $PORT"
echo

# ── root check ───────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: run this script as root (sudo bash install.sh)" >&2
    exit 1
fi

# ── system packages ──────────────────────────────────────────────────────────
echo "--- Installing system packages ---"
apt-get update -qq
apt-get install -y python3-venv python3-full python3-pip >/dev/null

# Node.js: skip if already installed (nodesource builds bundle npm inside nodejs)
if ! command -v node >/dev/null 2>&1; then
    echo "    installing Node.js..."
    apt-get install -y nodejs npm >/dev/null 2>/dev/null || {
        # Fallback: install via nodesource for older Debian/Raspbian
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
        apt-get install -y nodejs >/dev/null
    }
fi
echo "    node $(node --version), npm $(npm --version)"

# ── rnsd ─────────────────────────────────────────────────────────────────────
if ! command -v rnsd >/dev/null 2>&1; then
    echo "--- Installing Reticulum (rnsd) ---"
    pip3 install --break-system-packages rns==$RNS_VERSION 2>/dev/null \
        || pip3 install rns==$RNS_VERSION
fi
echo "    rnsd $(rnsd --version 2>&1 | head -1)"

# ── rnsd systemd service ─────────────────────────────────────────────────────
if ! systemctl is-active --quiet rnsd 2>/dev/null; then
    echo "--- Setting up rnsd service ---"
    RNSD_BIN="$(command -v rnsd)"
    cat > /etc/systemd/system/rnsd.service << EOF
[Unit]
Description=Reticulum Network Stack Daemon
After=network.target

[Service]
Type=simple
User=root
Environment=HOME=/root
ExecStart=$RNSD_BIN
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable rnsd
    systemctl start rnsd
    sleep 3
    echo "    rnsd started"
else
    echo "--- rnsd already running ---"
fi

# ── python venv for our app ───────────────────────────────────────────────────
echo "--- Setting up Python virtualenv ---"
python3 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/pip" install -q -r "$INSTALL_DIR/backend/requirements.txt"

# ── frontend build ────────────────────────────────────────────────────────────
echo "--- Building frontend ---"
cd "$INSTALL_DIR/frontend"
npm install --silent
npm run build
cd "$INSTALL_DIR"

# ── reticulum-web systemd service ─────────────────────────────────────────────
echo "--- Installing reticulum-web service ---"
cat > /etc/systemd/system/reticulum-web.service << EOF
[Unit]
Description=Reticulum Web UI
After=network.target rnsd.service
Wants=rnsd.service

[Service]
Type=simple
User=root
Environment=HOME=/root
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$INSTALL_DIR/.venv/bin/uvicorn main:app --host 0.0.0.0 --port $PORT
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable reticulum-web
systemctl restart reticulum-web

# ── done ──────────────────────────────────────────────────────────────────────
sleep 3
if systemctl is-active --quiet reticulum-web; then
    IP=$(hostname -I | awk '{print $1}')
    echo
    echo "✓ Done! Reticulum Web UI is running at http://$IP:$PORT"
else
    echo
    echo "✗ Service failed to start. Check logs:"
    echo "  journalctl -u reticulum-web -n 50"
    exit 1
fi
