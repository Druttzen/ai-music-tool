#!/usr/bin/env node
/**
 * Verify large Suno catalogs are split into async chunks (not inlined in the main app bundle).
 * Run after `next build` (wired via npm postbuild).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const chunkRoots = [
  path.join(root, ".next", "static", "chunks"),
  path.join(root, "out", "_next", "static", "chunks"),
];

/** Marker strings that only appear inside lazy catalog modules. */
const LAZY_MARKERS = [
  { id: "awesome-suno", needle: "awesomeSunoConceptLines" },
  { id: "suno-catalog-sync", needle: "stayen-tag-reference" },
];

function listJsFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) listJsFiles(full, acc);
    else if (name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

const files = chunkRoots.flatMap((dir) => listJsFiles(dir));
if (!files.length) {
  console.error("verify-lazy-catalog-chunks: no build chunks found — run npm run build first");
  process.exit(1);
}

const fileContents = files.map((file) => ({
  file,
  text: fs.readFileSync(file, "utf8"),
  base: path.basename(file),
}));

const mainCandidates = fileContents.filter(
  ({ base, text }) =>
    /^(main|app|pages|framework|webpack)-/.test(base) ||
    (base.length < 24 && text.includes("createElement") && !text.includes("awesomeSunoConceptLines")),
);

let failed = false;

for (const { id, needle } of LAZY_MARKERS) {
  const dedicated = fileContents.filter(({ text }) => text.includes(needle));
  if (!dedicated.length) {
    console.error(`verify-lazy-catalog-chunks: missing async chunk for ${id} (needle: ${needle})`);
    failed = true;
    continue;
  }

  const inlinedInMain = mainCandidates.filter(({ text }) => text.includes(needle));
  if (inlinedInMain.length) {
    console.error(
      `verify-lazy-catalog-chunks: ${id} marker found in main-like chunks: ${inlinedInMain
        .map((f) => f.base)
        .join(", ")}`,
    );
    failed = true;
  } else {
    console.log(`verify-lazy-catalog-chunks: ${id} OK (${dedicated.length} chunk(s))`);
  }
}

if (failed) process.exit(1);
console.log("verify-lazy-catalog-chunks: OK");
