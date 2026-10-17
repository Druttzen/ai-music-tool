let batches = 0;
let idle = Promise.resolve();
let resolveIdle;

/** Prevent automatic repairs from racing a user-started Download all batch. */
export function beginSidecarInstallBatch() {
  if (batches++ === 0) idle = new Promise((resolve) => { resolveIdle = resolve; });
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    if (--batches === 0) resolveIdle?.();
  };
}

export async function waitForSidecarInstallBatch() {
  while (batches) await idle;
}
