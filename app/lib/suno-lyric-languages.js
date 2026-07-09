/**
 * Suno-supported lyric languages — metadata, section tags, and sample phrases.
 * Strong tier: English, Spanish, French, German, Italian, Portuguese, Japanese,
 * Korean, Mandarin Chinese, Russian, Arabic, Hindi, Polish, Dutch, Turkish, Swedish.
 * Extended tier: additional languages Suno can attempt (quality varies by model).
 */

/** @typedef {{
 *   label: string,
 *   sunoTag: string,
 *   tier: "strong" | "extended",
 *   scriptHint: string,
 *   sectionSuffix: string,
 *   samples?: {
 *     signature: string,
 *     energyHigh: string,
 *     energyLow: string,
 *     energyMid: string,
 *     hookDark: string,
 *     hookLight: string,
 *     hookEmo: string,
 *     verse: string[],
 *     chorus: string[],
 *     hooks: string[],
 *   },
 * }} SunoLyricLanguage
 */

/** @type {SunoLyricLanguage[]} */
const LANGUAGE_CATALOG = [
  {
    label: "English",
    sunoTag: "English",
    tier: "strong",
    scriptHint: "Latin alphabet. Default Suno strength.",
    sectionSuffix: "English only",
    samples: {
      signature: "Shadows move under my skin",
      energyHigh: "Feel the pressure, feel the sound",
      energyLow: "Slow motion, drifting down",
      energyMid: "Every heartbeat locks in time",
      hookDark: "In the dark we come alive",
      hookLight: "In the light we rise again",
      hookEmo: "Hearts collide beneath the sky",
      verse: ["Neon rain on empty streets", "Every secret that I keep"],
      chorus: ["In the dark we come alive", "Feel the bass beneath your skin"],
      hooks: ["In the dark we come alive", "Hands up!", "Feel the drop"],
    },
  },
  {
    label: "Spanish",
    sunoTag: "Spanish",
    tier: "strong",
    scriptHint: "Write lyrics in Spanish. Prefer Spanish style words in the Style field to reduce English ad-libs.",
    sectionSuffix: "Spanish only, no English ad-libs",
    samples: {
      signature: "Las sombras se mueven bajo mi piel",
      energyHigh: "Siente la presión, siente el sonido",
      energyLow: "Cámara lenta, cayendo",
      energyMid: "Cada latido encaja en el tiempo",
      hookDark: "En la oscuridad cobramos vida",
      hookLight: "En la luz volvemos a nacer",
      hookEmo: "Los corazones chocan bajo el cielo",
      verse: ["Lluvia de neón en calles vacías", "Cada secreto que guardo"],
      chorus: ["En la oscuridad cobramos vida", "Siente el bajo bajo tu piel"],
      hooks: ["Manos arriba", "No paramos", "Siente el drop"],
    },
  },
  {
    label: "French",
    sunoTag: "French",
    tier: "strong",
    scriptHint: "Write lyrics in French. Use French section tags when possible.",
    sectionSuffix: "French only, no English ad-libs",
    samples: {
      signature: "Les ombres bougent sous ma peau",
      energyHigh: "Sens la pression, sens le son",
      energyLow: "Ralenti, je dérive",
      energyMid: "Chaque battement verrouille le temps",
      hookDark: "Dans le noir on prend vie",
      hookLight: "Dans la lumière on renaît",
      hookEmo: "Les cœurs se croisent sous le ciel",
      verse: ["Pluie de néon sur rues vides", "Chaque secret que je garde"],
      chorus: ["Dans le noir on prend vie", "Sens la basse sous ta peau"],
      hooks: ["Dans le noir", "Encore une fois", "Sens le drop"],
    },
  },
  {
    label: "German",
    sunoTag: "German",
    tier: "strong",
    scriptHint: "Write lyrics in German.",
    sectionSuffix: "German only, no English ad-libs",
    samples: {
      signature: "Schatten wandern unter meiner Haut",
      energyHigh: "Spür den Druck, spür den Sound",
      energyLow: "Zeitlupe, langsam nach unten",
      energyMid: "Jeder Herzschlag fixiert die Zeit",
      hookDark: "In der Dunkelheit erwachen wir",
      hookLight: "Im Licht steigen wir wieder auf",
      hookEmo: "Herzen treffen sich unter dem Himmel",
      verse: ["Neonregen auf leeren Straßen", "Jedes Geheimnis das ich bewahr"],
      chorus: ["In der Dunkelheit erwachen wir", "Spür den Bass unter deiner Haut"],
      hooks: ["In der Dunkelheit", "Hände hoch", "Spür den Drop"],
    },
  },
  {
    label: "Italian",
    sunoTag: "Italian",
    tier: "strong",
    scriptHint: "Write lyrics in Italian.",
    sectionSuffix: "Italian only, no English ad-libs",
    samples: {
      signature: "Le ombre si muovono sotto la pelle",
      energyHigh: "Senti la pressione, senti il suono",
      energyLow: "Al rallentatore, scendo giù",
      energyMid: "Ogni battito blocca il tempo",
      hookDark: "Nel buio torniamo vivi",
      hookLight: "Nella luce risorgiamo",
      hookEmo: "I cuori si incontrano sotto il cielo",
      verse: ["Pioggia di neon su strade vuote", "Ogni segreto che custodisco"],
      chorus: ["Nel buio torniamo vivi", "Senti il basso sotto la pelle"],
      hooks: ["Nel buio", "Non ci fermiamo", "Senti il drop"],
    },
  },
  {
    label: "Portuguese",
    sunoTag: "Portuguese",
    tier: "strong",
    scriptHint: "Write lyrics in Portuguese (Brazilian or European — declare in theme if needed).",
    sectionSuffix: "Portuguese only, no English ad-libs",
    samples: {
      signature: "Sombras se movem debaixo da pele",
      energyHigh: "Sente a pressão, sente o som",
      energyLow: "Câmera lenta, descendo",
      energyMid: "Cada batida trava o tempo",
      hookDark: "No escuro a gente revive",
      hookLight: "Na luz a gente renasce",
      hookEmo: "Corações colidem debaixo do céu",
      verse: ["Chuva de neon em ruas vazias", "Cada segredo que eu guardo"],
      chorus: ["No escuro a gente revive", "Sente o grave na pele"],
      hooks: ["No escuro", "Mãos pro alto", "Sente o drop"],
    },
  },
  {
    label: "Russian",
    sunoTag: "Russian",
    tier: "strong",
    scriptHint: "Write lyrics in Cyrillic (Russian).",
    sectionSuffix: "Russian only, no English ad-libs",
    samples: {
      signature: "Тени движутся под кожей",
      energyHigh: "Чувствуй давление, чувствуй звук",
      energyLow: "Замедленно, падаю вниз",
      energyMid: "Каждый удар сердца ловит время",
      hookDark: "В темноте мы оживаем",
      hookLight: "В свете мы поднимаемся снова",
      hookEmo: "Сердца сталкиваются под небом",
      verse: ["Неоновый дождь на пустых улицах", "Каждая тайна что храню"],
      chorus: ["В темноте мы оживаем", "Чувствуй бас под кожей"],
      hooks: ["В темноте", "Руки вверх", "Чувствуй дроп"],
    },
  },
  {
    label: "Mandarin Chinese",
    sunoTag: "Mandarin",
    tier: "strong",
    scriptHint: "Write lyrics in simplified or traditional Chinese characters. Use [Verse — Mandarin only] tags.",
    sectionSuffix: "Mandarin only, no English ad-libs",
    samples: {
      signature: "阴影在我皮肤下移动",
      energyHigh: "感受压力，感受声音",
      energyLow: "慢动作，向下漂流",
      energyMid: "每次心跳锁定时间",
      hookDark: "在黑暗中我们复活",
      hookLight: "在光明中我们再次升起",
      hookEmo: "心灵在天空下相遇",
      verse: ["霓虹雨落在空荡的街", "我守护的每个秘密"],
      chorus: ["在黑暗中我们复活", "感受低音在皮肤下"],
      hooks: ["在黑暗中", "举起双手", "感受落点"],
    },
  },
  {
    label: "Cantonese",
    sunoTag: "Cantonese",
    tier: "extended",
    scriptHint: "Write lyrics in traditional Chinese characters; declare Cantonese vocal in Style.",
    sectionSuffix: "Cantonese only, no English ad-libs",
    samples: {
      signature: "影子喺皮膚下郁動",
      energyHigh: "感受壓力，感受聲音",
      energyLow: "慢動作，向下漂",
      energyMid: "每次心跳鎖住時間",
      hookDark: "喺黑暗裏我哋醒過來",
      hookLight: "喺光裏我哋再升起",
      hookEmo: "心喺天空下相遇",
      verse: ["霓虹雨落喺空街", "我守住嘅秘密"],
      chorus: ["喺黑暗裏我哋醒過來", "感受低音喺皮膚下"],
      hooks: ["喺黑暗", "舉起手", "感受 drop"],
    },
  },
  {
    label: "Japanese",
    sunoTag: "Japanese",
    tier: "strong",
    scriptHint: "Mix kanji and hiragana naturally; avoid all-katakana lyrics.",
    sectionSuffix: "Japanese only, no English ad-libs",
    samples: {
      signature: "影が肌の下で動く",
      energyHigh: "プレッシャーを感じて、サウンドを感じて",
      energyLow: "スローモーション、落ちていく",
      energyMid: "鼓動が時間を止める",
      hookDark: "闇の中で僕らは生き返る",
      hookLight: "光の中でまた昇る",
      hookEmo: "心が空の下で出会う",
      verse: ["ネオンの雨が空の道", "守ってきた秘密"],
      chorus: ["闇の中で僕らは生き返る", "ベースを肌で感じて"],
      hooks: ["闇の中", "手を上げて", "ドロップを感じて"],
    },
  },
  {
    label: "Korean",
    sunoTag: "Korean",
    tier: "strong",
    scriptHint: "Write lyrics in hangul.",
    sectionSuffix: "Korean only, no English ad-libs",
    samples: {
      signature: "그림자가 피부 아래 움직여",
      energyHigh: "압력을 느껴, 사운드를 느껴",
      energyLow: "슬로 모션, 아래로",
      energyMid: "매 heartbeat이 시간을 잠가",
      hookDark: "어둠 속에서 우리는 살아나",
      hookLight: "빛 속에서 다시 일어서",
      hookEmo: "마음이 하늘 아래 부딪혀",
      verse: ["네온 비가 빈 거리에", "지켜온 모든 비밀"],
      chorus: ["어둠 속에서 우리는 살아나", "베이스를 피부로 느껴"],
      hooks: ["어둠 속", "손 들어", "드롭을 느껴"],
    },
  },
  {
    label: "Hindi",
    sunoTag: "Hindi",
    tier: "strong",
    scriptHint: "Write lyrics in Devanagari script when possible.",
    sectionSuffix: "Hindi only, no English ad-libs",
    samples: {
      signature: "पर्छाइयाँ त्वचा के नीचे चलती हैं",
      energyHigh: "दबाव महसूस करो, आवाज़ महसूस करो",
      energyLow: "धीमा गति, नीचे बह रहा",
      energyMid: "हर धड़कन समय को जकड़ती है",
      hookDark: "अंधेरे में हम जागते हैं",
      hookLight: "रोशनी में हम फिर उठते हैं",
      hookEmo: "दिल आसमान के नीचे मिलते हैं",
      verse: ["खाली सड़कों पर नीयन बारिश", "हर राज़ जो मैं रखता हूँ"],
      chorus: ["अंधेरे में हम जागते हैं", "बास को त्वचा के नीचे महसूस करो"],
      hooks: ["अंधेरे में", "हाथ ऊपर", "ड्रॉप महसूस करो"],
    },
  },
  {
    label: "Arabic",
    sunoTag: "Arabic",
    tier: "strong",
    scriptHint: "Write lyrics in Arabic script; if the lyric box misbehaves, try transliteration with Arabic in parentheses.",
    sectionSuffix: "Arabic only, no English ad-libs",
    samples: {
      signature: "الظلال تتحرك تحت جلدي",
      energyHigh: "اشعر بالضغط، اشعر بالصوت",
      energyLow: "حركة بطيئة، أنزل",
      energyMid: "كل نبضة تقفل الزمن",
      hookDark: "في الظلام نحن نحيا",
      hookLight: "في النور ننهض من جديد",
      hookEmo: "القلوب تصطدم تحت السماء",
      verse: ["مطر نيون على شوارع فارغة", "كل سر أحتفظ به"],
      chorus: ["في الظلام نحن نحيا", "اشعر بالباس تحت جلدك"],
      hooks: ["في الظلام", "ارفع يديك", "اشعر بالدروب"],
    },
  },
  {
    label: "Dutch",
    sunoTag: "Dutch",
    tier: "strong",
    scriptHint: "Write lyrics in Dutch.",
    sectionSuffix: "Dutch only, no English ad-libs",
    samples: {
      signature: "Schaduwen bewegen onder mijn huid",
      energyHigh: "Voel de druk, voel het geluid",
      energyLow: "Slow motion, zakken naar beneden",
      energyMid: "Elke hartslag vergrendelt de tijd",
      hookDark: "In het donker komen we tot leven",
      hookLight: "In het licht stijgen we weer op",
      hookEmo: "Harten botsen onder de hemel",
      verse: ["Neonregen op lege straten", "Elk geheim dat ik bewaar"],
      chorus: ["In het donker komen we tot leven", "Voel de bas onder je huid"],
      hooks: ["In het donker", "Handen omhoog", "Voel de drop"],
    },
  },
  {
    label: "Polish",
    sunoTag: "Polish",
    tier: "strong",
    scriptHint: "Write lyrics in Polish.",
    sectionSuffix: "Polish only, no English ad-libs",
    samples: {
      signature: "Cienie poruszają się pod skórą",
      energyHigh: "Czuj presję, czuj dźwięk",
      energyLow: "Zwolnione tempo, opadam",
      energyMid: "Każde uderzenie serca blokuje czas",
      hookDark: "W ciemności ożywamy",
      hookLight: "W świetle znów wstajemy",
      hookEmo: "Serca spotykają się pod niebem",
      verse: ["Neonowy deszcz na pustych ulicach", "Każdy sekret który trzymam"],
      chorus: ["W ciemności ożywamy", "Czuj bas pod skórą"],
      hooks: ["W ciemności", "Ręce w górę", "Czuj drop"],
    },
  },
  {
    label: "Turkish",
    sunoTag: "Turkish",
    tier: "strong",
    scriptHint: "Write lyrics in Turkish.",
    sectionSuffix: "Turkish only, no English ad-libs",
    samples: {
      signature: "Gölgeler tenimin altında hareket eder",
      energyHigh: "Baskıyı hisset, sesi hisset",
      energyLow: "Ağır çekim, aşağı süzülüyorum",
      energyMid: "Her kalp atışı zamanı kilitler",
      hookDark: "Karanlıkta hayata dönüyoruz",
      hookLight: "Işıkta yeniden yükseliyoruz",
      hookEmo: "Kalpler gökyüzünde çarpışır",
      verse: ["Boş sokaklarda neon yağmuru", "Sakladığım her sır"],
      chorus: ["Karanlıkta hayata dönüyoruz", "Bası teninin altında hisset"],
      hooks: ["Karanlıkta", "Eller yukarı", "Drop'u hisset"],
    },
  },
  {
    label: "Swedish",
    sunoTag: "Swedish",
    tier: "strong",
    scriptHint: "Write lyrics in Swedish.",
    sectionSuffix: "Swedish only, no English ad-libs",
    samples: {
      signature: "Skuggor rör sig under huden",
      energyHigh: "Känn trycket, känn ljudet",
      energyLow: "Långsam rörelse, glider ner",
      energyMid: "Varje hjärtslag låser tiden",
      hookDark: "I mörkret vaknar vi",
      hookLight: "I ljuset stiger vi igen",
      hookEmo: "Hjärtan möts under himlen",
      verse: ["Neons regn på tomma gator", "Månsken skär genom betonggrått"],
      chorus: ["I mörkret vaknar vi", "Håll natten i ditt bröst"],
      hooks: ["I mörkret vaknar vi", "Neonhemligheter", "Känn droppen"],
    },
  },
  {
    label: "Indonesian",
    sunoTag: "Indonesian",
    tier: "strong",
    scriptHint: "Write lyrics in Indonesian.",
    sectionSuffix: "Indonesian only, no English ad-libs",
    samples: {
      signature: "Bayangan bergerak di bawah kulitku",
      energyHigh: "Rasakan tekanan, rasakan suara",
      energyLow: "Gerak lambat, turun perlahan",
      energyMid: "Setiap detak mengunci waktu",
      hookDark: "Dalam gelap kita hidup kembali",
      hookLight: "Dalam cahaya kita bangkit lagi",
      hookEmo: "Hati bertemu di bawah langit",
      verse: ["Hujan neon di jalan kosong", "Setiap rahasia yang kusimpan"],
      chorus: ["Dalam gelap kita hidup kembali", "Rasakan bass di bawah kulit"],
      hooks: ["Dalam gelap", "Angkat tangan", "Rasakan drop"],
    },
  },
  {
    label: "Tagalog",
    sunoTag: "Tagalog",
    tier: "strong",
    scriptHint: "Write lyrics in Tagalog / Filipino.",
    sectionSuffix: "Tagalog only, no English ad-libs",
    samples: {
      signature: "Gumagalaw ang mga anino sa ilalim ng balat",
      energyHigh: "Damhin ang pressure, damhin ang tunog",
      energyLow: "Mabagal, bumababa",
      energyMid: "Bawat tibok ay nagsasara ng oras",
      hookDark: "Sa dilim tayo'y nabubuhay",
      hookLight: "Sa liwanag tayo'y babangon",
      hookEmo: "Mga puso'y nagtatagpo sa langit",
      verse: ["Neon na ulan sa walang laman na kalsada", "Bawat lihim na tinatago"],
      chorus: ["Sa dilim tayo'y nabubuhay", "Damhin ang bass sa balat"],
      hooks: ["Sa dilim", "Itaas ang kamay", "Damhin ang drop"],
    },
  },
  {
    label: "Vietnamese",
    sunoTag: "Vietnamese",
    tier: "extended",
    scriptHint: "Write lyrics in Vietnamese with proper diacritics.",
    sectionSuffix: "Vietnamese only, no English ad-libs",
  },
  {
    label: "Thai",
    sunoTag: "Thai",
    tier: "extended",
    scriptHint: "Write lyrics in Thai script.",
    sectionSuffix: "Thai only, no English ad-libs",
  },
  {
    label: "Greek",
    sunoTag: "Greek",
    tier: "extended",
    scriptHint: "Write lyrics in Greek script.",
    sectionSuffix: "Greek only, no English ad-libs",
  },
  {
    label: "Czech",
    sunoTag: "Czech",
    tier: "extended",
    scriptHint: "Write lyrics in Czech.",
    sectionSuffix: "Czech only, no English ad-libs",
  },
  {
    label: "Romanian",
    sunoTag: "Romanian",
    tier: "extended",
    scriptHint: "Write lyrics in Romanian.",
    sectionSuffix: "Romanian only, no English ad-libs",
  },
  {
    label: "Hungarian",
    sunoTag: "Hungarian",
    tier: "extended",
    scriptHint: "Write lyrics in Hungarian.",
    sectionSuffix: "Hungarian only, no English ad-libs",
  },
  {
    label: "Finnish",
    sunoTag: "Finnish",
    tier: "extended",
    scriptHint: "Write lyrics in Finnish.",
    sectionSuffix: "Finnish only, no English ad-libs",
  },
  {
    label: "Norwegian",
    sunoTag: "Norwegian",
    tier: "extended",
    scriptHint: "Write lyrics in Norwegian.",
    sectionSuffix: "Norwegian only, no English ad-libs",
  },
  {
    label: "Danish",
    sunoTag: "Danish",
    tier: "extended",
    scriptHint: "Write lyrics in Danish.",
    sectionSuffix: "Danish only, no English ad-libs",
  },
  {
    label: "Ukrainian",
    sunoTag: "Ukrainian",
    tier: "extended",
    scriptHint: "Write lyrics in Ukrainian Cyrillic.",
    sectionSuffix: "Ukrainian only, no English ad-libs",
  },
  {
    label: "Hebrew",
    sunoTag: "Hebrew",
    tier: "extended",
    scriptHint: "Write lyrics in Hebrew script (RTL).",
    sectionSuffix: "Hebrew only, no English ad-libs",
  },
  {
    label: "Persian",
    sunoTag: "Persian",
    tier: "extended",
    scriptHint: "Write lyrics in Persian / Farsi script.",
    sectionSuffix: "Persian only, no English ad-libs",
  },
  {
    label: "Bengali",
    sunoTag: "Bengali",
    tier: "extended",
    scriptHint: "Write lyrics in Bengali script.",
    sectionSuffix: "Bengali only, no English ad-libs",
  },
  {
    label: "Tamil",
    sunoTag: "Tamil",
    tier: "extended",
    scriptHint: "Write lyrics in Tamil script.",
    sectionSuffix: "Tamil only, no English ad-libs",
  },
  {
    label: "Urdu",
    sunoTag: "Urdu",
    tier: "extended",
    scriptHint: "Write lyrics in Urdu script.",
    sectionSuffix: "Urdu only, no English ad-libs",
  },
  {
    label: "Malay",
    sunoTag: "Malay",
    tier: "extended",
    scriptHint: "Write lyrics in Malay.",
    sectionSuffix: "Malay only, no English ad-libs",
  },
  {
    label: "Swahili",
    sunoTag: "Swahili",
    tier: "extended",
    scriptHint: "Write lyrics in Swahili.",
    sectionSuffix: "Swahili only, no English ad-libs",
  },
  {
    label: "Catalan",
    sunoTag: "Catalan",
    tier: "extended",
    scriptHint: "Write lyrics in Catalan.",
    sectionSuffix: "Catalan only, no English ad-libs",
  },
];

/** Legacy saved projects */
const LEGACY_LANGUAGE_ALIASES = {
  "Mixed English/Swedish": "Bilingual (declare in section tags)",
};

export function normalizeLyricLanguage(label) {
  if (label === undefined || label === null) return "English";
  const trimmed = String(label).trim();
  if (!trimmed) return "";
  return LEGACY_LANGUAGE_ALIASES[trimmed] || trimmed;
}

export const SUNO_LYRIC_SPECIAL_OPTIONS = [
  "Bilingual (declare in section tags)",
  "No specific language",
];

export const lyricLanguageOptions = [
  ...LANGUAGE_CATALOG.map((l) => l.label),
  ...SUNO_LYRIC_SPECIAL_OPTIONS,
];

export const SUNO_LYRIC_LANGUAGE_GROUPS = [
  { label: "Strong Suno support", languages: LANGUAGE_CATALOG.filter((l) => l.tier === "strong") },
  { label: "Extended Suno support", languages: LANGUAGE_CATALOG.filter((l) => l.tier === "extended") },
  { label: "Other", languages: SUNO_LYRIC_SPECIAL_OPTIONS.map((label) => ({ label, sunoTag: label, tier: "special" })) },
];

const BY_LABEL = new Map(LANGUAGE_CATALOG.map((l) => [l.label, l]));

/**
 * @param {string} label
 * @returns {SunoLyricLanguage | null}
 */
export function getSunoLyricLanguageMeta(label) {
  const normalized = LEGACY_LANGUAGE_ALIASES[label] || label;
  if (normalized === "No specific language" || normalized === "Bilingual (declare in section tags)") {
    return {
      label: normalized,
      sunoTag: normalized,
      tier: "special",
      scriptHint:
        normalized === "Bilingual (declare in section tags)"
          ? "Use [Verse — Language A] / [Chorus — Language B] section tags. Avoid English ad-libs unless intended."
          : "No fixed language — declare per section if needed.",
      sectionSuffix: "",
    };
  }
  return BY_LABEL.get(normalized) || null;
}

/**
 * Suno bracket rules appended to lyric direction prompts.
 * @param {string} lyricLanguage
 */
export function getSunoLanguagePromptRules(lyricLanguage) {
  const meta = getSunoLyricLanguageMeta(lyricLanguage);
  if (!meta) return "";
  if (meta.label === "No specific language") {
    return "No fixed lyric language — use section tags if mixing languages.";
  }
  if (meta.label === "Bilingual (declare in section tags)") {
    return "Bilingual lyrics: declare each section language in brackets, e.g. [Verse 1 — Spanish only]. Minimize unintended English ad-libs.";
  }
  const lines = [
    `Write ALL sung lyrics in ${meta.sunoTag} only.`,
    `Use section tags like [Verse 1 — ${meta.sunoTag} only, no English ad-libs].`,
    meta.scriptHint,
  ];
  if (meta.tier === "extended") {
    lines.push("Extended Suno support — test on your model; native script preferred.");
  }
  return lines.join(" ");
}

/**
 * @param {string} lyricLanguage
 * @param {"high"|"low"|"mid"} energy
 */
export function getLanguageEnergyLine(lyricLanguage, energy) {
  const meta = getSunoLyricLanguageMeta(lyricLanguage);
  const s = meta?.samples;
  if (!s) {
    if (energy === "high") return "Feel the pressure, feel the sound";
    if (energy === "low") return "Slow motion, drifting down";
    return "Every heartbeat locks in time";
  }
  if (energy === "high") return s.energyHigh;
  if (energy === "low") return s.energyLow;
  return s.energyMid;
}

/**
 * @param {string} lyricLanguage
 * @param {"dark"|"light"|"emo"} tone
 */
export function getLanguageHookLine(lyricLanguage, tone) {
  const meta = getSunoLyricLanguageMeta(lyricLanguage);
  const s = meta?.samples;
  if (!s) {
    if (tone === "dark") return "In the dark we come alive";
    if (tone === "emo") return "Hearts collide beneath the sky";
    return "In the light we rise again";
  }
  if (tone === "dark") return s.hookDark;
  if (tone === "emo") return s.hookEmo;
  return s.hookLight;
}

/**
 * @param {string} lyricLanguage
 * @param {string} sectionName e.g. "Verse 1"
 */
export function formatSunoLyricSectionTag(sectionName, lyricLanguage) {
  const meta = getSunoLyricLanguageMeta(lyricLanguage);
  if (!meta?.sunoTag || meta.label === "No specific language") return `[${sectionName}]`;
  if (meta.label === "Bilingual (declare in section tags)") {
    return `[${sectionName} — declare language here]`;
  }
  return `[${sectionName} — ${meta.sectionSuffix}]`;
}

/**
 * Apply native phrase samples when available.
 * @param {object} content
 * @param {string} lyricLanguage
 */
export function applyLanguageFlavorToContent(content, lyricLanguage) {
  if (lyricLanguage === "English" || lyricLanguage === "No specific language") {
    return content;
  }
  if (lyricLanguage === "Bilingual (declare in section tags)" || lyricLanguage === "Mixed English/Swedish") {
    const sv = getSunoLyricLanguageMeta("Swedish")?.samples;
    if (!sv) return content;
    return {
      ...content,
      signatureLine: `${content.signatureLine} / ${sv.signature || ""}`.trim(),
      verse: [...content.verse.slice(0, 2), ...(sv.verse || []).slice(0, 2)],
      chorus: [...content.chorus.slice(0, 2), ...(sv.chorus || []).slice(0, 2)],
      hooks: [...(content.hooks || []).slice(0, 2), ...(sv.hooks || []).slice(0, 1)],
    };
  }
  const meta = getSunoLyricLanguageMeta(lyricLanguage);
  const s = meta?.samples;
  if (!s) return content;
  return {
    ...content,
    signatureLine: s.signature || content.signatureLine,
    verse: s.verse?.length ? s.verse : content.verse,
    chorus: s.chorus?.length ? s.chorus : content.chorus,
    hooks: s.hooks?.length ? s.hooks : content.hooks,
  };
}

export function getLanguageHeaderLine(lyricLanguage) {
  const meta = getSunoLyricLanguageMeta(lyricLanguage);
  if (!meta || meta.label === "No specific language") return "";
  if (meta.label === "Bilingual (declare in section tags)") {
    return "[Language: Bilingual — declare each section in bracket tags]";
  }
  return `[Language: ${meta.sunoTag} — ${meta.sectionSuffix}]`;
}

export { LANGUAGE_CATALOG as SUNO_LYRIC_LANGUAGE_CATALOG };
