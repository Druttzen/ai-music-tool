const stages = ["preparing", "decoding", "resampling", "mastering", "normalizing", "metering", "encoding", "saving"];

/** Stage counts describe completed work, not a prediction of time remaining. */
export function masteringProgress(progress) {
  const index = stages.indexOf(progress.phase);
  return { ...progress, unit: "audio frames", completed: progress.completed ?? null, total: progress.total ?? null,
    completedSteps: progress.phase === "done" ? stages.length : Math.max(0, index), totalSteps: stages.length };
}
