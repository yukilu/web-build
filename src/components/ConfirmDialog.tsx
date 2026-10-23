import { useEffect, useId, useRef } from "react";
import { LoaderCircle, TriangleAlert, X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

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
    window.setTimeout(() => cancelRef.current?.focus(), 30);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, busy, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl shadow-slate-950/20 animate-modal-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="flex items-start justify-between gap-4">
          <span
            className={`grid size-11 place-items-center rounded-2xl ring-1 ring-inset ${
              destructive
                ? "bg-rose-50 text-rose-600 ring-rose-100"
                : "bg-amber-50 text-amber-600 ring-amber-100"
            }`}
            aria-hidden="true"
          >
            <TriangleAlert size={21} strokeWidth={1.8} />
          </span>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            onClick={onCancel}
            disabled={busy}
            aria-label="关闭"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>
        <h2
          id={titleId}
          className="mt-4 text-xl font-semibold tracking-tight text-slate-950"
        >
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-500">
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-45"
            onClick={onCancel}
            disabled={busy}
          >
            取消
          </button>
          <button
            type="button"
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition disabled:opacity-45 ${
              destructive
                ? "bg-rose-600 hover:bg-rose-500"
                : "bg-orange-600 hover:bg-orange-500"
            }`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <LoaderCircle className="animate-spin" size={15} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
