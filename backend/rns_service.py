"""
RNS service layer — single RNS.Reticulum instance shared across the app.

When rnsd is already running, RNS.Reticulum() connects to it via its
multiprocessing RPC socket and all get_* calls proxy transparently.
"""

import asyncio
import math
import threading
import time
from collections import deque
from typing import Any

import RNS

# ---------------------------------------------------------------------------
# Log capture — uses RNS.LOG_CALLBACK so every RNS log line is routed here.
# ---------------------------------------------------------------------------

_log_buffer: deque[dict] = deque(maxlen=1000)
_log_lock = threading.Lock()


def _rns_log_callback(msg: str) -> None:
    with _log_lock:
        _log_buffer.append({'ts': time.time(), 'msg': msg.strip()})


# Redirect RNS output from stdout to our callback
RNS.logdest = RNS.LOG_CALLBACK
RNS.logcall = _rns_log_callback


def init_log_capture() -> None:
    """No-op — kept for backwards compat."""


def get_logs(limit: int = 500) -> list[dict]:
    with _log_lock:
        entries = list(_log_buffer)
    return entries[-limit:]


def get_loglevel() -> int:
    return RNS.loglevel


def set_loglevel(level: int) -> None:
    RNS.loglevel = max(0, min(7, level))


try:
    import msgpack
    _MSGPACK_AVAILABLE = True
except ImportError:
    _MSGPACK_AVAILABLE = False

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------

_reticulum: RNS.Reticulum | None = None
_announce_log: deque[dict] = deque(maxlen=500)
_node_registry: dict[str, dict] = {}
_ws_manager: "ConnectionManager | None" = None
_start_time: float | None = None
_loop: asyncio.AbstractEventLoop | None = None  # main event loop, captured at startup


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def init_rns(configdir: str | None = None) -> None:
    """Call once at application startup."""
    global _reticulum, _start_time, _loop
    _start_time = time.time()
    _loop = asyncio.get_event_loop()  # capture the running loop for use in threads
    _reticulum = RNS.Reticulum(configdir=configdir, loglevel=RNS.LOG_NOTICE)
    RNS.Transport.register_announce_handler(_AnnounceHandler())


def get_instance_uptime() -> float | None:
    if _start_time is None:
        return None
    return time.time() - _start_time


def get_rns() -> RNS.Reticulum:
    if _reticulum is None:
        raise RuntimeError("RNS not initialised — call init_rns() first")
    return _reticulum


# ---------------------------------------------------------------------------
# Announce handler
# ---------------------------------------------------------------------------

class _AnnounceHandler:
    aspect_filter = None  # receive all announces

    def received_announce(
        self,
        destination_hash: bytes,
        announced_identity: RNS.Identity,
        app_data: bytes | None,
    ) -> None:
        hex_hash = destination_hash.hex()
        parsed = _parse_app_data(app_data)
        location = _extract_location(parsed)
        name = _extract_name(parsed)

        entry = {
            "ts": time.time(),
            "hash": hex_hash,
            "identity": announced_identity.hash.hex() if announced_identity else None,
            "app_data": _decode_app_data(app_data),
            "name": name,
            "location": location,
        }
        _announce_log.append(entry)

        # Update node registry if we have a location
        if location:
            _node_registry[hex_hash] = {
                "hash": hex_hash,
                "name": name,
                "lat": location["lat"],
                "lon": location["lon"],
                "alt": location.get("alt"),
                "ts": entry["ts"],
                "app_data": entry["app_data"],
            }

        if _ws_manager is not None and _loop is not None:
            asyncio.run_coroutine_threadsafe(
                _ws_manager.broadcast({"type": "announce", "data": entry}), _loop
            )
            if location:
                asyncio.run_coroutine_threadsafe(
                    _ws_manager.broadcast({"type": "node_update", "data": _node_registry[hex_hash]}), _loop
                )


def _parse_app_data(raw: bytes | None) -> Any:
    """Try to decode app_data as MSGPACK, fall back to None."""
    if not raw or not _MSGPACK_AVAILABLE:
        return None
    try:
        return msgpack.unpackb(raw, raw=False, strict_map_key=False)
    except Exception:
        return None


def _extract_location(parsed: Any) -> dict | None:
    """
    Search for GPS coordinates in a parsed MSGPACK structure.

    Sideband telemetry packs sensors under integer keys. The location sensor
    (SID_LOCATION = 0x06) contains a dict with lat/lon/alt fields.
    We also handle plain dicts with common field names.
    """
    if not isinstance(parsed, dict):
        return None

    # --- Common top-level field names ---
    lat = _find_float(parsed, ("lat", "latitude", "la"))
    lon = _find_float(parsed, ("lon", "lng", "longitude", "lo"))
    if lat is not None and lon is not None:
        return {"lat": lat, "lon": lon, "alt": _find_float(parsed, ("alt", "altitude"))}

    # --- Sideband telemetry: sensor dict keyed by integer SID ---
    # SID_LOCATION = 0x06 (6)
    for sid_key in (0x06, 6, "0x06", "loc", "location", "telemetry"):
        sensor = parsed.get(sid_key)
        if isinstance(sensor, dict):
            lat = _find_float(sensor, ("lat", "latitude", "la"))
            lon = _find_float(sensor, ("lon", "lng", "longitude", "lo"))
            if lat is not None and lon is not None:
                return {"lat": lat, "lon": lon, "alt": _find_float(sensor, ("alt", "altitude"))}

    # --- Nested "telemetry" key ---
    tel = parsed.get("telemetry") or parsed.get("t")
    if isinstance(tel, dict):
        return _extract_location(tel)

    return None


def _find_float(d: dict, keys: tuple) -> float | None:
    for k in keys:
        v = d.get(k)
        if v is not None:
            try:
                f = float(v)
                if math.isfinite(f):
                    return f
            except (TypeError, ValueError):
                pass
    return None


def _extract_name(parsed: Any) -> str | None:
    if not isinstance(parsed, dict):
        return None
    for k in ("name", "n", "display_name", "dn"):
        v = parsed.get(k)
        if isinstance(v, str) and v:
            return v
    return None


def _decode_app_data(raw: bytes | None) -> str | None:
    if not raw:
        return None
    try:
        return raw.decode("utf-8")
    except Exception:
        return raw.hex()


def get_nodes() -> list[dict]:
    return list(_node_registry.values())


# ---------------------------------------------------------------------------
# Data access helpers (run sync RNS calls in thread pool)
# ---------------------------------------------------------------------------

def _bytes_to_hex(obj: Any) -> Any:
    """Recursively convert bytes → hex string, strip non-finite floats."""
    if isinstance(obj, bytes):
        return obj.hex()
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    if isinstance(obj, dict):
        return {k: _bytes_to_hex(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_bytes_to_hex(i) for i in obj]
    return obj


def _get_interface_stats_sync() -> dict:
    raw = get_rns().get_interface_stats()
    return _bytes_to_hex(raw)


def _get_path_table_sync(max_hops: int | None) -> list:
    raw = get_rns().get_path_table(max_hops=max_hops)
    return _bytes_to_hex(raw)


def _get_link_count_sync() -> int:
    return get_rns().get_link_count()


def _get_rate_table_sync() -> list:
    raw = get_rns().get_rate_table()
    return _bytes_to_hex(raw)


async def get_interface_stats() -> dict:
    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, _get_interface_stats_sync), timeout=10.0
    )


async def get_path_table(max_hops: int | None = None) -> list:
    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, _get_path_table_sync, max_hops), timeout=10.0
    )


async def get_link_count() -> int:
    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, _get_link_count_sync), timeout=10.0
    )


async def get_rate_table() -> list:
    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, _get_rate_table_sync), timeout=10.0
    )


def get_announces(limit: int = 100) -> list[dict]:
    entries = list(_announce_log)
    return entries[-limit:]


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._active = [c for c in self._active if c is not ws]

    async def broadcast(self, data: dict) -> None:
        import json
        text = json.dumps(data)
        dead = []
        for ws in self._active:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


def get_ws_manager() -> ConnectionManager:
    global _ws_manager
    if _ws_manager is None:
        _ws_manager = ConnectionManager()
    return _ws_manager


# ---------------------------------------------------------------------------
# Background stats polling task
# ---------------------------------------------------------------------------

async def stats_broadcast_loop(manager: ConnectionManager, interval: float = 3.0) -> None:
    while True:
        await asyncio.sleep(interval)
        if not manager._active:
            continue
        try:
            stats = await get_interface_stats()
            link_count = await get_link_count()
            payload = {
                "type": "stats",
                "data": {
                    "interfaces": stats.get("interfaces", []),
                    "rxb": stats.get("rxb"),
                    "txb": stats.get("txb"),
                    "rxs": stats.get("rxs"),
                    "txs": stats.get("txs"),
                    "transport_uptime": stats.get("transport_uptime"),
                    "instance_uptime": get_instance_uptime(),
                    "transport_id": stats.get("transport_id"),
                    "link_count": link_count,
                },
            }
            await manager.broadcast(payload)
        except Exception:
            pass
