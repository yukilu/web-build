import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  Copy,
  Download,
  LoaderCircle,
  Terminal,
} from "lucide-react";
import type { Run } from "../../shared/types";
import { archiveUrl } from "../api";
import { shortId } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

type LogTerminalProps = {
  run: Run | null;
  loading: boolean;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

export function LogTerminal({ run, loading }: LogTerminalProps) {
  const bodyRef = useRef<HTMLPreElement>(null);
  const resetTimer = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [run?.id]);

  useEffect(() => {
    const body = bodyRef.current;
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }, [run?.log, run?.id, loading]);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const handleCopy = async () => {
    if (!run?.log) {
      return;
    }
    const success = await copyText(run.log);
    if (!success) {
      return;
    }
    setCopied(true);
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }
    resetTimer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-slate-300 shadow-xl shadow-slate-950/10 animate-rise xl:h-full"
      aria-label="打包输出日志"
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-rose-400/80" />
          <span className="size-2 rounded-full bg-amber-400/80" />
          <span className="size-2 rounded-full bg-emerald-400/80" />
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-400">
          <Terminal size={15} strokeWidth={2} className="shrink-0 text-slate-500" />
          <span className="font-console hidden tracking-normal sm:inline">
            OUTPUT STREAM
          </span>
          {run && (
            <span className="font-console truncate text-sm text-slate-600">
              / {shortId(run.id)}
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {run && <StatusBadge status={run.status} />}
          <button
            type="button"
            className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
            onClick={handleCopy}
            disabled={!run?.log || loading}
            aria-label="复制日志"
            title="复制日志"
          >
            {copied ? (
              <Check size={15} strokeWidth={2.4} />
            ) : (
              <Copy size={15} strokeWidth={2} />
            )}
          </button>
          {run?.status === "success" && run.archiveName && (
            <a
              className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white"
              href={archiveUrl(run.id)}
              download={run.archiveName}
              aria-label="下载 ZIP"
              title="下载 ZIP"
            >
              <Download size={15} strokeWidth={2} />
            </a>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-sm text-slate-500 sm:min-h-[360px] xl:min-h-0 xl:flex-1">
          <LoaderCircle className="animate-spin" size={20} />
          <span>正在读取运行日志…</span>
        </div>
      ) : run ? (
        <pre
          className="font-console terminal-scroll min-h-[300px] max-h-[420px] flex-1 overflow-auto whitespace-pre-wrap break-words p-5 text-sm leading-6 text-slate-300 sm:min-h-[360px] sm:max-h-[560px] xl:min-h-0 xl:max-h-none"
          ref={bodyRef}
        >
          {run.log ||
            (run.status === "running"
              ? "任务正在启动，等待输出…"
              : "本次任务没有输出。\n")}
        </pre>
      ) : (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 p-6 text-center sm:min-h-[360px] xl:min-h-0 xl:flex-1">
          <span className="mb-1 grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-600">
            <Terminal size={23} strokeWidth={1.5} />
          </span>
          <p className="text-sm font-medium text-slate-300">控制台等待第一条任务</p>
          <span className="text-sm text-slate-500">
            运行打包后，构建与整理输出会在这里实时刷新。
          </span>
        </div>
      )}

      {run?.status === "failed" && run.error && (
        <div className="flex items-start gap-2.5 border-t border-rose-500/15 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-200">
          <CircleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{run.error}</span>
        </div>
      )}

    </section>
  );
}
