import { ArrowUpRight, Package, Plus } from "lucide-react";
import type { ProjectSummary } from "../../shared/types";
import { pathTail } from "../lib/format";

type SidebarProps = {
  projects: ProjectSummary[];
  selectedId: string | null;
  runningProjectId: string | null;
  busy: boolean;
  onCreate: () => void;
  onSelect: (project: ProjectSummary) => void;
};

export function Sidebar({
  projects,
  selectedId,
  runningProjectId,
  busy,
  onCreate,
  onSelect,
}: SidebarProps) {
  return (
    <aside className="relative overflow-hidden border-b border-white/10 bg-slate-950 px-4 py-4 text-slate-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[264px] lg:flex-col lg:border-b-0 lg:border-r lg:border-white/5 lg:px-5 lg:py-6">
      <div
        className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-orange-500/12 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-950/50 ring-1 ring-white/20"
          aria-hidden="true"
        >
          <Package size={22} strokeWidth={1.8} />
        </span>
        <span className="flex min-w-0 flex-col">
          <strong className="font-script mb-0.5 text-[26px] leading-none font-normal text-white">
            Packforge
          </strong>
          <span className="text-sm tracking-[0.12em] text-slate-500">
            LOCAL PACKAGER
          </span>
        </span>
      </div>

      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className="group mt-5 flex h-11 w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-medium text-slate-200 transition hover:border-orange-400/30 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-orange-500 text-white shadow-sm transition group-hover:bg-orange-400">
          <Plus size={16} strokeWidth={2.4} />
        </span>
        <span className="flex-1 text-left">新建项目</span>
        <ArrowUpRight
          size={15}
          strokeWidth={2}
          className="text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-orange-300"
        />
      </button>

      <nav
        className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0"
        aria-label="项目列表"
      >
        {projects.length === 0 ? (
          <div className="flex w-full min-w-[220px] flex-col gap-1 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-500 lg:min-w-0">
            <p className="font-medium text-slate-300">还没有项目</p>
            <span>从一个打包目标开始。</span>
          </div>
        ) : (
          projects.map((project) => {
            const active = selectedId === project.id;
            const isRunning =
              project.id === runningProjectId ||
              project.lastRun?.status === "running";
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelect(project)}
                title={project.projectDir}
                disabled={busy}
                className={`group flex min-w-[218px] shrink-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition lg:min-w-0 lg:w-full ${
                  active
                    ? "border-orange-400/25 bg-white/[0.07] text-white shadow-lg shadow-orange-950/20"
                    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04]"
                } disabled:opacity-50`}
              >
                <span
                  className={`relative grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold ring-1 ${
                    active
                      ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white ring-white/20"
                      : "bg-white/[0.05] text-slate-200 ring-white/10"
                  }`}
                >
                  {project.name.slice(0, 1).toUpperCase()}
                  {isRunning && (
                    <span
                      className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-slate-100">
                    {project.name}
                  </span>
                  <span className="truncate font-mono text-sm text-slate-500">
                    {pathTail(project.projectDir)}
                  </span>
                </span>
                <span className="hidden text-slate-600 transition group-hover:text-slate-300 lg:block">
                  ›
                </span>
              </button>
            );
          })
        )}
      </nav>

    </aside>
  );
}
