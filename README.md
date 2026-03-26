# Reticulum Web UI

A web dashboard for the [Reticulum](https://reticulum.network) network stack. Monitor interfaces, paths, announces and edit config — all from a browser.

- **Backend:** Python + FastAPI (serves the frontend too)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS

## Install (Debian / Raspberry Pi OS)

```bash
git clone https://github.com/vooteleaer/Reticulum-web.git
cd Reticulum-web
sudo bash install.sh
```

The script will ask for:
- **Instance name** — shown in the Reticulum network (default: hostname)
- **Web UI port** — default 8080

It will then:
- Install `rnsd` if not present
- Create a dedicated `reticulum` system user
- Write a Reticulum config with your chosen instance name
- Build the frontend and set up both `rnsd` and `reticulum-web` as systemd services that start on boot

The UI will be available at `http://<device-ip>:8080`.

## Development

Requirements: Python 3.10+, Node.js 18+, a running `rnsd`

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Frontend dev server starts at `http://localhost:5173` and proxies `/api` to the backend automatically.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/status` | Transport summary |
| GET | `/api/v1/interfaces` | Interface list with stats |
| GET | `/api/v1/paths?max_hops=N` | Path/routing table |
| GET | `/api/v1/announces?limit=N` | Announce log |
| WS  | `/api/v1/ws` | Live stats and announce events |
| GET | `/api/v1/config` | Parsed Reticulum config |
| PUT | `/api/v1/config/general/{section}` | Update a config section |
| POST | `/api/v1/restart` | Restart rnsd + backend |

## Notes

- The backend connects to `rnsd` via the RNS shared instance socket. Both must run as the same user so the RPC auth key matches — `install.sh` handles this automatically.
- Restarting from the UI restarts both `rnsd` and the backend so config changes (e.g. instance name) take effect immediately.
