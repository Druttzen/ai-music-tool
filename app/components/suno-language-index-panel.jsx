"use client";

import { Panel } from "./ui-blocks";
import {
  formatPromptSymbolGuidePlain,
  formatVocalArtifactGuidePlain,
  referencePromptBlocks,
  stylePromptCatalog,
  sunoLanguageIndex,
} from "../lib/suno-language-index";

function flattenStylePromptCatalog(cat) {
  return Object.entries(cat)
    .map(([section, lines]) => `## ${section.replace(/([A-Z])/g, " $1").trim()}\n${lines.join("\n")}`)
    .join("\n\n");
}

/**
 * Sidebar reference panel: Suno vocabulary, symbol guide, templates, and genre anchors.
 */
export function SunoLanguageIndexPanel({ copyToClipboard, onApplyGenreAnchors }) {
  return (
    <Panel title="Suno Language Index" hint="Community-derived prompting vocabulary (non-official).">
      <div className="space-y-3 text-xs text-white/80">
        <p className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-[11px] text-white/55">
          Browse and add style prompts in <strong className="text-cyan-100">Step 3 → Style prompt library</strong>{" "}
          (section dropdown + multi-select → Add to Styles).
        </p>
        <div>
          <div className="mb-1 font-bold text-cyan-200">Core Principles</div>
          <ul className="space-y-1 text-white/70">
            {sunoLanguageIndex.principles.map((p, i) => (
              <li key={i}>- {p}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 font-bold text-cyan-200">Structure Tags</div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-2 text-white/70">
            {sunoLanguageIndex.structureTags.map((tag) => `[${tag}]`).join("  ")}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-amber-100">Prompt symbol overview</div>
            <button
              type="button"
              onClick={() => copyToClipboard(formatPromptSymbolGuidePlain(), "Symbol guide copied")}
              className="rounded-xl border border-amber-300/40 bg-amber-400/20 px-2 py-1 text-[11px] font-bold text-amber-50 hover:bg-amber-400/30"
            >
              Copy full symbol guide
            </button>
          </div>
          <p className="mb-2 text-[11px] text-amber-100/70">
            Delimiter roles (comma, semicolon, brackets, pipes, etc.) + examples for style prompts and registers.
          </p>
          <div className="max-h-[min(220px,35vh)] overflow-auto rounded-xl border border-white/10 bg-black/40">
            <table className="w-full border-collapse text-left text-[10px] text-white/75">
              <thead className="sticky top-0 bg-black/80 text-amber-100/90">
                <tr>
                  <th className="border-b border-white/10 p-2">Symbol</th>
                  <th className="border-b border-white/10 p-2">Meaning</th>
                  <th className="border-b border-white/10 p-2">Example</th>
                </tr>
              </thead>
              <tbody>
                {(sunoLanguageIndex.promptSymbolOverview || []).map((row, idx) => (
                  <tr key={`sym-${idx}`} className="border-b border-white/5">
                    <td className="align-top p-2 font-mono text-cyan-100/90">
                      <div className="whitespace-nowrap">
                        {"symbolAlt" in row && row.symbolAlt
                          ? `${row.symbol} (${row.symbolAlt})`
                          : row.symbol}
                      </div>
                      <div className="mt-0.5 text-[9px] font-sans font-normal text-white/40">{row.label}</div>
                    </td>
                    <td className="align-top p-2">{row.role}</td>
                    <td className="align-top p-2 text-white/60">{row.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-2 space-y-1 text-[11px] text-white/65">
            {(sunoLanguageIndex.promptSymbolUsageTips || []).map((t, i) => (
              <li key={`tip-${i}`}>- {t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 font-bold text-cyan-200">Delimiter examples</div>
          <div className="max-h-[min(280px,40vh)] space-y-2 overflow-y-auto">
            {Object.entries(sunoLanguageIndex.promptSymbolExamples || {}).map(([key, lines]) => (
              <details
                key={key}
                className="rounded-xl border border-white/10 bg-black/40 open:border-cyan-400/25"
              >
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-cyan-100 marker:text-cyan-300">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </summary>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap px-3 pb-3 text-[11px] leading-relaxed text-white/65">
                  {(lines || []).join("\n")}
                </pre>
                <div className="px-3 pb-3">
                  <button
                    type="button"
                    onClick={() => copyToClipboard((lines || []).join("\n"), `${key} examples copied`)}
                    className="rounded-xl bg-white/10 px-2 py-1 text-[11px] font-bold text-white hover:bg-white/20"
                  >
                    Copy
                  </button>
                </div>
              </details>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-rose-400/30 bg-rose-950/40 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-rose-100">
              {sunoLanguageIndex.sunoVocalArtifactGuide?.title ||
                "Vocal texture vs lyrics (DnB / Jungle / dub)"}
            </div>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(formatVocalArtifactGuidePlain(), "Vocal artifact guide copied")
              }
              className="rounded-xl border border-rose-300/35 bg-rose-400/20 px-2 py-1 text-[11px] font-bold text-rose-50 hover:bg-rose-400/30"
            >
              Copy full guide
            </button>
          </div>
          <p className="mb-2 text-[11px] text-rose-100/75">{sunoLanguageIndex.sunoVocalArtifactGuide?.summary}</p>
          <div className="max-h-[min(340px,45vh)] space-y-3 overflow-y-auto text-[11px] text-white/75">
            {(sunoLanguageIndex.sunoVocalArtifactGuide?.causes || []).map((c, i) => (
              <div key={`cause-${i}`} className="rounded-xl border border-white/10 bg-black/35 p-2">
                <div className="font-bold text-rose-100/95">{c.heading}</div>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {(c.bullets || []).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
            {(sunoLanguageIndex.sunoVocalArtifactGuide?.fixes || []).map((f, i) => (
              <div key={`fix-${i}`} className="rounded-xl border border-emerald-400/20 bg-emerald-950/30 p-2">
                <div className="font-bold text-emerald-100">{f.heading}</div>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {(f.bullets || []).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="rounded-xl border border-cyan-400/25 bg-black/40 p-2 font-mono text-[10px] text-cyan-50/90">
              <div className="font-bold text-cyan-100">
                {(sunoLanguageIndex.sunoVocalArtifactGuide || {}).diagnostic?.heading}
              </div>
              <div className="mt-1 whitespace-pre-wrap">
                Before: {(sunoLanguageIndex.sunoVocalArtifactGuide || {}).diagnostic?.before}
                {"\n"}
                After: {(sunoLanguageIndex.sunoVocalArtifactGuide || {}).diagnostic?.after}
                {"\n"}
                {(sunoLanguageIndex.sunoVocalArtifactGuide || {}).diagnostic?.note}
              </div>
            </div>
            <p className="text-white/70">{(sunoLanguageIndex.sunoVocalArtifactGuide || {}).bottomLine}</p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <button
            onClick={() => copyToClipboard(sunoLanguageIndex.templates.styleField, "Suno style template copied")}
            className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 font-bold text-white hover:bg-white/20"
          >
            Copy Style Template
          </button>
          <button
            onClick={() => copyToClipboard(sunoLanguageIndex.templates.lyricsField, "Suno lyrics template copied")}
            className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 font-bold text-white hover:bg-white/20"
          >
            Copy Lyrics Template
          </button>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(sunoLanguageIndex.templates.lyricsFieldAdvanced, "Advanced lyrics template copied")
            }
            className="rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/15 px-3 py-2 font-bold text-fuchsia-100 hover:bg-fuchsia-500/25"
          >
            Copy Advanced Lyrics
          </button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-2 font-bold text-fuchsia-200">Quick lyric snippets</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(sunoLanguageIndex.templates.lyricSnippets || {}).map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  copyToClipboard(text, `${key.replace(/([A-Z])/g, " $1").trim()} copied`)
                }
                className="rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/85 hover:bg-white/15"
              >
                {key.replace(/([A-Z])/g, " $1").trim()}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 font-bold text-fuchsia-200">Advanced Suno lyric cookbook</div>
          <p className="mb-2 text-[11px] text-white/55">
            Meta intros, curly FX, SATB, build/drop, duets — paste into Suno&apos;s Lyrics box.
          </p>
          <div className="max-h-[min(320px,40vh)] space-y-2 overflow-y-auto">
            {(sunoLanguageIndex.advancedLyricCookbook || []).map((item) => (
              <details
                key={item.id}
                className="rounded-xl border border-white/10 bg-black/40 open:border-fuchsia-400/30"
              >
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-fuchsia-100 marker:text-fuchsia-300">
                  {item.title}
                </summary>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap px-3 pb-2 text-[11px] leading-relaxed text-white/70">
                  {item.body}
                </pre>
                <div className="px-3 pb-3">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(item.body, `${item.title} copied`)}
                    className="rounded-xl bg-fuchsia-400/90 px-2 py-1 text-[11px] font-bold text-black hover:bg-fuchsia-300"
                  >
                    Copy
                  </button>
                </div>
              </details>
            ))}
          </div>
        </div>
        <button
          onClick={onApplyGenreAnchors}
          className="w-full rounded-2xl bg-cyan-300 px-3 py-2 font-bold text-black hover:bg-cyan-200"
        >
          Apply Genre Anchors
        </button>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-cyan-200">Style prompt index (copy only)</div>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(flattenStylePromptCatalog(stylePromptCatalog), "Full style index copied")
              }
              className="rounded-xl border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-bold text-white hover:bg-white/20"
            >
              Copy all sections
            </button>
          </div>
          <p className="text-[11px] text-white/45">
            To add prompts into your track identity, use Step 3 Style prompt library instead of copy-paste.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 font-bold text-cyan-200">Reference prompt blocks</div>
          <p className="mb-2 text-[11px] text-white/55">
            Long-form examples (trim lines before pasting into Suno).
          </p>
          <div className="max-h-[min(380px,45vh)] space-y-2 overflow-y-auto">
            {referencePromptBlocks.map((block) => (
              <details
                key={block.id}
                className="rounded-xl border border-white/10 bg-black/40 open:border-orange-300/25"
              >
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-orange-100 marker:text-orange-300">
                  {block.title}
                </summary>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-2 text-[11px] leading-relaxed text-white/70">
                  {block.body}
                </pre>
                <div className="px-3 pb-3">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(block.body, `${block.title} copied`)}
                    className="rounded-xl bg-orange-300/90 px-2 py-1 text-[11px] font-bold text-black hover:bg-orange-200"
                  >
                    Copy block
                  </button>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
