# Reticulum Web UI

A web dashboard for the [Reticulum](https://reticulum.network) network stack.

- **Backend:** Python + FastAPI
- **Frontend:** React + TypeScript + Vite + Tailwind CSS

## Prerequisites

- Python 3.10+
- Node.js 18+
- A running Reticulum daemon (`rnsd`)

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

> The backend connects to a running `rnsd` instance via its multiprocessing RPC socket (port 37428). Make sure `rnsd` is running before starting the backend.

### Frontend (development)

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies `/api` requests to the backend automatically.

## Production Deployment

### 1. Build the frontend

```bash
cd frontend
npm install
npm run build
```

Static output is in `frontend/dist/`.

### 2. Run the backend

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 3. Serve with nginx

Serve the built frontend and proxy API/WebSocket requests to the backend:

```nginx
server {
    listen 80;
    root /path/to/reticulum-web/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 4. Run as a systemd service (optional)

```ini
# /etc/systemd/system/reticulum-web.service
[Unit]
Description=Reticulum Web UI
After=network.target

[Service]
User=<your-user>
WorkingDirectory=/path/to/reticulum-web/backend
ExecStart=/path/to/reticulum-web/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now reticulum-web
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/status` | Transport summary |
| GET | `/api/v1/interfaces` | Interface list with stats |
| GET | `/api/v1/paths?max_hops=N` | Path/routing table |
| GET | `/api/v1/announces?limit=N` | Announce log (last N) |
| WS  | `/api/v1/ws` | Live stats and announce events |
| GET | `/api/v1/config` | Parsed Reticulum config |
| PUT | `/api/v1/config` | Write a config value |
