"use client";

import { memo } from "react";
import { SunoGuidedPath } from "./suno-guided-path";
import { StylePromptPicker } from "./suno-english-style-prompt-picker";
import { AudioTrackEditor } from "./audio-track-editor";
import { DropBox, Panel, Pill, SearchablePillGrid, Slider, TextBox } from "./ui-blocks";
import { VariationCompare } from "./variation-compare";
import {
  CoProducerHooksBlock,
  CoProducerLlmSettings,
  CoProducerLyricsBlock,
} from "./co-producer-lyrics-block";
import { IMAGE_ANALYZER_DISCLAIMER } from "../lib/analyzer-disclaimer";
import {
  SUPPORTED_AUDIO_ACCEPT,
  SUPPORTED_AUDIO_LABEL,
  SUPPORTED_IMAGE_ACCEPT,
  SUPPORTED_IMAGE_LABEL,
} from "../lib/analyzer-file-types";
import {
  fixes,
  genreOptions,
  lyricModeOptions,
  lyricStyleOptions,
  promptFormatOptions,
  rhythmOptions,
  soundOptions,
  vocalOptions,
} from "../lib/music-config";
import { SUNO_LYRIC_LANGUAGE_GROUPS } from "../lib/suno-lyric-languages";
import {
  SUNO_GENRE_GROUPS,
  SUNO_GENRE_WHEEL_COUNT,
  SUNO_INSTRUMENT_GROUPS,
  SUNO_RHYTHM_GROUPS,
} from "../lib/suno-music-styles";
import {
  SUNO_LYRICS_CHAR_TYPICAL_MAX,
  SUNO_LYRICS_CHAR_WARN,
  SUNO_STYLE_CHAR_CAP,
  SUNO_STYLE_CHAR_WARN,
} from "../lib/suno-limits";
import { FAMOUS_VOICE_PRESETS, formatPublicName } from "../lib/suno-voice-style";
import { getLyricStyleDirection } from "../lib/lyric-generator";
import { saveCoProducerLlmSettings } from "../lib/co-producer-llm";
import { useProjectWorkspace } from "../context/project-workspace-context";

export const PageWorkspaceCenter = memo(function PageWorkspaceCenter() {
  const ws = useProjectWorkspace();
  return (
          <section className="space-y-4">
            <SunoGuidedPath
              promptEngine={ws.promptEngine}
              onSelectSunoEngine={() => {
                ws.setPromptEngine("Suno-like");
                ws.setStatusWithTime("Switched to Suno-like engine", "info");
              }}
              input={ws.sunoGuidedInput}
              copyToClipboard={ws.copyToClipboard}
              setStatusWithTime={ws.setStatusWithTime}
              vocal={ws.vocal}
              instrumentalVocalFx={ws.instrumentalVocalFx}
              setVocal={ws.setVocal}
              setInstrumentalVocalFx={ws.setInstrumentalVocalFx}
              customPresets={ws.customPresets}
              guidedStep={ws.guidedStep}
              setGuidedStep={ws.setGuidedStep}
              onApplyFactoryPreset={(name) => {
                ws.applyPreset(name);
                ws.setGuidedStep(0);
                ws.setStatusWithTime(`Loaded preset: ${name} — guided path reset to step 1`);
              }}
              onLoadCustomPreset={(name) => {
                ws.loadPresetObject(name, ws.customPresets[name]);
                ws.setGuidedStep(0);
                ws.setStatusWithTime(`Loaded custom preset: ${name} — guided path reset to step 1`);
              }}
            />
            <Panel title="Step 1 — Idea Input" hint="Describe what you want in plain language."><input value={ws.idea} onChange={(e)=>ws.setIdea(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"/></Panel>


            <Panel title="Lyric Style Generator" hint="Suno-only lyric prompt metadata. Every generated line uses [] so Suno reads it as prompt direction, not lyric text.">
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Theme</div>
                  <input
                    value={ws.lyricTheme}
                    onChange={(e)=>ws.setLyricTheme(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-orange-300"
                  />
                </label>

                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Structure</div>
                  <input
                    value={ws.lyricStructure}
                    onChange={(e)=>ws.setLyricStructure(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-orange-300"
                  />
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Style</div>
                  <select value={ws.lyricStyle} onChange={(e)=>ws.setLyricStyle(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    {lyricStyleOptions.map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>

                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Language</div>
                  <select value={ws.lyricLanguage} onChange={(e)=>ws.setLyricLanguage(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    {SUNO_LYRIC_LANGUAGE_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.languages.map((lang) => (
                          <option key={lang.label} value={lang.label}>{lang.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Mode</div>
                  <select value={ws.lyricMode} onChange={(e)=>ws.setLyricMode(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    {lyricModeOptions.map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>

                <Slider label="Lyric Density" value={ws.lyricDensity} left="minimal" right="dense" setValue={ws.setLyricDensity}/>
              </div>

              <CoProducerLyricsBlock
                lyricStyle={ws.lyricStyle}
                generatedLyrics={ws.generatedLyrics}
                generatedLyricsStyle={ws.generatedLyricsStyle}
                onLyricsChange={ws.setGeneratedLyrics}
                onGenerate={ws.generateExampleLyrics}
                onAnotherTake={ws.shuffleExampleLyrics}
                generateBusy={ws.lyricsGenerateBusy}
              />

              {ws.generatedLyrics && (
                <button
                  type="button"
                  onClick={() => ws.copyToClipboard(ws.generatedLyrics, "Generated lyrics copied")}
                  className="mt-2 w-full rounded-2xl border border-orange-300/30 bg-black/30 px-4 py-2 text-sm font-bold text-orange-100 hover:bg-black/50"
                >
                  Copy Generated Lyrics
                </button>
              )}

              <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-orange-300/20 bg-black/50 p-4 text-xs leading-relaxed text-orange-50">
                {ws.lyricPrompt}
              </pre>

              <button
                onClick={() => ws.copyToClipboard(ws.lyricPrompt, "Lyric style prompt copied")}
                className="mt-3 w-full rounded-2xl bg-orange-300 px-4 py-2 font-bold text-black hover:bg-orange-200"
              >
                Copy Lyric Style Prompt
              </button>
            </Panel>

            <Panel
              title="Suno Voice Style Generator"
              hint="Uses famous artists as stylistic references only (prompt direction — not impersonation or voice cloning). Included in Suno-like prompt when vocals are on."
            >
              <p className="mb-3 text-xs text-white/50">
                Enter a first and last name, pick a quick preset, then generate. Paste the compact line into Suno&apos;s Style field; use the lyric tag above your verses in Custom Mode if you want.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">
                    First name
                  </div>
                  <input
                    value={ws.voiceRefFirstName}
                    onChange={(e) => ws.setVoiceRefFirstName(e.target.value)}
                    placeholder="e.g. Freddie"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">
                    Last name
                  </div>
                  <input
                    value={ws.voiceRefLastName}
                    onChange={(e) => ws.setVoiceRefLastName(e.target.value)}
                    placeholder="e.g. Mercury (optional)"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"
                  />
                </label>
              </div>
              <div className="mt-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">
                  Quick presets
                </div>
                <div className="flex flex-wrap gap-2">
                  {FAMOUS_VOICE_PRESETS.map((p, presetIdx) => {
                    const label = formatPublicName(p.first, p.last);
                    return (
                      <Pill
                        key={`voice-preset-${presetIdx}-${p.first}-${p.last}`}
                        active={false}
                        onClick={() => {
                          ws.setVoiceRefFirstName(p.first);
                          ws.setVoiceRefLastName(p.last);
                          ws.setStatusWithTime(`Preset: ${label}`);
                        }}
                      >
                        {label}
                      </Pill>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={ws.generateVoiceStyleFromNames}
                  className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-200"
                >
                  Generate voice style
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ws.setVoiceRefFirstName("");
                    ws.setVoiceRefLastName("");
                    ws.setVoiceStyleLine("");
                    ws.setStatusWithTime("Voice style cleared");
                  }}
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
                >
                  Clear
                </button>
              </div>
              {ws.vocal === "Instrumental" && (
                <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100">
                  Instrumental ws.mode: voice reference is not added to the Suno-like export. Switch ws.vocal preset to hear a lead ws.vocal in the prompt.
                </div>
              )}
              {ws.voiceStyleLine ? (
                <>
                  <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-4 text-xs leading-relaxed text-cyan-50">
                    {ws.voiceStyleLine}
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      ws.copyToClipboard(ws.voiceStyleLine, "Full voice style copied")
                    }
                    className="mt-2 w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20"
                  >
                    Copy full voice style (Suno-like block)
                  </button>
                </>
              ) : null}
              {ws.voiceStyleCompact.style ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/45">
                    Compact (Style box)
                  </div>
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
                    {ws.voiceStyleCompact.style}
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      ws.copyToClipboard(ws.voiceStyleCompact.style, "Compact style copied")
                    }
                    className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-cyan-100"
                  >
                    Copy compact style line
                  </button>
                  <div className="text-xs font-bold uppercase tracking-wider text-white/45">
                    Lyric metatag (optional)
                  </div>
                  <pre className="max-h-20 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
                    {ws.voiceStyleCompact.lyricTag}
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      ws.copyToClipboard(
                        ws.voiceStyleCompact.lyricTag,
                        "Lyric metatag copied",
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
                  >
                    Copy lyric metatag
                  </button>
                </div>
              ) : null}
            </Panel>

            <Panel title="Drag & Drop Analyzers" hint="Optional Polish-step tools — track report with waveform, LUFS/dBTP meter, studio WAV export (Streaming −14 LUFS), merge into Suno fields, Goal, and Notes. Image DNA uses compact AUDIO:/IMAGE: lines for the 1000-character Style cap.">
              <div
                className={`mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border px-3 py-2 font-mono text-[11px] leading-snug ${
                  ws.sunoFieldSlices.style.length > SUNO_STYLE_CHAR_CAP
                    ? "border-red-400/45 bg-red-500/15 text-red-100"
                    : ws.sunoFieldSlices.style.length > SUNO_STYLE_CHAR_WARN
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-50"
                      : "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
                }`}
              >
                <span>
                  Style box: {ws.sunoFieldSlices.style.length}/{SUNO_STYLE_CHAR_CAP}
                  {ws.promptEngine !== "Suno-like" ? (
                    <span className="ml-1.5 font-sans text-[10px] font-normal text-white/40">
                      (same string as validator when you use Suno-like)
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    ws.sunoFieldSlices.lyrics.length > SUNO_LYRICS_CHAR_TYPICAL_MAX
                      ? "text-red-200"
                      : ws.sunoFieldSlices.lyrics.length > SUNO_LYRICS_CHAR_WARN
                        ? "text-amber-200"
                        : "text-white/55"
                  }
                >
                  Lyrics: {ws.sunoFieldSlices.lyrics.length}/{SUNO_LYRICS_CHAR_TYPICAL_MAX}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <DropBox
                  title="Drop Audio File"
                  hint={SUPPORTED_AUDIO_LABEL}
                  accept={SUPPORTED_AUDIO_ACCEPT}
                  onFile={ws.analyzeAudioFile}
                >
                  {ws.audioAnalysis ? (
                    <AudioTrackEditor
                      analysis={ws.audioAnalysis}
                      audioUrl={ws.audioPreviewUrl}
                      onChange={ws.updateAudioAnalysis}
                      onApply={() => {
                        ws.captureSnapshot("before audio merge");
                        ws.applyAudioToSunoStyle();
                      }}
                      onClear={ws.clearAudioAnalysis}
                      onAttachAudio={ws.attachAudioFile}
                      onAddLyricsForTrack={ws.addLyricsFromInstrumentalTrack}
                      loudness={ws.audioLoudness}
                      loudnessBusy={ws.audioLoudnessBusy}
                      onExportEnhanced={ws.exportEnhancedAudio}
                      exportBusy={ws.audioExportBusy}
                      exportProgress={ws.audioExportProgress}
                    />
                  ) : null}
                </DropBox>
                <DropBox
                  title="Drop Image File"
                  hint={SUPPORTED_IMAGE_LABEL}
                  accept={SUPPORTED_IMAGE_ACCEPT}
                  onFile={ws.analyzeImageFile}
                >
                  {ws.imagePreview && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob Object URLs from analyzer */}
                      <img src={ws.imagePreview} alt="Image preview" className="mx-auto mt-3 max-h-40 rounded-2xl object-contain" />
                    </>
                  )}
                  {ws.imageAnalysis ? (
                    <div className="mt-3 text-left">
                      <p className="mb-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90">
                        {IMAGE_ANALYZER_DISCLAIMER}
                      </p>
                      <div className="rounded-2xl bg-black/30 p-3 text-xs text-white/70 whitespace-pre-wrap">{ws.imageAnalysis.summary}</div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          ws.captureSnapshot("before image merge");
                          ws.applyImageToSunoStyle();
                        }}
                        className="mt-2 w-full rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/20 py-2 text-xs font-bold text-fuchsia-50 hover:bg-fuchsia-500/30"
                      >
                        Add image style to Suno (merge) → next step
                      </button>
                    </div>
                  ) : null}
                </DropBox>
              </div>
            </Panel>


            {ws.sourcePrompt.trim() && (
              <Panel title="Extracted Source Prompt" hint="Copy only the prompt created from audio/image analysis.">
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-orange-300/20 bg-black/50 p-4 text-xs leading-relaxed text-orange-50">
                  {ws.sourcePrompt}
                </pre>
                <button
                  onClick={() => ws.copyToClipboard(ws.sourcePrompt, "Extracted prompt copied")}
                  className="mt-3 w-full rounded-2xl bg-orange-300 px-4 py-2 font-bold text-black hover:bg-orange-200"
                >
                  Copy Extracted Prompt
                </button>
              </Panel>
            )}

            <Panel title="Step 2 — Mood Sliders" hint="Shape the feeling without typing."><div className="grid gap-3 md:grid-cols-3">{[
              ["Darkness","bright","dark","darkness"],["Energy","calm","extreme","energy"],["Aggression","soft","brutal","aggression"],["Emotion","cold","emotional","emotion"],["Complexity","minimal","complex","complexity"],["Space","dry","wide","space"]
            ].map(([label,left,right,key])=><Slider key={key} label={label} value={ws.mood[key]} left={left} right={right} setValue={(v)=>ws.setMood({...ws.mood,[key]:v})}/>)}</div></Panel>

            <Panel title="Step 3 — Clickable Music Controls" hint={`Suno-aligned genres (${genreOptions.length}), instruments (${soundOptions.length}), and rhythms. Style Prompt Library adds ${SUNO_GENRE_WHEEL_COUNT}+ fusion phrases from the Suno v5.5 genre wheel.`}>
              <SearchablePillGrid
                label="Genres"
                hint="Strong Suno genres by family — use Style Prompt Library below for fusion / wheel phrases."
                options={genreOptions}
                groups={SUNO_GENRE_GROUPS}
                selected={ws.selectedGenres}
                onToggle={(x) => ws.toggle(x, ws.selectedGenres, ws.setSelectedGenres)}
              />
              <StylePromptPicker
                selectedGenres={ws.selectedGenres}
                setSelectedGenres={ws.setSelectedGenres}
                rules={ws.rules}
                setRules={ws.setRules}
                setStatusWithTime={ws.setStatusWithTime}
                defaultOpen
              />
              <SearchablePillGrid
                label="Rhythm"
                options={rhythmOptions}
                groups={SUNO_RHYTHM_GROUPS}
                selected={ws.selectedRhythms}
                onToggle={(x) => ws.toggle(x, ws.selectedRhythms, ws.setSelectedRhythms)}
              />
              <SearchablePillGrid
                label="Instruments & textures"
                hint="Core Suno instrument tags plus catalog lines — search e.g. sax, 808, koto."
                options={soundOptions}
                groups={SUNO_INSTRUMENT_GROUPS}
                selected={ws.selectedSounds}
                onToggle={(x) => ws.toggle(x, ws.selectedSounds, ws.setSelectedSounds)}
              />
              <div><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Vocals</div><div className="flex flex-wrap gap-2">{vocalOptions.map(x=><Pill key={x} active={ws.vocal===x} onClick={()=>ws.setVocal(x)}>{x}</Pill>)}</div></div>
            </Panel>

            <Panel title="Step 4 — Co‑Producer Buttons" hint="One-click creative direction."><div className="flex flex-wrap gap-2">{["Make darker","More aggressive","More minimal","More cinematic","More club"].map(x=><button key={x} onClick={()=>ws.coProducer(x)} className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-cyan-100">{x}</button>)}</div></Panel>

            <Panel title="Co‑Producer AI" hint="Improve Prompt analyzes balance and gaps; quick fixes append rule lines. Hooks and lyrics follow your Lyric Style.">
              <p className="mb-3 text-[11px] leading-relaxed text-white/50">
                <strong className="text-white/65">Copy guide:</strong> Lyric Style Generator = bracketed Suno direction only.
                <strong className="text-white/65"> Generate Lyrics</strong> writes draft lyric text matched to{" "}
                <strong className="text-white/65">{ws.lyricStyle}</strong> ({getLyricStyleDirection(ws.lyricStyle)}).
                Raw Prompt = bracketed direction; Structured Song / Performance Ready = [Verse]/[Chorus] drafts.
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                <button onClick={ws.buildCoProducerAI} className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200">
                  Improve Prompt
                </button>
                <button onClick={() => ws.generateHooks()} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">
                  Generate Hooks
                </button>
                <button onClick={() => ws.generateHooks(true)} className="rounded-2xl border border-cyan-300/40 bg-black/30 px-4 py-2 font-bold text-cyan-100 hover:bg-black/50">
                  Another hook take
                </button>
              </div>

              <div className="mt-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Quick rule fixes</div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(fixes).map((label) => (
                    <button
                      key={label}
                      type="button"
                      title={fixes[label]}
                      onClick={() => ws.applyQuickFix(label)}
                      className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/20"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <CoProducerLlmSettings
                settings={ws.coProducerLlmSettings}
                onChange={ws.setCoProducerLlmSettings}
                onSave={() => {
                  saveCoProducerLlmSettings(ws.coProducerLlmSettings);
                  ws.setStatusWithTime("LLM settings saved locally");
                }}
              />

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Prompt Format</div>
                  <select value={ws.promptFormat} onChange={(e)=>ws.setPromptFormat(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    {promptFormatOptions.map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Prompt Engine</div>
                  <select value={ws.promptEngine} onChange={(e)=>ws.setPromptEngine(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    <option>Standard</option>
                    <option>Suno-like</option>
                  </select>
                </label>
              </div>

              {ws.coProducerOutput && (
                <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-emerald-300/20 bg-black/50 p-4 text-xs leading-relaxed text-emerald-50">
                  {ws.coProducerOutput}
                </pre>
              )}

              <CoProducerHooksBlock
                lyricStyle={ws.lyricStyle}
                generatedHooks={ws.generatedHooks}
                generatedHooksStyle={ws.generatedHooksStyle}
              />

              <CoProducerLyricsBlock
                className="mt-3"
                lyricStyle={ws.lyricStyle}
                generatedLyrics={ws.generatedLyrics}
                generatedLyricsStyle={ws.generatedLyricsStyle}
                onLyricsChange={ws.setGeneratedLyrics}
                onGenerate={ws.generateExampleLyrics}
                onAnotherTake={ws.shuffleExampleLyrics}
                generateBusy={ws.lyricsGenerateBusy}
                showStyleHint={false}
              />

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <button onClick={() => ws.copyToClipboard(ws.coProducerOutput || "", "Report copied")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Copy Report</button>
                <button onClick={() => ws.copyToClipboard(ws.generatedHooks || "", "Hooks copied")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Copy Hooks</button>
                <button onClick={() => ws.copyToClipboard(ws.generatedLyrics || "", "Lyrics copied")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Copy Lyrics</button>
              </div>
            </Panel>

            <Panel title="Variation Engine" hint="Auto-generate prompt versions while keeping your core identity."><button onClick={ws.generateVariations} className="w-full rounded-2xl bg-fuchsia-300 px-4 py-2 font-bold text-black hover:bg-fuchsia-200">Generate {ws.variationCount} Variations</button>{ws.variations.length>0 && <><VariationCompare key={ws.variations.map((v) => v.id).join("-")} variations={ws.variations} onCopy={ws.copyToClipboard} onApplyWinner={(text)=>{ ws.setNotes(text.slice(0,2000)); ws.setStatusWithTime("Variation A seeded into Notes"); }} /><div className="mt-3 space-y-3">{ws.variations.map(v=><div key={v.id} className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="mb-2 font-bold text-fuchsia-200">{v.title}</div><pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-white/70">{v.prompt}</pre><button onClick={()=>ws.copyToClipboard(v.prompt, `${v.title} copied`)} className="mt-2 rounded-xl bg-white px-3 py-1 text-xs font-bold text-black hover:bg-cyan-100">Copy Variation</button></div>)}</div></>}</Panel>

            {ws.proMode && <Panel title="Advanced Override" hint="Optional text editing for exact control."><div className="grid gap-3 md:grid-cols-2"><label><div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Tempo</div><input value={ws.tempo} onChange={(e)=>ws.setTempo(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"/></label><label><div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Structure</div><input value={ws.structure} onChange={(e)=>ws.setStructure(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"/></label></div><div className="mt-3 grid gap-3 md:grid-cols-2"><TextBox label="Rules" value={ws.rules} setValue={ws.setRules}/><TextBox label="Notes / Analyzer Output" value={ws.notes} setValue={ws.setNotes}/></div></Panel>}
          </section>
  );
});
