/**
 * Build build/AI_Music_Creator_README.pdf from README.md (Electron first-launch doc).
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const ROOT = path.join(__dirname, "..");
const README_PATH = path.join(ROOT, "README.md");
const OUT_PATH = path.join(ROOT, "build", "AI_Music_Creator_README.pdf");

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return pkg.version || "0.0.0";
}

/** Strip lightweight markdown for PDF text runs. */
function stripInline(text) {
  return String(text || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/—/g, "-")
    .trim();
}

/**
 * @param {string} md
 * @returns {Array<{ type: string, text?: string, lines?: string[] }>}
 */
function parseReadme(md) {
  const lines = md.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  const skipLegacy = (line) =>
    line.startsWith("_Legacy") || line.startsWith("_legacy");

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim() || skipLegacy(line)) {
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", lines: code });
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: stripInline(line.slice(2)) });
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: stripInline(line.slice(3)) });
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: stripInline(line.slice(4)) });
      i++;
      continue;
    }

    if (line.startsWith("|")) {
      const table = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s\-:|]+\|$/.test(lines[i].trim())) {
          table.push(
            lines[i]
              .split("|")
              .slice(1, -1)
              .map((c) => stripInline(c))
              .join("  |  "),
          );
        }
        i++;
      }
      blocks.push({ type: "table", lines: table });
      continue;
    }

    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(stripInline(lines[i].slice(2)));
        i++;
      }
      blocks.push({ type: "list", lines: items });
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("|") &&
      !lines[i].startsWith("```") &&
      !skipLegacy(lines[i])
    ) {
      para.push(stripInline(lines[i]));
      i++;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }

  return blocks;
}

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

function renderBlocks(doc, blocks) {
  const margin = doc.page.margins.left;
  const width = doc.page.width - margin - doc.page.margins.right;

  for (const block of blocks) {
    switch (block.type) {
      case "h1":
        ensureSpace(doc, 56);
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(22).fillColor("#1a1a1a").text(block.text, {
          width,
        });
        doc.moveDown(0.5);
        break;

      case "h2":
        ensureSpace(doc, 40);
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold").fontSize(14).fillColor("#c2410c").text(block.text, {
          width,
        });
        doc.moveDown(0.35);
        break;

      case "h3":
        ensureSpace(doc, 32);
        doc.moveDown(0.4);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#334155").text(block.text, {
          width,
        });
        doc.moveDown(0.25);
        break;

      case "p":
        ensureSpace(doc, 24);
        doc.font("Helvetica").fontSize(10).fillColor("#1e293b").text(block.text, {
          width,
          align: "left",
          lineGap: 3,
        });
        doc.moveDown(0.35);
        break;

      case "list":
        doc.font("Helvetica").fontSize(10).fillColor("#1e293b");
        for (const item of block.lines) {
          ensureSpace(doc, 18);
          doc.text(`•  ${item}`, { width, indent: 12, lineGap: 2 });
        }
        doc.moveDown(0.35);
        break;

      case "code":
        ensureSpace(doc, 14 + block.lines.length * 12);
        doc.font("Courier").fontSize(9).fillColor("#0f172a");
        for (const codeLine of block.lines) {
          doc.text(codeLine, {
            width: width - 16,
            indent: 8,
            lineGap: 1,
          });
        }
        doc.moveDown(0.4);
        break;

      case "table":
        doc.font("Helvetica").fontSize(9).fillColor("#334155");
        for (const row of block.lines) {
          ensureSpace(doc, 14);
          doc.text(row, { width, lineGap: 1 });
        }
        doc.moveDown(0.4);
        break;

      default:
        break;
    }
  }
}

function addCover(doc, version) {
  const w = doc.page.width;
  doc.rect(0, 0, w, 120).fill("#0b0d10");
  doc.fillColor("#fb923c").font("Helvetica-Bold").fontSize(11);
  doc.text("BONES VIBRATION", 50, 42, { width: w - 100, align: "center" });
  doc.fillColor("#ffffff").fontSize(26);
  doc.text("AI Music Creator", 50, 62, { width: w - 100, align: "center" });
  doc.fontSize(13).fillColor("#94a3b8");
  doc.text("Prompt Control Room", 50, 96, { width: w - 100, align: "center" });
  doc.y = 150;
  doc.fillColor("#64748b").font("Helvetica").fontSize(10);
  doc.text(`User guide  •  Version ${version}`, { align: "center" });
  doc.moveDown(1.2);
  doc.fillColor("#1e293b").fontSize(10);
  doc.text(
    "Dense Suno-oriented prompts, local track and image analyzers, EBU R128 loudness metering, and studio WAV export. Runs in the browser or as a Windows desktop app.",
    { align: "center", width: w - 120 },
  );
  doc.addPage();
}

function addFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor("#94a3b8");
    doc.text(
      `AI Music Creator  •  DJ M@D  •  Page ${i + 1} of ${range.count}`,
      doc.page.margins.left,
      doc.page.height - 32,
      { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: "center" },
    );
  }
}

async function main() {
  if (!fs.existsSync(README_PATH)) {
    console.error("README.md not found");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  const version = readVersion();
  const md = fs.readFileSync(README_PATH, "utf8");
  const blocks = parseReadme(md);

  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 54, bottom: 54, left: 54, right: 54 },
    bufferPages: true,
    info: {
      Title: `AI Music Creator v${version} — User Guide`,
      Author: "DJ M@D",
      Subject: "AI Music Creator Prompt Control Room",
    },
  });

  const stream = fs.createWriteStream(OUT_PATH);
  doc.pipe(stream);

  addCover(doc, version);
  renderBlocks(doc, blocks);

  ensureSpace(doc, 40);
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#c2410c").text("Author", { width: 500 });
  doc.font("Helvetica").fontSize(10).fillColor("#1e293b").text("DJ M@D");

  addFooter(doc);
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  const stat = fs.statSync(OUT_PATH);
  console.log(`Wrote ${path.relative(ROOT, OUT_PATH)} (${Math.round(stat.size / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
