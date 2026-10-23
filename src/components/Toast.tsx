import { Check, CircleAlert, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

export type ToastState = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastProps = {
  toast: ToastState | null;
  onClose: () => void;
};

const iconTones: Record<ToastTone, string> = {
  success: "bg-emerald-400/15 text-emerald-300",
  error: "bg-rose-400/15 text-rose-300",
  info: "bg-sky-400/15 text-sky-300",
};

export function Toast({ toast, onClose }: ToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <div
      className="fixed right-4 bottom-4 z-[70] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm text-white shadow-2xl shadow-slate-950/30 backdrop-blur animate-rise sm:right-6 sm:bottom-6"
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-xl ${iconTones[toast.tone]}`}
        aria-hidden="true"
      >
        {toast.tone === "success" ? (
          <Check size={16} strokeWidth={2.5} />
        ) : toast.tone === "error" ? (
          <CircleAlert size={16} strokeWidth={2.2} />
        ) : (
          <Info size={16} strokeWidth={2.2} />
        )}
      </span>
      <span className="min-w-0 self-center leading-6">{toast.message}</span>
      <button
        type="button"
        className="ml-1 grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
        onClick={onClose}
        aria-label="关闭提示"
      >
        <X size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}
