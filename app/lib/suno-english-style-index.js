/**
 * Flattens the Suno Language Index + style catalog into English-only addable lines.
 * Non-Latin scripts (CJK, Arabic, Cyrillic, Hebrew, Thai, etc.) are excluded.
 */

import {
  promptSymbolExamples,
  promptSymbolOverview,
  promptSymbolUsageTips,
  sunoVocalArtifactGuide,
} from "./prompt-symbol-guide";
import { stylePromptCatalog, referencePromptBlocks } from "./style-prompt-catalog";
import { sunoLanguageIndex } from "./suno-language-index";

/** Characters that indicate the line is not English-only for our purposes. */
const NON_ENGLISH_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\u0400-\u04FF\u0530-\u058F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0E00-\u0E7F\u0980-\u09FF\u0A00-\u0A7F\u0B80-\u0BFF]/u;

/**
 * @param {string} s
 * @returns {boolean}
 */
export function isEnglishOnlyPromptLine(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  if (NON_ENGLISH_SCRIPT.test(t)) return false;
  return true;
}

const CATALOG_LABELS = {
  productionMixSpatial: "Catalog — Production / mix / spatial",
  epicOrchestralFilm: "Catalog — Epic / orchestral / film",
  rootsWorshipWorld: "Catalog — Roots / worship / world",
  electronicClub: "Catalog — Electronic / club",
  hiphopRnBPop: "Catalog — Hip-hop / R&B / pop",
  rockMetalAlternative: "Catalog — Rock / metal / alt",
  instrumentsTextures: "Catalog — Instruments & textures",
  moodDescriptors: "Catalog — Mood",
  fusionMashupLabels: "Catalog — Fusion / mashup labels",
  sunoV55GenreWheel: "Catalog — Suno v5.5 genre wheel",
  worldStylesAfricaDiaspora: "Catalog — World: Africa & diaspora (style + instruments)",
  worldStylesMiddleEastMediterranean: "Catalog — World: Middle East & Mediterranean",
  worldStylesSouthAsia: "Catalog — World: South Asia",
  worldStylesEastAsiaPacific: "Catalog — World: East Asia & Pacific",
  worldStylesAmericasCaribbean: "Catalog — World: Americas & Caribbean",
  worldStylesEuropeFolkPopular: "Catalog — World: Europe folk & popular",
  soundFxPrompts: "Catalog — Sound FX (transitions, hits, foley)",
  environmentSoundscapes: "Catalog — Environment & soundscapes",
};

let _cached = null;

/**
 * @returns {{ sectionId: string, sectionTitle: string, items: { id: string, text: string, label?: string, isLong?: boolean }[] }[]}
 */
export function buildEnglishSunoStylePromptSections() {
  if (_cached) return _cached;

  const globalSeen = new Set();
  const sections = [];
  let serial = 0;

  /**
   * @param {string} sectionId
   * @param {string} text
   * @param {string} [label]
   */
  function pushItem(sectionId, text, label) {
    const t = String(text).trim();
    if (!t || !isEnglishOnlyPromptLine(t)) return null;
    const key = t.toLowerCase();
    if (globalSeen.has(key)) return null;
    globalSeen.add(key);
    serial += 1;
    const id = `${sectionId}--${serial}`;
    const isLong = t.length > 240;
    return { id, text: t, label, isLong };
  }

  /**
   * @param {string} sectionId
   * @param {string} sectionTitle
   * @param {unknown[]} list
   * @param {(raw: unknown, i: number) => { text: string; label?: string } | null} [mapLine]
   */
  function addSection(sectionId, sectionTitle, list, mapLine) {
    const items = [];
    for (let i = 0; i < list.length; i++) {
      const raw = list[i];
      let text;
      let label;
      if (mapLine) {
        const m = mapLine(raw, i);
        if (!m || !m.text) continue;
        text = m.text;
        label = m.label;
      } else {
        text = String(raw);
      }
      const it = pushItem(sectionId, text, label);
      if (it) items.push(it);
    }
    if (items.length) sections.push({ sectionId, sectionTitle, items });
  }

  for (const [key, lines] of Object.entries(stylePromptCatalog)) {
    const title = CATALOG_LABELS[key] || `Catalog — ${key}`;
    addSection(`cat-${key}`, title, lines);
  }

  addSection("idx-vocal", "Index — Vocal tags", sunoLanguageIndex.vocalTags || []);
  addSection("idx-prod", "Index — Production tokens", sunoLanguageIndex.productionTokens || []);
  addSection("idx-neg", "Index — Negative / guard phrases", sunoLanguageIndex.negativePrompting || []);
  addSection("idx-struct", "Index — Structure tags (Lyrics)", sunoLanguageIndex.structureTags || [], (tag) => ({
    text: `[${tag}]`,
    label: String(tag),
  }));
  addSection("idx-blueprint", "Index — Style blueprint lines", sunoLanguageIndex.styleBlueprint || []);
  addSection("idx-principles", "Index — Core principles", sunoLanguageIndex.principles || []);

  const tpl = sunoLanguageIndex.templates;
  if (tpl) {
    const templateLines = [];
    if (tpl.styleField) templateLines.push(tpl.styleField);
    if (tpl.negativeBlock) templateLines.push(tpl.negativeBlock);
    addSection("idx-templates", "Index — Template snippets", templateLines);
  }

  const anchorLines = [];
  const ga = sunoLanguageIndex.genreAnchors || {};
  for (const [g, arr] of Object.entries(ga)) {
    for (const a of arr) anchorLines.push(`${g}: ${a}`);
  }
  addSection("idx-genre-anchors", "Index — Genre anchor hints", anchorLines);

  addSection("sym-overview", "Symbol guide — overview (table rows)", promptSymbolOverview, (row) => {
    if (!row || typeof row !== "object" || !row.role) return null;
    const sym =
      "symbolAlt" in row && row.symbolAlt ? `${row.symbol} (${row.symbolAlt})` : row.symbol;
    const text = `${sym} — ${row.role}${row.example != null && row.example !== "" ? ` Example: ${row.example}` : ""}`.trim();
    if (!isEnglishOnlyPromptLine(text)) return null;
    return { text, label: row.label ? String(row.label) : undefined };
  });

  const symbolExampleRows = [];
  for (const [key, lines] of Object.entries(promptSymbolExamples)) {
    for (const line of lines) {
      if (typeof line !== "string" || !isEnglishOnlyPromptLine(line)) continue;
      symbolExampleRows.push({ key, line: line.trim() });
    }
  }
  addSection("sym-examples", "Symbol guide — examples by delimiter", symbolExampleRows, (o) => ({
    text: o.line,
    label: o.key,
  }));

  addSection("sym-tips", "Symbol guide — usage tips", promptSymbolUsageTips || []);

  const vocalLines = [];
  const g = sunoVocalArtifactGuide;
  if (g) {
    const push = (s) => {
      const t = String(s).trim();
      if (t && isEnglishOnlyPromptLine(t)) vocalLines.push(t);
    };
    if (g.title) push(g.title);
    if (g.summary) push(g.summary);
    for (const c of g.causes || []) {
      for (const b of c.bullets || []) {
        push(c.heading ? `${c.heading} — ${b}` : b);
      }
    }
    for (const f of g.fixes || []) {
      for (const b of f.bullets || []) {
        push(f.heading ? `${f.heading} — ${b}` : b);
      }
    }
    const d = g.diagnostic;
    if (d) {
      if (d.before) push(`Quick diagnostic — before: ${d.before}`);
      if (d.after) push(`Quick diagnostic — after: ${d.after}`);
      if (d.note) push(`Quick diagnostic — ${d.note}`);
    }
    if (g.bottomLine) push(g.bottomLine);
  }
  addSection("vocal-artifact", "Vocal texture artifact guide (Suno)", vocalLines);

  addSection(
    "lyric-cook",
    "Lyric cookbook (English — usually Lyrics field)",
    sunoLanguageIndex.advancedLyricCookbook || [],
    (item) =>
      item?.body && isEnglishOnlyPromptLine(item.body)
        ? { text: item.body.trim(), label: item.title }
        : null,
  );

  addSection(
    "ref-blocks",
    "Reference blocks (long)",
    referencePromptBlocks,
    (block) =>
      block?.body && isEnglishOnlyPromptLine(block.body)
        ? { text: block.body.trim(), label: block.title }
        : null,
  );

  _cached = sections;
  return _cached;
}

export function getEnglishSunoStylePromptStats() {
  const sections = buildEnglishSunoStylePromptSections();
  const lineCount = sections.reduce((a, s) => a + s.items.length, 0);
  return { sectionCount: sections.length, lineCount };
}

export function clearEnglishSunoStylePromptCache() {
  _cached = null;
}
