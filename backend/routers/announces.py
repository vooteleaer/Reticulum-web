from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from rns_service import get_announces, get_ws_manager

router = APIRouter(prefix="/api/v1", tags=["announces"])


@router.get("/announces")
def announces(limit: int = Query(default=100, ge=1, le=500)):
    return get_announces(limit=limit)


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    manager = get_ws_manager()
    await manager.connect(ws)
    try:
        while True:
            # Keep the connection alive; we only push from the server
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)
