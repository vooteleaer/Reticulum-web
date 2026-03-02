from fastapi import APIRouter
from rns_service import get_nodes

router = APIRouter(prefix="/api/v1", tags=["nodes"])


@router.get("/nodes")
def nodes():
    return get_nodes()
