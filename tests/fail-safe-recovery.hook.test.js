/** @vitest-environment happy-dom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { FailSafeErrorBoundary } from "../app/components/fail-safe-error-boundary";
import { useFailSafeBot } from "../app/hooks/use-fail-safe-bot";
import { clearLocalFaults, getActiveLocalFaults, getHistoricalLocalFaults } from "../app/lib/fail-safe-runtime-fault";
import { remediateRuntimeIssues } from "../app/lib/fail-safe-local-remediate";
import { resetLaunchScanGateForTests } from "../app/lib/fail-safe-hibernate";
import { FAIL_SAFE_STORAGE_KEY } from "../app/lib/fail-safe-bot";

vi.mock("../app/lib/sidecar-bridge", () => ({ fetchSidecarHealth: async () => ({ librosa_available: true }) }));
beforeEach(() => { localStorage.clear(); clearLocalFaults(); resetLaunchScanGateForTests(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("does not display a cached M4A fault as a current launch failure", async () => {
  localStorage.setItem(FAIL_SAFE_STORAGE_KEY, JSON.stringify({ at: Date.now(), issues: [{ id: "studio_error", severity: "warn", title: "Error opening tmp.m4a" }] }));
  const { result } = renderHook(() => useFailSafeBot({ sidecarAiStatus: "standby" }));
  expect(result.current.report).toBeNull();
  await waitFor(() => expect(result.current.report).not.toBeNull());
  expect(result.current.report.issues.some((issue) => issue.id === "studio_error")).toBe(false);
});

it("refreshes the report when the sidecar recovers", async () => {
  const { result, rerender } = renderHook(({ status }) => useFailSafeBot({ sidecarAiStatus: status }), { initialProps: { status: "offline" } });
  await waitFor(() => expect(result.current.report?.meta.sidecarAiStatus).toBe("offline"));
  rerender({ status: "ready" });
  await waitFor(() => expect(result.current.report?.meta.sidecarAiStatus).toBe("ready"));
  expect(result.current.report.issues.some((issue) => issue.id === "sidecar_offline")).toBe(false);
});

it.each([false, true])("checks whether a retried boundary really recovers (still broken: %s)", async (stillBroken) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let broken = true;
  function Panel() { if (broken) throw new Error("Panel crashed"); return createElement("p", null, "Recovered panel"); }
  render(createElement(FailSafeErrorBoundary, { name: "test" }, createElement(Panel)));
  expect(getActiveLocalFaults()).toHaveLength(1);
  broken = stillBroken;
  let result, pending;
  act(() => { pending = remediateRuntimeIssues([{ id: "react_render" }]); });
  await act(async () => { result = await pending; });
  expect(result.ok).toBe(!stillBroken);
  expect(getActiveLocalFaults()).toHaveLength(stillBroken ? 1 : 0);
  expect(getHistoricalLocalFaults()).toHaveLength(stillBroken ? 0 : 1);
});
