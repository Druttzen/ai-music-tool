"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "./ui-blocks";
import { GUIDED_PANEL_IDS } from "../lib/suno-guided-step-focus";
import { useProjectWorkspaceActions } from "../context/project-workspace-context";
import { GuidedFocusPanel } from "./guided-focus-panel";
import {
  SUITE_ADDON_CATALOG,
  formatAddonInstallStatus,
  getAddonStatus,
  installAddon,
  launchAddon,
} from "../lib/suite-addons-client";

function AddonCard({ addon, status, busy, onInstall, onOpen }) {
  const installed = Boolean(status?.installed);
  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-emerald-50">{status?.title || addon.title}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/75">
            {status?.description || addon.description}
          </p>
        </div>
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider " +
            (installed
              ? "border border-emerald-300/40 bg-emerald-300/20 text-emerald-100"
              : "border border-white/15 bg-black/30 text-white/55")
          }
        >
          {installed ? "Installed" : "Not installed"}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onInstall(addon.id)}
          className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200 disabled:opacity-50"
        >
          {installed ? `Re-check / Update ${addon.title}` : `Download / Install ${addon.title}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onOpen(addon.id)}
          className="rounded-2xl border border-emerald-300/40 bg-black/25 px-4 py-2 font-bold text-emerald-50 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          Open {addon.title}
        </button>
      </div>
    </div>
  );
}

export function SuiteAddonsPanel() {
  const { setStatusWithTime } = useProjectWorkspaceActions();
  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(SUITE_ADDON_CATALOG.map((a) => [a.id, { ...a, installed: false }])),
  );
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = {};
    for (const addon of SUITE_ADDON_CATALOG) {
      try {
        next[addon.id] = await getAddonStatus(addon.id);
      } catch {
        next[addon.id] = { ...addon, installed: false };
      }
    }
    setStatuses(next);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const onInstall = useCallback(
    async (addonId) => {
      setBusy(true);
      try {
        const addon = SUITE_ADDON_CATALOG.find((a) => a.id === addonId);
        setStatusWithTime(`Downloading / installing ${addon?.title || addonId}…`);
        const result = await installAddon(addonId);
        setStatusWithTime(formatAddonInstallStatus(result, addonId), result.ok ? "info" : "error");
        await refresh();
      } catch (err) {
        setStatusWithTime(err instanceof Error ? err.message : "Could not install addon", "error");
      } finally {
        setBusy(false);
      }
    },
    [refresh, setStatusWithTime],
  );

  const onOpen = useCallback(
    async (addonId) => {
      setBusy(true);
      try {
        const addon = SUITE_ADDON_CATALOG.find((a) => a.id === addonId);
        setStatusWithTime(`Opening ${addon?.title || addonId}…`);
        const result = await launchAddon(addonId);
        if (result?.ok && result?.launched !== false) {
          setStatusWithTime(`${addon?.title || addonId} opened`);
        } else if (result?.error) {
          setStatusWithTime(result.error, "error");
        } else {
          setStatusWithTime(`Install ${addon?.title || addonId} first (Download / Install)`, "error");
        }
        await refresh();
      } catch (err) {
        setStatusWithTime(err instanceof Error ? err.message : "Could not open addon", "error");
      } finally {
        setBusy(false);
      }
    },
    [refresh, setStatusWithTime],
  );

  return (
    <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.suiteAddons} column="left">
      <Panel
        title="Suite Addons"
        hint="Optional suite apps: Canvas (Spotify loops) and Music Video (Glitchframe)."
      >
        <div className="space-y-3">
          {SUITE_ADDON_CATALOG.map((addon) => (
            <AddonCard
              key={addon.id}
              addon={addon}
              status={statuses[addon.id]}
              busy={busy}
              onInstall={onInstall}
              onOpen={onOpen}
            />
          ))}
        </div>
      </Panel>
    </GuidedFocusPanel>
  );
}
