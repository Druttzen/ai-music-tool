/**
 * Stereo phase / correlation helpers for monitoring (Wide preset safety).
 */

/**
 * @typedef {{
 *   correlation: number,
 *   leftPeak: number,
 *   rightPeak: number,
 *   monoPeak: number,
 *   monoCancelDb: number,
 *   outOfPhase: boolean,
 * }} StereoPhaseStats
 */

/**
 * Pearson correlation of L/R plus mono-sum peak vs channel peaks.
 * @param {AudioBuffer} buffer
 * @returns {StereoPhaseStats}
 */
export function measureStereoPhase(buffer) {
  const frames = buffer.length;
  const left = buffer.getChannelData(0);
  const right =
    buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0);

  let sumL = 0;
  let sumR = 0;
  let sumLL = 0;
  let sumRR = 0;
  let sumLR = 0;
  let leftPeak = 0;
  let rightPeak = 0;
  let monoPeak = 0;

  for (let i = 0; i < frames; i++) {
    const l = left[i];
    const r = right[i];
    sumL += l;
    sumR += r;
    sumLL += l * l;
    sumRR += r * r;
    sumLR += l * r;
    const al = Math.abs(l);
    const ar = Math.abs(r);
    if (al > leftPeak) leftPeak = al;
    if (ar > rightPeak) rightPeak = ar;
    const mono = Math.abs((l + r) * 0.5);
    if (mono > monoPeak) monoPeak = mono;
  }

  const n = frames || 1;
  const meanL = sumL / n;
  const meanR = sumR / n;
  const cov = sumLR / n - meanL * meanR;
  const varL = sumLL / n - meanL * meanL;
  const varR = sumRR / n - meanR * meanR;
  const denom = Math.sqrt(Math.max(0, varL) * Math.max(0, varR));
  let correlation = denom > 1e-12 ? cov / denom : 1;
  if (!Number.isFinite(correlation)) correlation = 0;
  correlation = Math.max(-1, Math.min(1, correlation));

  const channelPeak = Math.max(leftPeak, rightPeak, 1e-12);
  const monoCancelDb = 20 * Math.log10(Math.max(monoPeak, 1e-12) / channelPeak);
  const outOfPhase = correlation < -0.25 || monoCancelDb < -6;

  return {
    correlation,
    leftPeak,
    rightPeak,
    monoPeak,
    monoCancelDb,
    outOfPhase,
  };
}

/**
 * @param {number} correlation
 */
export function formatCorrelation(correlation) {
  if (!Number.isFinite(correlation)) return "—";
  const sign = correlation > 0 ? "+" : "";
  return `${sign}${correlation.toFixed(2)}`;
}

/**
 * Build a short stereo AudioBuffer fixture (Node-friendly stub or real AudioBuffer).
 * @param {"inPhase"|"outOfPhase"} kind
 * @param {number} [frames]
 * @param {number} [sampleRate]
 */
export function makePhaseFixtureBuffer(kind, frames = 2048, sampleRate = 48000) {
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const s = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    left[i] = s;
    right[i] = kind === "outOfPhase" ? -s : s;
  }
  if (typeof OfflineAudioContext !== "undefined") {
    const ctx = new OfflineAudioContext(2, frames, sampleRate);
    const buf = ctx.createBuffer(2, frames, sampleRate);
    buf.copyToChannel(left, 0);
    buf.copyToChannel(right, 1);
    return buf;
  }
  return {
    numberOfChannels: 2,
    length: frames,
    sampleRate,
    getChannelData: (ch) => (ch === 0 ? left : right),
  };
}
