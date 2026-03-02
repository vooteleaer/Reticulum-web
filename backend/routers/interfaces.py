from fastapi import APIRouter
from rns_service import get_interface_stats

router = APIRouter(prefix="/api/v1", tags=["interfaces"])


@router.get("/interfaces")
async def interfaces():
    stats = await get_interface_stats()
    return stats.get("interfaces", [])
