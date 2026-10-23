import {
  Check,
  Download,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import type { RunSummary } from "../../shared/types";
import { archiveUrl } from "../api";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  shortId,
} from "../lib/format";

type RunHistoryProps = {
  runs: RunSummary[];
  selectedRunId: string | null;
  loading: boolean;
  enabled: boolean;
  now: number;
  onSelect: (runId: string) => void;
  onRefresh: () => void;
};

const glyphTones: Record<string, string> = {
  running: "bg-amber-50 text-amber-600",
  success: "bg-emerald-50 text-emerald-600",
  failed: "bg-rose-50 text-rose-600",
};

export function RunHistory({
  runs,
  selectedRunId,
  loading,
  enabled,
  now,
  onSelect,
  onRefresh,
}: RunHistoryProps) {
  return (
    <section
      id="run-history-panel"
      className="relative flex min-h-0 flex-col self-start rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.03] animate-rise xl:sticky xl:top-6"
      aria-label="运行记录"
    >
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          运行记录
        </h2>
        <button
          type="button"
          className="grid size-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-35"
          onClick={onRefresh}
          disabled={!enabled || loading}
          aria-label="刷新运行记录"
          title="刷新运行记录"
        >
          <RefreshCw
            size={15}
            strokeWidth={2}
            className={loading ? "animate-spin" : undefined}
          />
        </button>
      </div>

      {!enabled ? (
        <div className="flex min-h-[180px] flex-col items-start justify-center gap-1.5 px-1 py-6">
          <h3 className="text-[12px] font-semibold text-slate-700">
            保存后即可运行
          </h3>
          <p className="text-[12px] leading-5 text-slate-400">
            创建项目并填写配置，第一次运行记录会出现在这里。
          </p>
        </div>
      ) : loading && runs.length === 0 ? (
        <div className="flex flex-col gap-2 pt-2" aria-label="正在加载运行记录">
          <span className="h-14 animate-pulse rounded-2xl bg-slate-100" />
          <span className="h-14 animate-pulse rounded-2xl bg-slate-100" />
          <span className="h-14 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : runs.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-start justify-center gap-1.5 px-1 py-6">
          <h3 className="text-[12px] font-semibold text-slate-700">
            还没有运行记录
          </h3>
          <p className="text-[12px] leading-5 text-slate-400">
            点击「开始打包」，构建输出与 ZIP 结果会保留在这里。
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-t border-slate-100 py-2 font-mono text-[12px] text-slate-400">
            <span>{runs.length} 次运行</span>
            <span>按时间倒序</span>
          </div>
          <ul className="terminal-scroll mt-1 flex max-h-[520px] flex-col gap-1 overflow-y-auto pr-1">
            {runs.map((run, index) => {
              const selected = selectedRunId === run.id;
              return (
                <li
                  key={run.id}
                  className={`group flex items-stretch rounded-2xl border transition ${
                    selected
                      ? "border-orange-200/90 bg-orange-50/60"
                      : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-2.5 p-2.5 text-left"
                    onClick={() => onSelect(run.id)}
                    aria-pressed={selected}
                    title={`查看运行 ${shortId(run.id)} 的日志`}
                  >
                    <span
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                        glyphTones[run.status] ?? "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {run.status === "running" ? (
                        <LoaderCircle className="animate-spin" size={15} strokeWidth={2.2} />
                      ) : run.status === "success" ? (
                        <Check size={15} strokeWidth={2.6} />
                      ) : (
                        <X size={15} strokeWidth={2.6} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                        <span>{formatDateTime(run.startedAt)}</span>
                        {index === 0 && (
                          <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[12px] font-semibold tracking-wide text-orange-600">
                            LATEST
                          </span>
                        )}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-1.5 font-mono text-[12px] leading-4 text-slate-400">
                        <span>{formatDuration(run.startedAt, run.finishedAt, now)}</span>
                        {run.archiveSize !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{formatBytes(run.archiveSize)}</span>
                          </>
                        )}
                      </span>
                      {run.status === "failed" && run.error && (
                        <span
                          className="line-clamp-1 text-[12px] leading-4 text-rose-600"
                          title={run.error}
                        >
                          {run.error}
                        </span>
                      )}
                    </span>
                  </button>
                  {run.status === "success" && run.archiveName && (
                    <a
                      className="grid w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-orange-100 hover:text-orange-600"
                      href={archiveUrl(run.id)}
                      download={run.archiveName}
                      title={`下载 ${run.archiveName}`}
                      aria-label={`下载 ${run.archiveName}`}
                    >
                      <Download size={15} strokeWidth={2} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
