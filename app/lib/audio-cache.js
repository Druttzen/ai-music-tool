/**
 * IndexedDB cache for analyzed audio files (waveform rehydrate after reload).
 */

import { uniq } from "./music-helpers";

const DB_NAME = "ai-music-creator";
const STORE = "audio-files";
const DB_VERSION = 1;

function openDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
  });
}

/**
 * @param {File|Blob} file
 */
export function makeAudioCacheKey(file) {
  const name = file?.name || "audio";
  const size = file?.size ?? 0;
  const mod = file?.lastModified ?? 0;
  return `${name}|${size}|${mod}`;
}

/**
 * Stable key for the same track identity (name + duration) across sessions.
 * @param {string} fileName
 * @param {number} durationSec
 */
export function makeAudioLookupKey(fileName, durationSec) {
  const name = String(fileName || "audio")
    .trim()
    .toLowerCase();
  const d = Math.round((Number(durationSec) || 0) * 10);
  return `lookup:${name}:${d}`;
}

/**
 * @param {object} analysis
 * @returns {string[]}
 */
export function getAudioCacheKeysForAnalysis(analysis) {
  if (!analysis) return [];
  const keys = [];
  if (analysis.audioCacheKey) keys.push(analysis.audioCacheKey);
  if (analysis.audioLookupKey) keys.push(analysis.audioLookupKey);
  if (analysis.fileName && analysis.duration) {
    keys.push(makeAudioLookupKey(analysis.fileName, analysis.duration));
  }
  return uniq(keys);
}

/**
 * @param {string} key
 * @param {File|Blob} file
 */
export async function putAudioCache(key, file) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * @param {File|Blob} file
 * @param {string} primaryKey
 * @param {number} durationSec
 */
export async function putAudioCacheEntries(file, primaryKey, durationSec) {
  const fileName = file?.name || "audio";
  const keys = uniq([
    primaryKey,
    makeAudioLookupKey(fileName, durationSec),
  ]).filter(Boolean);
  for (const key of keys) {
    await putAudioCache(key, file);
  }
  return {
    audioCacheKey: primaryKey,
    audioLookupKey: makeAudioLookupKey(fileName, durationSec),
  };
}

/**
 * @param {string} key
 * @returns {Promise<Blob|null>}
 */
export async function getAudioCacheBlob(key) {
  if (!key) return null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        db.close();
        resolve(req.result ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * @param {object} analysis
 * @returns {Promise<{ blob: Blob, matchedKey: string }|null>}
 */
export async function resolveAudioCacheBlob(analysis) {
  const keys = getAudioCacheKeysForAnalysis(analysis);
  for (const key of keys) {
    const blob = await getAudioCacheBlob(key);
    if (blob) return { blob, matchedKey: key };
  }
  return null;
}

/**
 * @param {string[]} keys
 */
export async function deleteAudioCacheEntries(keys) {
  const list = uniq((keys || []).filter(Boolean));
  await Promise.all(list.map((key) => deleteAudioCache(key)));
}

/**
 * @param {string} key
 */
export async function deleteAudioCache(key) {
  if (!key) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} analysis
 * @param {number} fileDurationSec
 * @param {number} [toleranceSec=3]
 */
export function audioFileMatchesAnalysis(file, analysis, fileDurationSec, toleranceSec = 3) {
  if (!file || !analysis) return false;
  const nameMatch =
    !analysis.fileName ||
    String(file.name || "").toLowerCase() === String(analysis.fileName).toLowerCase();
  const expected = Number(analysis.duration) || 0;
  const got = Number(fileDurationSec) || 0;
  const durationMatch =
    !expected || !got || Math.abs(expected - got) <= toleranceSec;
  return nameMatch && durationMatch;
}
