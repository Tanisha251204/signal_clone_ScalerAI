"""Hermetic integration run (cross-platform): boots a FRESH seeded backend (temp DB), then runs
  1) the live-server smoke test (real HTTP + WebSockets)
  2) the frontend UI integration tests (real React UI against a clean server)

Usage (repo root; backend deps installed in the active Python, `npm install` done in frontend/):
    python scripts/run_integration.py
"""
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND, FRONTEND = ROOT / "backend", ROOT / "frontend"
NPM = "npm.cmd" if os.name == "nt" else "npm"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(port: int, tmp: str, tag: str) -> subprocess.Popen:
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{Path(tmp, tag + '.db').as_posix()}", "UPLOAD_DIR": str(Path(tmp, "up")),
           "CORS_ORIGINS": "*", "SEED_DEMO_DATA": "1"}
    proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port)], cwd=BACKEND, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1)
            return proc
        except Exception:
            time.sleep(0.5)
    proc.terminate()
    raise RuntimeError("backend failed to start")


def main() -> int:
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    tmp = tempfile.mkdtemp()
    server = None
    try:
        server = start_server(port, tmp, "smoke")
        print(f"== 1/2 live smoke test against fresh backend {base}")
        rc = subprocess.call([sys.executable, "tests/smoke_live.py", base], cwd=BACKEND)
        if rc:
            return rc
        # the smoke test mutates data; restart on a clean DB so the UI tests' seed assumptions hold
        server.terminate(); server.wait(10)
        server = start_server(port, tmp, "ui")
        print("== 2/2 frontend UI integration tests (clean DB)")
        return subprocess.call([NPM, "test"], cwd=FRONTEND, env={**os.environ, "TEST_API_URL": base})
    finally:
        if server:
            server.terminate()
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
