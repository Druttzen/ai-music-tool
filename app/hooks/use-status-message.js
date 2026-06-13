import { useCallback, useEffect, useRef, useState } from "react";

export const ACTION_TOAST_MS = 2800;

/** @typedef {'success' | 'info' | 'warning' | 'error'} ActionToastType */

/**
 * @typedef {{ message: string, type: ActionToastType, tick: number }} ActionToastState
 */

export function useStatusMessage(initialValue = "Not saved yet") {
  const [statusMessage, setStatusMessage] = useState(initialValue);
  /** @type {[ActionToastState | null, Function]} */
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const clearToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  /**
   * @param {string} message
   * @param {ActionToastType} [type]
   */
  const setStatusWithTime = useCallback((message, type = "success") => {
    setStatusMessage(`${message} at ${new Date().toLocaleTimeString()}`);
    if (timerRef.current) clearTimeout(timerRef.current);
    const tick = Date.now();
    setToast({ message, type, tick });
    timerRef.current = setTimeout(() => {
      setToast((current) => (current?.tick === tick ? null : current));
      timerRef.current = null;
    }, ACTION_TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { statusMessage, setStatusMessage, setStatusWithTime, toast, clearToast };
}
