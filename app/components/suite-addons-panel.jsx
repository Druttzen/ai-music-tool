"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "./ui-blocks";
import { GUIDED_PANEL_IDS } from "../lib/suno-guided-step-focus";
import { useGuidedFocus } from "../context/guided-focus-context";
import { useProjectWorkspaceActions } from "../context/project-workspace-context";
import { GuidedFocusPanel } from "./guided-focus-panel";
import {
  CANVAS_ADDON,
  formatCanvasInstallStatus,
  getCanvasAddonStatus,
  installCanvasAddon,
  launchCanvasAddon,
} from "../lib/suite-addons-client";

export function SuiteAddonsPanel() {
  const { setStatusWithTime } = useProjectWorkspaceActions();
  const { focused } = useGuidedFocus();
  const [status, setStatus] = useState({
    installed: false,
    title: CANVAS_ADDON.title,
    description: CANVAS_ADDON.description,
  });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await getCanvasAddonStatus();
      setStatus(next);
    } catch {
      setStatus((prev) => ({ ...prev, installed: false }));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const onInstall = useCallback(async () => {
    setBusy(true);
    try {
      setStatusWithTime("Downloading / installing AI Canvas Tool…");
      const result = await installCanvasAddon();
      setStatusWithTime(formatCanvasInstallStatus(result), result.ok ? "info" : "error");
      await refresh();
    } catch (err) {
      setStatusWithTime(
        err instanceof Error ? err.message : "Could not install Canvas addon",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }, [refresh, setStatusWithTime]);

  const onOpen = useCallback(async () => {
    setBusy(true);
    try {
      setStatusWithTime("Opening AI Canvas Tool…");
      const result = await launchCanvasAddon();
      if (result?.ok && result?.launched !== false) {
        setStatusWithTime("AI Canvas Tool opened");
      } else if (result?.error) {
        setStatusWithTime(result.error, "error");
      } else {
        setStatusWithTime("Install AI Canvas Tool first (Download / Install)", "error");
      }
      await refresh();
    } catch (err) {
      setStatusWithTime(
        err instanceof Error ? err.message : "Could not open Canvas Tool",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }, [refresh, setStatusWithTime]);

  return (
    <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.suiteAddons} column="left">
      <Panel
        title="Suite Addons"
        hint="Optional suite apps fused into Music Creator. Canvas Tool builds Spotify loops from album art."
      >
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-emerald-50">{status.title || CANVAS_ADDON.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/75">
                {status.description || CANVAS_ADDON.description}
              </p>
            </div>
            <span
              className={
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider " +
                (status.installed
                  ? "border border-emerald-300/40 bg-emerald-300/20 text-emerald-100"
                  : "border border-white/15 bg-black/30 text-white/55")
              }
            >
              {status.installed ? "Installed" : "Not installed"}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onInstall()}
              className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200 disabled:opacity-50"
              title="Download or open the Canvas Tool installer"
            >
              {status.installed ? "Re-check / Update Canvas" : "Download / Install Canvas"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onOpen()}
              className="rounded-2xl border border-emerald-300/40 bg-black/30 px-4 py-2 font-bold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
              title="Launch AI Canvas Tool"
            >
              Open Canvas Tool
            </button>
          </div>
        </div>
        {focused ? null : (
          <p className="mt-2 text-[10px] text-white/40">
            After install, drop album art in Analyzers → Open in Canvas Tool for Spotify loop handoff.
          </p>
        )}
      </Panel>
    </GuidedFocusPanel>
  );
}
