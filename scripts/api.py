import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _venv_python() -> Path | None:
    candidates = (
        ROOT / ".venv" / "Scripts" / "python.exe",
        ROOT / ".venv" / "bin" / "python",
    )
    return next((path for path in candidates if path.is_file()), None)


def _run_in_project_venv() -> int | None:
    if sys.prefix != sys.base_prefix:
        return None
    venv_python = _venv_python()
    if venv_python is None:
        return None
    if Path(sys.executable).resolve() == venv_python.resolve():
        return None
    process: subprocess.Popen | None = None
    try:
        process = subprocess.Popen(
            [str(venv_python), str(Path(__file__).resolve()), *sys.argv[1:]],
            cwd=str(ROOT),
        )
        return process.wait()
    except KeyboardInterrupt:
        if process is not None:
            if process.poll() is None:
                process.terminate()
            return process.wait()
        return 130


def main() -> None:
    venv_exit_code = _run_in_project_venv()
    if venv_exit_code is not None:
        raise SystemExit(venv_exit_code)

    try:
        import uvicorn
    except ModuleNotFoundError:
        print(
            "Missing Python dependencies. Run: python -m pip install -r requirements.txt",
            file=sys.stderr,
        )
        raise SystemExit(1) from None

    from backend.config import HOST, PORT

    reload_enabled = "--reload" in sys.argv[1:]
    if not reload_enabled:
        from backend import service_control

        config = uvicorn.Config("backend.main:app", host=HOST, port=PORT)
        server = uvicorn.Server(config)
        service_control.set_stop_handler(
            lambda: setattr(server, "should_exit", True)
        )
        server.run()
        return

    uvicorn.run(
        "backend.main:app",
        host=HOST,
        port=PORT,
        reload=True,
        reload_dirs=[str(ROOT / "backend")],
    )


if __name__ == "__main__":
    main()
