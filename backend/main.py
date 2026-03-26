import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import rns_service
from routers import announces, config, interfaces, network, nodes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    rns_service.init_log_capture()  # must be before init_rns so RNS logs are captured
    rns_service.init_rns()
    manager = rns_service.get_ws_manager()
    task = asyncio.create_task(rns_service.stats_broadcast_loop(manager))
    yield
    # Shutdown
    task.cancel()


app = FastAPI(title="Reticulum Web UI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(network.router)
app.include_router(interfaces.router)
app.include_router(announces.router)
app.include_router(config.router)
app.include_router(nodes.router)

_dist = os.path.join(os.path.dirname(__file__), "../frontend/dist")
if os.path.isdir(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(os.path.join(_dist, "index.html"))
