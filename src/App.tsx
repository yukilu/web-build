import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  CircleAlert,
  FolderOpen,
  LoaderCircle,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Power,
  RotateCcw,
  Settings2,
  SquareTerminal,
} from "lucide-react";
import type {
  Project,
  ProjectSummary,
  Run,
  RunSummary,
} from "../shared/types";
import { api } from "./api";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { LogTerminal } from "./components/LogTerminal";
import { ProjectEditor } from "./components/ProjectEditor";
import { RunHistory } from "./components/RunHistory";
import { SuffixRunDialog } from "./components/SuffixRunDialog";
import { Sidebar } from "./components/Sidebar";
import { Toast, type ToastState, type ToastTone } from "./components/Toast";
import { WelcomeScreen } from "./components/WelcomeScreen";
import {
  EMPTY_PROJECT_FORM,
  formsEqual,
  normalizeProjectForm,
  normalizeReleaseName,
  projectToForm,
  validateProjectForm,
  validateReleaseSuffix,
  type ProjectFormField,
  type ProjectFormState,
} from "./lib/projectForm";

type Mode = "welcome" | "create" | "edit";
type WorkspaceTab = "activity" | "config";

const ACTIVE_TAB_KEY = "packforge.activeTab";

type ConfirmRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  action: () => void | Promise<void>;
};

function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900"
      onClick={onToggle}
      aria-label={collapsed ? "展开项目栏" : "收起项目栏"}
      title={collapsed ? "展开项目栏" : "收起项目栏"}
    >
      {collapsed ? (
        <PanelLeftOpen size={16} strokeWidth={1.9} aria-hidden="true" />
      ) : (
        <PanelLeftClose size={16} strokeWidth={1.9} aria-hidden="true" />
      )}
    </button>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toRunSummary(run: Run): RunSummary {
  return {
    id: run.id,
    projectId: run.projectId,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    exitCode: run.exitCode,
    archiveName: run.archiveName,
    archiveSize: run.archiveSize,
    error: run.error,
  };
}

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [mode, setMode] = useState<Mode>("welcome");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => {
    try {
      return window.localStorage.getItem(ACTIVE_TAB_KEY) === "config"
        ? "config"
        : "activity";
    } catch {
      return "activity";
    }
  });
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>({ ...EMPTY_PROJECT_FORM });
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [runningProjectId, setRunningProjectId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [serviceStopped, setServiceStopped] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [suffixDialogOpen, setSuffixDialogOpen] = useState(false);
  const [startSuffix, setStartSuffix] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const runsRequestRef = useRef(0);
  const runRequestRef = useRef(0);
  const toastIdRef = useRef(0);
  const bootStartedRef = useRef(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const isDirty = useMemo(() => {
    if (mode === "create") {
      return !formsEqual(form, EMPTY_PROJECT_FORM);
    }
    if (mode === "edit" && selectedProject) {
      return !formsEqual(form, projectToForm(selectedProject));
    }
    return false;
  }, [form, mode, selectedProject]);

  const canSave = mode !== "welcome" && validateProjectForm(form) === null;
  const busy = saving || starting;
  const latestRun = runs[0] ?? selectedProject?.lastRun ?? null;
  const projectIsRunning =
    Boolean(selectedId) &&
    (runningProjectId === selectedId || latestRun?.status === "running");
  const anyProjectRunning =
    Boolean(runningProjectId) ||
    projects.some((project) => project.lastRun?.status === "running");

  const notify = useCallback((tone: ToastTone, message: string) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, tone, message });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 4600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {
      // Persisting the tab is optional when storage is unavailable.
    }
  }, [activeTab]);

  useEffect(() => {
    document.title =
      mode === "edit" && selectedProject
        ? `${selectedProject.name} · Packforge`
        : "Packforge · 项目打包工作台";
  }, [mode, selectedProject]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [isDirty]);

  const refreshProjects = useCallback(async (): Promise<ProjectSummary[] | null> => {
    try {
      const list = await api.listProjects();
      setProjects(list);
      setOnline(true);
      return list;
    } catch {
      setOnline(false);
      return null;
    }
  }, []);

  const loadRunDetail = useCallback(
    async (runId: string) => {
      const token = ++runRequestRef.current;
      setSelectedRunId(runId);
      setSelectedRun(null);
      setRunLoading(true);
      try {
        const detail = await api.getRun(runId);
        if (token !== runRequestRef.current) {
          return;
        }
        setSelectedRun(detail);
        setRuns((previous) =>
          previous.map((run) =>
            run.id === detail.id ? toRunSummary(detail) : run,
          ),
        );
        if (detail.status === "running") {
          setRunningProjectId(detail.projectId);
        }
      } catch (error) {
        if (token === runRequestRef.current) {
          notify("error", `读取运行记录失败：${errorMessage(error)}`);
        }
      } finally {
        if (token === runRequestRef.current) {
          setRunLoading(false);
        }
      }
    },
    [notify],
  );

  const loadRuns = useCallback(
    async (projectId: string, preferredRunId?: string) => {
      const token = ++runsRequestRef.current;
      runRequestRef.current += 1;
      setRunsLoading(true);
      setRuns([]);
      setSelectedRun(null);
      setSelectedRunId(null);
      setRunLoading(false);
      try {
        const list = await api.listRuns(projectId);
        if (token !== runsRequestRef.current) {
          return;
        }
        setRuns(list);
        const activeRun = list.find((run) => run.status === "running");
        setRunningProjectId((previous) => {
          if (activeRun) {
            return activeRun.projectId;
          }
          return previous === projectId ? null : previous;
        });
        const desiredRunId =
          preferredRunId && list.some((run) => run.id === preferredRunId)
            ? preferredRunId
            : list[0]?.id;
        if (desiredRunId) {
          await loadRunDetail(desiredRunId);
        }
      } catch (error) {
        if (token === runsRequestRef.current) {
          notify("error", `读取运行记录失败：${errorMessage(error)}`);
        }
      } finally {
        if (token === runsRequestRef.current) {
          setRunsLoading(false);
        }
      }
    },
    [loadRunDetail, notify],
  );

  const resetWorkspace = useCallback(() => {
    runsRequestRef.current += 1;
    runRequestRef.current += 1;
    setMode("welcome");
    setSelectedId(null);
    setForm({ ...EMPTY_PROJECT_FORM });
    setRuns([]);
    setSelectedRun(null);
    setSelectedRunId(null);
    setRunsLoading(false);
    setRunLoading(false);
  }, []);

  const applyProject = useCallback(
    (project: ProjectSummary) => {
      setMode("edit");
      setSelectedId(project.id);
      setForm(projectToForm(project));
      setRuns([]);
      setSelectedRun(null);
      setSelectedRunId(null);
      void loadRuns(project.id);
    },
    [loadRuns],
  );

  const bootstrap = useCallback(async () => {
    setBooting(true);
    setBootError(null);
    try {
      const [health, list] = await Promise.all([
        api.health(),
        api.listProjects(),
      ]);
      setOnline(health.ok);
      setProjects(list);
      const activeProject = list.find(
        (project) => project.lastRun?.status === "running",
      );
      setRunningProjectId(activeProject?.id ?? null);
      if (list.length > 0) {
        applyProject(list[list.length - 1]);
      } else {
        resetWorkspace();
      }
    } catch (error) {
      setOnline(false);
      setBootError(errorMessage(error));
    } finally {
      setBooting(false);
    }
  }, [applyProject, resetWorkspace]);

  useEffect(() => {
    if (bootStartedRef.current) {
      return;
    }
    bootStartedRef.current = true;
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (
      latestRun?.status !== "running" &&
      selectedRun?.status !== "running"
    ) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [latestRun?.status, selectedRun?.status]);

  const beginCreate = useCallback(() => {
    runsRequestRef.current += 1;
    runRequestRef.current += 1;
    const seedProject =
      selectedProject ?? projects[projects.length - 1] ?? null;
    setMode("create");
    setActiveTab("config");
    setSelectedId(null);
    setForm({
      ...EMPTY_PROJECT_FORM,
      projectDir: seedProject?.projectDir ?? "",
      outputDir: seedProject?.outputDir ?? "",
    });
    setRuns([]);
    setSelectedRun(null);
    setSelectedRunId(null);
    setRunsLoading(false);
    setRunLoading(false);
  }, [projects, selectedProject]);

  const requestConfirmation = useCallback(
    (request: ConfirmRequest) => {
      setConfirmRequest(request);
    },
    [],
  );

  const requestServiceControl = useCallback(
    (action: "stop" | "restart") => {
      const runningWarning = anyProjectRunning
        ? "当前有打包任务正在进行，请等待完成后再操作。"
        : "";
      const unsavedWarning = isDirty ? "未保存的配置会丢失。" : "";
      requestConfirmation({
        title: action === "stop" ? "停止服务？" : "重启服务？",
        description:
          action === "stop"
            ? `停止后网页将无法继续使用，需要双击桌面 Build 重新启动。${runningWarning}${unsavedWarning}`
            : `服务会短暂断开并自动重启，页面恢复后会自动刷新。${runningWarning}${unsavedWarning}`,
        confirmLabel: action === "stop" ? "停止服务" : "重启服务",
        destructive: action === "stop",
        action: async () => {
          if (action === "stop") {
            await api.stopService();
            setServiceStopped(true);
            return;
          }
          const before = await api.health();
          await api.restartService();
          setRestarting(true);
          void (async () => {
            const deadline = Date.now() + 30000;
            while (Date.now() < deadline) {
              await new Promise((resolve) => window.setTimeout(resolve, 500));
              try {
                const health = await api.health();
                if (health.processId !== before.processId) {
                  window.location.reload();
                  return;
                }
              } catch {
                // The restarted service is still starting up.
              }
            }
            setRestarting(false);
            setServiceStopped(true);
            notify("error", "服务重启超时，请双击桌面 Build 重新启动。");
          })();
        },
      });
    },
    [anyProjectRunning, isDirty, notify, requestConfirmation],
  );

  const guardUnsaved = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      requestConfirmation({
        title: "放弃未保存的修改？",
        description: "当前表单还有未保存的配置，继续操作会丢失这些修改。",
        confirmLabel: "放弃修改",
        destructive: true,
        action,
      });
    },
    [isDirty, requestConfirmation],
  );

  const handleCreate = useCallback(() => {
    if (busy) {
      return;
    }
    guardUnsaved(beginCreate);
  }, [beginCreate, busy, guardUnsaved]);

  const handleProjectSelect = useCallback(
    (project: ProjectSummary) => {
      if (busy) {
        return;
      }
      if (mode === "edit" && selectedId === project.id) {
        return;
      }
      guardUnsaved(() => applyProject(project));
    },
    [applyProject, busy, guardUnsaved, mode, selectedId],
  );

  const handleFormChange = useCallback(
    (field: ProjectFormField, value: string) => {
      setForm((previous) => ({ ...previous, [field]: value }));
    },
    [],
  );

  const saveProject = useCallback(
    async (options?: { silent?: boolean }): Promise<ProjectSummary | null> => {
      if (mode === "welcome") {
        return null;
      }
      const validation = validateProjectForm(form);
      if (validation) {
        notify("error", validation);
        return null;
      }
      if (mode === "edit" && !selectedId) {
        notify("error", "项目不存在，请刷新后重试");
        return null;
      }

      const creating = mode === "create";
      const payload = normalizeProjectForm(form);
      setSaving(true);
      try {
        const saved: Project = creating
          ? await api.createProject(payload)
          : await api.updateProject(selectedId!, payload);

        let freshList: ProjectSummary[] | null = null;
        try {
          freshList = await api.listProjects();
          setProjects(freshList);
          setOnline(true);
        } catch {
          setOnline(false);
          setProjects((previous) => {
            const existing = previous.some((project) => project.id === saved.id);
            if (existing) {
              return previous.map((project) =>
                project.id === saved.id ? { ...saved, lastRun: project.lastRun } : project,
              );
            }
            return [...previous, { ...saved, lastRun: null }];
          });
        }

        const fresh = freshList?.find((project) => project.id === saved.id);
        const summary: ProjectSummary = fresh ?? {
          ...saved,
          lastRun: null,
        };

        setMode("edit");
        setSelectedId(saved.id);
        setForm(projectToForm(saved));
        if (!options?.silent) {
          notify("success", creating ? "项目已创建" : "配置已保存");
        }
        if (creating) {
          await loadRuns(saved.id);
        }
        return summary;
      } catch (error) {
        notify("error", errorMessage(error));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [form, loadRuns, mode, notify, selectedId],
  );

  const handleSubmit = useCallback(() => {
    if (saving || starting || !canSave) {
      return;
    }
    void saveProject();
  }, [canSave, saveProject, saving, starting]);

  const startPackaging = useCallback(
    async (suffix?: string) => {
      if (saving || starting || anyProjectRunning) {
        return;
      }

      let project = selectedProject;
      if (mode === "create" || isDirty) {
        project = await saveProject({ silent: true });
        if (!project) {
          return;
        }
      }
      if (!project) {
        notify("error", "请先保存项目配置");
        return;
      }

      setStarting(true);
      try {
        const run = await api.startRun(project.id, suffix);
        const summary = toRunSummary(run);
        setRuns((previous) => [
          summary,
          ...previous.filter((item) => item.id !== run.id),
        ]);
        setSelectedRun(run);
        setSelectedRunId(run.id);
        setRunningProjectId(project.id);
        setActiveTab("activity");
        setSuffixDialogOpen(false);
        setProjects((previous) =>
          previous.map((item) =>
            item.id === project.id
              ? {
                  ...item,
                  lastRun: summary,
                  ...(suffix ? { releaseSuffix: suffix } : {}),
                }
              : item,
          ),
        );
        if (suffix) {
          setForm((previous) => ({ ...previous, releaseSuffix: suffix }));
        }
        notify("info", suffix ? "带后缀打包任务已启动" : "打包任务已启动");
      } catch (error) {
        notify("error", errorMessage(error));
        void loadRuns(project.id);
        void refreshProjects();
      } finally {
        setStarting(false);
      }
    },
    [
      anyProjectRunning,
      isDirty,
      loadRuns,
      mode,
      notify,
      refreshProjects,
      saveProject,
      saving,
      selectedProject,
      starting,
    ],
  );

  const handleStart = useCallback(() => {
    if (saving || starting) {
      return;
    }
    if (anyProjectRunning) {
      notify("info", "已有项目正在运行，请等待完成后再开始");
      return;
    }
    void startPackaging();
  }, [anyProjectRunning, notify, saving, startPackaging, starting]);

  const handleSuffixStart = useCallback(() => {
    if (saving || starting) {
      return;
    }
    if (anyProjectRunning) {
      notify("info", "已有项目正在运行，请等待完成后再开始");
      return;
    }
    setStartSuffix(selectedProject?.releaseSuffix ?? form.releaseSuffix ?? "");
    setSuffixDialogOpen(true);
  }, [
    anyProjectRunning,
    form.releaseSuffix,
    notify,
    saving,
    selectedProject,
    starting,
  ]);

  const handleConfirmSuffixStart = useCallback(
    (suffix: string) => {
      const validation = validateReleaseSuffix(suffix);
      if (validation) {
        notify("error", validation);
        return;
      }
      void startPackaging(normalizeReleaseName(suffix));
    },
    [notify, startPackaging],
  );

  const handleSelectRun = useCallback(
    (runId: string) => {
      if (runId === selectedRunId && !runLoading) {
        return;
      }
      void loadRunDetail(runId);
    },
    [loadRunDetail, runLoading, selectedRunId],
  );

  const handleRefreshHistory = useCallback(() => {
    if (!selectedId) {
      return;
    }
    void loadRuns(selectedId, selectedRunId ?? undefined);
    void refreshProjects();
  }, [loadRuns, refreshProjects, selectedId, selectedRunId]);

  const handleDelete = useCallback(() => {
    const project = selectedProject;
    if (!project) {
      return;
    }
    if (projectIsRunning || project.lastRun?.status === "running") {
      notify("error", "项目正在打包，暂时不能删除");
      return;
    }
    requestConfirmation({
      title: "删除这个项目？",
      description: `「${project.name}」的配置与运行记录会从本地 SQLite 中删除，已经生成的 ZIP 文件会保留在输出目录中。`,
      confirmLabel: "删除项目",
      destructive: true,
      action: async () => {
        await api.deleteProject(project.id);
        const remaining = projects.filter((item) => item.id !== project.id);
        setProjects(remaining);
        if (remaining.length > 0) {
          applyProject(remaining[0]);
        } else {
          resetWorkspace();
        }
        notify("success", "项目已删除");
      },
    });
  }, [
    applyProject,
    notify,
    projectIsRunning,
    projects,
    requestConfirmation,
    resetWorkspace,
    selectedProject,
  ]);

  const handleConfirm = useCallback(async () => {
    if (!confirmRequest || confirmBusy) {
      return;
    }
    setConfirmBusy(true);
    try {
      await confirmRequest.action();
      setConfirmRequest(null);
    } catch (error) {
      notify("error", errorMessage(error));
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmBusy, confirmRequest, notify]);

  useEffect(() => {
    if (selectedRun?.status !== "running") {
      return;
    }
    const runId = selectedRun.id;
    const projectId = selectedRun.projectId;
    let disposed = false;
    let failures = 0;
    let timer = 0;

    const poll = async () => {
      try {
        const updated = await api.getRun(runId);
        if (disposed) {
          return;
        }
        failures = 0;
        setSelectedRun((previous) =>
          previous && previous.id === runId ? updated : previous,
        );
        setRuns((previous) =>
          previous.map((run) =>
            run.id === updated.id ? toRunSummary(updated) : run,
          ),
        );
        setProjects((previous) =>
          previous.map((project) =>
            project.id === updated.projectId
              ? { ...project, lastRun: toRunSummary(updated) }
              : project,
          ),
        );
        if (updated.status !== "running") {
          disposed = true;
          window.clearInterval(timer);
          setRunningProjectId((previous) =>
            previous === projectId ? null : previous,
          );
          void refreshProjects();
          if (updated.status === "success") {
            notify(
              "success",
              updated.archiveName
                ? `打包完成 · ${updated.archiveName}`
                : "打包完成",
            );
          } else {
            notify(
              "error",
              updated.error ? `打包失败：${updated.error}` : "打包失败，请查看日志",
            );
          }
        }
      } catch {
        if (disposed) {
          return;
        }
        failures += 1;
        if (failures >= 3) {
          disposed = true;
          window.clearInterval(timer);
          notify("error", "无法同步运行状态，请刷新运行记录");
        }
      }
    };

    void poll();
    timer = window.setInterval(poll, 900);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [notify, refreshProjects, selectedRun?.id, selectedRun?.status]);

  useEffect(() => {
    if (!anyProjectRunning) {
      return;
    }
    let cancelled = false;

    const syncActiveProject = async () => {
      const list = await refreshProjects();
      if (cancelled || !list) {
        return;
      }
      const activeProject = list.find(
        (project) => project.lastRun?.status === "running",
      );
      setRunningProjectId(activeProject?.id ?? null);
    };

    void syncActiveProject();
    const timer = window.setInterval(() => {
      void syncActiveProject();
    }, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [anyProjectRunning, refreshProjects]);

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-slate-300 shadow-2xl animate-fade-in">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-950/40">
            <FolderOpen size={18} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-[0.16em] text-white">
            PACKFORGE
          </span>
          <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          <LoaderCircle className="animate-spin text-orange-300" size={18} />
          <span className="text-sm text-slate-400">正在连接本地打包引擎</span>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl animate-modal-in">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/15">
            <CircleAlert size={24} strokeWidth={1.8} />
          </span>
          <span className="mt-5 block font-mono text-sm tracking-[0.16em] text-rose-300 uppercase">
            Engine unreachable
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            无法连接本地服务
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{bootError}</p>
          <button
            type="button"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-lg shadow-orange-950/30 transition hover:bg-orange-500"
            onClick={() => void bootstrap()}
          >
            重新连接
          </button>
          <small className="mt-4 block text-sm text-slate-500">
            请确认后端服务已启动，并监听 127.0.0.1:4310。
          </small>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen lg:flex">
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${
            sidebarCollapsed
              ? "max-h-0 opacity-0 lg:max-h-none lg:w-0"
              : "max-h-[420px] opacity-100 lg:max-h-none lg:w-[264px]"
          }`}
          aria-hidden={sidebarCollapsed}
          inert={sidebarCollapsed}
        >
          <Sidebar
            projects={projects}
            selectedId={selectedId}
            runningProjectId={runningProjectId}
            busy={busy}
            onCreate={handleCreate}
            onSelect={handleProjectSelect}
          />
        </div>

        <main
          className={`app-grid flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip px-4 pt-4 pb-4 sm:px-6 lg:px-8 ${
            mode !== "welcome" && activeTab === "activity"
              ? "xl:h-screen xl:overflow-hidden"
              : ""
          }`}
        >
          {mode === "welcome" ? (
            <>
              <header className="flex items-center justify-between gap-4 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <SidebarToggle
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((value) => !value)}
                  />
                  <span className="flex items-center gap-1.5 font-mono text-sm text-slate-400">
                    工作区 <ChevronRight size={14} /> 概览
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-2 font-mono text-sm font-medium ${
                    online ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      online
                        ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]"
                        : "bg-rose-500"
                    }`}
                  />
                  <span className="hidden sm:inline">
                    {online ? "LOCAL ENGINE ONLINE" : "LOCAL ENGINE OFFLINE"}
                  </span>
                  <span className="sm:hidden">
                    {online ? "ONLINE" : "OFFLINE"}
                  </span>
                </span>
              </header>
              <WelcomeScreen onCreate={handleCreate} />
            </>
          ) : (
            <>
              <header className="mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/75 p-2 shadow-sm backdrop-blur lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <div
                  className="order-1 flex min-w-0 flex-1 items-center gap-2 px-1 lg:order-none"
                  title={form.projectDir || undefined}
                >
                  <SidebarToggle
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((value) => !value)}
                  />
                  <FolderOpen
                    size={16}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className="shrink-0 text-slate-400"
                  />
                  <span className="min-w-0 truncate font-mono text-sm text-slate-600">
                    {form.projectDir || "尚未选择项目文件夹"}
                  </span>
                  <button
                    type="button"
                    className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-orange-500 active:translate-y-0 disabled:translate-y-0 disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none"
                    onClick={() => void handleStart()}
                    disabled={!canSave || anyProjectRunning || busy}
                    aria-label="直接打包"
                    title="直接打包"
                  >
                    {starting || projectIsRunning ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Play size={16} fill="currentColor" strokeWidth={2} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="grid size-9 shrink-0 place-items-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600 shadow-sm transition hover:border-orange-300 hover:bg-orange-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100"
                    onClick={handleSuffixStart}
                    disabled={!canSave || anyProjectRunning || busy}
                    aria-label="带后缀打包"
                    title="带后缀打包"
                  >
                    <PackagePlus size={16} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                </div>

                <div
                  className="order-3 flex w-full min-w-0 items-center gap-1 rounded-xl bg-slate-100/80 p-1 lg:order-none lg:w-auto lg:justify-self-center"
                  role="tablist"
                  aria-label="工作区视图"
                >
                  <button
                    type="button"
                    role="tab"
                    id="workspace-tab-activity"
                    aria-selected={activeTab === "activity"}
                    aria-controls="workspace-panel-activity"
                    className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl px-2.5 text-sm font-semibold whitespace-nowrap transition lg:flex-none lg:px-3 ${
                      activeTab === "activity"
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-slate-900"
                    }`}
                    onClick={() => setActiveTab("activity")}
                  >
                    <SquareTerminal
                      size={16}
                      strokeWidth={1.9}
                      aria-hidden="true"
                      className={
                        activeTab === "activity" ? "text-orange-400" : ""
                      }
                    />
                    控制台
                    {projectIsRunning && (
                      <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="workspace-tab-config"
                    aria-selected={activeTab === "config"}
                    aria-controls="workspace-panel-config"
                    className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl px-2.5 text-sm font-semibold whitespace-nowrap transition lg:flex-none lg:px-3 ${
                      activeTab === "config"
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-slate-900"
                    }`}
                    onClick={() => setActiveTab("config")}
                  >
                    <Settings2
                      size={16}
                      strokeWidth={1.9}
                      aria-hidden="true"
                      className={
                        activeTab === "config" ? "text-orange-400" : ""
                      }
                    />
                    配置
                    {isDirty && (
                      <span
                        className="size-1.5 rounded-full bg-orange-500"
                        title="有未保存的修改"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>

                <div className="order-2 flex shrink-0 items-center justify-end gap-1.5 lg:order-none lg:justify-self-end">
                  <button
                    type="button"
                    className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                    onClick={() => requestServiceControl("stop")}
                    disabled={busy || serviceStopped || restarting}
                    aria-label="停止服务"
                    title="停止服务"
                  >
                    <Power size={16} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                    onClick={() => requestServiceControl("restart")}
                    disabled={busy || serviceStopped || restarting}
                    aria-label="重启服务"
                    title="重启服务"
                  >
                    <RotateCcw size={16} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                  {activeTab === "activity" && (
                    <button
                      type="button"
                      className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900"
                      aria-expanded={!historyCollapsed}
                      aria-controls="run-history-panel"
                      aria-label={historyCollapsed ? "展开运行记录" : "收起运行记录"}
                      onClick={() => setHistoryCollapsed((collapsed) => !collapsed)}
                      title={historyCollapsed ? "展开运行记录" : "收起运行记录"}
                    >
                      {historyCollapsed ? (
                        <PanelRightOpen size={16} strokeWidth={1.9} aria-hidden="true" />
                      ) : (
                        <PanelRightClose size={16} strokeWidth={1.9} aria-hidden="true" />
                      )}
                    </button>
                  )}
                </div>
              </header>

              {activeTab === "activity" ? (
                <section
                  id="workspace-panel-activity"
                  role="tabpanel"
                  aria-labelledby="workspace-tab-activity"
                  className="flex flex-col animate-fade-in xl:min-h-0 xl:flex-1"
                >
                  <div
                    className={`grid min-h-0 gap-4 xl:flex-1 xl:grid-rows-1 ${
                      historyCollapsed
                        ? ""
                        : "xl:grid-cols-[minmax(0,1fr)_300px]"
                    }`}
                  >
                    <LogTerminal run={selectedRun} loading={runLoading} />
                    {!historyCollapsed && (
                      <RunHistory
                        runs={runs}
                        selectedRunId={selectedRunId}
                        loading={runsLoading}
                        enabled={mode === "edit"}
                        now={now}
                        onSelect={handleSelectRun}
                        onRefresh={handleRefreshHistory}
                      />
                    )}
                  </div>
                </section>
              ) : (
                <section
                  id="workspace-panel-config"
                  role="tabpanel"
                  aria-labelledby="workspace-tab-config"
                  className="animate-fade-in"
                >
                  <ProjectEditor
                    mode={mode}
                    form={form}
                    dirty={isDirty}
                    saving={saving}
                    canSave={canSave}
                    busy={busy}
                    projectIsRunning={projectIsRunning}
                    onChange={handleFormChange}
                    onSubmit={handleSubmit}
                    onDelete={mode === "edit" ? handleDelete : undefined}
                  />
                </section>
              )}

            </>
          )}
        </main>
      </div>

      {restarting && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-white/10 bg-slate-900 px-8 py-8 text-center text-white shadow-2xl">
            <LoaderCircle
              size={28}
              className="animate-spin text-orange-400"
              aria-hidden="true"
            />
            <div>
              <p className="text-lg font-semibold">正在重启服务</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">
                服务恢复后页面会自动刷新。
              </p>
            </div>
          </div>
        </div>
      )}

      {serviceStopped && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-white/10 bg-slate-900 px-8 py-8 text-center text-white shadow-2xl">
            <span className="grid size-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20 ring-inset">
              <Power size={22} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-semibold">服务已停止</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">
                双击桌面「Build」快捷方式即可重新启动服务。
              </p>
            </div>
          </div>
        </div>
      )}

      <SuffixRunDialog
        open={suffixDialogOpen}
        initialSuffix={startSuffix}
        busy={busy}
        onCancel={() => {
          if (!busy) {
            setSuffixDialogOpen(false);
          }
        }}
        onConfirm={handleConfirmSuffixStart}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={confirmRequest !== null}
        title={confirmRequest?.title ?? ""}
        description={confirmRequest?.description ?? ""}
        confirmLabel={confirmRequest?.confirmLabel ?? "确认"}
        destructive={confirmRequest?.destructive}
        busy={confirmBusy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => {
          if (!confirmBusy) {
            setConfirmRequest(null);
          }
        }}
      />
    </>
  );
}
