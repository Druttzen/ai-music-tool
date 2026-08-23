/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { useDesktopHost } from "../app/hooks/use-desktop-host.js";

vi.mock("../app/lib/canvas-addon-client.js", () => ({
  isDesktopAddonHost: vi.fn(() => true),
}));

function Probe() {
  const desktop = useDesktopHost();
  return createElement("span", { "data-desktop": String(desktop) });
}

describe("useDesktopHost", () => {
  it("SSR HTML is not desktop even when the host will be Tauri", () => {
    const html = renderToString(createElement(Probe));
    expect(html).toContain('data-desktop="false"');
  });

  it("becomes desktop after mount", async () => {
    const { result } = renderHook(() => useDesktopHost());
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
