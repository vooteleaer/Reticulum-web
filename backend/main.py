import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
