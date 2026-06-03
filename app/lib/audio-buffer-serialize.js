/**
 * Transfer AudioBuffer to/from worker-safe plain objects.
 */

/**
 * @param {AudioBuffer} buffer
 */
export function serializeAudioBuffer(buffer) {
  const channelData = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channelData.push(new Float32Array(buffer.getChannelData(c)));
  }
  return {
    sampleRate: buffer.sampleRate,
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
    channelData,
  };
}

/**
 * @param {AudioContext|OfflineAudioContext} ctx
 * @param {{ sampleRate: number, length: number, numberOfChannels: number, channelData: Float32Array[] }} payload
 */
export function deserializeAudioBuffer(ctx, payload) {
  const buffer = ctx.createBuffer(
    payload.numberOfChannels,
    payload.length,
    payload.sampleRate,
  );
  for (let c = 0; c < payload.numberOfChannels; c++) {
    buffer.copyToChannel(payload.channelData[c], c);
  }
  return buffer;
}

/**
 * @param {AudioBuffer} source
 * @param {number} startSec
 * @param {number} endSec
 */
export function sliceAudioBuffer(source, startSec, endSec) {
  const start = Math.max(0, Math.floor(startSec * source.sampleRate));
  const end = Math.min(source.length, Math.ceil(endSec * source.sampleRate));
  const len = Math.max(1, end - start);
  const ctx = new OfflineAudioContext(
    source.numberOfChannels,
    len,
    source.sampleRate,
  );
  const out = ctx.createBuffer(source.numberOfChannels, len, source.sampleRate);
  for (let c = 0; c < source.numberOfChannels; c++) {
    const src = source.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(start, start + len));
  }
  return out;
}
