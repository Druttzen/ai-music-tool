#!/usr/bin/env node
/**
 * Sync Suno style/prompt/symbol catalogs from public online references.
 *
 * Primary source: stayen/suno-reference (MIT) tag-reference.md
 * https://github.com/stayen/suno-reference
 *
 * Genre wheel phrases remain in suno-v55-genre-wheel.js (Suno login required to scrape live).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "suno-catalog");
const OUT_JS = path.join(ROOT, "app", "lib", "suno-catalog-synced.js");

const SOURCES = {
  tagReference: {
    url: "https://raw.githubusercontent.com/stayen/suno-reference/main/tag-reference.md",
    repo: "https://github.com/stayen/suno-reference",
    license: "MIT",
  },
  genreWheel: {
    url: "https://suno.com/labs/genre-wheel",
    note: "Login-gated — refresh suno-v55-genre-wheel.js manually when Suno updates the wheel.",
  },
};

/** Structural section tags recognized in lyrics (Title Case for UI). */
const STRUCTURAL_TAG_SLUGS = new Set([
  "intro",
  "verse",
  "pre-chorus",
  "post-chorus",
  "chorus",
  "final chorus",
  "bridge",
  "bridge-drop",
  "build",
  "drop",
  "breakdown",
  "break",
  "hook",
  "interlude",
  "outro",
  "instrumental",
  "instrumental break",
  "coda",
  "refrain",
  "solo",
  "spoken word",
  "ad-lib",
  "concert intro",
  "vocal drone",
  "fade out",
  "end",
  "announcer",
  "call-and-response",
]);

/** Tags whose definitions imply vocal or production vocabulary. */
const VOCAL_TAG_SLUGS = new Set([
  "vocalist",
  "vocals",
  "background-vocals",
  "ad-lib",
  "choir",
  "chant",
  "spoken-word",
  "announcer",
]);

const PRODUCTION_TAG_SLUGS = new Set([
  "compression",
  "reverb",
  "delay",
  "eq",
  "mix",
  "master",
  "saturation",
  "sidechain",
  "filter",
  "distortion",
  "stereo",
  "spatial",
  "tempo",
  "bpm",
  "attack",
  "release",
  "articulation",
  "arrangement",
]);

function titleCaseTag(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function slugFromHeading(line) {
  const m = line.match(/^## \[([^\]]+)\]/);
  return m ? m[1].trim().toLowerCase() : null;
}

function parseTrademarkSubstitutions(markdown) {
  const block = markdown.split("# Grouping and containers")[0] || "";
  const items = [];
  for (const line of block.split("\n")) {
    const m = line.match(/^-\s+"([^"]+)":\s*(.+)$/);
    if (m) {
      items.push({ term: m[1], guidance: m[2].trim() });
    }
  }
  return items;
}

function parseMetaTags(markdown) {
  const tags = [];
  const sections = markdown.split(/^## \[/m).slice(1);

  for (const chunk of sections) {
    const nameEnd = chunk.indexOf("]");
    if (nameEnd < 0) continue;
    const slug = chunk.slice(0, nameEnd).trim().toLowerCase();
    const body = chunk.slice(nameEnd + 1);

    let meaning = "";
    const meaningMatch = body.match(/\*\*Meaning\*\*:\s*(.+)/);
    if (meaningMatch) {
      meaning = meaningMatch[1].replace(/\*\*/g, "").trim();
    } else {
      const descMatch = body.match(/\*\*Description:\*\*\s*\n\n(.+)/);
      if (descMatch) meaning = descMatch[1].replace(/\*\*/g, "").trim().split("\n")[0];
    }

    const placementMatch = body.match(/\*\*Placement(?: and syntax)?\*\*:?\s*\n?([\s\S]*?)(?=\n\*\*|\n---|\n## |$)/);
    const placement = placementMatch
      ? placementMatch[1]
          .replace(/\*\*/g, "")
          .replace(/^[\s-]+/gm, "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 3)
          .join(" ")
      : "";

    tags.push({ slug, name: titleCaseTag(slug), meaning, placement });
  }

  return tags;
}

function extractVocalTokens(metaTags) {
  const out = new Set();
  for (const t of metaTags) {
    if (!VOCAL_TAG_SLUGS.has(t.slug) && !t.slug.includes("vocal")) continue;
    if (t.meaning) out.add(t.meaning.split(".")[0].slice(0, 120));
    out.add(`${t.slug.replace(/-/g, " ")} tag`);
  }
  return [...out].slice(0, 40);
}

function extractProductionTokens(metaTags) {
  const out = new Set();
  for (const t of metaTags) {
    if (
      !PRODUCTION_TAG_SLUGS.has(t.slug) &&
      !/(mix|reverb|compress|filter|stereo|spatial|bass|drum|synth)/i.test(t.slug)
    ) {
      continue;
    }
    if (t.meaning) out.add(t.meaning.split(".")[0].slice(0, 100));
  }
  return [...out].slice(0, 35);
}

function buildPrinciples(trademarkSubstitutions) {
  const principles = [
    "Style field: use 4–8 strong tags; put instrumental-only guards last when present (v5.5 community guidance).",
    "Lyrics field: bracketed section tags + pipe overrides for local changes — e.g. [chorus | style: hook, vocals: autotune-light].",
    "Open with [track: genre:, mood:, length:, instruments:] for global defaults when building long prompts.",
    "Avoid protected trademark names in Style — use descriptive substitutes (see trademarkSubstitutions in sync manifest).",
    "Parameterized tags beat vague adjectives — [verse: soft, intimate vocal lines over acoustic guitar].",
  ];
  if (trademarkSubstitutions.length) {
    principles.push(
      `Trademark guard: e.g. "${trademarkSubstitutions[0].term}" → ${trademarkSubstitutions[0].guidance}`,
    );
  }
  return principles;
}

function serializeJsModule(payload) {
  return `/**
 * AUTO-GENERATED by scripts/sync-suno-catalog.cjs — do not edit manually.
 * Re-run: npm run sync:suno-catalog
 *
 * Sources: ${payload.sources.map((s) => s.id).join(", ")}
 * Synced at: ${payload.syncedAt}
 */

export const SUNO_CATALOG_SYNC = ${JSON.stringify(payload, null, 2)};

/** @param {string} slug */
export function metaTagTitle(slug) {
  const hit = SUNO_CATALOG_SYNC.metaTags.find((t) => t.slug === slug.toLowerCase());
  return hit ? hit.name : titleCaseTag(slug);
}

function titleCaseTag(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
`;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "ai-music-tool-catalog-sync/1.0" } });
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

async function main() {
  console.log("Fetching stayen/suno-reference tag-reference.md …");
  const markdown = await fetchText(SOURCES.tagReference.url);
  const lastModifiedMatch = markdown.match(/Last modified:\s*(.+)/i);
  const upstreamModified = lastModifiedMatch ? lastModifiedMatch[1].trim() : null;

  const metaTags = parseMetaTags(markdown);
  const trademarkSubstitutions = parseTrademarkSubstitutions(markdown);
  const structureTags = [...STRUCTURAL_TAG_SLUGS].map(titleCaseTag).sort((a, b) => a.localeCompare(b));
  const vocalTokens = extractVocalTokens(metaTags);
  const productionTokens = extractProductionTokens(metaTags);
  const principles = buildPrinciples(trademarkSubstitutions);

  const syncedAt = new Date().toISOString();

  const payload = {
    syncedAt,
    upstreamModified,
    sources: [
      {
        id: "stayen-tag-reference",
        url: SOURCES.tagReference.url,
        repo: SOURCES.tagReference.repo,
        license: SOURCES.tagReference.license,
        metaTagCount: metaTags.length,
      },
      {
        id: "suno-genre-wheel",
        url: SOURCES.genreWheel.url,
        note: SOURCES.genreWheel.note,
        embeddedIn: "app/lib/suno-v55-genre-wheel.js",
      },
    ],
    metaTags,
    structureTags,
    trademarkSubstitutions,
    vocalTokens,
    productionTokens,
    principles,
    pipeNotation: {
      format: "[SectionName | paramA: valueA, paramB: valueB]",
      example: "[chorus | style: phonk hook, vocals: autotune-light, melodic]",
      note: "Section-local overrides of global [track] defaults.",
    },
    trackContainerTag: {
      format: "[track: genre:, style:, mood:, length:, instruments:]",
      example:
        "[track: genre: phonk drift, style: lo-fi hip-hop, mood: gritty night drive, length: 180, instruments: 808 sub-bass, vinyl crackle]",
      note: "Place at the very top of the lyrics field before section tags.",
    },
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, "manifest.json"), JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(path.join(DATA_DIR, "meta-tags.json"), JSON.stringify(metaTags, null, 2), "utf8");
  fs.writeFileSync(
    path.join(DATA_DIR, "trademark-substitutions.json"),
    JSON.stringify(trademarkSubstitutions, null, 2),
    "utf8",
  );
  fs.writeFileSync(OUT_JS, serializeJsModule(payload), "utf8");

  console.log(`Parsed ${metaTags.length} meta-tags, ${structureTags.length} structure tags.`);
  console.log(`Wrote ${path.relative(ROOT, OUT_JS)}`);
  console.log(`Wrote ${path.relative(ROOT, path.join(DATA_DIR, "manifest.json"))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
