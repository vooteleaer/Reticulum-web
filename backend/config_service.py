"""
Reticulum config parser.

Reticulum uses a non-standard INI format with double-bracket interface sections:
    [reticulum]           <- regular section
    [[AutoInterface]]     <- interface section

Python's configparser cannot handle the double-bracket syntax, so we parse
the file manually.
"""

from pathlib import Path


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def _config_path(configdir: str | None = None) -> Path:
    base = Path(configdir) if configdir else Path.home() / ".reticulum"
    return base / "config"


def get_config_path(configdir: str | None = None) -> str:
    return str(_config_path(configdir))


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_config(configdir: str | None = None) -> dict:
    """
    Return:
        {
          "general":    {section_name: {key: value, ...}, ...},
          "interfaces": {iface_name:   {key: value, ...}, ...},
        }
    """
    path = _config_path(configdir)
    if not path.exists():
        return {"general": {}, "interfaces": {}}

    general: dict[str, dict[str, str]] = {}
    interfaces: dict[str, dict[str, str]] = {}
    current: str | None = None
    is_iface = False

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        # Interface section  [[Name]]
        if line.startswith("[[") and line.endswith("]]"):
            current = line[2:-2].strip()
            is_iface = True
            interfaces.setdefault(current, {})

        # General section  [Name]
        elif line.startswith("[") and line.endswith("]"):
            current = line[1:-1].strip()
            is_iface = False
            general.setdefault(current, {})

        # Key = value
        elif "=" in line and current is not None:
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if is_iface:
                interfaces[current][key] = value
            else:
                general[current][key] = value

    return {"general": general, "interfaces": interfaces}


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

def _write(
    general: dict[str, dict[str, str]],
    interfaces: dict[str, dict[str, str]],
    configdir: str | None = None,
) -> None:
    path = _config_path(configdir)
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []

    for section, keys in general.items():
        lines.append(f"[{section}]")
        for k, v in keys.items():
            lines.append(f"  {k} = {v}")
        lines.append("")

    for name, keys in interfaces.items():
        lines.append(f"[[{name}]]")
        for k, v in keys.items():
            lines.append(f"  {k} = {v}")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


# ---------------------------------------------------------------------------
# Mutation helpers
# ---------------------------------------------------------------------------

def save_section(
    section: str,
    keys: dict[str, str],
    is_interface: bool,
    configdir: str | None = None,
) -> None:
    """Replace all keys in a section atomically."""
    cfg = parse_config(configdir)
    target = cfg["interfaces"] if is_interface else cfg["general"]
    target[section] = keys
    _write(cfg["general"], cfg["interfaces"], configdir)


def add_interface(name: str, iface_type: str, configdir: str | None = None) -> None:
    cfg = parse_config(configdir)
    if name not in cfg["interfaces"]:
        cfg["interfaces"][name] = {
            "type": iface_type,
            "interface_enabled": "True",
        }
        _write(cfg["general"], cfg["interfaces"], configdir)


def remove_interface(name: str, configdir: str | None = None) -> None:
    cfg = parse_config(configdir)
    cfg["interfaces"].pop(name, None)
    _write(cfg["general"], cfg["interfaces"], configdir)


def get_config(configdir: str | None = None) -> dict:
    return parse_config(configdir)
