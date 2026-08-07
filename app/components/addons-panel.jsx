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
import { missingSidecarInstallHints } from "../lib/sidecar-capabilities";
import {
  formatSidecarExtraInstallStatus,
  installSidecarExtra,
  normalizeSidecarExtraId,
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
    } catch {
      setMissingExtras([]);
    } finally {
      setExtrasLoaded(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshCanvas();
      void refreshExtras();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshCanvas, refreshExtras]);

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
      setBusyKey(`extra:${id}`);
      try {
        setStatusWithTime(`Installing sidecar extra (${id})…`);
        const result = await installSidecarExtra(id);
        setStatusWithTime(formatSidecarExtraInstallStatus(result), result.ok ? "info" : "error");
        await refreshSidecarCapabilities();
        await refreshExtras();
      } catch (error) {
        setStatusWithTime(error instanceof Error ? error.message : "Could not install extra", "error");
      } finally {
        setBusyKey(null);
      }
    },
    [refreshExtras, refreshSidecarCapabilities, setStatusWithTime],
  );

  const busy = busyKey !== null;
  const extrasEmptyHint =
    sidecarAiStatus !== "ready"
      ? "Start the sidecar to see missing extras."
      : extrasLoaded
        ? "All detected sidecar extras are installed."
        : "Checking sidecar extras…";

  return (
    <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.canvasIntegration} column="left">
      <Panel
        title="Addons"
        hint="Canvas suite tool and optional sidecar ML extras (install needs a local ai-sidecar/.venv)."
      >
        {!desktop ? (
          <p className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-50/90">
            {CANVAS_DESKTOP_REQUIRED}. Sidecar Install buttons copy the npm command in the browser.
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
              {canvasStatus?.installed ? "Re-check / Update Canvas" : "Download / Install Canvas"}
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
                        {rowBusy ? "Installing…" : "Install"}
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
