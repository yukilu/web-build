import errno
import os
import re
import stat
from pathlib import Path

from .errors import ApiError


def _directory_error(error: OSError, target: str) -> ApiError:
    if error.errno in (errno.EACCES, errno.EPERM):
        return ApiError(403, f"没有权限访问文件夹：{target}")
    if error.errno == errno.ENOENT:
        return ApiError(400, f"文件夹不存在：{target}")
    if error.errno == errno.ENOTDIR:
        return ApiError(400, "该路径不是文件夹")
    return ApiError(400, f"无法访问文件夹：{target}")


def list_roots() -> list[dict[str, str]]:
    if os.name != "nt":
        return [{"name": "/", "path": "/"}]

    roots: list[dict[str, str]] = []
    for index in range(26):
        letter = chr(ord("A") + index)
        root = f"{letter}:\\"
        try:
            if os.path.isdir(root):
                roots.append({"name": f"{letter}:", "path": root})
        except OSError:
            continue
    return roots


def read_directory_listing(target: str) -> dict[str, object]:
    try:
        info = os.stat(target)
    except OSError as error:
        raise _directory_error(error, target) from error

    if not stat.S_ISDIR(info.st_mode):
        raise ApiError(400, "该路径不是文件夹")

    entries: list[dict[str, str]] = []
    try:
        with os.scandir(target) as iterator:
            for entry in iterator:
                try:
                    if entry.is_dir(follow_symlinks=False):
                        entries.append(
                            {
                                "name": entry.name,
                                "path": os.path.join(target, entry.name),
                            }
                        )
                except OSError:
                    continue
    except OSError as error:
        raise _directory_error(error, target) from error

    entries.sort(key=lambda entry: entry["name"].casefold())
    parent = os.path.dirname(target)
    return {
        "path": target,
        "parent": None if parent == target else parent,
        "directories": entries,
        "roots": list_roots(),
        "home": str(Path.home()),
        "workspace": os.getcwd(),
    }


def read_directory_path(value: str | None) -> str | None:
    if value is None:
        return None
    target = value.strip()
    if not target:
        return None
    if len(target) > 1000:
        raise ApiError(400, "目录路径不能超过 1000 个字符")
    return os.path.abspath(target)


def create_directory(parent: str, name: str) -> dict[str, object]:
    parent_path = os.path.abspath(parent.strip())
    if len(parent_path) > 1000:
        raise ApiError(400, "目录路径不能超过 1000 个字符")

    folder_name = name.strip()
    if not folder_name:
        raise ApiError(400, "请输入新文件夹名称")
    if len(folder_name) > 120:
        raise ApiError(400, "文件夹名称不能超过 120 个字符")
    if folder_name in (".", "..") or re.search(r"[\\/\x00]", folder_name):
        raise ApiError(400, "文件夹名称不能包含路径分隔符")
    if os.name == "nt" and re.search(r'[<>:"|?*\x00-\x1f]|[. ]$', folder_name):
        raise ApiError(400, "文件夹名称包含 Windows 不支持的字符")

    try:
        info = os.stat(parent_path)
    except OSError as error:
        raise _directory_error(error, parent_path) from error
    if not stat.S_ISDIR(info.st_mode):
        raise ApiError(400, "所选位置不是文件夹")

    target = os.path.join(parent_path, folder_name)
    try:
        os.mkdir(target)
    except FileExistsError as error:
        raise ApiError(409, "同名文件夹已存在") from error
    except OSError as error:
        raise _directory_error(error, target) from error

    return read_directory_listing(target)
