#!/usr/bin/env python
"""Deploy Reticulum Web UI to cafa-cloud."""

import os
import stat
import paramiko

HOST = "cafa-cloud"
USER = "vootele"
PASSWORD = "abrakadabra"
REMOTE_DIR = "/home/vootele/reticulum-web"
PORT = 8080

LOCAL_ROOT = os.path.dirname(os.path.abspath(__file__))

IGNORE = {
    "__pycache__", ".git", "node_modules", "dist", ".venv", "venv",
    "*.pyc", ".env", "deploy.py",
}


def should_skip(name):
    if name in IGNORE:
        return True
    for pattern in IGNORE:
        if pattern.startswith("*") and name.endswith(pattern[1:]):
            return True
    return False


def upload_dir(sftp, local_path, remote_path):
    try:
        sftp.mkdir(remote_path)
    except OSError:
        pass

    for item in os.listdir(local_path):
        if should_skip(item):
            continue
        lp = os.path.join(local_path, item)
        rp = remote_path + "/" + item
        if os.path.isdir(lp):
            upload_dir(sftp, lp, rp)
        else:
            print(f"  uploading {rp}")
            sftp.put(lp, rp)


def run(client, cmd, sudo=False, get_output=False):
    if sudo:
        cmd = f"echo '{PASSWORD}' | sudo -S {cmd}"
    print(f"$ {cmd.replace(PASSWORD, '***') if sudo else cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(out.rstrip().encode('cp1252', errors='replace').decode('cp1252'))
    if err.strip() and not sudo:
        print("STDERR:", err.rstrip().encode('cp1252', errors='replace').decode('cp1252'))
    if get_output:
        return out
    return out, err


def main():
    print("Connecting to", HOST)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    print("\n=== Uploading files ===")
    run(client, f"mkdir -p {REMOTE_DIR}/backend {REMOTE_DIR}/frontend")
    sftp = client.open_sftp()

    # Upload backend
    print("backend/")
    upload_dir(sftp, os.path.join(LOCAL_ROOT, "backend"), REMOTE_DIR + "/backend")

    # Upload frontend (without node_modules/dist)
    print("frontend/")
    upload_dir(sftp, os.path.join(LOCAL_ROOT, "frontend"), REMOTE_DIR + "/frontend")

    sftp.close()

    print("\n=== Installing python3-venv ===")
    run(client, "apt-get install -y python3-venv python3-full", sudo=True)

    print("\n=== Setting up Python virtualenv ===")
    run(client, f"python3 -m venv {REMOTE_DIR}/.venv")
    run(client, f"{REMOTE_DIR}/.venv/bin/pip install -q -r {REMOTE_DIR}/backend/requirements.txt")

    print("\n=== Building frontend ===")
    run(client, f"cd {REMOTE_DIR}/frontend && npm install --silent")
    run(client, f"cd {REMOTE_DIR}/frontend && npm run build")

    print("\n=== Creating systemd service ===")
    service = f"""[Unit]
Description=Reticulum Web UI
After=network.target

[Service]
Type=simple
User={USER}
WorkingDirectory={REMOTE_DIR}/backend
ExecStart={REMOTE_DIR}/.venv/bin/uvicorn main:app --host 0.0.0.0 --port {PORT}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    # Write to tmp then move with sudo
    tmp = "/tmp/reticulum-web.service"
    sftp2 = client.open_sftp()
    with sftp2.file(tmp, "w") as f:
        f.write(service)
    sftp2.close()
    run(client, f"mv {tmp} /etc/systemd/system/reticulum-web.service", sudo=True)

    print("\n=== Enabling and starting service ===")
    run(client, "systemctl daemon-reload", sudo=True)
    run(client, "systemctl enable reticulum-web", sudo=True)
    run(client, "systemctl restart reticulum-web", sudo=True)

    import time
    time.sleep(3)
    run(client, "systemctl is-active reticulum-web || journalctl -u reticulum-web -n 20 --no-pager", sudo=True)

    client.close()
    print(f"\nDone! App should be at http://cafa-cloud:{PORT}")


if __name__ == "__main__":
    main()
