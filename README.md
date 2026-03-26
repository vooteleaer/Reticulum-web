# Reticulum Web UI

A web dashboard for the [Reticulum](https://reticulum.network) network stack. Monitor interfaces, paths, announces, and network topology — all from a browser.

- **Backend:** Python + FastAPI (also serves the built frontend)
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

## Pages

### Dashboard
Live interface stats (RX/TX bytes and speed), uptime, link count, and the full path/routing table. The path table is sortable and filterable.

### Announce Monitor
Real-time feed of all Reticulum announces received. Persists across tab navigation. Supports pause and filter by hash or app_data. Announces are color-coded by node type (see below).

### Network Topology (Map)
Force-directed graph of all known nodes from the routing table:
- Nodes are arranged in **concentric rings by hop count** (1 hop → 16+ hops)
- **Node colors** indicate type (see color scheme below)
- **Transport nodes** (route traffic but never announce themselves) are shown in amber
- Click any node to see its full hash, hop count, interface, via node, and expiry
- Pan and zoom freely; background click deselects

### Config
View and edit Reticulum config sections and interfaces inline. Add or remove interfaces. Restart rnsd + backend from the UI.

## Color Scheme

Node colors are uniform across the Announce Monitor, Path Table, and Network Topology map:

| Color | Type | Description |
|-------|------|-------------|
| Emerald | Our node | This Reticulum instance |
| Amber | Transport | Routes packets but never announces itself |
| Sky blue | Named node | LXMF / NomadNetwork node with a readable display name |
| Violet | Data node | Binary app_data (Sideband, hubs, etc.) |
| Slate | Path-only | In the routing table, never seen announcing |
| Gray | Unknown | No identifiable data |

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
| GET | `/api/v1/status` | Transport summary (transport_id, uptime, RX/TX) |
| GET | `/api/v1/interfaces` | Interface list with stats |
| GET | `/api/v1/paths?max_hops=N` | Path/routing table |
| GET | `/api/v1/announces?limit=N` | Announce log (last N) |
| WS  | `/api/v1/ws` | Live: `{type:"stats"}` and `{type:"announce"}` events |
| GET | `/api/v1/config` | Parsed Reticulum config |
| PUT | `/api/v1/config/general/{section}` | Update a general config section |
| PUT | `/api/v1/config/interfaces/{name}` | Update an interface config |
| POST | `/api/v1/config/interfaces` | Add a new interface |
| DELETE | `/api/v1/config/interfaces/{name}` | Remove an interface |
| POST | `/api/v1/restart` | Restart rnsd + backend |

## Notes

- The backend connects to `rnsd` via the RNS shared instance socket. Both must run as the same OS user so the RPC auth key matches — `install.sh` handles this by creating a dedicated `reticulum` system user for both services.
- Restarting from the UI restarts `rnsd` first, then the backend, so config changes (e.g. instance name) take effect cleanly.
- The announce log is in-memory and resets on restart; the routing table is always fetched live from `rnsd`.
- RNS version in the Python venv must match the system `rnsd` version (`rns==x.y.z` in `backend/requirements.txt`).
