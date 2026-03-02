from fastapi import APIRouter, HTTPException, Query
from rns_service import (
    get_interface_stats, get_path_table, get_link_count, get_instance_uptime,
    get_logs, get_loglevel, set_loglevel,
)

router = APIRouter(prefix="/api/v1", tags=["network"])


@router.get("/status")
async def status():
    stats = await get_interface_stats()
    link_count = await get_link_count()
    return {
        "transport_id": stats.get("transport_id"),
        "network_id": stats.get("network_id"),
        "transport_uptime": stats.get("transport_uptime"),
        "instance_uptime": get_instance_uptime(),
        "rxb": stats.get("rxb"),
        "txb": stats.get("txb"),
        "rxs": stats.get("rxs"),
        "txs": stats.get("txs"),
        "rss": stats.get("rss"),
        "link_count": link_count,
    }


@router.get("/paths")
async def paths(max_hops: int | None = Query(default=None)):
    return await get_path_table(max_hops=max_hops)


@router.get("/logs")
def logs(limit: int = Query(default=500)):
    return get_logs(limit)


@router.get("/loglevel")
def loglevel_get():
    return {"loglevel": get_loglevel()}


@router.post("/loglevel/{level}")
def loglevel_set(level: int):
    if not (0 <= level <= 7):
        raise HTTPException(status_code=400, detail="level must be 0–7")
    set_loglevel(level)
    return {"ok": True, "loglevel": level}
