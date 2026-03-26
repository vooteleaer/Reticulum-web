import os
import subprocess
import sys
import threading

from fastapi import APIRouter
from pydantic import BaseModel
from config_service import (
    get_config,
    get_config_path,
    save_section,
    add_interface,
    remove_interface,
)

router = APIRouter(prefix="/api/v1", tags=["config"])


@router.get("/config")
def config():
    cfg = get_config()
    # Exclude interface namespace sections — [interfaces] and [interfaces.*] are
    # structural group headers in Reticulum's config, not real general sections.
    # Also drop any that happen to be empty (no key-value pairs).
    def _is_real_general(name: str, keys: dict) -> bool:
        if not keys:
            return False
        n = name.lower()
        return n != "interfaces" and not n.startswith("interfaces.")
    general = {k: v for k, v in cfg["general"].items() if _is_real_general(k, v)}
    return {
        "path": get_config_path(),
        "general": general,
        "interfaces": cfg["interfaces"],
    }


class SectionSave(BaseModel):
    keys: dict[str, str]


@router.put("/config/general/{section}")
def update_general(section: str, body: SectionSave):
    save_section(section, body.keys, is_interface=False)
    return {"ok": True}


@router.put("/config/interfaces/{name}")
def update_interface(name: str, body: SectionSave):
    save_section(name, body.keys, is_interface=True)
    return {"ok": True}


class NewInterface(BaseModel):
    name: str
    type: str


@router.post("/config/interfaces")
def create_interface(body: NewInterface):
    add_interface(body.name, body.type)
    return {"ok": True}


@router.delete("/config/interfaces/{name}")
def delete_interface(name: str):
    remove_interface(name)
    return {"ok": True}


@router.post("/restart")
def restart():
    """Restart the backend process to apply config changes."""
    def _do_restart() -> None:
        import time
        time.sleep(0.8)  # allow the HTTP response to be sent first
        if os.name == "nt":
            # Windows: spawn a new process since there's no service manager
            cmd = [sys.executable, "-m", "uvicorn"] + sys.argv[1:]
            subprocess.Popen(cmd, cwd=os.getcwd(),
                             creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        else:
            # Restart rnsd first, then let systemd restart us
            subprocess.run(["systemctl", "restart", "rnsd"], timeout=15)
            time.sleep(2)  # wait for rnsd to come up before we exit
        os._exit(0)

    threading.Thread(target=_do_restart, daemon=True).start()
    return {"ok": True}
