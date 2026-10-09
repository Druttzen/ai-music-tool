import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("allows local audio blob reads in installed and dev Studio", () => {
  const config = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  for (const policy of [config.app.security.csp, config.app.security.devCsp]) {
    const connect = policy.split(";").map((part) => part.trim()).find((part) => part.startsWith("connect-src "));
    expect(connect.split(/\s+/)).toContain("blob:");
    expect(connect.split(/\s+/)).not.toContain("*");
  }
});
