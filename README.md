Deployment
Prerequisites
Python 3.10+
Node.js 18+
A running Reticulum daemon (rnsd)
1. Clone the repository

git clone https://github.com/vooteleaer/reticulum-web.git
cd reticulum-web
2. Backend

cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
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
        proxy_set_header Connection "upgrade";  # required for WebSocket
        proxy_set_header Host $host;
    }
}
Running as a service (systemd)

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

sudo systemctl enable --now reticulum-web
