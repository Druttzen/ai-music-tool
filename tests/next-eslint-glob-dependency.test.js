import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const pluginRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js");
const { Linter } = require("eslint");
const plugin = require("@next/eslint-plugin-next");
const fixture = mkdtempSync(path.join(tmpdir(), "studio-next-glob-"));
const projects = path.join(fixture, "projects");
const studio = path.join(projects, "studio");
const legacy = path.join(projects, "legacy");
const slash = (value) => value.replace(/\\/g, "/").replace(/\/$/, "");
mkdirSync(path.join(studio, "app", "library"), { recursive: true });
mkdirSync(path.join(legacy, "pages"), { recursive: true });
writeFileSync(path.join(studio, "app", "library", "page.js"), "export default function Page() {}");
writeFileSync(path.join(studio, "app", "page.js"), "export default function Page() {}");
writeFileSync(path.join(legacy, "pages", "library.js"), "export default function Page() {}");
writeFileSync(path.join(projects, "not-a-directory.txt"), "fixture");

afterAll(() => {
  // Delete only the unique directory created by this test.
  if (path.dirname(fixture) !== path.resolve(tmpdir()) || !path.basename(fixture).startsWith("studio-next-glob-")) {
    throw new Error("Unexpected temporary directory");
  }
  rmSync(fixture, { recursive: true, force: true });
});

describe("Next ESLint's scoped glob dependency replacement", () => {
  it("loads the internal adapter and removes the vulnerable chain from the lockfile", () => {
    const installed = pluginRequire("fast-glob/package.json");
    expect(installed.name).toBe("@ai-music-tool/next-eslint-glob");
    expect(installed.dependencies.tinyglobby).toBe("0.2.17");
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    for (const [location, dependency] of Object.entries(lock.packages)) {
      expect(location).not.toMatch(/node_modules\/(braces|micromatch)$/);
      if (location.endsWith("node_modules/fast-glob")) {
        expect(dependency.link).toBe(true);
        expect(dependency.resolved).toBe("tools/next-eslint-glob");
      }
    }
  });

  it("preserves the default working directory", () => {
    expect(getRootDirs({ cwd: fixture, settings: {} })).toEqual([fixture]);
  });

  it("keeps the replacement limited to the verified Next API", () => {
    const dist = path.dirname(require.resolve("@next/eslint-plugin-next"));
    const consumers = readdirSync(dist, { recursive: true })
      .filter((file) => file.endsWith(".js") && readFileSync(path.join(dist, file), "utf8").includes('require("fast-glob")'));
    expect(consumers.map(slash)).toEqual(["utils/get-root-dirs.js"]);
    const source = readFileSync(path.join(dist, consumers[0]), "utf8");
    expect(source).toMatch(/_fastglob\.globSync/);
    expect(source).toMatch(/onlyDirectories: true/);
  });

  it.each([".", "app"])('preserves relative root "%s"', (rootDir) => {
    expect(getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir } } }).map(slash)).toEqual([rootDir]);
  });

  it("rejects excessive length and mismatched deep nesting before traversal", () => {
    const { globSync } = pluginRequire("fast-glob");
    expect(() => globSync("a".repeat(65537), { onlyDirectories: true })).toThrow("too long");
    expect(() => globSync("{)".repeat(129), { onlyDirectories: true })).toThrow("nested too deeply");
    expect(() => globSync(".", { onlyDirectories: true, unknownOption: true })).toThrow(TypeError);
  });

  it.each([
    ["literal path", studio, [studio]],
    ["trailing separator", `${slash(studio)}/`, [studio]],
    ["wildcard", `${slash(projects)}/*`, [studio, legacy]],
    ["brace alternatives", `${slash(projects)}/{studio,legacy}`, [studio, legacy]],
    ["extglob alternatives", `${slash(projects)}/@(studio|legacy)`, [studio, legacy]],
    ["Windows separators", `${slash(projects)}/*`.replace(/\//g, "\\"), [studio, legacy]],
    ["array of roots", [studio, legacy], [studio, legacy]],
    ["missing root", path.join(projects, "missing"), []],
    ["file excluded by onlyDirectories", path.join(projects, "not-a-directory.txt"), []],
  ])("resolves %s through the real Next plugin", (_label, rootDir, expected) => {
    const actual = getRootDirs({ cwd: fixture, settings: { next: { rootDir } } });
    expect(actual.map(slash).sort()).toEqual(expected.map(slash).sort());
  });

  it.each([[studio, "/"], [legacy, "/library/"]])("still reports internal HTML links for root %s", (rootDir, href) => {
    const linter = new Linter();
    const config = {
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "@next/next": plugin },
      settings: { next: { rootDir } },
      rules: { "@next/next/no-html-link-for-pages": "error" },
    };
    const internal = linter.verify(`const link = <a href="${href}">Library</a>;`, config);
    expect(internal).toHaveLength(1);
    expect(internal[0].ruleId).toBe("@next/next/no-html-link-for-pages");
    expect(linter.verify('const link = <a href="https://example.com/">External</a>;', config)).toEqual([]);
  });

  it("handles deeply nested braces without the vulnerable AST walker", () => {
    // Run the malicious pattern in a separate process with a deadline.
    const program = `
      const { createRequire } = require('node:module');
      const nextRequire = createRequire(require.resolve('@next/eslint-plugin-next'));
      const { getRootDirs } = nextRequire('./utils/get-root-dirs.js');
      const rootDir = process.argv[1].replace(/\\\\/g, '/') + '/' +
        '{'.repeat(12000) + 'studio,legacy' + '}'.repeat(12000);
      try {
        getRootDirs({ cwd: process.argv[1], settings: { next: { rootDir } } });
        process.exit(2);
      } catch (error) {
        if (!(error instanceof SyntaxError) || !error.message.includes('nested too deeply')) throw error;
        console.log('rejected');
      }
    `;
    const result = spawnSync(process.execPath, ["-e", program, projects], {
      encoding: "utf8", shell: false, timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("rejected");
  });
});
