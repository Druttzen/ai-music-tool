"""Rich audio sonic signature — BPM, key, chords, timeline segments."""

from __future__ import annotations

from typing import Any

_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Major triad templates on pitch-class circle (root indices)
_MAJOR = {0, 4, 7}
_MINOR = {0, 3, 7}


def _chord_label(root_idx: int, minor: bool) -> str:
    name = _KEYS[root_idx % 12]
    return f"{name}m" if minor else name


def _estimate_chord_from_chroma(chroma_vec: Any) -> tuple[str, float]:
    import numpy as np  # noqa: PLC0415

    vec = np.asarray(chroma_vec, dtype=float)
    if vec.size != 12:
        return "N", 0.0
    total = float(vec.sum()) or 1.0
    best_label = "N"
    best_score = 0.0
    for root in range(12):
        for minor, template in ((False, _MAJOR), (True, _MINOR)):
            score = 0.0
            for step in template:
                score += vec[(root + step) % 12]
            score /= total
            if score > best_score:
                best_score = score
                best_label = _chord_label(root, minor)
    return best_label, float(best_score)


def extract_sonic_signature(audio_bytes: bytes) -> dict[str, Any]:
    """Analyze raw audio bytes into a structured sonic signature."""
    import io

    import librosa  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415

    y, sr = librosa.load(io.BytesIO(audio_bytes), sr=None, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, onset_envelope=onset_env)
    tempo_bpm = float(np.atleast_1d(tempo)[0])

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    key_idx = int(np.argmax(chroma_mean))
    key_total = float(np.sum(chroma_mean)) or 1.0
    key_confidence = float(chroma_mean[key_idx] / key_total)

    # Mode: correlate with major vs minor profile
    major_profile = np.array([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1], dtype=float)
    minor_profile = np.array([1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0], dtype=float)
    rotated_major = np.roll(major_profile, key_idx)
    rotated_minor = np.roll(minor_profile, key_idx)
    major_corr = float(np.dot(chroma_mean, rotated_major))
    minor_corr = float(np.dot(chroma_mean, rotated_minor))
    mode = "minor" if minor_corr > major_corr else "major"
    key_estimate = f"{_KEYS[key_idx]} {mode}"

    harmonic, percussive = librosa.effects.hpss(y)
    harm_rms = float(np.sqrt(np.mean(harmonic**2)) or 0.0)
    perc_rms = float(np.sqrt(np.mean(percussive**2)) or 0.0)
    total_rms = harm_rms + perc_rms or 1.0

    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    rms = librosa.feature.rms(y=y)[0]
    loudness_db = float(20 * np.log10(np.mean(rms) + 1e-9))

    hop = 512
    frame_chords: list[dict[str, Any]] = []
    n_frames = chroma.shape[1]
    window = max(1, int(sr * 4 / hop))  # ~4s windows
    for start in range(0, n_frames, window):
        end = min(n_frames, start + window)
        seg = chroma[:, start:end].mean(axis=1)
        label, strength = _estimate_chord_from_chroma(seg)
        t0 = float(librosa.frames_to_time(start, sr=sr, hop_length=hop))
        if label != "N" and strength > 0.22:
            frame_chords.append({"time_sec": round(t0, 2), "chord": label, "strength": round(strength, 3)})

    # Deduplicate consecutive same chords
    progression: list[dict[str, Any]] = []
    for item in frame_chords:
        if progression and progression[-1]["chord"] == item["chord"]:
            continue
        progression.append(item)

    # 30s timeline segments
    segment_sec = 30.0
    segments: list[dict[str, Any]] = []
    seg_count = max(1, int(np.ceil(duration / segment_sec)))
    for i in range(seg_count):
        t0 = i * segment_sec
        t1 = min(duration, (i + 1) * segment_sec)
        i0 = int(t0 * sr)
        i1 = int(t1 * sr)
        slice_y = y[i0:i1]
        if slice_y.size < sr * 0.5:
            continue
        seg_rms = float(np.sqrt(np.mean(slice_y**2)) or 0.0)
        seg_centroid = float(np.mean(librosa.feature.spectral_centroid(y=slice_y, sr=sr)))
        segments.append(
            {
                "start_sec": round(t0, 2),
                "end_sec": round(t1, 2),
                "energy": round(min(100, seg_rms * 400), 1),
                "brightness_hz": round(seg_centroid, 1),
            }
        )

    time_sig = 4
    if beat_frames is not None and len(beat_frames) > 8:
        intervals = np.diff(librosa.frames_to_time(beat_frames, sr=sr))
        median_iv = float(np.median(intervals))
        if median_iv > 0.55:
            time_sig = 3

    return {
        "duration_sec": round(duration, 3),
        "tempo_bpm": round(tempo_bpm, 2),
        "key_estimate": key_estimate,
        "key_confidence": round(key_confidence, 4),
        "time_signature": time_sig,
        "loudness_db": round(loudness_db, 2),
        "spectral_centroid_hz": round(centroid, 2),
        "harmonic_ratio": round(harm_rms / total_rms, 4),
        "percussive_ratio": round(perc_rms / total_rms, 4),
        "beat_count": int(len(beat_frames)),
        "chord_progression": progression[:24],
        "timeline_segments": segments[:20],
        "provider": "librosa",
    }
