import { useCallback } from "react";

async function writeClipboard(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to execCommand */
    }
  }
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export function useClipboard(setStatusWithTime) {
  const copyToClipboard = useCallback(
    async (text, successLabel = "Copied to clipboard") => {
      const ok = await writeClipboard(text);
      if (ok) {
        setStatusWithTime(successLabel);
        return true;
      }
      setStatusWithTime("Copy failed: clipboard permission blocked", "error");
      return false;
    },
    [setStatusWithTime],
  );

  return { copyToClipboard };
}
