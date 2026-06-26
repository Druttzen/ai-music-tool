/**
 * Browser-side studio chains → 16-bit stereo WAV export.
 * Streaming preset uses EBU R128 integrated loudness targeting −14 LUFS.
 */

import {
  applyTargetIntegratedLufs,
  STREAMING_TARGET_LUFS,
} from "./lufs-meter";

/** @typedef {{ id: string, label: string, fileSuffix: string, hint: string }} StudioExportPreset */

/** @type {StudioExportPreset[]} */
export const STUDIO_EXPORT_PRESETS = [
  {
    id: "streaming",
    label: "Streaming",
    fileSuffix: "streaming",
    hint: `R128 polish → ${STREAMING_TARGET_LUFS} LUFS`,
  },
  {
    id: "wide",
    label: "Wide spatial",
    fileSuffix: "wide",
    hint: "Wider stereo, air and depth",
  },
  {
    id: "punch",
    label: "Punch",
    fileSuffix: "punch",
    hint: "Tighter dynamics, stronger low end",
  },
];

const MAX_EXPORT_DURATION_SEC = 600;

/**
 * @param {AudioBuffer} buffer
 * @param {string} presetId
 * @returns {Promise<AudioBuffer>}
 */
export async function renderEnhancedAudioBuffer(buffer, presetId) {
  const preset = STUDIO_EXPORT_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error("Unknown preset");

  if (buffer.duration > MAX_EXPORT_DURATION_SEC) {
    throw new Error(
      `Track is longer than ${MAX_EXPORT_DURATION_SEC / 60} minutes — shorten before export`,
    );
  }

  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const offline = new OfflineAudioContext(2, length, sampleRate);

  const stereo = bufferToStereo(offline, buffer);
  const source = offline.createBufferSource();
  source.buffer = stereo;

  const { input, output } = buildEnhancementChain(offline, preset);
  source.connect(input);
  output.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();

  if (preset.id === "streaming") {
    const { buffer } = await applyTargetIntegratedLufs(rendered, STREAMING_TARGET_LUFS);
    return buffer;
  }

  normalizeBufferPeak(rendered, 0.944);
  return rendered;
}

/**
 * @param {AudioBuffer} buffer
 * @returns {Blob}
 */
export function audioBufferToWavBlob(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const samples = buffer.length;
  const dataBytes = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const v = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, v, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * @param {AudioBuffer} buffer
 * @returns {Blob}
 */
export function audioBufferToWav24Blob(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 24;
  const bytesPerSample = 3;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const samples = buffer.length;
  const dataBytes = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      let v = s < 0 ? Math.round(s * 0x800000) : Math.round(s * 0x7fffff);
      if (v < 0) v = (1 << 24) + v;
      view.setUint8(offset, v & 0xff);
      view.setUint8(offset + 1, (v >> 8) & 0xff);
      view.setUint8(offset + 2, (v >> 16) & 0xff);
      offset += 3;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * @param {Blob} wavBlob
 * @param {string} fileName
 */
export function downloadAudioBlob(wavBlob, fileName) {
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {BaseAudioContext} ctx
 * @param {AudioBuffer} buffer
 */
function bufferToStereo(ctx, buffer) {
  if (buffer.numberOfChannels >= 2) return buffer;
  const stereo = ctx.createBuffer(2, buffer.length, buffer.sampleRate);
  const mono = buffer.getChannelData(0);
  stereo.copyToChannel(mono, 0);
  stereo.copyToChannel(mono, 1);
  return stereo;
}

/**
 * @param {BaseAudioContext} ctx
 * @param {StudioExportPreset} preset
 */
function buildEnhancementChain(ctx, preset) {
  const input = ctx.createGain();
  let tail = input;

  const hpf = ctx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 32;
  hpf.Q.value = 0.71;
  tail.connect(hpf);
  tail = hpf;

  if (preset.id === "punch") {
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 110;
    low.gain.value = 3;
    tail.connect(low);
    tail = low;
  }

  if (preset.id === "streaming" || preset.id === "wide") {
    const air = ctx.createBiquadFilter();
    air.type = "highshelf";
    air.frequency.value = preset.id === "wide" ? 6500 : 9000;
    air.gain.value = preset.id === "wide" ? 2.2 : 1.4;
    tail.connect(air);
    tail = air;
  }

  if (preset.id === "wide") {
    const widen = createHaasWidenNode(ctx, 0.7);
    tail.connect(widen.input);
    tail = widen.output;
  }

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = preset.id === "punch" ? -24 : -20;
  comp.knee.value = 8;
  comp.ratio.value = preset.id === "punch" ? 4.5 : 2.8;
  comp.attack.value = preset.id === "punch" ? 0.003 : 0.006;
  comp.release.value = preset.id === "wide" ? 0.22 : 0.14;
  tail.connect(comp);
  tail = comp;

  const makeup = ctx.createGain();
  makeup.gain.value = preset.id === "punch" ? 1.22 : preset.id === "wide" ? 1.12 : 1.08;
  tail.connect(makeup);
  tail = makeup;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2.5;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.04;
  tail.connect(limiter);

  return { input, output: limiter };
}

/**
 * @param {BaseAudioContext} ctx
 * @param {number} amount 0–1
 */
function createHaasWidenNode(ctx, amount) {
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  const dryL = ctx.createGain();
  const dryR = ctx.createGain();
  dryL.gain.value = 1 - amount * 0.2;
  dryR.gain.value = 1 - amount * 0.2;

  const delayL = ctx.createDelay(0.05);
  const delayR = ctx.createDelay(0.05);
  delayL.delayTime.value = 0.006 + amount * 0.01;
  delayR.delayTime.value = 0.01 + amount * 0.012;

  const crossL = ctx.createGain();
  const crossR = ctx.createGain();
  crossL.gain.value = amount * 0.38;
  crossR.gain.value = amount * 0.38;

  splitter.connect(dryL, 0);
  splitter.connect(dryR, 1);
  splitter.connect(delayL, 0);
  splitter.connect(delayR, 1);

  delayL.connect(crossR);
  delayR.connect(crossL);

  dryL.connect(merger, 0, 0);
  dryR.connect(merger, 0, 1);
  crossL.connect(merger, 0, 0);
  crossR.connect(merger, 0, 1);

  return { input: splitter, output: merger };
}

/**
 * @param {AudioBuffer} buffer
 * @param {number} targetPeak
 */
function normalizeBufferPeak(buffer, targetPeak) {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  if (peak < 1e-8) return;
  const gain = targetPeak / peak;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
}
