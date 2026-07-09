"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  buildEnglishSunoStylePromptSections,
  getEnglishSunoStylePromptStats,
} from "../lib/suno-english-style-index";
import { awesomeSunoConceptTags } from "../lib/awesome-suno-concepts-synced";
import { generateMetaphorStyle, metaphorToCatalogHints } from "../lib/metaphor-style";
import { Pill } from "./ui-blocks";

const FEATURED_SECTIONS = [
  { id: "cat-eraAnchoredGenres", label: "Era anchors" },
  { id: "cat-trendMicroGenres2026", label: "2026 trends" },
  { id: "cat-awesomeSunoConcepts", label: "CC0 concepts" },
];

const VISIBLE_CAP = 150;
const SEARCH_MIN_ALL = 2;

function previewLine(text, max = 100) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function mergeUniqueStrings(prev, incoming) {
  const out = [...prev];
  const seen = new Set(prev.map((x) => x.toLowerCase()));
  for (const raw of incoming) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Unified style prompt picker — all catalog + index + genre wheel lines in one dropdown.
 * @param {object} props
 * @param {string[]} props.selectedGenres
 * @param {React.Dispatch<React.SetStateAction<string[]>>} props.setSelectedGenres
 * @param {string} props.rules
 * @param {React.Dispatch<React.SetStateAction<string>>} props.setRules
 * @param {(msg: string) => void} props.setStatusWithTime
 * @param {boolean} [props.defaultOpen]
 */
export function StylePromptPicker({
  selectedGenres,
  setSelectedGenres,
  rules,
  setRules,
  setStatusWithTime,
  defaultOpen = false,
}) {
  const sections = useMemo(() => buildEnglishSunoStylePromptSections(), []);
  const stats = useMemo(() => getEnglishSunoStylePromptStats(), []);

  const [open, setOpen] = useState(defaultOpen);
  const [sectionKey, setSectionKey] = useState("all");
  const [query, setQuery] = useState("");
  const [cc0TagFilter, setCc0TagFilter] = useState("all");
  const [cc0ActiveTags, setCc0ActiveTags] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());

  const cc0TagOptions = useMemo(() => {
    const tags = new Set(Object.values(awesomeSunoConceptTags || {}));
    return ["all", ...Array.from(tags).sort()];
  }, []);

  const idToItem = useMemo(() => {
    const m = new Map();
    for (const sec of sections) {
      for (const it of sec.items) m.set(it.id, it);
    }
    return m;
  }, [sections]);

  const { visibleItems, visibleTotal, searchRequired } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];
    let total = 0;

    for (const sec of sections) {
      if (sectionKey !== "all" && sec.sectionId !== sectionKey) continue;
      for (const it of sec.items) {
        if (
          sectionKey === "cat-awesomeSunoConcepts" &&
          cc0TagFilter !== "all" &&
          awesomeSunoConceptTags?.[it.text] !== cc0TagFilter
        ) {
          continue;
        }
        if (sectionKey === "cat-awesomeSunoConcepts" && cc0ActiveTags.size > 0) {
          const tag = awesomeSunoConceptTags?.[it.text];
          if (!tag || !cc0ActiveTags.has(tag)) continue;
        }
        if (q) {
          const hay = `${it.text} ${it.label || ""} ${sec.sectionTitle}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        total += 1;
        if (out.length < VISIBLE_CAP) {
          out.push({ ...it, sectionTitle: sec.sectionTitle });
        }
      }
    }

    const needsSearch = sectionKey === "all" && q.length < SEARCH_MIN_ALL;

    return { visibleItems: needsSearch ? [] : out, visibleTotal: total, searchRequired: needsSearch };
  }, [sections, sectionKey, query, cc0TagFilter, cc0ActiveTags]);

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

  const textsFromSelection = useCallback(() => {
    const toAdd = [];
    for (const id of selected) {
      const it = idToItem.get(id);
      if (it?.text) toAdd.push(it.text.trim());
    }
    return toAdd;
  }, [idToItem, selected]);

  const addSelectedToStyles = useCallback(() => {
    if (selected.size === 0) {
      setStatusWithTime("Check one or more style prompts first");
      return;
    }
    const toAdd = textsFromSelection();
    setSelectedGenres((prev) => {
      const merged = mergeUniqueStrings(prev, toAdd);
      return merged;
    });
    setStatusWithTime(`Added ${toAdd.length} style prompt(s) to Styles`);
    setSelected(new Set());
  }, [selected, setSelectedGenres, setStatusWithTime, textsFromSelection]);

  const replaceStylesWithSelected = useCallback(() => {
    if (selected.size === 0) {
      setStatusWithTime("Check one or more style prompts first");
      return;
    }
    const next = textsFromSelection();
    setSelectedGenres(next);
    setStatusWithTime(`Replaced Styles with ${next.length} prompt(s)`);
    setSelected(new Set());
  }, [selected, setSelectedGenres, setStatusWithTime, textsFromSelection]);

  const addSelectedToRules = useCallback(() => {
    if (selected.size === 0) {
      setStatusWithTime("Check one or more style prompts first");
      return;
    }
    const toAdd = textsFromSelection();
    const prev = rules.trim();
    const low = prev.toLowerCase();
    const fresh = [];
    for (const chunk of toAdd) {
      const head = chunk.slice(0, 64).toLowerCase();
      if (low && low.includes(head)) continue;
      fresh.push(chunk);
    }
    if (fresh.length === 0) {
      setStatusWithTime("Selected lines are already present in Rules (or empty)");
      return;
    }
    const sep = prev ? ", " : "";
    setRules((r) => `${r.trim()}${sep}${fresh.join(", ")}`);
    setStatusWithTime(`Added ${fresh.length} line(s) to Rules`);
    setSelected(new Set());
  }, [rules, selected, setRules, setStatusWithTime, textsFromSelection]);

  const catalogStylesInUse = useMemo(() => {
    const pillSet = new Set();
    return selectedGenres.filter((g) => {
      const key = g.toLowerCase();
      if (pillSet.has(key)) return false;
      pillSet.add(key);
      return true;
    });
  }, [selectedGenres]);

  const removeStyle = useCallback(
    (genre) => {
      setSelectedGenres((prev) => prev.filter((g) => g !== genre));
      setStatusWithTime(`Removed "${previewLine(genre, 40)}" from Styles`);
    },
    [setSelectedGenres, setStatusWithTime],
  );

  const rollMetaphorStyle = useCallback(() => {
    const metaphor = generateMetaphorStyle();
    const hints = metaphorToCatalogHints(metaphor);
    setSelectedGenres((prev) => mergeUniqueStrings(prev, [metaphor.styleLine, ...hints.genres]));
    setStatusWithTime("Metaphor roll added to Styles");
    setOpen(true);
    setSectionKey("all");
    setQuery("");
  }, [setSelectedGenres, setStatusWithTime]);

  const jumpToFeaturedSection = useCallback((sectionId) => {
    setOpen(true);
    setSectionKey(sectionId);
    setQuery("");
    setStatusWithTime(`Browsing ${FEATURED_SECTIONS.find((s) => s.id === sectionId)?.label || "catalog"}`);
  }, [setStatusWithTime]);

  return (
    <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div>
          <div className="text-[11px] font-bold text-cyan-200">Style prompt library</div>
          <div className="text-[10px] text-white/45">
            {stats.lineCount} prompts in {stats.sectionCount} sections (catalog, genre wheel, Suno index). Pick one
            or more → <span className="text-white/60">Add to Styles</span> (DNA / prompt identity).
          </div>
        </div>
        <span className="text-sm text-cyan-200/90">{open ? "▲" : "▼"}</span>
      </button>

      {catalogStylesInUse.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {catalogStylesInUse.map((g) => (
            <Pill key={g} active onClick={() => removeStyle(g)} title={`Click to remove: ${g}`}>
              {previewLine(g, 36)} ×
            </Pill>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={rollMetaphorStyle}
          className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-1 text-[10px] font-bold text-fuchsia-100 hover:bg-fuchsia-500/20"
        >
          Metaphor roll
        </button>
        {FEATURED_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => jumpToFeaturedSection(section.id)}
            className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-100 hover:bg-cyan-500/20"
          >
            {section.label}
          </button>
        ))}
      </div>

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
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-white/45">
                Search
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by word…"
                className="w-full rounded-xl border border-white/10 bg-black/40 p-2 text-xs text-white outline-none placeholder:text-white/30"
              />
            </label>
          </div>

          {sectionKey === "cat-awesomeSunoConcepts" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {cc0TagOptions.slice(0, 24).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (tag === "all") {
                        setCc0TagFilter("all");
                        setCc0ActiveTags(new Set());
                        return;
                      }
                      setCc0TagFilter(tag);
                      setCc0ActiveTags((prev) => {
                        const next = new Set(prev);
                        if (next.has(tag)) next.delete(tag);
                        else next.add(tag);
                        return next;
                      });
                    }}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      cc0TagFilter === tag || cc0ActiveTags.has(tag)
                        ? "bg-violet-500/25 text-violet-100"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const pool = visibleItems.length
                    ? visibleItems
                    : sections
                        .find((s) => s.sectionId === "cat-awesomeSunoConcepts")
                        ?.items.filter((it) => {
                          if (cc0ActiveTags.size === 0) return true;
                          return cc0ActiveTags.has(awesomeSunoConceptTags?.[it.text]);
                        }) || [];
                  if (!pool.length) {
                    setStatusWithTime("No CC0 concepts match the active tags");
                    return;
                  }
                  const pick = pool[Math.floor(Math.random() * pool.length)];
                  if (!pick?.text) return;
                  setSelectedGenres((prev) => mergeUniqueStrings(prev, [pick.text]));
                  setStatusWithTime(`Surprise CC0 pick: ${previewLine(pick.text, 72)}`);
                }}
                className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-100 hover:bg-violet-500/20"
              >
                Surprise from tag filter
              </button>
            </div>
          ) : null}

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
              onClick={addSelectedToStyles}
              className="rounded-lg bg-cyan-300 px-2 py-1 text-[10px] font-bold text-black hover:bg-cyan-200"
            >
              Add to Styles ({selected.size})
            </button>
            <button
              type="button"
              onClick={replaceStylesWithSelected}
              className="rounded-lg border border-cyan-300/40 bg-cyan-400/15 px-2 py-1 text-[10px] font-bold text-cyan-100 hover:bg-cyan-400/25"
            >
              Replace Styles
            </button>
            <button
              type="button"
              onClick={addSelectedToRules}
              className="rounded-lg border border-emerald-300/40 bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-100 hover:bg-emerald-400/25"
            >
              Add to Rules
            </button>
          </div>

          <div className="max-h-[min(48vh,420px)] space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-2 pr-1">
            {searchRequired ? (
              <div className="py-6 text-center text-[11px] text-white/40">
                Type at least {SEARCH_MIN_ALL} characters to search{" "}
                {sectionKey === "all" ? "all sections" : "this section"}.
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-white/40">No matches. Change section or search.</div>
            ) : (
              <>
                {visibleTotal > VISIBLE_CAP ? (
                  <p className="px-1 pb-1 text-[9px] text-white/40">
                    Showing {VISIBLE_CAP} of {visibleTotal} matches — refine search to narrow.
                  </p>
                ) : null}
                {visibleItems.map((it) => (
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
                      {selectedGenres.some((g) => g.toLowerCase() === it.text.toLowerCase()) ? (
                        <span className="text-[9px] font-bold text-cyan-300/90">· in Styles</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use StylePromptPicker */
export const SunoEnglishStylePromptPicker = StylePromptPicker;
