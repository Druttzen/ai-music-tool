"""Local float audio decoding, including AAC/ALAC in M4A without a system FFmpeg."""

from __future__ import annotations


def read_audio(path):
    """Return finite frames x channels at the source rate; never silently downmix."""
    import numpy as np
    import soundfile as sf

    try:
        audio, rate = sf.read(path, dtype="float32", always_2d=True)
    except (RuntimeError, sf.LibsndfileError):
        import av

        chunks = []
        if hasattr(path, "seek"):
            path.seek(0)
        source = path if hasattr(path, "read") else str(path)
        with av.open(source) as container:
            if not container.streams.audio:
                raise ValueError("The file contains no audio stream")
            stream = container.streams.audio[0]
            rate = stream.codec_context.sample_rate
            channels = stream.codec_context.channels
            if not rate or channels not in (1, 2):
                raise ValueError("Separation requires mono or stereo audio with a valid sample rate")
            resampler = av.AudioResampler(format="fltp", layout="mono" if channels == 1 else "stereo", rate=rate)
            for frame in container.decode(stream):
                if frame.sample_rate != rate or len(frame.layout.channels) != channels:
                    raise ValueError("Audio channel count or sample rate changes inside the file")
                for output in resampler.resample(frame):
                    chunks.append(output.to_ndarray().T)
            for output in resampler.resample(None):
                chunks.append(output.to_ndarray().T)
        audio = np.concatenate(chunks, axis=0) if chunks else np.empty((0, channels), dtype=np.float32)

    if not len(audio) or audio.shape[1] not in (1, 2) or rate <= 0:
        raise ValueError("Separation requires non-empty mono or stereo audio")
    if not np.isfinite(audio).all():
        raise ValueError("Audio contains non-finite samples")
    return np.ascontiguousarray(audio, dtype=np.float32), rate


def read_mono_bytes(raw):
    import io
    import numpy as np

    audio, rate = read_audio(io.BytesIO(raw))
    return audio.mean(axis=1, dtype=np.float32), rate
