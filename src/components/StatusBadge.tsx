import { Check, LoaderCircle, X } from "lucide-react";
import type { RunStatus } from "../../shared/types";
import { statusLabel } from "../lib/format";

type StatusBadgeProps = {
  status: RunStatus | null;
};

const tones: Record<RunStatus | "idle", string> = {
  running: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  success: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  failed: "bg-rose-400/10 text-rose-300 ring-rose-400/20",
  idle: "bg-white/5 text-slate-400 ring-white/10",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status ?? "idle";
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium ring-1 ring-inset ${tones[normalized]}`}
    >
      {status === "running" ? (
        <LoaderCircle className="animate-spin" size={14} aria-hidden="true" />
      ) : status === "success" ? (
        <Check size={14} strokeWidth={2.6} aria-hidden="true" />
      ) : status === "failed" ? (
        <X size={14} strokeWidth={2.6} aria-hidden="true" />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      )}
      <span>{statusLabel(status)}</span>
    </span>
  );
}
