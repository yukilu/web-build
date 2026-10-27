import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowUp,
  Check,
  ChevronRight,
  CircleAlert,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  House,
  LoaderCircle,
  X,
} from "lucide-react";
import type { DirectoryListing } from "../../shared/types";
import { api } from "../api";

type DirectoryPickerProps = {
  open: boolean;
  title: string;
  initialPath?: string;
  allowCreate?: boolean;
  onSelect: (path: string) => void;
  onClose: () => void;
};

const secondaryButton =
  "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-45";
const primaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm shadow-orange-600/20 transition hover:bg-orange-500 disabled:opacity-45 disabled:shadow-none";
const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "读取文件夹失败";
}

export function DirectoryPicker({
  open,
  title,
  initialPath,
  allowCreate = false,
  onSelect,
  onClose,
}: DirectoryPickerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadDirectory = useCallback(async (target?: string) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    setSelectedPath(null);
    try {
      const result = await api.listDirectories(target);
      if (requestId === requestRef.current) {
        setListing(result);
      }
    } catch (loadError) {
      if (requestId === requestRef.current) {
        setError(errorText(loadError));
      }
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setListing(null);
    setError(null);
    setSelectedPath(null);
    setLoading(false);
    setCreateOpen(false);
    setCreateName("");
    setCreateError(null);
    setCreating(false);
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 30);
    void loadDirectory(initialPath?.trim() || undefined);
    return () => {
      window.clearTimeout(focusTimer);
      requestRef.current += 1;
    };
  }, [open, initialPath, loadDirectory]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || creating) {
        return;
      }
      if (createOpen) {
        setCreateOpen(false);
        setCreateError(null);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, creating, createOpen, onClose]);

  if (!open) {
    return null;
  }

  const busy = loading || creating;
  const currentPath = listing?.path ?? null;

  const handleClose = () => {
    if (!creating) {
      onClose();
    }
  };

  const handleSelect = () => {
    if (listing && !busy) {
      onSelect(selectedPath ?? listing.path);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listing || creating) {
      return;
    }
    const name = createName.trim();
    if (!name) {
      setCreateError("请输入新文件夹名称");
      return;
    }

    setCreating(true);
    setError(null);
    setCreateError(null);
    try {
      const result = await api.createDirectory(listing.path, name);
      setListing(result);
      setCreateOpen(false);
      setCreateName("");
    } catch (createFailure) {
      setCreateError(errorText(createFailure));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creating) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25 outline-none animate-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5">
          <div className="flex min-w-0 items-start gap-3.5">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-600 ring-1 ring-orange-200/60"
              aria-hidden="true"
            >
              <FolderOpen size={21} strokeWidth={1.7} />
            </span>
            <div className="min-w-0">
              <span className="font-mono text-sm font-medium tracking-[0.16em] text-orange-500 uppercase">
                Local folder browser
              </span>
              <h2
                id={titleId}
                className="mt-0.5 text-xl font-semibold tracking-tight text-slate-950"
              >
                {title}
              </h2>
              <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-500">
                单击选中文件夹，双击进入下一层。
              </p>
            </div>
          </div>
          <button
            type="button"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            onClick={handleClose}
            disabled={creating}
            aria-label="关闭文件夹选择"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-3 px-5 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35"
              onClick={() => {
                if (listing?.parent) {
                  void loadDirectory(listing.parent);
                }
              }}
              disabled={!listing?.parent || busy}
              aria-label="返回上一级"
              title="返回上一级"
            >
              <ArrowUp size={16} strokeWidth={2} />
            </button>
            <div
              className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 font-mono text-sm text-slate-600"
              title={currentPath ?? undefined}
            >
              <FolderOpen size={15} strokeWidth={1.8} className="shrink-0 text-slate-400" />
              <span className="truncate">
                {currentPath ?? (loading ? "正在读取位置…" : "未选择位置")}
              </span>
              {loading && (
                <LoaderCircle
                  className="ml-auto shrink-0 animate-spin text-orange-500"
                  size={14}
                />
              )}
            </div>
          </div>

          {listing && (
            <div className="flex flex-wrap gap-1.5" aria-label="快捷位置">
              {listing.roots.map((root) => (
                <button
                  key={root.path}
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40"
                  onClick={() => void loadDirectory(root.path)}
                  disabled={busy}
                >
                  <HardDrive size={13} strokeWidth={1.9} aria-hidden="true" />
                  {root.name}
                </button>
              ))}
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40"
                onClick={() => void loadDirectory(listing.home)}
                disabled={busy}
              >
                <House size={13} strokeWidth={1.9} aria-hidden="true" />
                主目录
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40"
                onClick={() => void loadDirectory(listing.workspace)}
                disabled={busy}
              >
                <Folder size={13} strokeWidth={1.9} aria-hidden="true" />
                应用目录
              </button>
            </div>
          )}
        </div>

        {error && (
          <div
            className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-700"
            role="alert"
          >
            <CircleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">{error}</span>
            {!listing && (
              <button
                type="button"
                className="shrink-0 rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                onClick={() => void loadDirectory()}
              >
                打开应用目录
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 px-5 py-4">
          {listing ? (
            <>
              <div className="flex items-center justify-between pb-2 font-mono text-sm tracking-[0.1em] text-slate-400 uppercase">
                <span>Folders</span>
                <span>{listing.directories.length} 个文件夹</span>
              </div>
              <div
                className={`terminal-scroll max-h-[min(380px,42vh)] min-h-[190px] overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/60 p-1.5 transition ${
                  loading ? "pointer-events-none opacity-50" : ""
                }`}
                aria-busy={loading}
              >
                {listing.directories.length === 0 ? (
                  <div className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 p-6 text-center">
                    <span className="mb-1 grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-400">
                      <Folder size={23} strokeWidth={1.5} />
                    </span>
                    <p className="text-sm font-medium text-slate-700">
                      此文件夹下没有子文件夹
                    </p>
                    <span className="text-sm text-slate-400">
                      可以直接选择当前文件夹。
                    </span>
                  </div>
                ) : (
                  listing.directories.map((directory) => {
                    const isSelected = selectedPath === directory.path;
                    return (
                      <button
                        key={directory.path}
                        type="button"
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition disabled:opacity-50 ${
                          isSelected
                            ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200"
                            : "text-slate-700 hover:bg-white hover:shadow-sm"
                        }`}
                        onClick={() => setSelectedPath(directory.path)}
                        onDoubleClick={() => void loadDirectory(directory.path)}
                        disabled={busy}
                        title={directory.path}
                        aria-pressed={isSelected}
                      >
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                            isSelected
                              ? "bg-orange-100 text-orange-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          <Folder size={16} strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {directory.name}
                        </span>
                        {isSelected ? (
                          <Check
                            size={15}
                            strokeWidth={2.2}
                            className="shrink-0 text-orange-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            size={15}
                            strokeWidth={1.8}
                            className="shrink-0 text-slate-300"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-[190px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
              {loading ? (
                <>
                  <LoaderCircle className="animate-spin" size={21} />
                  <p>正在读取文件夹…</p>
                </>
              ) : (
                <>
                  <CircleAlert size={21} strokeWidth={1.7} className="text-slate-400" />
                  <p>没有可用的文件夹列表</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          {createOpen && listing && (
            <form
              className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2"
              onSubmit={handleCreate}
            >
              <FolderPlus
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="ml-1 shrink-0 text-orange-500"
              />
              <input
                autoFocus
                value={createName}
                onChange={(event) => {
                  setCreateName(event.target.value);
                  setCreateError(null);
                }}
                placeholder="新文件夹名称"
                maxLength={120}
                disabled={creating}
                aria-label="新文件夹名称"
                className="h-9 min-w-[120px] flex-1 rounded-lg bg-transparent px-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-45"
                disabled={!createName.trim() || creating}
              >
                {creating ? <LoaderCircle className="animate-spin" size={14} /> : "创建"}
              </button>
              <button
                type="button"
                className={iconButton}
                onClick={() => {
                  setCreateOpen(false);
                  setCreateName("");
                  setCreateError(null);
                }}
                disabled={creating}
                aria-label="取消新建文件夹"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </form>
          )}

          {createError && (
            <div className="mb-3 text-sm text-rose-600" role="alert">
              {createError}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {allowCreate && listing && !createOpen && (
                <button
                  type="button"
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-transparent px-2.5 text-sm font-medium text-slate-500 transition hover:bg-orange-50 hover:text-orange-600 disabled:opacity-40 sm:w-auto"
                  onClick={() => {
                    setCreateOpen(true);
                    setCreateError(null);
                  }}
                  disabled={busy}
                >
                  <FolderPlus size={15} strokeWidth={1.8} />
                  新建文件夹
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                className={secondaryButton}
                onClick={handleClose}
                disabled={creating}
              >
                取消
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={handleSelect}
                disabled={!listing || busy}
              >
                <Check size={15} strokeWidth={2.4} />
                选择此文件夹
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
