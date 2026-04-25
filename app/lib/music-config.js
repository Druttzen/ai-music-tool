export const STORAGE_KEY = "ai_music_creator_visual_tool_v3";
export const PRESET_KEY = "ai_music_creator_custom_presets_v1";
export const HISTORY_KEY = "ai_music_creator_prompt_history_v1";
export const APP_VERSION = "0.5.1";
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
  coProducerOutput: "",
  generatedLyrics: "",
  generatedHooks: "",
  lyricMode: "Structured Song",
};

export const genreOptions = ["Techno","House","Drum & Bass","Jungle","Hip Hop","Trap","Pop","Ambient","Cinematic","Rock","Jazz","Experimental","Industrial","Synthwave","Future Bass","Orchestral"];
export const rhythmOptions = ["4/4","Breakbeat","Halftime","Swing","Boom Bap","Rolling","Off-grid","Minimal","No drums","Syncopated"];
export const soundOptions = ["Heavy sub bass","Distorted bass","808 bass","Metallic percussion","Analog synths","Bright leads","Dark pads","Piano","Guitar","Orchestral strings","Big drums","Soft drums","Vinyl texture","Noise atmosphere","Dub delays","Glitch FX","Choir texture"];
export const vocalOptions = ["Instrumental","Female Lead","Male Lead","Robotic","Choir","Spoken Word","Vocal Chops","Rave Chant"];

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

export const lyricLanguageOptions = [
  "English",
  "Swedish",
  "Mixed English/Swedish",
  "No specific language",
];

export const promptFormatOptions = ["Compressed", "Balanced", "Detailed"];
export const lyricModeOptions = ["Raw Prompt", "Structured Song", "Performance Ready"];

export const stylePresets = {
  "Techno Core": { genres:["Techno","Industrial"], rhythms:["4/4","Syncopated"], sounds:["Heavy sub bass","Metallic percussion","Analog synths","Distorted bass"], vocal:"Instrumental", tempo:"130 BPM", structure:"intro → build → drop → breakdown → final drop → outro" },
  "Jungle / DnB": { genres:["Drum & Bass","Jungle"], rhythms:["Breakbeat","Rolling"], sounds:["Heavy sub bass","Dub delays","Dark pads","Glitch FX"], vocal:"Instrumental", tempo:"174 BPM", structure:"cold intro → breakbeat build → sub drop → mutation → breakdown → final roll" },
  "Cinematic Hybrid": { genres:["Cinematic","Orchestral"], rhythms:["Halftime"], sounds:["Orchestral strings","Big drums","Dark pads","Choir texture"], vocal:"Choir", tempo:"95 BPM", structure:"quiet opening → emotional build → heroic climax → soft outro" },
  "Ambient Flow": { genres:["Ambient","Experimental"], rhythms:["No drums","Minimal"], sounds:["Dark pads","Noise atmosphere","Dub delays","Choir texture"], vocal:"Instrumental", tempo:"60 BPM", structure:"slow evolution with no clear sections" },
};

export const fixes = {
  "Weak bass": "Increase sub bass presence, make low end dominant, add physical bass impact.",
  "Wrong genre": "Reinforce the primary genre first and remove conflicting genre words.",
  "Mumbled vocals": "No vocals, no vocal chops, no mumbled speech, do not use lyrics as FX.",
  "Too generic": "Add specific instruments, rhythm behavior, atmosphere source, and production texture.",
  "Too melodic": "Avoid traditional melody, focus on rhythm, texture, bass, and sound design.",
  "Too messy": "Simplify the prompt: one core genre, one secondary influence, fewer rules.",
};
