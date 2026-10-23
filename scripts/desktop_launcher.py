import copy
import os
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))


def _prepare_output() -> None:
    if sys.stdout is not None and sys.stderr is not None:
        return
    try:
        log_dir = ROOT / "logs"
        log_dir.mkdir(exist_ok=True)
        stream = (log_dir / "launcher.log").open(
            "a",
            encoding="utf-8",
            buffering=1,
        )
    except OSError:
        stream = open(os.devnull, "w", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = stream
    if sys.stderr is None:
        sys.stderr = stream


_prepare_output()

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")


def _show_error(message: str) -> None:
    print(f"[packforge] {message}", file=sys.stderr, flush=True)
    if os.name != "nt":
        return
    try:
        import ctypes

        ctypes.windll.user32.MessageBoxW(None, message, "Packforge", 0x10)
    except Exception:
        pass


def main() -> None:
    from backend.config import HOST, PORT

    base_url = f"http://{HOST}:{PORT}/"

    def is_healthy() -> bool:
        try:
            with urllib.request.urlopen(
                f"{base_url}api/health",
                timeout=1,
            ) as response:
                return response.status == 200
        except OSError:
            return False

    skip_browser = os.environ.get("PACKFORGE_NO_BROWSER") == "1"

    if is_healthy():
        print("[packforge] Service is already running. Opening browser...", flush=True)
        if not skip_browser:
            webbrowser.open(base_url, new=2)
        return

    if not (ROOT / "dist" / "index.html").is_file():
        _show_error(
            "Missing frontend build: dist/index.html. Run npm run build first."
        )
        raise SystemExit(1)

    def open_when_ready() -> None:
        for _ in range(100):
            if is_healthy():
                if not skip_browser:
                    webbrowser.open(base_url, new=2)
                return
            time.sleep(0.2)

    print("[packforge] Starting the local packaging workbench...", flush=True)
    print(f"[packforge] The browser will open at {base_url} when ready.", flush=True)
    print("[packforge] Use the service controls on the page to stop or restart.\n", flush=True)

    if not skip_browser:
        threading.Thread(target=open_when_ready, daemon=True).start()

    import uvicorn
    from uvicorn.config import LOGGING_CONFIG

    from backend import service_control

    log_config = copy.deepcopy(LOGGING_CONFIG)
    for formatter in log_config["formatters"].values():
        formatter["use_colors"] = False

    config = uvicorn.Config(
        "backend.main:app",
        host=HOST,
        port=PORT,
        log_config=log_config,
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config)
    service_control.set_stop_handler(
        lambda: setattr(server, "should_exit", True)
    )
    try:
        server.run()
    except Exception as error:
        _show_error(f"Service failed to start: {error}")
        raise


if __name__ == "__main__":
    main()
