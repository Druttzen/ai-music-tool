"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "./ui-blocks";
import { GUIDED_PANEL_IDS } from "../lib/suno-guided-step-focus";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceAnalyzerState,
} from "../context/project-workspace-context";
import { GuidedFocusPanel } from "./guided-focus-panel";
import {
  CANVAS_ADDON,
  CANVAS_DESKTOP_REQUIRED,
  formatCanvasInstallStatus,
  getCanvasAddonStatus,
  installCanvasAddon,
  isDesktopAddonHost,
  launchCanvasAddon,
} from "../lib/canvas-addon-client";
import { fetchSidecarHealth } from "../lib/sidecar-bridge";
import {
  formatSidecarDeviceSummary,
  formatSidecarExtraRowStatus,
  formatSidecarInstallEnvChip,
  formatSidecarProcessChip,
  listSidecarCapabilityRows,
  sortSidecarCapabilityRows,
} from "../lib/sidecar-capabilities";
import {
  formatSidecarExtraInstallStatus,
  installSidecarExtra,
  normalizeSidecarExtraId,
  probeSidecarExtraInstallEnv,
  sidecarExtraInstallStatusTone,
  sidecarExtraNpmHint,
} from "../lib/sidecar-extra-install-client";

/** @deprecated Prefer AddonsPanel — kept for any lingering imports. */
export function CanvasIntegrationPanel() {
  return <AddonsPanel />;
}

/** @param {"ok"|"info"|"warn"|"muted"|"bad"} tone */
function statusChipClass(tone) {
  switch (tone) {
    case "ok":
      return "border-emerald-400/35 bg-emerald-500/15 text-emerald-50";
    case "info":
      return "border-cyan-400/35 bg-cyan-500/15 text-cyan-50";
    case "warn":
      return "border-amber-400/35 bg-amber-500/15 text-amber-50";
    case "bad":
      return "border-rose-400/35 bg-rose-500/15 text-rose-50";
    default:
      return "border-white/15 bg-black/30 text-white/60";
  }
}

export function AddonsPanel() {
  const { setStatusWithTime, refreshSidecarCapabilities } = useProjectWorkspaceActions();
  const { sidecarAiStatus } = useProjectWorkspaceAnalyzerState();
  const desktop = isDesktopAddonHost();
  const [canvasStatus, setCanvasStatus] = useState({ ...CANVAS_ADDON, installed: false });
  const [capabilityRows, setCapabilityRows] = useState(
    /** @type {{ id: string, title: string, install_hint: string, available: boolean, commercial_use?: boolean|null, license?: string, tasks?: string[] }[]} */ ([]),
  );
  const [deviceSummary, setDeviceSummary] = useState("");
  const [capabilityCounts, setCapabilityCounts] = useState({ available: 0, total: 0 });
  const [installEnv, setInstallEnv] = useState(
    /** @type {{ mode: string, writable: boolean, message: string }|null} */ (null),
  );
  const [busyKey, setBusyKey] = useState(/** @type {string|null} */ (null));
  const [extraErrors, setExtraErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [extrasLoaded, setExtrasLoaded] = useState(false);

  const refreshCanvas = useCallback(async () => {
    try {
      setCanvasStatus(await getCanvasAddonStatus());
    } catch {
      setCanvasStatus({ ...CANVAS_ADDON, installed: false });
    }
  }, []);

  const refreshExtras = useCallback(async () => {
    try {
      const health = await fetchSidecarHealth();
      const rows = listSidecarCapabilityRows(health);
      setCapabilityRows(rows);
      setDeviceSummary(formatSidecarDeviceSummary(health));
      setCapabilityCounts({
        available: rows.filter((r) => r.available).length,
        total: rows.length,
      });
    } catch {
      setCapabilityRows([]);
      setDeviceSummary("");
      setCapabilityCounts({ available: 0, total: 0 });
    } finally {
      setExtrasLoaded(true);
    }
  }, []);

  const refreshInstallEnv = useCallback(async () => {
    try {
      setInstallEnv(await probeSidecarExtraInstallEnv());
    } catch {
      setInstallEnv({
        mode: "bundled-readonly",
        writable: false,
        message: "Could not probe sidecar install environment",
      });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshCanvas();
      void refreshExtras();
      void refreshInstallEnv();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshCanvas, refreshExtras, refreshInstallEnv]);

  useEffect(() => {
    if (sidecarAiStatus !== "ready") return undefined;
    const timer = setTimeout(() => {
      void refreshExtras();
    }, 0);
    return () => clearTimeout(timer);
  }, [sidecarAiStatus, refreshExtras]);

  const onInstallCanvas = useCallback(async () => {
    if (!desktop) {
      setStatusWithTime(CANVAS_DESKTOP_REQUIRED, "warning");
      return;
    }
    setBusyKey("canvas");
    try {
      setStatusWithTime("Downloading / installing AI Canvas Tool…");
      const result = await installCanvasAddon();
      setStatusWithTime(formatCanvasInstallStatus(result), result.ok ? "info" : "error");
      await refreshCanvas();
    } catch (error) {
      setStatusWithTime(error instanceof Error ? error.message : "Could not install Canvas", "error");
    } finally {
      setBusyKey(null);
    }
  }, [desktop, refreshCanvas, setStatusWithTime]);

  const onOpenCanvas = useCallback(async () => {
    if (!desktop) {
      setStatusWithTime(CANVAS_DESKTOP_REQUIRED, "warning");
      return;
    }
    setBusyKey("canvas-open");
    try {
      setStatusWithTime("Opening AI Canvas Tool…");
      const result = await launchCanvasAddon();
      const ok = result?.ok && result?.launched !== false;
      setStatusWithTime(ok ? "AI Canvas Tool opened" : result?.error || "Install AI Canvas Tool first", ok ? "info" : "error");
      await refreshCanvas();
    } catch (error) {
      setStatusWithTime(error instanceof Error ? error.message : "Could not open Canvas", "error");
    } finally {
      setBusyKey(null);
    }
  }, [desktop, refreshCanvas, setStatusWithTime]);

  const onInstallExtra = useCallback(
    async (extraId) => {
      const id = normalizeSidecarExtraId(extraId);
      const hint = sidecarExtraNpmHint(id);
      if (installEnv?.mode === "bundled-readonly") {
        setBusyKey(`extra:${id}`);
        try {
          if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(hint);
            setStatusWithTime(
              `${installEnv.message || "Packaged Studio cannot pip-install extras"} — copied “${hint}”`,
              "warning",
            );
          } else {
            setStatusWithTime(
              installEnv.message ||
                `Packaged Studio cannot pip-install extras — run ${hint} in a local checkout`,
              "warning",
            );
          }
        } catch {
          setStatusWithTime(
            installEnv.message || `Run in a local checkout: ${hint}`,
            "warning",
          );
        } finally {
          setBusyKey(null);
        }
        return;
      }
      setBusyKey(`extra:${id}`);
      setExtraErrors((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      try {
        setStatusWithTime(`Installing sidecar extra (${id})…`);
        const result = await installSidecarExtra(id);
        const tone = sidecarExtraInstallStatusTone(result);
        setStatusWithTime(formatSidecarExtraInstallStatus(result), tone);
        if (tone === "error" || result?.ok === false) {
          setExtraErrors((prev) => ({
            ...prev,
            [id]: formatSidecarExtraInstallStatus(result),
          }));
        }
        await refreshSidecarCapabilities({ waitForExtraId: id });
        await refreshExtras();
        await refreshInstallEnv();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Could not install extra";
        setExtraErrors((prev) => ({ ...prev, [id]: msg }));
        setStatusWithTime(msg, "error");
      } finally {
        setBusyKey(null);
      }
    },
    [installEnv, refreshExtras, refreshInstallEnv, refreshSidecarCapabilities, setStatusWithTime],
  );

  const busy = busyKey !== null;
  const bundledReadonly = installEnv?.mode === "bundled-readonly";
  const userDataBootstrap = installEnv?.mode === "user-data-bootstrap";
  const canPipInstall =
    installEnv?.writable === true ||
    installEnv?.mode === "writable" ||
    installEnv?.mode === "user-data-bootstrap";
  const installButtonLabel = (rowBusy) => {
    if (rowBusy) return "Installing…";
    if (bundledReadonly || !canPipInstall) return "Copy hint";
    if (!desktop) return "Copy hint";
    return userDataBootstrap ? "Install (first-time setup)" : "Install";
  };

  const processChip = formatSidecarProcessChip(sidecarAiStatus);
  const envChip = formatSidecarInstallEnvChip(installEnv);
  const extrasEmptyHint =
    sidecarAiStatus !== "ready"
      ? "Start the sidecar to load addon status."
      : extrasLoaded
        ? "No installable sidecar extras reported."
        : "Checking sidecar extras…";

  return (
    <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.canvasIntegration} column="left">
      <Panel
        title="Addons"
        hint="Canvas suite tool and optional sidecar ML extras (checkout .venv or packaged user-data venv)."
      >
        {!desktop ? (
          <p className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-50/90">
            {CANVAS_DESKTOP_REQUIRED}. Sidecar Install buttons copy the npm command in the browser.
          </p>
        ) : null}

        <div
          data-testid="addons-status-strip"
          className="mb-3 space-y-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              data-testid="addons-sidecar-process"
              className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusChipClass(processChip.tone)}`}
            >
              {processChip.label}
            </span>
            <span
              data-testid="addons-install-env"
              className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusChipClass(envChip.tone)}`}
              title={envChip.detail || undefined}
            >
              {envChip.label}
            </span>
            {capabilityCounts.total > 0 ? (
              <span
                data-testid="addons-sidecar-capabilities"
                className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/65"
              >
                {capabilityCounts.available}/{capabilityCounts.total} ready
              </span>
            ) : null}
          </div>
          {deviceSummary ? (
            <p className="text-[11px] text-white/65">
              Device: <span className="text-white/80">{deviceSummary}</span>
            </p>
          ) : null}
          {envChip.detail ? (
            <p data-testid="addons-install-env-detail" className="text-[11px] leading-relaxed text-white/55">
              {envChip.detail}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-emerald-50">{canvasStatus?.title || CANVAS_ADDON.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/75">
                {canvasStatus?.description || CANVAS_ADDON.description}
              </p>
            </div>
            <span
              data-testid="addons-canvas-status"
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                canvasStatus?.installed
                  ? statusChipClass("ok")
                  : statusChipClass("muted")
              }`}
            >
              {canvasStatus?.installed ? "Installed" : "Not installed"}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              disabled={busy || !desktop}
              onClick={() => void onInstallCanvas()}
              className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200 disabled:opacity-50"
            >
              {canvasStatus?.installed ? "Re-check Canvas" : "Download / Install Canvas"}
            </button>
            <button
              type="button"
              disabled={busy || !desktop}
              onClick={() => void onOpenCanvas()}
              className="rounded-2xl border border-emerald-300/40 bg-black/25 px-4 py-2 font-bold text-emerald-50 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              Open AI Canvas Tool
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">Sidecar extras</div>
            <button
              type="button"
              data-testid="addons-refresh-status"
              disabled={busy}
              onClick={() => {
                void refreshExtras();
                void refreshInstallEnv();
              }}
              className="rounded-md border border-white/15 bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/55 hover:bg-white/10 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          {capabilityRows.length === 0 ? (
            <p className="text-[11px] text-white/40">{extrasEmptyHint}</p>
          ) : (
            <ul className="space-y-2" data-testid="addons-capability-list">
              {sortSidecarCapabilityRows(capabilityRows, extraErrors, normalizeSidecarExtraId).map((cap) => {
                const id = normalizeSidecarExtraId(cap.id);
                const hint = cap.install_hint || sidecarExtraNpmHint(id);
                const rowBusy = busyKey === `extra:${id}`;
                const err = extraErrors[id];
                const installed = Boolean(cap.available);
                const rowStatus = formatSidecarExtraRowStatus(cap, { installing: rowBusy, error: err });
                const tasks = Array.isArray(cap.tasks) ? cap.tasks : [];
                return (
                  <li
                    key={cap.id}
                    data-testid={`addons-cap-${id}`}
                    data-available={installed ? "true" : "false"}
                    data-status={rowStatus.label.toLowerCase()}
                    className={`rounded-xl border px-3 py-2 ${rowStatus.borderClass}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="text-xs font-bold text-white/90">{cap.title}</div>
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusChipClass(rowStatus.tone)}`}
                          >
                            {rowStatus.label}
                          </span>
                          {cap.commercial_use === false ? (
                            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-100/80">
                              Non-commercial
                            </span>
                          ) : null}
                        </div>
                        {tasks.length > 0 ? (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {tasks.map((task) => (
                              <span
                                key={task}
                                className="rounded border border-white/10 bg-black/25 px-1.5 py-0.5 font-mono text-[9px] text-white/45"
                              >
                                {task}
                              </span>
                            ))}
                          </p>
                        ) : null}
                        <code className="mt-1 block truncate font-mono text-[10px] text-cyan-100/70">{hint}</code>
                        {cap.license ? (
                          <p className="mt-0.5 truncate text-[10px] text-white/40">{cap.license}</p>
                        ) : null}
                        {err ? (
                          <p className="mt-1 text-[10px] leading-snug text-rose-200/90">{err}</p>
                        ) : null}
                        {rowBusy ? (
                          <p className="mt-1 text-[10px] text-cyan-100/75">
                            Pip install in progress — large extras can take several minutes.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {!installed || err ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onInstallExtra(id)}
                            className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-[11px] font-bold text-cyan-50 hover:bg-cyan-500/25 disabled:opacity-50"
                          >
                            {err ? "Retry" : installButtonLabel(rowBusy)}
                          </button>
                        ) : (
                          <span className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-center text-[11px] font-bold text-emerald-100/80">
                            Ready
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>
    </GuidedFocusPanel>
  );
}
