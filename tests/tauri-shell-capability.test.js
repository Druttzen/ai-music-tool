import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Tauri webview shell capability", () => {
  it("does not let the webview execute the sidecar with arbitrary args", () => {
    const raw = readFileSync(join(root, "src-tauri/capabilities/default.json"), "utf8");
    const cap = JSON.parse(raw);
    const perms = cap.permissions ?? [];
    const shellExecute = perms.filter(
      (p) => p === "shell:allow-execute" || p?.identifier === "shell:allow-execute",
    );
    expect(shellExecute).toEqual([]);
    const blob = JSON.stringify(cap);
    expect(blob).not.toContain('"args": true');
    expect(blob).not.toContain('"args":true');
  });
});
