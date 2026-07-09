const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

function singableWords(text) {
  const words = [];
  for (const line of String(text || "").split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed || (/^\[[^\]]+\]$/.test(trimmed))) continue;
    for (const part of trimmed.split(/\s+/)) {
      if (part) words.push(part);
    }
  }
  return words;
}

function sectionWords(section, fallbackLyrics) {
  const text = String(section?.text || "").trim();
  const words = singableWords(text);
  if (words.length) return words;
  const lineCount = Number(section?.lineCount || 0);
  if (lineCount > 0) {
    const allWords = singableWords(fallbackLyrics);
    if (allWords.length) {
      const per = Math.max(1, Math.floor(allWords.length / Math.max(lineCount, 1)));
      return allWords.slice(0, Math.max(1, lineCount * per));
    }
  }
  return [];
}

function rootMidiFromKey(key) {
  const lower = String(key || "C").toLowerCase();
  const roots = {
    c: 60,
    "c#": 61,
    db: 61,
    d: 62,
    "d#": 63,
    eb: 63,
    e: 64,
    f: 65,
    "f#": 66,
    gb: 66,
    g: 67,
    "g#": 68,
    ab: 68,
    a: 69,
    "a#": 70,
    bb: 70,
    b: 71,
  };
  for (const [name, midi] of Object.entries(roots)) {
    if (lower.startsWith(name)) return midi;
  }
  return 60;
}

function midiToNote(midi) {
  const clamped = Math.max(36, Math.min(84, Math.trunc(midi)));
  return `${NOTE_NAMES[clamped % 12]}${Math.floor(clamped / 12) - 1}`;
}

function buildSegmentFromWords(words, start, end, rootMidi, wordIndexStart) {
  let wordIndex = wordIndexStart;
  const alignedWords = words.map((word) => {
    const degree = MAJOR_SCALE[wordIndex % MAJOR_SCALE.length];
    const octave = Math.floor(wordIndex / MAJOR_SCALE.length) % 2;
    const midi = rootMidi + degree + octave * 12;
    wordIndex += 1;
    return { word, midi };
  });

  const duration = end - start;
  const slot = Math.max(0.12, duration / Math.max(alignedWords.length, 1));
  const noteSeq = [];
  const noteDur = [];
  const noteSlur = [];
  const textTokens = [];
  let cursor = 0;

  for (const entry of alignedWords) {
    if (cursor >= duration) break;
    const noteDurVal = Math.min(slot, duration - cursor);
    noteSeq.push(midiToNote(entry.midi));
    noteDur.push(noteDurVal.toFixed(4));
    noteSlur.push("0");
    textTokens.push(entry.word);
    cursor += noteDurVal;
  }

  if (!noteSeq.length) return null;

  return {
    segment: {
      offset: Math.round(start * 10000) / 10000,
      text: textTokens.join(" "),
      note_seq: noteSeq.join(" "),
      note_dur: noteDur.join(" "),
      note_slur: noteSlur.join(" "),
    },
    nextWordIndex: wordIndex,
  };
}

function buildSegmentFromAlignedWords(alignedWords, start, end, rootMidi, wordIndexStart) {
  let wordIndex = wordIndexStart;
  const noteSeq = [];
  const noteDur = [];
  const noteSlur = [];
  const textTokens = [];

  for (const entry of alignedWords) {
    if (!entry || typeof entry !== "object") continue;
    const word = String(entry.word || "").trim();
    const wStart = Number(entry.start ?? start);
    const wEnd = Number(entry.end ?? end);
    if (!word || wEnd <= wStart) continue;
    const degree = MAJOR_SCALE[wordIndex % MAJOR_SCALE.length];
    const octave = Math.floor(wordIndex / MAJOR_SCALE.length) % 2;
    const midi = rootMidi + degree + octave * 12;
    noteSeq.push(midiToNote(midi));
    noteDur.push((wEnd - wStart).toFixed(4));
    noteSlur.push("0");
    textTokens.push(word);
    wordIndex += 1;
  }

  if (!noteSeq.length) return null;

  return {
    segment: {
      offset: Math.round(start * 10000) / 10000,
      text: textTokens.join(" "),
      note_seq: noteSeq.join(" "),
      note_dur: noteDur.join(" "),
      note_slur: noteSlur.join(" "),
    },
    nextWordIndex: wordIndex,
  };
}

/**
 * Build OpenVPI DiffSinger `.ds` segment objects from a vocal embed plan.
 * @param {object} plan
 */
export function buildOpenvpiDsSegmentsFromPlan(plan) {
  const sections = Array.isArray(plan?.sections) ? plan.sections : [];
  const lyrics = String(plan?.lyrics || "");
  const rootMidi = rootMidiFromKey(plan?.key);
  const segments = [];
  let wordIndex = 0;

  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const start = Number(section.start ?? 0);
    const end = Number(section.end ?? 0);
    if (end <= start) continue;

    const alignedWords = section.alignedWords;
    let built =
      Array.isArray(alignedWords) && alignedWords.length
        ? buildSegmentFromAlignedWords(alignedWords, start, end, rootMidi, wordIndex)
        : null;

    if (!built) {
      const words = sectionWords(section, lyrics);
      if (!words.length) continue;
      built = buildSegmentFromWords(words, start, end, rootMidi, wordIndex);
    }

    if (!built?.segment) continue;
    segments.push(built.segment);
    wordIndex = built.nextWordIndex;
  }

  if (!segments.length && lyrics.trim()) {
    const words = singableWords(lyrics);
    if (words.length) {
      const built = buildSegmentFromWords(words, 0, Math.max(3, words.length * 0.35), rootMidi, 0);
      if (built?.segment) segments.push(built.segment);
    }
  }

  return segments;
}

/**
 * @param {object} plan — vocal embed plan (optionally with alignedWords on sections)
 * @param {{ align_method?: string }|null} [alignPreview]
 */
export function buildOpenvpiDsExport(plan, alignPreview = null) {
  const mergedPlan =
    alignPreview?.sections?.length && plan
      ? {
          ...plan,
          sections: (plan.sections || []).map((section, index) => {
            const aligned = alignPreview.sections[index];
            if (!aligned?.alignedWords?.length) return section;
            return { ...section, alignedWords: aligned.alignedWords };
          }),
        }
      : plan;

  const segments = buildOpenvpiDsSegmentsFromPlan(mergedPlan);
  return {
    format: "openvpi-ds-segments",
    version: 1,
    createdAt: new Date().toISOString(),
    align_method: alignPreview?.align_method || mergedPlan?.alignMethod || null,
    segment_count: segments.length,
    segments,
  };
}
