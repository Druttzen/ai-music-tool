import { useCallback, useState } from "react";

export function useStatusMessage(initialValue = "Not saved yet") {
  const [statusMessage, setStatusMessage] = useState(initialValue);

  const setStatusWithTime = useCallback((message) => {
    setStatusMessage(`${message} at ${new Date().toLocaleTimeString()}`);
  }, []);

  return { statusMessage, setStatusMessage, setStatusWithTime };
}
