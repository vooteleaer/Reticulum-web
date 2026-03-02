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
=======
Deployment
Prerequisites
Python 3.10+
Node.js 18+
A running Reticulum daemon (rnsd)
1. Clone the repository

git clone https://github.com/vooteleaer/reticulum-web.git
cd reticulum-web
2. Backend

>>>>>>> 8a558bdd99a1810eda0181daddd398d32a93c03f
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
<<<<<<< HEAD
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
=======
uvicorn main:app --host 0.0.0.0 --port 8000
The API will be available at http://localhost:8000.

Note: The backend connects to a running rnsd instance via its multiprocessing RPC socket (port 37428). Make sure rnsd is running before starting the backend.

3. Frontend (development)

cd frontend
npm install
npm run dev
The dev server starts at http://localhost:5173 and proxies /api requests to the backend.

4. Frontend (production build)

cd frontend
npm install
npm run build
The static output is in frontend/dist/. Serve it with any web server (nginx, caddy, etc.) and proxy /api to the FastAPI backend.

Example nginx snippet:


>>>>>>> 8a558bdd99a1810eda0181daddd398d32a93c03f
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
<<<<<<< HEAD
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 4. Run as a systemd service (optional)

```ini
=======
        proxy_set_header Connection "upgrade";  # required for WebSocket
        proxy_set_header Host $host;
    }
}
Running as a service (systemd)

>>>>>>> 8a558bdd99a1810eda0181daddd398d32a93c03f
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
<<<<<<< HEAD
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
=======

sudo systemctl enable --now reticulum-web
>>>>>>> 8a558bdd99a1810eda0181daddd398d32a93c03f
