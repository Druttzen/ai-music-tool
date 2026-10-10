/** Advance the shared operation token only from events, effects or callbacks. */
export function advanceAnalyzerEpoch(ref) {
  ref.current += 1;
  return ref.current;
}

export function audioSourceKey(report) {
  if (!report) return "";
  return report.audioCacheKey || report.audioLookupKey ||
    `${report.fileName || ""}:${report.fileSize || ""}:${report.duration || ""}`;
}
