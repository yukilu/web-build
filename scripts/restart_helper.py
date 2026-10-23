import os
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

LOG_DIR = ROOT / "logs"
LOG_PATH = LOG_DIR / "restart.log"


def log(message: str) -> None:
    LOG_DIR.mkdir(exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as stream:
        stream.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}\n")


def port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def main() -> int:
    from backend.config import HOST, PORT

    deadline = time.time() + 30
    while time.time() < deadline and port_open(HOST, PORT):
        time.sleep(0.3)
    if port_open(HOST, PORT):
        log("Old service did not stop. Restart aborted.")
        return 1

    time.sleep(0.4)

    venv_pythonw = ROOT / ".venv" / "Scripts" / "pythonw.exe"
    python = Path(sys.executable)
    pythonw = python.with_name("pythonw.exe")
    executable = (
        venv_pythonw
        if venv_pythonw.is_file()
        else pythonw if pythonw.exists() else python
    )

    env = os.environ.copy()
    env["PACKFORGE_NO_BROWSER"] = "1"

    kwargs: dict[str, object] = {}
    if os.name == "nt":
        kwargs["creationflags"] = (
            getattr(subprocess, "DETACHED_PROCESS", 0)
            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        )
    else:
        kwargs["start_new_session"] = True

    subprocess.Popen(
        [str(executable), str(ROOT / "scripts" / "desktop_launcher.py")],
        cwd=str(ROOT),
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        **kwargs,
    )
    log(f"Started new service with {executable.name}.")

    for _ in range(60):
        time.sleep(0.5)
        if port_open(HOST, PORT):
            log("New service is listening.")
            return 0

    log("New service did not start.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
