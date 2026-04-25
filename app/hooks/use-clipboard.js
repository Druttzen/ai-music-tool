import { useCallback } from "react";

export function useClipboard(setStatusWithTime) {
  const copyToClipboard = useCallback(
    async (text, successLabel = "Copied to clipboard") => {
      try {
        await navigator.clipboard.writeText(text);
        setStatusWithTime(successLabel);
        return true;
      } catch {
        setStatusWithTime("Copy failed: clipboard permission blocked");
        return false;
      }
    },
    [setStatusWithTime]
  );

  return { copyToClipboard };
}
