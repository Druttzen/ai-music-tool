"use client";

import { useDesktopUpdates } from "../hooks/use-desktop-updates";
import { ProcessStatusBar } from "./process-status-bar";

export function DesktopUpdateStatusBar() {
  const update = useDesktopUpdates();
  return <ProcessStatusBar update={update} />;
}
