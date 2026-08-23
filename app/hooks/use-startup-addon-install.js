"use client";

import { useEffect, useState } from "react";
import {
  dismissStartupInstall,
  STARTUP_INSTALL_INITIAL,
  subscribeAndStartStartupAddonInstall,
} from "../lib/sidecar-startup-install-runner";

export function useStartupAddonInstall() {
  const [state, setState] = useState(STARTUP_INSTALL_INITIAL);

  useEffect(() => subscribeAndStartStartupAddonInstall(setState), []);

  return {
    ...state,
    dismiss: dismissStartupInstall,
  };
}
