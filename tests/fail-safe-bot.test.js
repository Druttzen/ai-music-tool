import { describe, expect, it } from "vitest";
import {
  buildRuntimeHealthReport,
  classifyFailureText,
  formatAgentFixPrompt,
  formatScanAge,
  getActionableIssues,
  overallSeverity,
} from "../app/lib/fail-safe-bot.js";

describe("fail-safe-bot", () => {
  it("classifies rust lock drift", () => {
    const issues = classifyFailureText(
      "verify-rust-locks — Cargo.lock is out of sync in src-tauri",
    );
    expect(issues.some((i) => i.id === "rust_lock_drift")).toBe(true);
    expect(issues[0].fixCommands.some((c) => c.includes("cargo build"))).toBe(true);
  });

  it("classifies eslint and vitest together", () => {
    const issues = classifyFailureText("eslint max-warnings 0\nAssertionError in vitest");
    expect(issues.map((i) => i.id)).toEqual(expect.arrayContaining(["eslint", "vitest"]));
  });

  it("classifies ci-gates label", () => {
    const issues = classifyFailureText("ci-gates — FAILED at: check:full");
    expect(issues.some((i) => i.id === "ci_gate")).toBe(true);
  });

  it("returns empty for clean output", () => {
    expect(classifyFailureText("ci-gates — OK")).toEqual([]);
  });

  it("buildRuntimeHealthReport warns when sidecar offline", () => {
    const report = buildRuntimeHealthReport({ sidecarAiStatus: "offline" });
    expect(report.overall).toBe("warn");
    expect(report.issues.some((i) => i.id === "sidecar_offline")).toBe(true);
  });

  it("buildRuntimeHealthReport ok when ready", () => {
    const report = buildRuntimeHealthReport({
      sidecarAiStatus: "ready",
      sidecarGenerateAvailable: true,
      sidecarHealth: { librosa_available: true },
    });
    expect(report.overall).toBe("ok");
  });

  it("overallSeverity prefers fail over warn", () => {
    expect(
      overallSeverity([
        { id: "a", severity: "warn", title: "", detail: "", fixCommands: [] },
        { id: "b", severity: "fail", title: "", detail: "", fixCommands: [] },
      ]),
    ).toBe("fail");
  });

  it("formatAgentFixPrompt includes classified fixes", () => {
    const prompt = formatAgentFixPrompt("ci-gates — FAILED at: check:full\npytest failed", {
      branch: "cursor/test",
    });
    expect(prompt).toContain("FAIL-SAFE BOT");
    expect(prompt).toContain("cursor/test");
    expect(prompt).toMatch(/pytest|CI gate/i);
  });

  it("getActionableIssues filters warn and fail only", () => {
    const issues = getActionableIssues([
      { id: "a", severity: "ok", title: "info", detail: "", fixCommands: [] },
      { id: "b", severity: "warn", title: "warn", detail: "", fixCommands: [] },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe("b");
  });

  it("formatScanAge formats relative time", () => {
    const now = 1_000_000;
    expect(formatScanAge(now - 30_000, now)).toBe("30s ago");
    expect(formatScanAge(now - 120_000, now)).toBe("2m ago");
  });
});
