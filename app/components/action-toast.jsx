"use client";

import { ACTION_TOAST_MS } from "../hooks/use-status-message";

const TYPE_STYLES = {
  success: {
    ring: "ring-emerald-400/45",
    bg: "bg-emerald-950/95",
    border: "border-emerald-400/40",
    icon: "bg-emerald-400 text-black",
    progress: "bg-emerald-300",
    label: "Success",
  },
  info: {
    ring: "ring-cyan-400/45",
    bg: "bg-cyan-950/95",
    border: "border-cyan-400/40",
    icon: "bg-cyan-300 text-black",
    progress: "bg-cyan-200",
    label: "Info",
  },
  warning: {
    ring: "ring-amber-400/45",
    bg: "bg-amber-950/95",
    border: "border-amber-400/40",
    icon: "bg-amber-300 text-black",
    progress: "bg-amber-200",
    label: "Notice",
  },
  error: {
    ring: "ring-red-400/45",
    bg: "bg-red-950/95",
    border: "border-red-400/40",
    icon: "bg-red-400 text-black",
    progress: "bg-red-300",
    label: "Error",
  },
};

/**
 * @param {{ toast: { message: string, type: keyof TYPE_STYLES, tick: number } | null, onDismiss?: () => void }} props
 */
export function ActionToast({ toast, onDismiss }) {
  if (!toast) return null;

  const style = TYPE_STYLES[toast.type] ?? TYPE_STYLES.success;

  return (
    <div
      key={toast.tick}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="action-toast"
      data-toast-type={toast.type}
      className={`action-toast pointer-events-auto fixed bottom-6 left-1/2 z-[10000] flex max-w-[min(92vw,28rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl ring-2 backdrop-blur-md ${style.bg} ${style.border} ${style.ring}`}
    >
      <span
        className={`action-toast-icon mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${style.icon}`}
        aria-hidden
      >
        ✓
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">{style.label}</div>
        <p className="mt-0.5 text-sm font-semibold leading-snug text-white">{toast.message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-white/50 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      ) : null}
      <div
        className={`action-toast-progress absolute bottom-0 left-3 right-3 h-0.5 origin-left rounded-full ${style.progress}`}
        style={{ animationDuration: `${ACTION_TOAST_MS}ms` }}
      />
    </div>
  );
}
