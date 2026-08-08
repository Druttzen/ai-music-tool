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
  countAvailableSidecarCapabilities,
  formatSidecarDeviceSummary,
  missingSidecarInstallHints,
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

export function AddonsPanel() {
  const { setStatusWithTime, refreshSidecarCapabilities } = useProjectWorkspaceActions();
  const { sidecarAiStatus } = useProjectWorkspaceAnalyzerState();
  const desktop = isDesktopAddonHost();
  const [canvasStatus, setCanvasStatus] = useState({ ...CANVAS_ADDON, installed: false });
  const [missingExtras, setMissingExtras] = useState([]);
  const [deviceSummary, setDeviceSummary] = useState("");
  const [capabilityCounts, setCapabilityCounts] = useState({ available: 0, total: 0 });
  const [installEnv, setInstallEnv] = useState(
    /** @type {{ mode: string, writable: boolean, message: string }|null} */ (null),
  );
  const [busyKey, setBusyKey] = useState(/** @type {string|null} */ (null));
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
      setMissingExtras(missingSidecarInstallHints(health));
      setDeviceSummary(formatSidecarDeviceSummary(health));
      setCapabilityCounts(countAvailableSidecarCapabilities(health));
    } catch {
      setMissingExtras([]);
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
      try {
        setStatusWithTime(`Installing sidecar extra (${id})…`);
        const result = await installSidecarExtra(id);
        setStatusWithTime(
          formatSidecarExtraInstallStatus(result),
          sidecarExtraInstallStatusTone(result),
        );
        await refreshSidecarCapabilities({ waitForExtraId: id });
        await refreshExtras();
        await refreshInstallEnv();
      } catch (error) {
        setStatusWithTime(error instanceof Error ? error.message : "Could not install extra", "error");
      } finally {
        setBusyKey(null);
      }
    },
    [installEnv, refreshExtras, refreshInstallEnv, refreshSidecarCapabilities, setStatusWithTime],
  );

  const busy = busyKey !== null;
  const extrasEmptyHint =
    sidecarAiStatus !== "ready"
      ? "Start the sidecar to see missing extras."
      : extrasLoaded
        ? "All detected sidecar extras are installed."
        : "Checking sidecar extras…";
  const bundledReadonly = installEnv?.mode === "bundled-readonly";
  const userDataBootstrap = installEnv?.mode === "user-data-bootstrap";
  const canPipInstall =
    installEnv?.writable === true ||
    installEnv?.mode === "writable" ||
    installEnv?.mode === "user-data-bootstrap";
  const installButtonLabel = (rowBusy) => {
    if (rowBusy) return "Installing…";
    if (bundledReadonly || !canPipInstall) return "Copy hint";
    if (!desktop && !canPipInstall) return "Copy hint";
    if (!desktop) return "Copy hint";
    return userDataBootstrap ? "Install (first-time setup)" : "Install";
  };

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

        {deviceSummary || capabilityCounts.total > 0 ? (
          <p
            data-testid="addons-sidecar-capabilities"
            className="mb-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/65"
          >
            {deviceSummary ? <span className="block text-white/80">Device: {deviceSummary}</span> : null}
            {capabilityCounts.total > 0 ? (
              <span className="mt-0.5 block">
                Capabilities: {capabilityCounts.available}/{capabilityCounts.total} available
              </span>
            ) : null}
          </p>
        ) : null}

        {bundledReadonly ? (
          <p
            data-testid="addons-bundled-readonly"
            className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-50/90"
          >
            {installEnv?.message ||
              "Packaged Studio cannot pip-install extras — install Python 3.10–3.12 or use a local ai-sidecar/.venv / npm hint."}
          </p>
        ) : null}

        {userDataBootstrap ? (
          <p
            data-testid="addons-user-data-bootstrap"
            className="mb-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-50/90"
          >
            {installEnv?.message ||
              "First Install creates a writable sidecar venv under app data (Python 3.10–3.12 required)."}
          </p>
        ) : null}

        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-emerald-50">{canvasStatus?.title || CANVAS_ADDON.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/75">
                {canvasStatus?.description || CANVAS_ADDON.description}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/60">
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
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">Sidecar extras</div>
          {missingExtras.length === 0 ? (
            <p className="text-[11px] text-white/40">{extrasEmptyHint}</p>
          ) : (
            <ul className="space-y-2">
              {missingExtras.map((cap) => {
                const id = normalizeSidecarExtraId(cap.id);
                const hint = cap.install_hint || sidecarExtraNpmHint(id);
                const rowBusy = busyKey === `extra:${id}`;
                return (
                  <li
                    key={cap.id}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white/85">{cap.title}</div>
                        <code className="mt-0.5 block truncate font-mono text-[10px] text-cyan-100/70">{hint}</code>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onInstallExtra(id)}
                        className="shrink-0 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-[11px] font-bold text-cyan-50 hover:bg-cyan-500/25 disabled:opacity-50"
                      >
                        {installButtonLabel(rowBusy)}
                      </button>
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
