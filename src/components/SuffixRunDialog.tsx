import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, PackagePlus, Play, X } from "lucide-react";
import {
  normalizeReleaseName,
  validateReleaseSuffix,
} from "../lib/projectForm";

type SuffixRunDialogProps = {
  open: boolean;
  initialSuffix: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (suffix: string) => void;
};

export function SuffixRunDialog({
  open,
  initialSuffix,
  busy,
  onCancel,
  onConfirm,
}: SuffixRunDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [suffix, setSuffix] = useState(initialSuffix);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSuffix(initialSuffix);
    const timer = window.setTimeout(() => inputRef.current?.select(), 40);
    return () => window.clearTimeout(timer);
  }, [open, initialSuffix]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, busy, onCancel]);

  if (!open) {
    return null;
  }

  const cleanSuffix = normalizeReleaseName(suffix);
  const suffixError = cleanSuffix ? validateReleaseSuffix(suffix) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <form
        className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl shadow-slate-950/20 animate-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && cleanSuffix && !suffixError) {
            onConfirm(cleanSuffix);
          }
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100 ring-inset"
              aria-hidden="true"
            >
              <PackagePlus size={19} strokeWidth={1.8} />
            </span>
            <h2
              id={titleId}
              className="truncate text-xl font-semibold tracking-tight text-slate-950"
            >
              带后缀打包
            </h2>
          </div>
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            onClick={onCancel}
            disabled={busy}
            aria-label="关闭"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="mt-5">
          <span className="relative block">
            <input
              ref={inputRef}
              id="start-suffix"
              aria-label="打包文件名后缀"
              value={suffix}
              onChange={(event) => setSuffix(event.target.value)}
              maxLength={120}
              spellCheck={false}
              autoComplete="off"
              disabled={busy}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 pr-10 font-mono text-sm text-slate-800 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/10 disabled:opacity-60"
            />
            {suffix && (
              <button
                type="button"
                className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 disabled:opacity-40"
                onClick={() => {
                  setSuffix("");
                  inputRef.current?.focus();
                }}
                disabled={busy}
                aria-label="清空后缀"
              >
                <X size={14} strokeWidth={2} />
              </button>
            )}
          </span>
          {suffixError && (
            <p className="mt-1.5 text-sm text-rose-600">{suffixError}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-45"
            onClick={onCancel}
            disabled={busy}
          >
            取消
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm shadow-orange-600/20 transition hover:bg-orange-500 disabled:opacity-45 disabled:shadow-none"
            disabled={busy || !cleanSuffix || Boolean(suffixError)}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" size={15} />
            ) : (
              <Play size={15} fill="currentColor" strokeWidth={2} />
            )}
            {busy ? "启动中" : "开始打包"}
          </button>
        </div>
      </form>
    </div>
  );
}
