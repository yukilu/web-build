# Packforge

Packforge 是一个运行在本机的项目打包工作台。它负责保存多个打包项目配置，在打包前检查 Git 工作区与分支，执行项目的 `npm run build:<参数>`，再把打包目录整理成 ZIP 输出。

前端是 React + TypeScript + Vite + Tailwind CSS，后端是 Python + FastAPI + SQLite。服务只监听 `127.0.0.1`，不对外网开放。

## 主要功能

- 管理多个打包项目，支持目录选择器和本机文件夹新建。
- 打包前 Git 预检：
  - 项目根目录必须是 Git 仓库；
  - 工作区有未提交或未跟踪改动时中断；
  - 填写了目标分支且当前不在该分支时自动 `git checkout`，失败则中断；
  - 未填写分支时直接使用当前分支。
- 构建命令固定为 `npm run build:<打包参数>`，不允许执行任意脚本。
- 打包目录复制到输出目录后：
  - 可选把 Taro 文件夹内容合并为发布包内的 `taro`；
  - 可选择保留 `ax-config` 的哪些配置文件；
  - 生成 ZIP，输出目录只保留 ZIP，不保留同名文件夹。
- 文件名支持前缀、日期和可选后缀：
  - 直接打包：`前缀_YYMMDD.zip`
  - 带后缀打包：`前缀_后缀_YYMMDD.zip`
  - 已存在同名 ZIP 时依次追加 `_1`、`_2`。
- 同一时间只允许一个打包任务运行；其他项目的打包按钮会置灰。
- 左侧只给正在运行的项目显示绿点；任务结束后不再显示状态点。
- 运行日志实时刷新，保留运行历史，可下载历史 ZIP。
- 页面右上角可停止或重启服务，均需二次确认。
- 切换项目保持当前 tab，刷新页面后仍停留在上次的 tab。
- 新建项目时会带入当前/最近项目的项目根目录和输出目录，仍可修改。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript 7、Vite 8、Tailwind CSS 4、lucide-react |
| 字体 | Great Vibes（本地打包，用于品牌字样） |
| 后端 | Python 3.13、FastAPI、uvicorn、Python 标准库 `sqlite3` |
| 数据 | SQLite（`data/packforge.db`） |
| 打包 | `npm run build:<参数>`、Python `zipfile` / `shutil` |

## 目录结构

```text
backend/                 FastAPI 路由、SQLite 数据层、打包执行器
  main.py                API、静态托管、本地访问保护
  runner.py              Git 预检、构建、复制、config 整理、压缩
  db.py                  数据库结构与迁移
  service_control.py     停止/重启服务
src/                     React 界面
  components/            侧栏、配置、控制台、运行记录、弹窗
  lib/projectForm.ts     表单规范化与校验
shared/types.ts          前后端共享类型
scripts/
  api.py                 开发/普通启动入口
  desktop_launcher.py    生产启动器（可由 pythonw 隐藏运行）
  restart_helper.py      页面重启服务的辅助进程
public/                  favicon、桌面图标
data/                    SQLite 数据（不提交）
logs/                    启动与重启日志（不提交）
dist/                    前端构建产物（不提交）
install-packforge.bat    Windows 后台一键安装脚本
start-packforge.bat      Windows 一键启动脚本
requirements.txt        Python 依赖
package.json            Node 依赖与脚本
```

## 环境要求

- Windows 10/11（使用了 `pythonw`、`.bat` 和 Windows 图标）。
- Node.js 与 npm；使用 PATH 中的 `node`/`npm` 即可。
- Python 3.13，建议使用项目内 `.venv`。
- Git；如果填写了目标分支，请确保该分支在本地存在。
- 目标项目需要有自己的 `build:<参数>` npm 脚本。

Packforge 直接使用系统 PATH 中的 `node`/`npm` 执行目标项目和前端的构建，不再切换或固定 Node 版本。

## 安装

### 后台一键安装（Python）

双击 `install-packforge.bat`，或在项目根目录执行：

```powershell
install-packforge.bat
```

脚本只负责后台：

1. 检查 Python 版本（3.10+，推荐 3.13）；
2. 创建或复用 `.venv`；
3. 安装 `requirements.txt` 中的 Python 依赖。

脚本不会安装 Node 依赖、不会构建前端，也不会启动服务。需要联网下载 Python 依赖。

### 前端安装与构建

前端的依赖安装和构建请自行执行：

```powershell
npm install
npm run build
```

打包目标项目时仍需要 Node/npm（执行 `npm run build:<参数>`）和 Git。

### 手动安装后台（等价）

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 开发模式

一次启动前后端：

```powershell
npm run dev
```

- Vite：http://127.0.0.1:5173
- API：http://127.0.0.1:4310
- Vite 会把 `/api` 代理到 4310。

也可以分开启动：

```powershell
npm run dev:server   # Python 后端，带 --reload
npm run dev:web      # Vite
```

注意：带 `--reload` 的开发后端没有安装进程内停止处理器，页面上的停止/重启服务按钮可能返回 503。需要测试这两个按钮时，用下面的无 reload 启动方式：

```powershell
npm run start        # Python 后端，无 reload，支持停止/重启
npm run dev:web      # 另开终端启动 Vite
```

## 生产模式与一键启动

先构建前端：

```powershell
npm run build
```

然后任选一种方式启动后台：

1. 双击 `start-packforge.bat`（会显示一个控制台窗口，并在缺少 `dist` 时尝试构建）。
2. 隐藏窗口使用 `pythonw`：

```powershell
.venv\Scripts\pythonw.exe scripts\desktop_launcher.py
```

服务启动后访问 http://127.0.0.1:4310/。Python 后台会同时托管 `dist` 和 API。

如需在桌面创建隐藏启动的快捷方式，可在项目根目录执行：

```powershell
$root = (Get-Location).Path
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Build.lnk")
$sc.TargetPath = "$root\.venv\Scripts\pythonw.exe"
$sc.Arguments = '"' + "$root\scripts\desktop_launcher.py" + '"'
$sc.WorkingDirectory = $root
$sc.IconLocation = "$root\public\build.ico,0"
$sc.Save()
```

启动日志写入 `logs/launcher.log`，页面重启服务的日志写入 `logs/restart.log`。

## 使用流程

### 1. 配置项目

| 字段 | 说明 |
| --- | --- |
| 项目名称 | 仅用于界面展示。 |
| 项目根目录 | 目标 Git 项目根目录，通过目录选择器选择。 |
| 打包目录 | 构建产物目录，如 `dist`；相对于项目根目录或绝对路径。 |
| ZIP 输出目录 | 最终 ZIP 的放置目录，通过目录选择器选择。 |
| Taro 文件目录 | 可选。文件夹内容会复制到发布包的 `taro` 下。 |
| 打包文件名前缀 | 必填，例如 `dist_for_client`。 |
| 保留 config | `所有` / `仅默认` / `仅默认和城建发`。 |
| Git 分支 | 可选；填写后在打包前切换到该分支，留空则使用当前分支。 |
| 打包参数 | 对应 `npm run build:<参数>`，例如 `client`。 |

`保留 config` 的策略：

- `所有`：不删除 `ax-config` 中的文件。
- `仅默认`：只保留 `config.js`。
- `仅默认和城建发`：保留 `config.js`、`config_cjf.js`、`config_cjf_cloud.js`。

策略只作用于输出副本；原始打包目录不会被修改。

### 2. 开始打包

页面左上角有两个打包按钮：

- **直接打包**：立即开始，不添加后缀。
- **带后缀打包**：弹窗填写必填后缀，会带入上次使用的后缀，可清空。

最终名称示例（日期为当天 `YYMMDD`）：

```text
dist_for_client_261023.zip
dist_for_client_test_261023.zip
dist_for_client_test_261023_1.zip
```

ZIP 内部保留同名顶层文件夹。打包目录的原始 `dist` 不会被删除或重命名；下载按钮读取的是本次运行生成并保存在输出目录的 ZIP。

### 3. 运行状态

- 同一时间只允许一个打包任务；运行中所有项目的打包按钮置灰。
- 左侧正在运行的项目头像显示绿点；结束后绿点消失。
- 右上角停止服务后页面会显示已停止提示，需要重新双击桌面 Build（或运行启动脚本）；重启服务会在运行中恢复并自动刷新页面。

## 数据与日志

- `data/packforge.db`：项目配置、运行记录、日志。首次启动自动创建。
- `logs/launcher.log`：生产启动器日志。
- `logs/restart.log`：页面重启服务的日志。
- 输出 ZIP 在项目配置的 ZIP 输出目录，不在本仓库中。

这些目录和文件都已在 `.gitignore` 中排除，不会提交本机数据和构建产物。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `PORT` | 后台端口，默认 `4310`。 |
| `PACKFORGE_DATA_DIR` | 数据目录，默认 `data/`。 |
| `PACKFORGE_DB` | SQLite 文件路径，默认 `data/packforge.db`。 |
| `PACKFORGE_CLIENT_DIST` | 前端静态文件目录，默认 `dist/`。 |
| `PACKFORGE_API_TARGET` | Vite 开发代理目标，默认 `http://127.0.0.1:4310`。 |
| `PACKFORGE_NO_BROWSER` | 启动器设为 `1` 时不自动打开浏览器。 |

## API 概览

所有接口位于 `/api`。除 GET 外，写操作和 `/api/fs` 请求需要携带请求头：

```http
X-Packforge-Client: web
```

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/health` | 健康检查，返回进程 ID。 |
| `GET/POST /api/projects` | 项目列表 / 新建项目。 |
| `GET/PUT/DELETE /api/projects/{id}` | 查询、更新、删除项目。 |
| `GET/POST /api/projects/{id}/runs` | 运行记录 / 开始打包；请求体可传 `{ "suffix": "..." }`。 |
| `GET /api/runs/{id}` | 运行详情与日志。 |
| `GET /api/runs/{id}/archive` | 下载该次运行的 ZIP。 |
| `GET/POST /api/fs/directories` | 浏览/创建本机文件夹。 |
| `POST /api/service/stop` | 停止后台（无运行任务时）。 |
| `POST /api/service/restart` | 重启后台并自动刷新页面。 |

## 安全说明

- 服务固定绑定 `127.0.0.1`，并通过 Host 白名单限制访问。
- 写操作要求 `X-Packforge-Client: web` 请求头；未启用 CORS。
- SQLite 数据库和运行日志只保存在本机。
- 目标项目必须通过 Git 预检才会执行构建。

## 已知限制

- 当前主要面向 Windows。
- 同一时间全局只允许一个打包任务。
- 目标项目工作区必须是干净的；未跟踪文件也会被视为未提交改动。
- 停止服务后网页无法自行重启后台，需要桌面 Build 快捷方式或启动脚本。
- 前端 `dist` 不在 Git 中，克隆后需要先执行 `npm run build`。
