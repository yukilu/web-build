import codecs
import errno
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from .db import iso_now, store

MAX_LOG_CHARS = 4_000_000
CONFIG_MODE_FILES = {
    "default": frozenset({"config.js"}),
    "defaultAndCjf": frozenset(
        {"config.js", "config_cjf.js", "config_cjf_cloud.js"}
    ),
}
ANSI_PATTERN = re.compile(
    r"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))"
)


@dataclass
class ActiveRun:
    id: str
    project: dict
    log: str
    log_truncated: bool = False


class RunConflictError(Exception):
    def __init__(self, message: str = "该项目已有打包任务正在运行") -> None:
        super().__init__(message)


class GitPreflightError(RuntimeError):
    pass


def _run_git(args: list[str], cwd: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", "-c", "core.quotepath=false", *args],
            cwd=cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except FileNotFoundError as error:
        raise GitPreflightError(
            "未找到 git 命令，请确认已安装 Git 并加入 PATH"
        ) from error
    except subprocess.TimeoutExpired as error:
        raise GitPreflightError("执行 Git 命令超时，已中断打包") from error
    except OSError as error:
        raise GitPreflightError(f"无法执行 Git 命令：{error}") from error


def _git_detail(result: subprocess.CompletedProcess[str]) -> str:
    return (result.stderr.strip() or result.stdout.strip() or "未知错误")


def _current_git_branch(cwd: str) -> str:
    result = _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd)
    if result.returncode != 0:
        raise GitPreflightError(
            f"无法读取当前 Git 分支：{_git_detail(result)}"
        )
    return result.stdout.strip()


def prepare_git_branch(
    project_root: str,
    branch: str,
    on_log: Callable[[str], None] | None = None,
) -> str:
    project_root = os.path.abspath(project_root)
    if not os.path.isdir(project_root):
        raise GitPreflightError(
            f"项目根目录不存在或不是目录：{project_root}"
        )
    repo = _run_git(["rev-parse", "--is-inside-work-tree"], project_root)
    if repo.returncode != 0 or repo.stdout.strip() != "true":
        raise GitPreflightError("项目根目录不是 Git 仓库，无法校验分支状态")

    status = _run_git(["status", "--porcelain"], project_root)
    if status.returncode != 0:
        raise GitPreflightError(f"无法读取 Git 状态：{_git_detail(status)}")
    if status.stdout.strip():
        raise GitPreflightError(
            "当前分支有未提交改动，请先提交或暂存后再打包"
        )

    current = _current_git_branch(project_root)
    if branch and current != branch:
        ref = _run_git(["check-ref-format", "--branch", branch], project_root)
        if ref.returncode != 0:
            raise GitPreflightError(f"Git 分支名称不合法：{branch}")
        if on_log:
            on_log(
                f"[packforge] 正在切换分支 · "
                f"{current or '未知'} → {branch}\n"
            )
        switch = _run_git(["checkout", branch], project_root)
        if switch.returncode != 0:
            raise GitPreflightError(
                f"无法切换到分支 {branch}：{_git_detail(switch)}"
            )
        current = _current_git_branch(project_root)
        if current != branch:
            raise GitPreflightError(f"无法切换到分支 {branch}")
        if on_log:
            on_log(f"[packforge] 已切换到分支 · {branch}\n")

    if on_log:
        on_log(f"[packforge] Git 分支 · {current or branch}\n")
        on_log("[packforge] Git 工作区干净\n")
    return current


_active_lock = threading.RLock()
_active_runs: dict[str, ActiveRun] = {}
_running_projects: dict[str, str] = {}


def is_project_running(project_id: str) -> bool:
    with _active_lock:
        return project_id in _running_projects


def has_active_runs() -> bool:
    with _active_lock:
        return bool(_running_projects)


def get_run_with_live_log(run_id: str) -> dict | None:
    stored = store.get_run(run_id)
    if stored is None:
        return None
    with _active_lock:
        active = _active_runs.get(run_id)
    return {**stored, "log": active.log} if active else stored


def _resolve_from(base_dir: str, target: str) -> str:
    if os.path.isabs(target):
        return os.path.normpath(target)
    return os.path.abspath(os.path.join(base_dir, target))


def _format_bytes(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    units = ["KB", "MB", "GB", "TB"]
    value = size / 1024
    unit = units[0]
    for unit_name in units[1:]:
        if value < 1024:
            break
        value /= 1024
        unit = unit_name
    precision = 1 if value >= 10 else 2
    return f"{value:.{precision}f} {unit}"


def _normalize_release_name(name: str) -> str:
    return re.sub(r"\.zip$", "", name.strip(), flags=re.IGNORECASE)


def _unique_release_paths(output_dir: str, base_name: str) -> tuple[str, str]:
    candidate = base_name
    counter = 1
    while os.path.exists(os.path.join(output_dir, candidate)) or os.path.exists(
        os.path.join(output_dir, f"{candidate}.zip")
    ):
        candidate = f"{base_name}_{counter}"
        counter += 1
    return candidate, os.path.join(output_dir, f"{candidate}.zip")


def _preferred_node_home() -> str | None:
    override = os.environ.get("PACKFORGE_NODE_HOME", "").strip()
    if override and os.path.isfile(os.path.join(override, "node.exe")):
        return os.path.abspath(override)

    roots: list[str] = []
    nvm_home = os.environ.get("NVM_HOME", "").strip()
    if nvm_home:
        roots.append(nvm_home)
    local_appdata = os.environ.get("LOCALAPPDATA", "").strip()
    if local_appdata:
        roots.extend(
            [
                os.path.join(local_appdata, "Author Software", "nvm"),
                os.path.join(local_appdata, "nvm"),
            ]
        )

    for root in roots:
        installs = os.path.join(root, "installs")
        try:
            names = os.listdir(installs)
        except OSError:
            continue
        candidates: list[tuple[int, int, str]] = []
        for name in names:
            match = re.fullmatch(r"v22\.(\d+)\.(\d+)", name)
            if match and os.path.isfile(
                os.path.join(installs, name, "node.exe")
            ):
                candidates.append((int(match.group(1)), int(match.group(2)), name))
        if candidates:
            return os.path.join(installs, max(candidates)[2])
    return None


def _build_environment() -> dict[str, str]:
    env = os.environ.copy()
    env["FORCE_COLOR"] = "0"
    env["NO_COLOR"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    if os.name == "nt":
        path_key = next(
            (key for key in env if key.lower() == "path"),
            "Path",
        )
        system_root = env.get("SystemRoot") or env.get("SYSTEMROOT") or "C:\\Windows"
        env[path_key] = os.pathsep.join(
            part
            for part in (
                _preferred_node_home(),
                os.path.join(system_root, "System32"),
                system_root,
                env.get(path_key, ""),
            )
            if part
        )
    return env


def _spawn_script(
    executable: str,
    args: list[str],
    cwd: str,
    on_output: Callable[[str], None],
) -> int:
    try:
        process = subprocess.Popen(
            [executable, *args],
            cwd=cwd,
            env=_build_environment(),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except OSError as error:
        raise RuntimeError(f"无法启动打包脚本：{error}") from error

    assert process.stdout is not None
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    try:
        while True:
            chunk = os.read(process.stdout.fileno(), 4096)
            if not chunk:
                break
            on_output(decoder.decode(chunk))
        on_output(decoder.decode(b"", final=True))
        exit_code = process.wait()
    finally:
        process.stdout.close()
        if process.poll() is None:
            process.kill()
            process.wait()

    if exit_code < 0:
        raise RuntimeError(f"打包脚本被信号 {-exit_code} 终止")
    return exit_code


def _run_script(
    command: str,
    cwd: str,
    on_output: Callable[[str], None],
) -> int:
    directory = tempfile.mkdtemp(prefix="packforge-script-")
    is_windows = os.name == "nt"
    script_path = os.path.join(directory, "build.cmd" if is_windows else "build.sh")
    if is_windows:
        newline_command = re.sub(r"\r\n|\r|\n", "\r\n", command)
        body = "\r\n".join(
            [
                "@echo off",
                "chcp 65001 >nul",
                f'cd /d "{cwd}" || exit /b 1',
                newline_command,
                "",
            ]
        )
    else:
        body = f"{command}\n"

    with open(script_path, "wb") as script:
        script.write(body.encode("utf-8"))

    try:
        if is_windows:
            executable = os.environ.get("ComSpec") or "cmd.exe"
            return _spawn_script(
                executable,
                ["/d", "/s", "/c", "build.cmd"],
                directory,
                on_output,
            )
        return _spawn_script("/bin/sh", [script_path], cwd, on_output)
    finally:
        shutil.rmtree(directory, ignore_errors=True)


def _write_zip(
    package_dir: str,
    destination: str,
    on_output: Callable[[str], None],
) -> tuple[int, int]:
    entries = 0
    warnings = 0

    with zipfile.ZipFile(
        destination,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
        allowZip64=True,
    ) as archive:
        for current_root, dir_names, file_names in os.walk(
            package_dir,
            topdown=True,
            followlinks=False,
        ):
            dir_names[:] = sorted(
                (
                    name
                    for name in dir_names
                    if not os.path.islink(os.path.join(current_root, name))
                ),
                key=str.casefold,
            )
            file_names.sort(key=str.casefold)

            for name in dir_names:
                full_path = os.path.join(current_root, name)
                arc_name = os.path.relpath(full_path, package_dir)
                try:
                    archive.writestr(
                        zipfile.ZipInfo.from_file(full_path, arc_name),
                        b"",
                    )
                    entries += 1
                except FileNotFoundError as error:
                    warnings += 1
                    on_output(f"[packforge] 压缩警告：{error}\n")

            for name in file_names:
                full_path = os.path.join(current_root, name)
                arc_name = os.path.relpath(full_path, package_dir)
                try:
                    archive.write(full_path, arc_name)
                    entries += 1
                except FileNotFoundError as error:
                    warnings += 1
                    on_output(f"[packforge] 压缩警告：{error}\n")

    return entries, warnings


def _move_archive(source: str, destination: str) -> None:
    try:
        os.replace(source, destination)
        return
    except OSError as error:
        if error.errno != errno.EXDEV:
            raise
    shutil.copy2(source, destination)
    os.unlink(source)


def _apply_config_mode(
    release_root: str,
    keep_files: frozenset[str],
) -> tuple[bool, int]:
    try:
        target: str | None = None
        with os.scandir(release_root) as entries:
            for entry in entries:
                if (
                    entry.name.casefold() == "ax-config"
                    and entry.is_dir(follow_symlinks=False)
                ):
                    target = entry.path
                    break
        if target is None:
            return False, 0

        removed = 0
        with os.scandir(target) as entries:
            for entry in entries:
                if (
                    entry.is_file(follow_symlinks=False)
                    and entry.name.casefold() in keep_files
                ):
                    continue
                if entry.is_dir(follow_symlinks=False) and not entry.is_symlink():
                    shutil.rmtree(entry.path)
                else:
                    os.remove(entry.path)
                removed += 1
        return True, removed
    except OSError as error:
        raise RuntimeError(f"整理 ax-config 失败：{error}") from error


def _append_log(active: ActiveRun, chunk: str) -> None:
    if len(active.log) >= MAX_LOG_CHARS:
        if not active.log_truncated:
            active.log_truncated = True
            active.log += "\n[packforge] 日志超过大小上限，后续输出已省略。\n"
        return
    clean = ANSI_PATTERN.sub("", chunk)
    active.log += clean[: MAX_LOG_CHARS - len(active.log)]


def _execute_run(active: ActiveRun) -> None:
    project = active.project
    exit_code: int | None = None
    archive_path: str | None = None
    archive_size: int | None = None
    failure: str | None = None

    project_root = os.path.abspath(project["projectDir"])
    package_path = _resolve_from(project_root, project["packageDir"])
    output_dir = _resolve_from(project_root, project["outputDir"])
    release_name = _normalize_release_name(project.get("releaseName", ""))
    release_suffix = _normalize_release_name(
        project.get("releaseSuffix", "")
    )
    release_parts = [release_name]
    if release_suffix:
        release_parts.append(release_suffix)
    release_parts.append(datetime.now().strftime("%y%m%d"))
    release_base = "_".join(part for part in release_parts if part)
    branch = project.get("branch", "").strip()
    extra_dir_value = project.get("extraDir", "").strip()
    extra_path = (
        _resolve_from(project_root, extra_dir_value) if extra_dir_value else None
    )

    def log(chunk: str) -> None:
        _append_log(active, chunk)

    started = time.monotonic()
    log(f"[packforge] 开始任务 · {project['name']}\n")
    log(f"[packforge] 工作目录 · {project_root}\n")
    node_home = _preferred_node_home()
    log(
        f"[packforge] Node · "
        f"{os.path.basename(node_home) if node_home else '系统 PATH'}\n"
    )
    if branch:
        log(f"[packforge] Git 分支 · {branch}\n")
    log(f"[packforge] 打包目录 · {package_path}\n")
    log(f"[packforge] 输出目录 · {output_dir}\n")
    if release_name:
        log(f"[packforge] 文件名前缀 · {release_name}\n")
    if release_suffix:
        log(f"[packforge] 文件名后缀 · {release_suffix}\n")
    if extra_path:
        log(f"[packforge] Taro 文件目录 · {extra_path}\n")

    try:
        if not os.path.isdir(project_root):
            raise RuntimeError(f"项目根目录不存在或不是目录：{project_root}")
        if not release_name:
            raise RuntimeError("未设置打包文件名前缀")
        build_param = project.get("buildParam", "").strip()
        if not build_param:
            raise RuntimeError("未设置打包参数")
        if extra_path and not os.path.isdir(extra_path):
            raise RuntimeError(f"Taro 文件目录不存在或不是目录：{extra_path}")
        if not branch:
            raise RuntimeError("未设置 Git 分支")
        prepare_git_branch(project_root, branch, log)

        command = f"npm run build:{build_param}"
        log(f"\n$ {command}\n\n")
        exit_code = _run_script(command, project_root, log)
        if exit_code != 0:
            raise RuntimeError(f"打包脚本执行失败，退出码 {exit_code}")
        log(f"\n[packforge] 脚本执行完成，退出码 {exit_code}\n")

        if not os.path.isdir(package_path):
            raise RuntimeError(f"打包目录不存在或不是目录：{package_path}")

        os.makedirs(output_dir, exist_ok=True)
        final_base, final_archive = _unique_release_paths(
            output_dir,
            release_base,
        )
        temporary_dir = tempfile.mkdtemp(prefix="packforge-")
        content_root = os.path.join(temporary_dir, "content")
        os.makedirs(content_root)
        release_stage = os.path.join(content_root, final_base)
        temporary_archive = os.path.join(temporary_dir, f"{final_base}.zip")

        try:
            log(f"\n[packforge] 正在准备打包目录 · {final_base}\n")
            shutil.copytree(package_path, release_stage)

            if extra_path:
                log(
                    f"[packforge] 正在合并 Taro 文件夹 → "
                    f"{os.path.join(final_base, 'taro')}\n"
                )
                shutil.copytree(
                    extra_path,
                    os.path.join(release_stage, "taro"),
                    dirs_exist_ok=True,
                )

            config_mode = project.get("configMode", "all")
            keep_files = CONFIG_MODE_FILES.get(config_mode)
            if keep_files is not None:
                keep_label = "、".join(
                    [
                        "config.js",
                        "config_cjf.js",
                        "config_cjf_cloud.js",
                    ]
                    if "config_cjf.js" in keep_files
                    else ["config.js"]
                )
                log(
                    f"[packforge] 正在整理 ax-config · 保留 {keep_label}\n"
                )
                found, removed = _apply_config_mode(release_stage, keep_files)
                if found:
                    log(
                        f"[packforge] ax-config 整理完成 · "
                        f"删除 {removed} 个多余条目\n"
                    )
                else:
                    log("[packforge] 未找到 ax-config 目录，跳过整理。\n")

            log(f"[packforge] 正在压缩：{final_base}\n")
            entry_count, warning_count = _write_zip(
                content_root,
                temporary_archive,
                log,
            )
            archive_bytes = os.path.getsize(temporary_archive)

            try:
                _move_archive(temporary_archive, final_archive)
            except Exception:
                if os.path.exists(final_archive):
                    try:
                        os.unlink(final_archive)
                    except OSError:
                        pass
                raise

            archive_path = final_archive
            archive_size = archive_bytes

            log(
                f"[packforge] 压缩完成 · {entry_count} 个条目 · "
                f"{_format_bytes(archive_bytes)}\n"
            )
            if warning_count > 0:
                log(f"[packforge] 压缩过程包含 {warning_count} 条非致命警告。\n")
            log("[packforge] 输出目录仅保留 ZIP，不生成同名文件夹。\n")
            log(f"[packforge] ZIP 已放置 · {final_archive}\n")
        finally:
            shutil.rmtree(temporary_dir, ignore_errors=True)

        if exit_code is None:
            exit_code = 0
        seconds = f"{time.monotonic() - started:.1f}"
        log(f"[packforge] 任务成功 · 用时 {seconds}s\n")
    except Exception as error:
        failure = str(error)
        log(f"\n[packforge] 任务失败 · {failure}\n")
        if exit_code == 0:
            exit_code = None

    finished_at = iso_now()
    try:
        store.finish_run(
            active.id,
            status="failed" if failure else "success",
            finished_at=finished_at,
            exit_code=exit_code,
            log=active.log,
            archive_path=archive_path,
            archive_size=archive_size,
            error=failure[:2000] if failure else None,
        )
    except Exception as error:
        print(f"[packforge] Failed to persist run {active.id}: {error}", flush=True)
    finally:
        with _active_lock:
            _active_runs.pop(active.id, None)
            _running_projects.pop(project["id"], None)


def _run_thread(active: ActiveRun) -> None:
    try:
        _execute_run(active)
    except Exception as error:
        print(f"[packforge] Runner error {active.id}: {error}", flush=True)
        with _active_lock:
            _active_runs.pop(active.id, None)
            _running_projects.pop(active.project["id"], None)


def start_run(project: dict) -> dict:
    run_id = str(uuid.uuid4())
    started_at = iso_now()
    initial_log = "[packforge] 任务已进入队列，正在启动...\n"
    active = ActiveRun(id=run_id, project=project, log=initial_log)

    with _active_lock:
        if _running_projects:
            raise RunConflictError(
                "已有打包任务正在运行，请等待完成后再开始"
            )
        _running_projects[project["id"]] = run_id
        _active_runs[run_id] = active

    try:
        store.create_run(run_id, project["id"], started_at, initial_log)
    except Exception:
        with _active_lock:
            _active_runs.pop(run_id, None)
            _running_projects.pop(project["id"], None)
        raise

    threading.Thread(
        target=_run_thread,
        args=(active,),
        name=f"packforge-run-{run_id[:8]}",
        daemon=True,
    ).start()

    run = get_run_with_live_log(run_id)
    if run is None:
        raise RuntimeError("无法读取刚创建的运行记录")
    return run
