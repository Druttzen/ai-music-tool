const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function walkPythonSources(directory, root, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkPythonSources(fullPath, root, files);
    } else if (entry.isFile() && entry.name.endsWith(".py")) {
      files.push(path.relative(root, fullPath));
    }
  }
  return files;
}

function getSidecarBuildStamp(root) {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const sourceRoot = path.join(root, "ai-sidecar", "ai_sidecar");
  const files = [
    ...walkPythonSources(sourceRoot, root),
    "ai-sidecar/pyproject.toml",
    "ai-sidecar/run_sidecar.py",
    "scripts/build-sidecar-bundle.ps1",
  ].sort();

  const hash = crypto.createHash("sha256");
  for (const relativePath of files) {
    hash.update(relativePath.replaceAll(path.sep, "/"));
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(root, relativePath)));
    hash.update("\0");
  }

  return `${packageJson.version}:${hash.digest("hex")}`;
}

module.exports = { getSidecarBuildStamp };

if (require.main === module) {
  process.stdout.write(`${getSidecarBuildStamp(path.join(__dirname, ".."))}\n`);
}
