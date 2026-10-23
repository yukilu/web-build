import os
import re
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import DATABASE_PATH

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_dir TEXT NOT NULL,
  build_param TEXT NOT NULL DEFAULT '',
  git_branch TEXT NOT NULL DEFAULT '',
  package_dir TEXT NOT NULL,
  output_dir TEXT NOT NULL,
  release_name TEXT NOT NULL DEFAULT '',
  release_suffix TEXT NOT NULL DEFAULT '',
  extra_dir TEXT NOT NULL DEFAULT '',
  config_mode TEXT NOT NULL DEFAULT 'all',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  exit_code INTEGER,
  log TEXT NOT NULL DEFAULT '',
  archive_path TEXT,
  archive_size INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_project_started
  ON runs(project_id, started_at DESC);
"""


def iso_now() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _to_project(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "projectDir": row["project_dir"],
        "branch": row["git_branch"],
        "buildParam": row["build_param"],
        "packageDir": row["package_dir"],
        "outputDir": row["output_dir"],
        "releaseName": row["release_name"],
        "releaseSuffix": row["release_suffix"],
        "extraDir": row["extra_dir"],
        "configMode": row["config_mode"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _to_run_summary(row: sqlite3.Row) -> dict[str, Any]:
    archive_path = row["archive_path"]
    return {
        "id": row["id"],
        "projectId": row["project_id"],
        "status": row["status"],
        "startedAt": row["started_at"],
        "finishedAt": row["finished_at"],
        "exitCode": row["exit_code"],
        "archiveName": os.path.basename(archive_path) if archive_path else None,
        "archiveSize": row["archive_size"],
        "error": row["error"],
    }


def _to_run(row: sqlite3.Row) -> dict[str, Any]:
    return {**_to_run_summary(row), "log": row["log"]}


class Store:
    def __init__(self, database_path: Path = DATABASE_PATH) -> None:
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._db = sqlite3.connect(
            str(database_path),
            timeout=5.0,
            check_same_thread=False,
        )
        self._db.row_factory = sqlite3.Row
        self._db.executescript(SCHEMA)
        self._ensure_project_columns()
        self._db.commit()

    def _ensure_project_columns(self) -> None:
        columns = {
            row["name"]
            for row in self._db.execute("PRAGMA table_info(projects)").fetchall()
        }
        if "release_name" not in columns:
            self._db.execute(
                "ALTER TABLE projects "
                "ADD COLUMN release_name TEXT NOT NULL DEFAULT ''"
            )
        if "release_suffix" not in columns:
            self._db.execute(
                "ALTER TABLE projects "
                "ADD COLUMN release_suffix TEXT NOT NULL DEFAULT ''"
            )
        if "extra_dir" not in columns:
            self._db.execute(
                "ALTER TABLE projects "
                "ADD COLUMN extra_dir TEXT NOT NULL DEFAULT ''"
            )
        if "config_mode" not in columns:
            self._db.execute(
                "ALTER TABLE projects "
                "ADD COLUMN config_mode TEXT NOT NULL DEFAULT 'all'"
            )
            if "prune_config" in columns:
                self._db.execute(
                    "UPDATE projects SET config_mode = CASE "
                    "WHEN prune_config = 1 THEN 'defaultAndCjf' ELSE 'all' END"
                )
        if "git_branch" not in columns:
            self._db.execute(
                "ALTER TABLE projects "
                "ADD COLUMN git_branch TEXT NOT NULL DEFAULT ''"
            )
        if "build_param" not in columns:
            self._db.execute(
                "ALTER TABLE projects "
                "ADD COLUMN build_param TEXT NOT NULL DEFAULT ''"
            )
            if "build_command" in columns:
                rows = self._db.execute(
                    "SELECT id, build_command FROM projects"
                ).fetchall()
                for row in rows:
                    match = re.match(
                        r"^npm\s+run\s+build:([A-Za-z0-9][A-Za-z0-9._-]*)\s*$",
                        row["build_command"] or "",
                        re.IGNORECASE,
                    )
                    if match:
                        self._db.execute(
                            "UPDATE projects SET build_param = ? WHERE id = ?",
                            (match.group(1), row["id"]),
                        )

    def mark_interrupted_runs(self) -> int:
        with self._lock:
            cursor = self._db.execute(
                """
                UPDATE runs
                SET status = 'failed',
                    finished_at = ?,
                    error = COALESCE(error, '服务重启，任务中断'),
                    log = COALESCE(log, '') || ?
                WHERE status = 'running'
                """,
                (
                    iso_now(),
                    "\n[packforge] 服务重新启动，未完成的任务已标记为失败。\n",
                ),
            )
            self._db.commit()
            return cursor.rowcount

    def list_projects(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._db.execute(
                """
                SELECT p.*,
                       r.id AS last_run_id,
                       r.status AS last_run_status,
                       r.started_at AS last_run_started_at,
                       r.finished_at AS last_run_finished_at,
                       r.exit_code AS last_run_exit_code,
                       r.archive_path AS last_run_archive_path,
                       r.archive_size AS last_run_archive_size,
                       r.error AS last_run_error
                FROM projects p
                LEFT JOIN runs r ON r.id = (
                  SELECT id FROM runs
                  WHERE project_id = p.id
                  ORDER BY started_at DESC, rowid DESC
                  LIMIT 1
                )
                ORDER BY p.created_at ASC, p.rowid ASC
                """
            ).fetchall()

        projects: list[dict[str, Any]] = []
        for row in rows:
            project = _to_project(row)
            if row["last_run_id"] and row["last_run_status"]:
                last_run = {
                    "id": row["last_run_id"],
                    "projectId": row["id"],
                    "status": row["last_run_status"],
                    "startedAt": row["last_run_started_at"],
                    "finishedAt": row["last_run_finished_at"],
                    "exitCode": row["last_run_exit_code"],
                    "archiveName": (
                        os.path.basename(row["last_run_archive_path"])
                        if row["last_run_archive_path"]
                        else None
                    ),
                    "archiveSize": row["last_run_archive_size"],
                    "error": row["last_run_error"],
                }
            else:
                last_run = None
            projects.append({**project, "lastRun": last_run})
        return projects

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._db.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ).fetchone()
        return _to_project(row) if row else None

    def create_project(self, project: dict[str, str]) -> dict[str, Any]:
        project_id = str(uuid.uuid4())
        now = iso_now()
        with self._lock:
            self._db.execute(
                """
                INSERT INTO projects
                  (id, name, project_dir, build_param, git_branch,
                   package_dir, output_dir, release_name, release_suffix,
                   extra_dir, config_mode, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    project["name"],
                    project["projectDir"],
                    project["buildParam"],
                    project["branch"],
                    project["packageDir"],
                    project["outputDir"],
                    project["releaseName"],
                    project["releaseSuffix"],
                    project["extraDir"],
                    project["configMode"],
                    now,
                    now,
                ),
            )
            self._db.commit()
        project_row = self.get_project(project_id)
        assert project_row is not None
        return project_row

    def update_project(
        self, project_id: str, project: dict[str, str]
    ) -> dict[str, Any] | None:
        with self._lock:
            cursor = self._db.execute(
                """
                UPDATE projects
                SET name = ?, project_dir = ?, build_param = ?,
                    git_branch = ?, package_dir = ?, output_dir = ?,
                    release_name = ?, release_suffix = ?, extra_dir = ?,
                    config_mode = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    project["name"],
                    project["projectDir"],
                    project["buildParam"],
                    project["branch"],
                    project["packageDir"],
                    project["outputDir"],
                    project["releaseName"],
                    project["releaseSuffix"],
                    project["extraDir"],
                    project["configMode"],
                    iso_now(),
                    project_id,
                ),
            )
            self._db.commit()
        return self.get_project(project_id) if cursor.rowcount > 0 else None

    def delete_project(self, project_id: str) -> bool:
        with self._lock:
            cursor = self._db.execute(
                "DELETE FROM projects WHERE id = ?", (project_id,)
            )
            self._db.commit()
            return cursor.rowcount > 0

    def list_runs(self, project_id: str, limit: int = 30) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._db.execute(
                """
                SELECT id, project_id, status, started_at, finished_at,
                       exit_code, archive_path, archive_size, error
                FROM runs
                WHERE project_id = ?
                ORDER BY started_at DESC, rowid DESC
                LIMIT ?
                """,
                (project_id, limit),
            ).fetchall()
        return [_to_run_summary(row) for row in rows]

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._db.execute(
                "SELECT * FROM runs WHERE id = ?", (run_id,)
            ).fetchone()
        return _to_run(row) if row else None

    def get_archive_path(self, run_id: str) -> str | None:
        with self._lock:
            row = self._db.execute(
                "SELECT archive_path FROM runs WHERE id = ?", (run_id,)
            ).fetchone()
        return row["archive_path"] if row else None

    def create_run(
        self, run_id: str, project_id: str, started_at: str, log: str
    ) -> dict[str, Any]:
        with self._lock:
            self._db.execute(
                """
                INSERT INTO runs (id, project_id, status, started_at, log)
                VALUES (?, ?, 'running', ?, ?)
                """,
                (run_id, project_id, started_at, log),
            )
            self._db.commit()
        run = self.get_run(run_id)
        assert run is not None
        return run

    def finish_run(
        self,
        run_id: str,
        *,
        status: str,
        finished_at: str,
        exit_code: int | None,
        log: str,
        archive_path: str | None,
        archive_size: int | None,
        error: str | None,
    ) -> dict[str, Any]:
        with self._lock:
            self._db.execute(
                """
                UPDATE runs
                SET status = ?, finished_at = ?, exit_code = ?, log = ?,
                    archive_path = ?, archive_size = ?, error = ?
                WHERE id = ?
                """,
                (
                    status,
                    finished_at,
                    exit_code,
                    log,
                    archive_path,
                    archive_size,
                    error,
                    run_id,
                ),
            )
            self._db.commit()
        run = self.get_run(run_id)
        assert run is not None
        return run

    def close(self) -> None:
        with self._lock:
            self._db.close()


store = Store()
