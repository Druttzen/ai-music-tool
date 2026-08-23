/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { DesktopUpdateControls } from "../app/components/desktop-update-controls.jsx";
import { useDesktopUpdates } from "../app/hooks/use-desktop-updates.js";

vi.mock("../app/lib/desktop-update-bridge.js", () => ({
  getDesktopUpdateRuntime: vi.fn(() => "tauri"),
  checkForDesktopUpdates: vi.fn(async () => ({ ok: true, available: false })),
  installDesktopUpdate: vi.fn(),
  subscribeToDesktopUpdateStatus: vi.fn(() => () => {}),
}));

describe("useDesktopUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("SSR omits desktop update controls even when a desktop runtime exists", () => {
    const html = renderToString(createElement(DesktopUpdateControls));
    expect(html).not.toContain("Desktop updates");
  });

  it("enables desktop update controls after mount when a host is present", async () => {
    const { result } = renderHook(() => useDesktopUpdates());
    await waitFor(() => {
      expect(result.current.available).toBe(true);
    });
  });
});

