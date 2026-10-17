"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { dismissProcess, getProcesses, getServerProcesses, subscribeProcesses } from "../lib/process-status";

export function ProcessStatusBar({ update } = {}) {
  const processes = useSyncExternalStore(subscribeProcesses, getProcesses, getServerProcesses);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const running = processes.filter((p) => p.state === "running");
  const failures = processes.filter((p) => p.state === "error");
  useEffect(() => {
    if (!running.length) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running.length]);
  if (!processes.length && !update?.visible) return null;
  const rows = expanded ? [...processes].reverse() : running.length ? running : processes.slice(-1);
  return (
    <section data-testid="process-status-bar" aria-label="Process status" className="fixed bottom-12 left-3 right-3 z-50 mx-auto max-w-2xl rounded-2xl border border-orange-400/30 bg-[#12161e]/95 p-3 text-xs text-white shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-bold text-orange-300" role="status">{running.length ? `${running.length} running` : "Recent activity"}{failures.length ? ` · ${failures.length} failed` : ""}</span>
        <button type="button" onClick={() => setExpanded(!expanded)} className="rounded px-2 py-1 hover:bg-white/10" aria-expanded={expanded}>{expanded ? "Show active" : `Activity (${processes.length})`}</button>
      </div>
      <div className="max-h-[35vh] space-y-3 overflow-y-auto">
        {update?.visible && <div role="status" className="text-orange-200"><p>{update.status || "Updating Studio…"}</p>{update.progressPct != null && <p>{update.progressPct}%</p>}</div>}
        {rows.map((p) => {
          const active = p.state === "running";
          const elapsed = Math.max(0, Math.floor(((active ? now : p.finishedAt) - p.startedAt) / 1000));
          const phase = String(p.phase || "Working").replace(/[-_]/g, " ");
          return (
            <div key={p.id} data-process-state={p.state}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="break-words font-semibold">{p.label}</p><p className={p.state === "error" ? "break-words text-red-300" : "break-words text-white/70"}>{active ? phase : p.state === "done" ? "Completed · 100%" : p.state === "cancelled" ? "Cancelled" : `Failed · ${p.detail}`}</p></div>
                <span className="shrink-0 tabular-nums text-white/60">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
                {!active && <button type="button" onClick={() => dismissProcess(p.id)} aria-label={`Dismiss ${p.label}`} className="px-1">×</button>}
              </div>
              {active && <>
                <div className="mt-1 flex flex-wrap gap-x-3 text-white/60">
                  {Number.isFinite(p.completedSteps) && p.totalSteps > 0 && <span>{p.completedSteps}/{p.totalSteps} steps complete</span>}
                  {p.pct != null ? <span>{Math.floor(p.pct)}% {p.unit === "audio frames" ? "of current stage" : "reported progress"}</span> : <span>In progress · total not yet known</span>}
                  {p.completed != null && p.total > 0 && <span>{p.completed.toLocaleString()}/{p.total.toLocaleString()} {p.unit || "items"}</span>}
                  {now - p.updatedAt > 15_000 && <span>Waiting for next progress update</span>}
                </div>
                <div role="progressbar" aria-label={`${p.label}: ${phase}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct ?? undefined} className="mt-1 h-1 overflow-hidden rounded bg-white/10">
                  <div className={`h-full rounded bg-orange-400 ${p.pct == null ? "w-1/3 animate-pulse" : "transition-[width]"}`} style={p.pct == null ? undefined : { width: `${p.pct}%` }} />
                </div>
              </>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
