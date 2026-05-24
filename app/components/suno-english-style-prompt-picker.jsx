"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildEnglishSunoStylePromptSections,
  getEnglishSunoStylePromptStats,
} from "../lib/suno-english-style-index";

function previewLine(text, max = 100) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * @param {object} props
 * @param {(msg: string) => void} props.setStatusWithTime
 * @param {string} props.rules
 * @param {React.Dispatch<React.SetStateAction<string>>} props.setRules
 */
export function SunoEnglishStylePromptPicker({ setStatusWithTime, rules, setRules }) {
  const sections = useMemo(() => buildEnglishSunoStylePromptSections(), []);
  const stats = useMemo(() => getEnglishSunoStylePromptStats(), []);

  const [open, setOpen] = useState(false);
  const [sectionKey, setSectionKey] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    const sunoSection = sections.find((s) => s.sectionId === "cat-sunoV55GenreWheel");
    // #region agent log
    fetch("http://127.0.0.1:7508/ingest/9c8bfb19-d6a5-4ab4-bf6e-336680cebd6d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b92901" }, body: JSON.stringify({ sessionId: "b92901", runId: "pre-fix", hypothesisId: "D", location: "app/components/suno-english-style-prompt-picker.jsx:32", message: "Suno English style picker mounted", data: { sectionCount: sections.length, lineCount: stats.lineCount, hasSunoWheelSection: Boolean(sunoSection), sunoWheelCount: sunoSection?.items.length ?? 0 }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
  }, [sections, stats.lineCount]);

  const idToItem = useMemo(() => {
    const m = new Map();
    for (const sec of sections) {
      for (const it of sec.items) m.set(it.id, it);
    }
    return m;
  }, [sections]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];
    for (const sec of sections) {
      if (sectionKey !== "all" && sec.sectionId !== sectionKey) continue;
      for (const it of sec.items) {
        if (q) {
          const hay = `${it.text} ${it.label || ""} ${sec.sectionTitle}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        out.push({ ...it, sectionTitle: sec.sectionTitle });
      }
    }
    return out;
  }, [sections, sectionKey, query]);

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7508/ingest/9c8bfb19-d6a5-4ab4-bf6e-336680cebd6d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b92901" }, body: JSON.stringify({ sessionId: "b92901", runId: "pre-fix", hypothesisId: "C", location: "app/components/suno-english-style-prompt-picker.jsx:63", message: "Suno English style picker visibility state", data: { open, sectionKey, query, visibleCount: visibleItems.length, sunoSectionVisible: sectionKey === "all" || sectionKey === "cat-sunoV55GenreWheel", firstVisibleSection: visibleItems[0]?.sectionTitle }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
  }, [open, query, sectionKey, visibleItems]);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const v of visibleItems) next.add(v.id);
      return next;
    });
  }, [visibleItems]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const addSelectedToRules = useCallback(() => {
    if (selected.size === 0) {
      setStatusWithTime("Check one or more lines to add to Rules");
      return;
    }
    const toAdd = [];
    for (const id of selected) {
      const it = idToItem.get(id);
      if (it) toAdd.push(it.text);
    }
    const prev = rules.trim();
    const low = prev.toLowerCase();
    const fresh = [];
    for (const chunk of toAdd) {
      const c = chunk.trim();
      if (!c) continue;
      const head = c.slice(0, 64).toLowerCase();
      if (low && low.includes(head)) continue;
      fresh.push(c);
    }
    if (fresh.length === 0) {
      setStatusWithTime("Selected lines are already present in Rules (or empty)");
      return;
    }
    const sep = prev ? ", " : "";
    setRules((r) => `${r.trim()}${sep}${fresh.join(", ")}`);
    setStatusWithTime(`Added ${fresh.length} line(s) to Rules`);
    setSelected(new Set());
  }, [idToItem, rules, selected, setRules, setStatusWithTime]);

  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div>
          <div className="text-[11px] font-bold text-emerald-200">Add from English prompt index</div>
          <div className="text-[10px] text-white/45">
            {stats.lineCount} English-only lines in {stats.sectionCount} groups (catalog + Suno index). Opens a
            filterable checklist for <span className="text-white/60">Rules</span>.
          </div>
        </div>
        <span className="text-sm text-emerald-200/90">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-white/45">Section</div>
              <select
                value={sectionKey}
                onChange={(e) => setSectionKey(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 p-2 text-xs text-white outline-none"
              >
                <option value="all">All sections</option>
                {sections.map((s) => (
                  <option key={s.sectionId} value={s.sectionId}>
                    {s.sectionTitle} ({s.items.length})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-white/45">Search</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by word…"
                className="w-full rounded-xl border border-white/10 bg-black/40 p-2 text-xs text-white outline-none placeholder:text-white/30"
              />
            </label>
          </div>

          <p className="text-[10px] leading-relaxed text-white/45">
            Only lines written in English (Latin script) are listed. Excludes other scripts. Selected chunks append to{" "}
            <strong className="text-white/60">Pro Mode → Rules</strong> (comma-separated). For huge reference blocks, trim
            after if you near the Style cap.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/80 hover:bg-white/10"
            >
              Select all visible ({visibleItems.length})
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/80 hover:bg-white/10"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={addSelectedToRules}
              className="rounded-lg bg-emerald-300 px-2 py-1 text-[10px] font-bold text-black hover:bg-emerald-200"
            >
              Add selected to Rules ({selected.size})
            </button>
          </div>

          <div className="max-h-[min(48vh,420px)] space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-2 pr-1">
            {visibleItems.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-white/40">No matches. Change section or search.</div>
            ) : (
              visibleItems.map((it) => (
                <label
                  key={it.id}
                  className="flex cursor-pointer gap-2 rounded-lg border border-white/5 bg-black/25 p-1.5 hover:border-white/15"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(it.id)}
                    onChange={() => toggle(it.id)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/30"
                  />
                  <span className="min-w-0">
                    {it.label ? (
                      <span className="block text-[10px] font-bold text-cyan-200/90">{it.label}</span>
                    ) : null}
                    <span
                      className="block break-words font-mono text-[10px] leading-snug text-white/75"
                      title={it.isLong ? it.text : undefined}
                    >
                      {it.isLong ? previewLine(it.text, 200) : it.text}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-white/35">{it.sectionTitle}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
