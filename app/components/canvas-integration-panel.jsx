"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "./ui-blocks";
import { GUIDED_PANEL_IDS } from "../lib/suno-guided-step-focus";
import { useProjectWorkspaceActions } from "../context/project-workspace-context";
import { GuidedFocusPanel } from "./guided-focus-panel";
import {
  CANVAS_ADDON,
  formatCanvasInstallStatus,
  getCanvasAddonStatus,
  installCanvasAddon,
  launchCanvasAddon,
} from "../lib/canvas-addon-client";

export function CanvasIntegrationPanel() {
  const { setStatusWithTime } = useProjectWorkspaceActions();
  const [status, setStatus] = useState({ ...CANVAS_ADDON, installed: false });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getCanvasAddonStatus());
    } catch {
      setStatus({ ...CANVAS_ADDON, installed: false });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const onInstall = useCallback(async () => {
    setBusy(true);
    try {
      setStatusWithTime("Downloading / installing AI Canvas Tool…");
      const result = await installCanvasAddon();
      setStatusWithTime(formatCanvasInstallStatus(result), result.ok ? "info" : "error");
      await refresh();
    } catch (error) {
      setStatusWithTime(error instanceof Error ? error.message : "Could not install Canvas", "error");
    } finally {
      setBusy(false);
    }
  }, [refresh, setStatusWithTime]);

  const onOpen = useCallback(async () => {
    setBusy(true);
    try {
      setStatusWithTime("Opening AI Canvas Tool…");
      const result = await launchCanvasAddon();
      setStatusWithTime(
        result?.ok && result?.launched !== false
          ? "AI Canvas Tool opened"
          : result?.error || "Install AI Canvas Tool first",
        result?.ok && result?.launched !== false ? "info" : "error",
      );
      await refresh();
    } catch (error) {
      setStatusWithTime(error instanceof Error ? error.message : "Could not open Canvas", "error");
    } finally {
      setBusy(false);
    }
  }, [refresh, setStatusWithTime]);

  return (
    <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.canvasIntegration} column="left">
      <Panel title="Canvas Integration" hint="The visual exception: turn music and album art into short Canvas loops.">
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-emerald-50">{status?.title || CANVAS_ADDON.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/75">
                {status?.description || CANVAS_ADDON.description}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/60">
              {status?.installed ? "Installed" : "Not installed"}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            <button type="button" disabled={busy} onClick={() => void onInstall()} className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200 disabled:opacity-50">
              {status?.installed ? "Re-check / Update Canvas" : "Download / Install Canvas"}
            </button>
            <button type="button" disabled={busy} onClick={() => void onOpen()} className="rounded-2xl border border-emerald-300/40 bg-black/25 px-4 py-2 font-bold text-emerald-50 hover:bg-emerald-500/20 disabled:opacity-50">
              Open AI Canvas Tool
            </button>
          </div>
        </div>
      </Panel>
    </GuidedFocusPanel>
  );
}
