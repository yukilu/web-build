import os
from pathlib import Path

APP_VERSION = "1.0.0"
APP_ROOT = Path.cwd()
DATA_DIR = Path(os.environ.get("PACKFORGE_DATA_DIR") or APP_ROOT / "data")
DATABASE_PATH = Path(os.environ.get("PACKFORGE_DB") or DATA_DIR / "packforge.db")
CLIENT_DIST = Path(
    os.environ.get("PACKFORGE_CLIENT_DIST") or APP_ROOT / "dist"
).resolve()
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT") or 4310)
