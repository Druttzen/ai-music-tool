import { lyricLanguageOptions as sunoLyricLanguageOptions } from "./suno-lyric-languages";
import {
  genreOptions as sunoGenreOptions,
  rhythmOptions as sunoRhythmOptions,
  soundOptions as sunoSoundOptions,
} from "./suno-music-styles";

export const lyricLanguageOptions = sunoLyricLanguageOptions;
export const genreOptions = sunoGenreOptions;
export const rhythmOptions = sunoRhythmOptions;
export const soundOptions = sunoSoundOptions;

export const STORAGE_KEY = "ai_music_creator_visual_tool_v3";
export const PRESET_KEY = "ai_music_creator_custom_presets_v1";
export const HISTORY_KEY = "ai_music_creator_prompt_history_v1";
/** Mirrors package.json version (injected at build via next.config.js `env`). */
export const APP_VERSION =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_VERSION
    ? process.env.NEXT_PUBLIC_APP_VERSION
    : "0.9.2";
export const AUTHOR = "DJ M@D";

export const DEFAULT_STATE = {
  idea: "dark underground bass track with mechanical energy",
  tempo: "130 BPM",
  structure: "intro → build → drop → breakdown → final drop → outro",
  selectedGenres: ["Techno", "Industrial"],
  selectedRhythms: ["4/4", "Syncopated"],
  selectedSounds: ["Heavy sub bass", "Metallic percussion", "Analog synths"],
  vocal: "Instrumental",
  mode: "Hybrid",
  proMode: false,
  promptIntensity: 55,
  variationCount: 3,
  rules: "clean production, consistent style, strong low end, no unwanted vocal artifacts",
  notes: "",
  scores: { bass: 4, rhythm: 4, identity: 4, clarity: 4 },
  mood: { darkness: 70, energy: 80, aggression: 65, emotion: 35, complexity: 55, space: 60 },
  lyricTheme: "underground pressure, personal power, night movement",
  lyricLanguage: "English",
  lyricStructure: "verse → pre-hook → hook → verse → hook → outro",
  lyricStyle: "Dark poetic",
  lyricDensity: 55,
  promptFormat: "Balanced",
  promptEngine: "Standard",
  coProducerOutput: "",
  generatedLyrics: "",
  generatedLyricsStyle: "",
  generatedHooks: "",
  generatedHooksStyle: "",
  lyricVariantSeed: 0,
  lyricMode: "Structured Song",
  voiceRefFirstName: "",
  voiceRefLastName: "",
  voiceStyleLine: "",
  /** Guided path: instrumental with vocal chops/textures (no lyrics). */
  instrumentalVocalFx: false,
};

/** Blank project — no preselected genres, sounds, rules, or prompt text (guided step 1). */
export const BLANK_STATE = {
  idea: "",
  tempo: "",
  structure: "",
  selectedGenres: [],
  selectedRhythms: [],
  selectedSounds: [],
  vocal: "",
  mode: "Hybrid",
  proMode: false,
  promptIntensity: 50,
  variationCount: 3,
  rules: "",
  notes: "",
  scores: { bass: 3, rhythm: 3, identity: 3, clarity: 3 },
  mood: { darkness: 50, energy: 50, aggression: 50, emotion: 50, complexity: 50, space: 50 },
  lyricTheme: "",
  lyricLanguage: "English",
  lyricStructure: "",
  lyricStyle: "Dark poetic",
  lyricDensity: 50,
  promptFormat: "Balanced",
  promptEngine: "Standard",
  coProducerOutput: "",
  generatedLyrics: "",
  generatedLyricsStyle: "",
  generatedHooks: "",
  generatedHooksStyle: "",
  lyricVariantSeed: 0,
  lyricMode: "Structured Song",
  voiceRefFirstName: "",
  voiceRefLastName: "",
  voiceStyleLine: "",
  instrumentalVocalFx: false,
  guidedStep: 0,
};

export const promptFormatOptions = ["Compressed", "Balanced", "Detailed"];

export const vocalOptions = [
  "Instrumental",
  "Female Lead",
  "Male Lead",
  "Female Group",
  "Male Group",
  "Duet (M/F)",
  "Baritone Lead",
  "Whispered Lead",
  "Raspy Lead",
  "Breathy Soprano",
  "Autotuned Vocal",
  "Robotic",
  "Choir",
  "Spoken Word",
  "Vocal Chops",
  "Rave Chant",
  "Background Vocals",
  "Beatbox",
  "Crowd Chant",
  "Stacked Harmonies",
];

export const lyricStyleOptions = [
  "Dark poetic",
  "Club chant",
  "Street raw",
  "Emotional cinematic",
  "Minimal mantra",
  "Robotic cyber",
  "Aggressive hype",
  "Dreamlike abstract",
];

export const lyricModeOptions = ["Raw Prompt", "Structured Song", "Performance Ready"];

export const stylePresets = {
  "Techno Core": { genres:["Techno","Industrial"], rhythms:["4/4","Syncopated"], sounds:["Heavy sub bass","Metallic percussion","Analog synths","Distorted bass"], vocal:"Instrumental", tempo:"130 BPM", structure:"intro → build → drop → breakdown → final drop → outro" },
  "Jungle / DnB": { genres:["Drum & Bass","Jungle"], rhythms:["Breakbeat","Rolling"], sounds:["Heavy sub bass","Dub delays","Dark pads","Glitch FX"], vocal:"Instrumental", tempo:"174 BPM", structure:"cold intro → breakbeat build → sub drop → mutation → breakdown → final roll" },
  "Cinematic Hybrid": { genres:["Cinematic","Orchestral"], rhythms:["Halftime"], sounds:["Orchestral strings","Big drums","Dark pads","Choir texture"], vocal:"Choir", tempo:"95 BPM", structure:"quiet opening → emotional build → heroic climax → soft outro" },
  "Ambient Flow": { genres:["Ambient","Experimental"], rhythms:["No drums","Minimal"], sounds:["Dark pads","Noise atmosphere","Dub delays","Choir texture"], vocal:"Instrumental", tempo:"60 BPM", structure:"slow evolution with no clear sections" },
  "Trap Night": { genres:["Trap","Hip Hop"], rhythms:["Halftime","Trap halftime"], sounds:["808 bass","Dark pads","Glitch FX","Vinyl texture"], vocal:"Male Lead", tempo:"140 BPM", structure:"intro → verse → hook → verse → hook → outro" },
  "Pop Anthem": { genres:["Pop","Synth Pop"], rhythms:["4/4","Rolling"], sounds:["Bright leads","Big drums","Supersaw chords","Soft drums"], vocal:"Female Lead", tempo:"118 BPM", structure:"intro → verse → pre-chorus → chorus → verse → chorus → outro" },
  "Lo-Fi Study": { genres:["Lo-Fi Hip Hop","Jazz"], rhythms:["Boom Bap","Swing"], sounds:["Rhodes electric piano","Vinyl texture","Soft drums","Dark saxophone"], vocal:"Instrumental", tempo:"82 BPM", structure:"loop-friendly intro → head → variation → fade" },
  "Reggaeton Heat": { genres:["Reggaeton","Latin"], rhythms:["Dembow bounce","Latin clave"], sounds:["808 bass","Hand percussion","Bright leads","Metallic percussion"], vocal:"Male Lead", tempo:"95 BPM", structure:"intro → verse → chorus → verse → chorus → bridge → chorus" },
  "Metal Forge": { genres:["Metal","Heavy Metal"], rhythms:["4/4","Double-time"], sounds:["Distorted bass","Guitar","Big drums","Metallic percussion"], vocal:"Male Lead", tempo:"150 BPM", structure:"intro → verse → chorus → solo → chorus → outro" },
  "Jazz Lounge": { genres:["Jazz","Smooth Jazz"], rhythms:["Swing","Bossa groove"], sounds:["Piano","Upright bass","Dark saxophone","Soft drums"], vocal:"Female Lead", tempo:"105 BPM", structure:"intro → head → solo → head → outro" },
  "Afrobeats Pulse": { genres:["Afrobeats","R&B"], rhythms:["Syncopated","Tribal"], sounds:["Hand percussion","Electric bass","Bright leads","Background choir"], vocal:"Male Lead", tempo:"102 BPM", structure:"intro → groove → hook → groove → hook → outro" },
  "Detroit Techno": { genres:["Detroit Techno","Techno"], rhythms:["4/4","Shuffle"], sounds:["Analog synths","Heavy sub bass","Metallic percussion","Vinyl texture"], vocal:"Instrumental", tempo:"128 BPM", structure:"intro → filter build → main groove → breakdown → final groove → outro" },
};

export const fixes = {
  "Weak bass": "Increase sub bass presence, make low end dominant, add physical bass impact.",
  "Wrong genre": "Reinforce the primary genre first and remove conflicting genre words.",
  "Mumbled vocals": "No vocals, no vocal chops, no mumbled speech, do not use lyrics as FX.",
  "Too generic": "Add specific instruments, rhythm behavior, atmosphere source, and production texture.",
  "Too melodic": "Avoid traditional melody, focus on rhythm, texture, bass, and sound design.",
  "Too messy": "Simplify the prompt: one core genre, one secondary influence, fewer rules.",
};
