import os
import subprocess
import sys
import threading
from pathlib import Path
from typing import Callable

_lock = threading.Lock()
_stop_handler: Callable[[], None] | None = None
_stopping = False


def set_stop_handler(handler: Callable[[], None]) -> None:
    global _stop_handler
    _stop_handler = handler


def is_available() -> bool:
    return _stop_handler is not None


def begin_stop() -> bool:
    global _stopping
    with _lock:
        if _stop_handler is None or _stopping:
            return False
        _stopping = True
        return True


def cancel_stop() -> None:
    global _stopping
    with _lock:
        _stopping = False


def schedule_stop(delay: float = 0.4) -> None:
    handler = _stop_handler
    if handler is not None:
        threading.Timer(delay, handler).start()


def start_restart_helper() -> None:
    root = Path(__file__).resolve().parents[1]
    helper = root / "scripts" / "restart_helper.py"
    venv_pythonw = root / ".venv" / "Scripts" / "pythonw.exe"
    python = Path(sys.executable)
    pythonw = python.with_name("pythonw.exe")
    executable = (
        venv_pythonw
        if venv_pythonw.is_file()
        else pythonw if pythonw.exists() else python
    )

    kwargs: dict[str, object] = {}
    if os.name == "nt":
        kwargs["creationflags"] = (
            getattr(subprocess, "DETACHED_PROCESS", 0)
            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        )
    else:
        kwargs["start_new_session"] = True

    subprocess.Popen(
        [str(executable), str(helper)],
        cwd=str(root),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        **kwargs,
    )
