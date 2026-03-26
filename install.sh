#!/bin/bash
set -e

# Reticulum Web UI — install script
# Works on Debian/Raspberry Pi OS. Run as root after cloning:
#   git clone <repo> && cd <repo> && sudo bash install.sh

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
RNS_VERSION="1.1.3"
RNS_USER="reticulum"
RNS_HOME="/var/lib/$RNS_USER"

echo "=== Reticulum Web UI installer ==="
echo

# ── root check ───────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: run this script as root (sudo bash install.sh)" >&2
    exit 1
fi

# ── interactive config ────────────────────────────────────────────────────────
DEFAULT_NAME="$(hostname -s)"
DEFAULT_PORT="8080"

read -rp "Instance name [$DEFAULT_NAME]: " INSTANCE_NAME
INSTANCE_NAME="${INSTANCE_NAME:-$DEFAULT_NAME}"

read -rp "Web UI port   [$DEFAULT_PORT]: " PORT
PORT="${PORT:-$DEFAULT_PORT}"

echo
echo "Install dir : $INSTALL_DIR"
echo "Instance    : $INSTANCE_NAME"
echo "Port        : $PORT"
echo "Service user: $RNS_USER"
echo
read -rp "Continue? [Y/n]: " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn] ]]; then exit 0; fi
echo

# ── system packages ──────────────────────────────────────────────────────────
echo "--- Installing system packages ---"
apt-get update -qq
apt-get install -y python3-venv python3-full python3-pip >/dev/null

# Node.js: skip if already installed (nodesource nodejs bundles its own npm)
if ! command -v node >/dev/null 2>&1; then
    echo "    installing Node.js..."
    apt-get install -y nodejs npm >/dev/null 2>/dev/null || {
        # Fallback: nodesource for older Debian/Raspbian
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
        apt-get install -y nodejs >/dev/null
    }
fi
echo "    node $(node --version), npm $(npm --version)"

# ── reticulum system user ─────────────────────────────────────────────────────
echo "--- Setting up '$RNS_USER' system user ---"
if ! id "$RNS_USER" >/dev/null 2>&1; then
    useradd --system --no-create-home --home-dir "$RNS_HOME" \
            --shell /usr/sbin/nologin "$RNS_USER"
fi
mkdir -p "$RNS_HOME"
chown "$RNS_USER:$RNS_USER" "$RNS_HOME"
# Add to dialout so RNode serial interfaces work
usermod -aG dialout "$RNS_USER" 2>/dev/null || true

# ── rnsd ─────────────────────────────────────────────────────────────────────
if ! command -v rnsd >/dev/null 2>&1; then
    echo "--- Installing Reticulum (rnsd) ---"
    pip3 install --break-system-packages "rns==$RNS_VERSION" 2>/dev/null \
        || pip3 install "rns==$RNS_VERSION"
fi
echo "    rnsd $(rnsd --version 2>&1 | head -1)"

# ── RNS config ────────────────────────────────────────────────────────────────
RNS_CONFIG_DIR="$RNS_HOME/.reticulum"
RNS_CONFIG="$RNS_CONFIG_DIR/config"
if [ ! -f "$RNS_CONFIG" ]; then
    echo "--- Creating Reticulum config ---"
    mkdir -p "$RNS_CONFIG_DIR"
    cat > "$RNS_CONFIG" << EOF
[reticulum]
  enable_transport = True
  share_instance = Yes
  instance_name = $INSTANCE_NAME

[logging]
  loglevel = 4

[interfaces]

[[Default Interface]]
  type = AutoInterface
  interface_enabled = True
EOF
    chown -R "$RNS_USER:$RNS_USER" "$RNS_CONFIG_DIR"
    echo "    created $RNS_CONFIG"
else
    # Update instance_name in existing config
    if grep -q "instance_name" "$RNS_CONFIG"; then
        sed -i "s/^\s*instance_name\s*=.*/  instance_name = $INSTANCE_NAME/" "$RNS_CONFIG"
    else
        sed -i "/^\[reticulum\]/a\\  instance_name = $INSTANCE_NAME" "$RNS_CONFIG"
    fi
    echo "    updated instance_name in $RNS_CONFIG"
fi

# ── rnsd systemd service ──────────────────────────────────────────────────────
echo "--- Setting up rnsd service ---"
RNSD_BIN="$(command -v rnsd)"
cat > /etc/systemd/system/rnsd.service << EOF
[Unit]
Description=Reticulum Network Stack Daemon
After=network.target

[Service]
Type=simple
User=$RNS_USER
Group=$RNS_USER
Environment=HOME=$RNS_HOME
ExecStart=$RNSD_BIN
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable rnsd
systemctl restart rnsd
sleep 3
echo "    rnsd $(systemctl is-active rnsd)"

# ── python venv ───────────────────────────────────────────────────────────────
echo "--- Setting up Python virtualenv ---"
python3 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/pip" install -q -r "$INSTALL_DIR/backend/requirements.txt"

# ── frontend build ────────────────────────────────────────────────────────────
echo "--- Building frontend ---"
cd "$INSTALL_DIR/frontend"
npm install --silent
npm run build
cd "$INSTALL_DIR"

# Give the service user ownership of what it needs to write/read
chown -R "$RNS_USER:$RNS_USER" "$INSTALL_DIR/.venv" "$INSTALL_DIR/frontend/dist"
chmod -R a+rX "$INSTALL_DIR"

# ── reticulum-web systemd service ─────────────────────────────────────────────
echo "--- Installing reticulum-web service ---"
cat > /etc/systemd/system/reticulum-web.service << EOF
[Unit]
Description=Reticulum Web UI
After=network.target rnsd.service
Wants=rnsd.service

[Service]
Type=simple
User=$RNS_USER
Group=$RNS_USER
Environment=HOME=$RNS_HOME
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
