import json
import os
import platform
import re
import sys
import traceback
import urllib.parse
from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, Body, FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import service_control
from .config import APP_VERSION, CLIENT_DIST, HOST, PORT
from .db import store
from .directories import (
    create_directory,
    read_directory_listing,
    read_directory_path,
)
from .errors import ApiError
from .runner import (
    GitPreflightError,
    RunConflictError,
    get_run_with_live_log,
    has_active_runs,
    is_project_running,
    prepare_git_branch,
    start_run,
)

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

LOCAL_HOST_PATTERN = re.compile(
    r"^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$",
    re.IGNORECASE,
)
MAX_JSON_BODY = 1024 * 1024
WINDOWS_RESERVED_NAME = re.compile(
    r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$",
    re.IGNORECASE,
)
CONFIG_MODES = {"all", "default", "defaultAndCjf"}
DIST_ROOT = CLIENT_DIST.resolve()
INDEX_FILE = DIST_ROOT / "index.html"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    interrupted = store.mark_interrupted_runs()
    if interrupted > 0:
        print(
            f"[packforge] Marked {interrupted} interrupted run(s) as failed.",
            flush=True,
        )
    print(
        f"[packforge] Local service started: http://{HOST}:{PORT} "
        f"(Python {platform.python_version()})",
        flush=True,
    )
    yield
    store.close()
    print("\n[packforge] Service stopped.", flush=True)


app = FastAPI(
    title="Packforge",
    version=APP_VERSION,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.middleware("http")
async def local_guards(request: Request, call_next):
    host = request.headers.get("host", "")
    if not LOCAL_HOST_PATTERN.match(host):
        return JSONResponse(
            {"error": "仅允许通过本机地址访问"},
            status_code=403,
        )

    path = request.url.path
    if path.startswith("/api"):
        mutating = request.method not in ("GET", "HEAD", "OPTIONS")
        guarded = mutating or path.startswith("/api/fs")
        if guarded and request.headers.get("x-packforge-client") != "web":
            return JSONResponse(
                {"error": "请求来源校验失败"},
                status_code=403,
            )

    return await call_next(request)


@app.exception_handler(ApiError)
async def handle_api_error(_request: Request, error: ApiError):
    return JSONResponse({"error": error.message}, status_code=error.status_code)


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(request: Request, error: StarletteHTTPException):
    if request.url.path.startswith("/api"):
        message = error.detail if isinstance(error.detail, str) else "请求失败"
        return JSONResponse({"error": message}, status_code=error.status_code)
    return JSONResponse({"error": str(error.detail)}, status_code=error.status_code)


@app.exception_handler(Exception)
async def handle_unexpected_error(_request: Request, error: Exception):
    traceback.print_exc()
    return JSONResponse({"error": "服务器内部错误"}, status_code=500)


def _read_string(record: dict[str, Any], key: str) -> str:
    value = record.get(key)
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ApiError(400, f"字段 {key} 必须是字符串")
    return value


def _strip_zip_suffix(value: str) -> str:
    return re.sub(r"\.zip$", "", value.strip(), flags=re.IGNORECASE)


def _validate_release_prefix(name: str) -> str:
    if not name:
        raise ApiError(400, "请填写打包文件名前缀")
    if len(name) > 120:
        raise ApiError(400, "打包文件名前缀不能超过 120 个字符")
    if name in (".", "..") or re.search(r"[\\/\x00]", name):
        raise ApiError(400, "打包文件名前缀不能包含路径分隔符")
    if os.name == "nt" and (
        re.search(r'[<>:"|?*\x00-\x1f]|[. ]$', name)
        or WINDOWS_RESERVED_NAME.match(name)
    ):
        raise ApiError(400, "打包文件名前缀包含 Windows 不支持的字符")
    return name


def _validate_release_suffix(name: str) -> str:
    if not name:
        raise ApiError(400, "请填写打包文件名后缀")
    if len(name) > 120:
        raise ApiError(400, "打包文件名后缀不能超过 120 个字符")
    if name in (".", "..") or re.search(r"[\\/\x00]", name):
        raise ApiError(400, "打包文件名后缀不能包含路径分隔符")
    if os.name == "nt" and (
        re.search(r'[<>:"|?*\x00-\x1f]|[. ]$', name)
        or WINDOWS_RESERVED_NAME.match(name)
    ):
        raise ApiError(400, "打包文件名后缀包含 Windows 不支持的字符")
    return name


def _read_project_input(body: Any) -> dict[str, str]:
    if not isinstance(body, dict):
        raise ApiError(400, "请求内容格式不正确")

    name = _read_string(body, "name").strip()
    project_dir = _read_string(body, "projectDir").strip()
    branch = _read_string(body, "branch").strip()
    build_param = _read_string(body, "buildParam").strip()
    build_param = re.sub(
        r"^npm\s+run\s+build:",
        "",
        build_param,
        flags=re.IGNORECASE,
    ).strip()
    build_param = re.sub(r"^build:", "", build_param, flags=re.IGNORECASE).strip()
    package_dir = _read_string(body, "packageDir").strip()
    output_dir = _read_string(body, "outputDir").strip()
    release_name = _strip_zip_suffix(_read_string(body, "releaseName"))
    release_suffix = _strip_zip_suffix(_read_string(body, "releaseSuffix"))
    extra_dir = _read_string(body, "extraDir").strip()
    config_mode = body.get("configMode")
    if config_mode is None:
        legacy_prune = body.get("pruneConfig")
        config_mode = (
            "defaultAndCjf" if legacy_prune is True else "all"
        )
    if not isinstance(config_mode, str) or config_mode not in CONFIG_MODES:
        raise ApiError(400, "config 保留方式不正确")

    if not name:
        raise ApiError(400, "请填写项目名称")
    if len(name) > 80:
        raise ApiError(400, "项目名称不能超过 80 个字符")
    if not project_dir:
        raise ApiError(400, "请选择项目根目录")
    if branch:
        if len(branch) > 200:
            raise ApiError(400, "Git 分支不能超过 200 个字符")
        if re.search(r"\s", branch) or branch.startswith("-"):
            raise ApiError(400, "Git 分支名称不合法")
    if not package_dir:
        raise ApiError(400, "请填写打包目录")
    if not output_dir:
        raise ApiError(400, "请选择 ZIP 输出目录")
    if not build_param:
        raise ApiError(400, "请填写打包参数")
    if len(build_param) > 100 or not re.fullmatch(
        r"[A-Za-z0-9][A-Za-z0-9._-]*",
        build_param,
    ):
        raise ApiError(400, "打包参数只能包含字母、数字、点、下划线和短横线")
    release_name = _validate_release_prefix(release_name)
    if release_suffix:
        release_suffix = _validate_release_suffix(release_suffix)
    if (
        len(project_dir) > 1000
        or len(package_dir) > 1000
        or len(output_dir) > 1000
        or len(extra_dir) > 1000
    ):
        raise ApiError(400, "目录路径不能超过 1000 个字符")

    return {
        "name": name,
        "projectDir": project_dir,
        "branch": branch,
        "buildParam": build_param,
        "packageDir": package_dir,
        "outputDir": output_dir,
        "releaseName": release_name,
        "releaseSuffix": release_suffix,
        "extraDir": extra_dir,
        "configMode": config_mode,
    }


async def _read_json_object(request: Request) -> dict[str, Any]:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_JSON_BODY:
                raise ApiError(413, "请求内容过大")
        except ValueError:
            pass

    raw = await request.body()
    if len(raw) > MAX_JSON_BODY:
        raise ApiError(413, "请求内容过大")
    if not raw:
        raise ApiError(400, "请求内容格式不正确")

    try:
        value = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as error:
        raise ApiError(400, "请求内容格式不正确") from error
    if not isinstance(value, dict):
        raise ApiError(400, "请求内容格式不正确")
    return value


def _require_project(project_id: str) -> dict[str, Any]:
    project = store.get_project(project_id)
    if project is None:
        raise ApiError(404, "项目不存在")
    return project


def _serves_html(accept: str) -> bool:
    normalized = accept.lower()
    return (
        not normalized
        or "text/html" in normalized
        or "*/*" in normalized
    )


def _content_disposition(filename: str) -> str:
    fallback = filename.encode("ascii", errors="replace").decode("ascii")
    encoded = urllib.parse.quote(filename, safe="")
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}"


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "service": "packforge",
        "version": APP_VERSION,
        "pythonVersion": platform.python_version(),
        "processId": os.getpid(),
    }


@app.post("/api/service/stop", status_code=202)
def stop_service(background: BackgroundTasks):
    if not service_control.is_available():
        raise ApiError(503, "服务控制仅在桌面启动模式下可用")
    if has_active_runs():
        raise ApiError(409, "有打包任务正在运行，请等待完成后再操作")
    if not service_control.begin_stop():
        raise ApiError(409, "服务正在停止")
    background.add_task(service_control.schedule_stop)
    return {"ok": True}


@app.post("/api/service/restart", status_code=202)
def restart_service(background: BackgroundTasks):
    if not service_control.is_available():
        raise ApiError(503, "服务控制仅在桌面启动模式下可用")
    if has_active_runs():
        raise ApiError(409, "有打包任务正在运行，请等待完成后再操作")
    if not service_control.begin_stop():
        raise ApiError(409, "服务正在停止")
    try:
        service_control.start_restart_helper()
    except OSError as error:
        service_control.cancel_stop()
        raise ApiError(500, f"无法启动重启助手：{error}") from error
    background.add_task(service_control.schedule_stop)
    return {"ok": True}


@app.get("/api/fs/directories")
async def list_directories(request: Request):
    target = read_directory_path(request.query_params.get("path"))
    return read_directory_listing(target or os.getcwd())


@app.post("/api/fs/directories", status_code=201)
async def create_filesystem_directory(request: Request):
    body = await _read_json_object(request)
    parent = body.get("parent")
    name = body.get("name")
    if not isinstance(parent, str) or not parent.strip():
        raise ApiError(400, "请选择要创建文件夹的位置")
    if not isinstance(name, str):
        raise ApiError(400, "请输入新文件夹名称")
    return create_directory(parent, name)


@app.get("/api/projects")
async def list_projects():
    return store.list_projects()


@app.post("/api/projects", status_code=201)
async def create_project(request: Request):
    body = await _read_json_object(request)
    return store.create_project(_read_project_input(body))


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    return _require_project(project_id)


@app.put("/api/projects/{project_id}")
async def update_project(project_id: str, request: Request):
    _require_project(project_id)
    body = await _read_json_object(request)
    project = store.update_project(project_id, _read_project_input(body))
    if project is None:
        raise ApiError(404, "项目不存在")
    return project


@app.delete("/api/projects/{project_id}", status_code=204)
async def delete_project(project_id: str):
    _require_project(project_id)
    if is_project_running(project_id):
        raise ApiError(409, "项目正在打包，暂时不能删除")
    store.delete_project(project_id)
    return Response(status_code=204)


@app.get("/api/projects/{project_id}/runs")
async def list_runs(project_id: str):
    _require_project(project_id)
    return store.list_runs(project_id)


@app.post("/api/projects/{project_id}/runs", status_code=202)
def begin_run(
    project_id: str,
    payload: dict[str, Any] | None = Body(default=None),
):
    project = _require_project(project_id)
    if payload is not None and not isinstance(payload, dict):
        raise ApiError(400, "请求内容格式不正确")
    payload = payload or {}
    _validate_release_prefix(
        _strip_zip_suffix(project.get("releaseName", ""))
    )
    if not project.get("buildParam"):
        raise ApiError(400, "请先填写打包参数")
    if project.get("configMode") not in CONFIG_MODES:
        raise ApiError(400, "请先选择 config 保留方式")
    if has_active_runs():
        raise ApiError(409, "已有打包任务正在运行，请等待完成后再开始")

    run_project = {**project, "releaseSuffix": ""}
    if "suffix" in payload:
        suffix = _validate_release_suffix(
            _strip_zip_suffix(_read_string(payload, "suffix"))
        )
        if suffix != project.get("releaseSuffix"):
            updated = store.update_project(
                project_id,
                {**project, "releaseSuffix": suffix},
            )
            if updated is None:
                raise ApiError(404, "项目不存在")
            project = updated
        run_project = {**project, "releaseSuffix": suffix}

    try:
        prepare_git_branch(project["projectDir"], project["branch"])
    except GitPreflightError as error:
        raise ApiError(400, str(error)) from error
    try:
        return start_run(run_project)
    except RunConflictError as error:
        raise ApiError(409, str(error)) from error


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    run = get_run_with_live_log(run_id)
    if run is None:
        raise ApiError(404, "运行记录不存在")
    return run


@app.get("/api/runs/{run_id}/archive")
async def download_archive(run_id: str):
    run = store.get_run(run_id)
    if run is None:
        raise ApiError(404, "运行记录不存在")
    if not run.get("archiveName"):
        raise ApiError(404, "该任务没有可下载的 ZIP")
    archive_path = store.get_archive_path(run_id)
    if not archive_path or not os.path.isfile(archive_path):
        raise ApiError(410, "ZIP 文件已被移动或删除")
    return FileResponse(
        archive_path,
        media_type="application/zip",
        headers={
            "Content-Disposition": _content_disposition(run["archiveName"]),
        },
    )


@app.api_route(
    "/api/{api_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
)
async def unknown_api(api_path: str):
    del api_path
    raise ApiError(404, "接口不存在")


if CLIENT_DIST.is_dir():

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_client(full_path: str, request: Request):
        if full_path:
            try:
                candidate = (DIST_ROOT / full_path).resolve()
                candidate.relative_to(DIST_ROOT)
            except (OSError, ValueError):
                raise ApiError(404, "资源不存在") from None
            if candidate.is_file():
                headers = {
                    "Cache-Control": (
                        "public, max-age=3600"
                        if candidate.suffix != ".html"
                        else "no-cache"
                    )
                }
                return FileResponse(candidate, headers=headers)

        if INDEX_FILE.is_file() and _serves_html(
            request.headers.get("accept", "")
        ):
            return FileResponse(INDEX_FILE, headers={"Cache-Control": "no-cache"})
        raise ApiError(404, "资源不存在")

else:

    @app.get("/")
    async def api_root():
        return PlainTextResponse(
            "Packforge API 正在运行。开发界面请访问 Vite 地址"
            "（默认 http://localhost:5173）。"
        )
