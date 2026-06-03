/**
 * EBU R128 / ITU-R BS.1770-4 loudness + true peak (browser).
 * K-weighting and true-peak oversampling ported from libebur128 (ISC, jiixyj/libebur128).
 */

export const STREAMING_TARGET_LUFS = -14;
const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = 10;
const BLOCK_SEC = 0.4;
const BLOCK_OVERLAP = 0.75;
const LOUDNESS_OFFSET = 0.691;

/**
 * @typedef {{ integratedLUFS: number, truePeakDbTP: number, blockCount: number, samplePeakDbFS: number }} LoudnessStats
 */

/**
 * @param {AudioBuffer} buffer
 * @returns {Promise<LoudnessStats>}
 */
export async function measureIntegratedLoudness(buffer) {
  return measureIntegratedLoudnessSync(buffer);
}

/**
 * @param {AudioBuffer} buffer
 * @returns {LoudnessStats}
 */
export function measureIntegratedLoudnessSync(buffer) {
  const sampleRate = buffer.sampleRate;
  const iir = buildKWeightCoefficients(sampleRate);
  const stereo = getStereoChannels(buffer);
  const weighted = stereo.map((ch) => {
    const data = new Float32Array(ch);
    applyKWeightFilterInPlace(data, iir.b, iir.a);
    return data;
  });

  const blockLoudness = computeBlockLoudness(weighted, sampleRate);
  const integratedLUFS = gatedIntegratedLoudness(blockLoudness);
  const truePeakDbTP = measureTruePeakDbTP(buffer);
  const samplePeakDbFS = measureSamplePeakDbFS(buffer);

  return {
    integratedLUFS,
    truePeakDbTP,
    samplePeakDbFS,
    blockCount: blockLoudness.length,
  };
}

/**
 * @param {AudioBuffer} buffer
 * @param {number} [targetLUFS]
 */
export async function applyTargetIntegratedLufs(buffer, targetLUFS = STREAMING_TARGET_LUFS) {
  const before = measureIntegratedLoudnessSync(buffer);
  let out = cloneAudioBuffer(buffer);

  for (let pass = 0; pass < 5; pass++) {
    const current = measureIntegratedLoudnessSync(out);
    const gainDb = targetLUFS - current.integratedLUFS;
    if (Math.abs(gainDb) < 0.05) break;
    applyGainInPlace(out, Math.pow(10, gainDb / 20));

    let tp = measureTruePeakDbTP(out);
    if (tp > -1) {
      applyGainInPlace(out, Math.pow(10, (-1 - tp) / 20));
    }
  }

  const after = measureIntegratedLoudnessSync(out);
  return { buffer: out, before, after };
}

/**
 * @param {number} lufs
 */
export function formatLufs(lufs) {
  if (!Number.isFinite(lufs)) return "—";
  return `${lufs.toFixed(1)} LUFS`;
}

/**
 * @param {number} dbTp
 */
export function formatTruePeak(dbTp) {
  if (!Number.isFinite(dbTp)) return "—";
  return `${dbTp.toFixed(1)} dBTP`;
}

/** libebur128 K-weight IIR design (any sample rate ≥ 16 kHz). */
function buildKWeightCoefficients(sampleRate) {
  let f0 = 1681.974450955533;
  let G = 3.999843853973347;
  let Q = 0.7071752369554196;

  let K = Math.tan((Math.PI * f0) / sampleRate);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);

  const pb = [0, 0, 0];
  const pa = [1, 0, 0];
  const rb = [1, -2, 1];
  const ra = [1, 0, 0];

  let a0 = 1 + K / Q + K * K;
  pb[0] = (Vh + (Vb * K) / Q + K * K) / a0;
  pb[1] = (2 * (K * K - Vh)) / a0;
  pb[2] = (Vh - (Vb * K) / Q + K * K) / a0;
  pa[1] = (2 * (K * K - 1)) / a0;
  pa[2] = (1 - K / Q + K * K) / a0;

  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / sampleRate);
  ra[1] = (2 * (K * K - 1)) / (1 + K / Q + K * K);
  ra[2] = (1 - K / Q + K * K) / (1 + K / Q + K * K);

  const b = new Array(5);
  const a = new Array(5);
  b[0] = pb[0] * rb[0];
  b[1] = pb[0] * rb[1] + pb[1] * rb[0];
  b[2] = pb[0] * rb[2] + pb[1] * rb[1] + pb[2] * rb[0];
  b[3] = pb[1] * rb[2] + pb[2] * rb[1];
  b[4] = pb[2] * rb[2];

  a[0] = pa[0] * ra[0];
  a[1] = pa[0] * ra[1] + pa[1] * ra[0];
  a[2] = pa[0] * ra[2] + pa[1] * ra[1] + pa[2] * ra[0];
  a[3] = pa[1] * ra[2] + pa[2] * ra[1];
  a[4] = pa[2] * ra[2];

  return { b, a };
}

/**
 * @param {Float32Array} data
 * @param {number[]} b
 * @param {number[]} a
 */
function applyKWeightFilterInPlace(data, b, a) {
  const v = [0, 0, 0, 0, 0];
  for (let i = 0; i < data.length; i++) {
    v[0] = data[i] - a[1] * v[1] - a[2] * v[2] - a[3] * v[3] - a[4] * v[4];
    data[i] = b[0] * v[0] + b[1] * v[1] + b[2] * v[2] + b[3] * v[3] + b[4] * v[4];
    v[4] = v[3];
    v[3] = v[2];
    v[2] = v[1];
    v[1] = v[0];
  }
}

/**
 * @param {AudioBuffer} buffer
 */
function getStereoChannels(buffer) {
  if (buffer.numberOfChannels >= 2) {
    return [buffer.getChannelData(0), buffer.getChannelData(1)];
  }
  const mono = buffer.getChannelData(0);
  return [mono, mono];
}

/**
 * @param {Float32Array[]} channels
 * @param {number} sampleRate
 */
function computeBlockLoudness(channels, sampleRate) {
  const blockSamples = Math.max(1, Math.floor(BLOCK_SEC * sampleRate));
  const hopSamples = Math.max(1, Math.floor(blockSamples * (1 - BLOCK_OVERLAP)));
  const len = channels[0]?.length || 0;
  const blocks = [];

  for (let start = 0; start + blockSamples <= len; start += hopSamples) {
    let sum = 0;
    for (let ch = 0; ch < 2; ch++) {
      const data = channels[ch];
      let ms = 0;
      for (let i = start; i < start + blockSamples; i++) ms += data[i] * data[i];
      ms /= blockSamples;
      sum += ms;
    }
    if (sum <= 0) continue;
    blocks.push(10 * Math.log10(sum) - LOUDNESS_OFFSET);
  }

  return blocks;
}

/**
 * @param {number[]} blockLoudness
 */
function gatedIntegratedLoudness(blockLoudness) {
  if (!blockLoudness.length) return -Infinity;

  const absGated = blockLoudness.filter((z) => z > ABSOLUTE_GATE_LUFS);
  if (!absGated.length) return -Infinity;

  const ungatedEnergy =
    absGated.reduce((acc, z) => acc + Math.pow(10, z / 10), 0) / absGated.length;
  const ungatedMean = 10 * Math.log10(ungatedEnergy);
  const relThreshold = Math.max(ABSOLUTE_GATE_LUFS, ungatedMean - RELATIVE_GATE_LU);

  const relGated = absGated.filter((z) => z >= relThreshold);
  if (!relGated.length) return ungatedMean;

  const energy =
    relGated.reduce((acc, z) => acc + Math.pow(10, z / 10), 0) / relGated.length;
  return 10 * Math.log10(energy);
}

/**
 * @param {AudioBuffer} buffer
 */
function measureTruePeakDbTP(buffer) {
  const factor = buffer.sampleRate >= 96000 ? 2 : 4;
  const taps = factor * 12 + 1;
  const channels = buffer.numberOfChannels;
  const detector = createTruePeakDetector(channels, taps, factor);
  const len = buffer.length;

  for (let i = 0; i < len; i++) {
    const frame = [];
    for (let c = 0; c < channels; c++) {
      frame.push(buffer.getChannelData(c)[i]);
    }
    detector.processFrame(frame);
  }

  return detector.getTruePeakDbTP();
}

/**
 * @param {AudioBuffer} buffer
 */
function measureSamplePeakDbFS(buffer) {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  return 20 * Math.log10(Math.max(peak, 1e-12));
}

/**
 * libebur128-style polyphase sinc/Hann true-peak oversampler.
 * @param {number} channels
 * @param {number} taps
 * @param {number} factor
 */
function createTruePeakDetector(channels, taps, factor) {
  const delay = Math.floor((taps + factor - 1) / factor);
  const filter = [];

  for (let f = 0; f < factor; f++) {
    filter[f] = { count: 0, index: [], coeff: [] };
  }

  for (let j = 0; j < taps; j++) {
    const m = j - (taps - 1) / 2;
    let c = 1;
    if (Math.abs(m) > 1e-12) {
      c = Math.sin((m * Math.PI) / factor) / ((m * Math.PI) / factor);
    }
    c *= 0.5 * (1 - Math.cos((2 * Math.PI * j) / (taps - 1)));
    if (Math.abs(c) <= 1e-12) continue;
    const f = j % factor;
    const t = filter[f].count++;
    filter[f].coeff[t] = c;
    filter[f].index[t] = Math.floor(j / factor);
  }

  const z = Array.from({ length: channels }, () => new Float32Array(delay));
  let zi = 0;
  const prevPeak = new Float64Array(channels);

  return {
    processFrame(frame) {
      for (let chan = 0; chan < channels; chan++) {
        prevPeak[chan] = Math.max(prevPeak[chan], Math.abs(frame[chan]));
        z[chan][zi] = frame[chan];
        for (let f = 0; f < factor; f++) {
          let acc = 0;
          const sub = filter[f];
          for (let t = 0; t < sub.count; t++) {
            let i = zi - sub.index[t];
            if (i < 0) i += delay;
            acc += z[chan][i] * sub.coeff[t];
          }
          prevPeak[chan] = Math.max(prevPeak[chan], Math.abs(acc));
        }
      }

      zi++;
      if (zi === delay) zi = 0;
    },
    getTruePeakDbTP() {
      let peak = 0;
      for (let c = 0; c < channels; c++) peak = Math.max(peak, prevPeak[c]);
      return 20 * Math.log10(Math.max(peak, 1e-12));
    },
  };
}

/**
 * @param {AudioBuffer} buffer
 */
function cloneAudioBuffer(buffer) {
  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    out.copyToChannel(buffer.getChannelData(ch), ch);
  }
  return out;
}

/**
 * @param {AudioBuffer} buffer
 * @param {number} gain
 */
function applyGainInPlace(buffer, gain) {
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
}
