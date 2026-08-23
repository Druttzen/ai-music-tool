"use client";

export function StartupInstallOverlay({
  open,
  phase,
  percent = 0,
  etaLabel,
  sizeLabel,
  statusLine,
  detailLine,
  currentTitle,
  completedCount = 0,
  totalCount = 0,
  errors = [],
  dismissable = false,
  dismiss,
}) {
  if (!open) return null;

  const barWidth = phase === "done" ? 100 : Math.max(2, Math.min(100, Number(percent) || 0));
  const showBar = phase === "checking" || phase === "installing" || phase === "done" || phase === "error";
  const canDismiss = dismissable && typeof dismiss === "function";

  return (
    <div
      data-testid="startup-install-overlay"
      data-phase={phase}
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-[#0b0d10]/80 p-4"
    >
      <div className="w-full max-w-lg rounded-[2rem] border border-orange-300/25 bg-black/80 p-8 text-center shadow-2xl backdrop-blur">
        <div className="text-xs font-black uppercase tracking-[0.35em] text-orange-300">
          Studio setup
        </div>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Installing addons</h2>
        <p data-testid="startup-install-status" className="mt-3 text-sm text-white/70">
          {statusLine || "Preparing…"}
        </p>
        {currentTitle ? (
          <p className="mt-1 text-xs font-bold text-cyan-100/80">{currentTitle}</p>
        ) : null}
        {totalCount > 0 ? (
          <p className="mt-1 text-[11px] uppercase tracking-wider text-white/40">
            {completedCount} of {totalCount} complete
          </p>
        ) : null}

        {showBar ? (
          <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              data-testid="startup-install-progress"
              className={`h-full rounded-full bg-gradient-to-r from-orange-300 to-cyan-300 ${
                phase === "checking" ? "w-1/3 animate-pulse" : ""
              }`}
              style={phase === "checking" ? undefined : { width: `${barWidth}%` }}
            />
          </div>
        ) : null}

        <div className="mt-4 grid gap-1 text-sm text-white/75">
          {sizeLabel ? (
            <p data-testid="startup-install-size">{sizeLabel}</p>
          ) : null}
          {etaLabel ? (
            <p data-testid="startup-install-eta">{etaLabel}</p>
          ) : null}
        </div>

        {detailLine ? (
          <p className="mt-3 max-h-16 overflow-hidden font-mono text-[11px] leading-snug text-white/45">
            {detailLine}
          </p>
        ) : null}

        {phase === "blocked" && !detailLine ? (
          <p className="mt-4 text-xs leading-relaxed text-amber-100/80">
            The app will keep working. You can install extras later from Addons.
          </p>
        ) : null}

        {Array.isArray(errors) && errors.length > 0 ? (
          <ul className="mt-4 max-h-24 overflow-auto text-left text-[11px] text-rose-200/90">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        ) : null}

        {canDismiss ? (
          <button
            type="button"
            onClick={dismiss}
            className="mt-6 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/20"
          >
            Continue
          </button>
        ) : (
          <p className="mt-6 text-[11px] text-white/35">This window stays open until setup finishes.</p>
        )}
      </div>
    </div>
  );
}
