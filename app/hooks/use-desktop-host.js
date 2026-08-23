"use client";

import { useEffect, useState } from "react";
import { isDesktopAddonHost } from "../lib/canvas-addon-client";

/**
 * Desktop host (Tauri / Electron) after mount only.
 * Always false on the first render so SSR HTML matches Studio hydration.
 */
export function useDesktopHost() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    setDesktop(isDesktopAddonHost());
  }, []);
  return desktop;
}
