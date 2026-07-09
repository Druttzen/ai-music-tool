"""Optional RVC / DiffSinger model integrations for Vocal Embed Studio.

Models are never bundled — configure via environment variables or an external RVC API.
Falls back to scipy/librosa DSP when models are not configured.
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from ai_sidecar.diffsinger_openvpi import openvpi_configured, openvpi_ready, openvpi_status

import numpy as np

_RVC_ENGINE: Any | None = None
_RVC_ENGINE_KEY: str | None = None


def _env_path(name: str) -> str | None:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    path = Path(raw).expanduser()
    return str(path) if path.exists() else raw


def rvc_python_available() -> bool:
    try:
        from rvc_python.infer import RVCInference  # noqa: F401, PLC0415
    except Exception:
        return False
    return True


def rvc_api_configured() -> bool:
    return bool(os.environ.get("AIMC_RVC_API_URL", "").strip())


def rvc_model_configured() -> bool:
    return bool(_env_path("AIMC_RVC_MODEL") or os.environ.get("AIMC_RVC_MODELS_DIR", "").strip())


def rvc_ready() -> bool:
    if rvc_api_configured():
        return True
    return rvc_python_available() and rvc_model_configured()


def diffsinger_configured() -> bool:
    return bool(
        os.environ.get("AIMC_DIFFSINGER_CMD", "").strip()
        or os.environ.get("AIMC_DIFFSINGER_URL", "").strip()
        or openvpi_configured()
    )


def diffsinger_ready() -> bool:
    if openvpi_configured():
        return openvpi_ready()
    return diffsinger_configured()


def full_ml_vocal_models_available() -> bool:
    return rvc_ready() or diffsinger_configured()


def vocal_model_status() -> dict[str, Any]:
    from .vocal_align import mfa_configured as mfa_align_ready  # noqa: PLC0415

    model_path = _env_path("AIMC_RVC_MODEL")
    index_path = _env_path("AIMC_RVC_INDEX")
    return {
        "rvc_python": rvc_python_available(),
        "rvc_api": rvc_api_configured(),
        "rvc_model_configured": rvc_model_configured(),
        "rvc_ready": rvc_ready(),
        "rvc_model": model_path,
        "rvc_index": index_path,
        "rvc_models_dir": os.environ.get("AIMC_RVC_MODELS_DIR", "").strip() or None,
        "rvc_api_url": os.environ.get("AIMC_RVC_API_URL", "").strip() or None,
        "diffsinger_configured": diffsinger_configured(),
        "diffsinger_ready": diffsinger_ready(),
        "diffsinger_cmd": os.environ.get("AIMC_DIFFSINGER_CMD", "").strip() or None,
        "diffsinger_url": os.environ.get("AIMC_DIFFSINGER_URL", "").strip() or None,
        "diffsinger_model_dir": os.environ.get("AIMC_DIFFSINGER_MODEL_DIR", "").strip() or None,
        "diffsinger_openvpi": openvpi_status(),
        "models_ready": full_ml_vocal_models_available(),
        "align": {
            "mfa_configured": mfa_align_ready(),
        },
    }


def _select_torch_device() -> str:
    try:
        import torch  # noqa: PLC0415

        if torch.cuda.is_available():
            return "cuda:0"
        mps = getattr(torch.backends, "mps", None)
        if mps is not None and mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def _write_mono_wav(path: str, mono: np.ndarray, sample_rate: int) -> None:
    import soundfile as sf  # noqa: PLC0415

    sf.write(path, mono.astype(np.float32), sample_rate, subtype="PCM_16", format="WAV")


def _read_stereo_wav(path: str, target_sr: int, length: int) -> np.ndarray:
    import librosa  # noqa: PLC0415

    y, _ = librosa.load(path, sr=target_sr, mono=False)
    if y.ndim == 1:
        stereo = np.stack([y, y], axis=0)
    else:
        stereo = y[:2] if y.shape[0] >= 2 else np.stack([y[0], y[0]], axis=0)
    stereo = stereo.astype(np.float32)
    if stereo.shape[1] < length:
        pad = np.zeros((2, length - stereo.shape[1]), dtype=stereo.dtype)
        stereo = np.concatenate([stereo, pad], axis=1)
    return stereo[:, :length]


def _get_rvc_engine() -> Any:
    global _RVC_ENGINE, _RVC_ENGINE_KEY

    model = _env_path("AIMC_RVC_MODEL")
    if not model:
        raise RuntimeError("AIMC_RVC_MODEL is not set or does not exist")

    index = _env_path("AIMC_RVC_INDEX")
    key = f"{model}|{index or ''}|{_select_torch_device()}"
    if _RVC_ENGINE is not None and _RVC_ENGINE_KEY == key:
        return _RVC_ENGINE

    from rvc_python.infer import RVCInference  # noqa: PLC0415

    engine = RVCInference(device=_select_torch_device())
    if index:
        engine.load_model(model, index_path=index)
    else:
        engine.load_model(model)
    _RVC_ENGINE = engine
    _RVC_ENGINE_KEY = key
    return engine


def _apply_rvc_pitch_params(engine: Any, pitch_semitones: float) -> None:
    semi = int(round(pitch_semitones))
    for method_name in ("set_params", "set_param"):
        setter = getattr(engine, method_name, None)
        if not callable(setter):
            continue
        try:
            setter({"f0up_key": semi, "pitch": semi})
            return
        except Exception:
            try:
                setter(f0up_key=semi, pitch=semi)
                return
            except Exception:
                pass
    params = getattr(engine, "params", None)
    if isinstance(params, dict):
        params["f0up_key"] = semi


def _convert_mono_with_rvc_python(mono: np.ndarray, sample_rate: int, pitch_semitones: float) -> np.ndarray:
    engine = _get_rvc_engine()
    _apply_rvc_pitch_params(engine, pitch_semitones)

    with tempfile.TemporaryDirectory(prefix="aimc-rvc-") as tmp:
        in_path = os.path.join(tmp, "in.wav")
        out_path = os.path.join(tmp, "out.wav")
        _write_mono_wav(in_path, mono, sample_rate)
        engine.infer_file(in_path, out_path)
        import librosa  # noqa: PLC0415

        y, _ = librosa.load(out_path, sr=sample_rate, mono=True)
        if y.shape[0] < mono.shape[0]:
            pad = np.zeros(mono.shape[0] - y.shape[0], dtype=np.float32)
            y = np.concatenate([y.astype(np.float32), pad])
        return y[: mono.shape[0]].astype(np.float32)


def _convert_mono_with_rvc_api(mono: np.ndarray, sample_rate: int, pitch_semitones: float) -> np.ndarray:
    import requests  # noqa: PLC0415

    base = os.environ.get("AIMC_RVC_API_URL", "").rstrip("/")
    if not base:
        raise RuntimeError("AIMC_RVC_API_URL is not set")

    with tempfile.TemporaryDirectory(prefix="aimc-rvc-api-") as tmp:
        in_path = os.path.join(tmp, "in.wav")
        _write_mono_wav(in_path, mono, sample_rate)
        with open(in_path, "rb") as handle:
            audio_data = base64.b64encode(handle.read()).decode("ascii")

        params_url = f"{base}/params"
        try:
            requests.post(
                params_url,
                json={"params": {"f0up_key": int(round(pitch_semitones)), "pitch": int(round(pitch_semitones))}},
                timeout=30,
            )
        except Exception:
            pass

        res = requests.post(f"{base}/convert", json={"audio_data": audio_data}, timeout=600)
        res.raise_for_status()
        out_path = os.path.join(tmp, "out.wav")
        with open(out_path, "wb") as handle:
            handle.write(res.content)
        import librosa  # noqa: PLC0415

        y, _ = librosa.load(out_path, sr=sample_rate, mono=True)
        if y.shape[0] < mono.shape[0]:
            pad = np.zeros(mono.shape[0] - y.shape[0], dtype=np.float32)
            y = np.concatenate([y.astype(np.float32), pad])
        return y[: mono.shape[0]].astype(np.float32)


def convert_guide_with_rvc(
    stereo: np.ndarray,
    sample_rate: int,
    pitch_semitones: float = 0.0,
) -> np.ndarray:
    """Run RVC on a guide vocal (mono mixdown, duplicated to stereo)."""
    if not rvc_ready():
        raise RuntimeError("RVC is not configured")

    mono = ((stereo[0] + stereo[1]) * 0.5).astype(np.float32)
    if rvc_api_configured():
        converted = _convert_mono_with_rvc_api(mono, sample_rate, pitch_semitones)
    else:
        converted = _convert_mono_with_rvc_python(mono, sample_rate, pitch_semitones)

    return np.stack([converted, converted], axis=0)


def _plan_to_diffsinger_payload(plan: dict[str, Any], sample_rate: int, length: int) -> dict[str, Any]:
    return {
        "sample_rate": sample_rate,
        "length_samples": length,
        "duration_sec": length / sample_rate,
        "bpm": plan.get("bpm"),
        "key": plan.get("key"),
        "lyrics": plan.get("lyrics"),
        "voice_style": plan.get("voiceStyle"),
        "sections": plan.get("sections") or [],
        "mix_plan": plan.get("mixPlan") or {},
    }


def _synthesize_with_diffsinger_url(plan: dict[str, Any], length: int, sample_rate: int) -> np.ndarray:
    import requests  # noqa: PLC0415

    base = os.environ.get("AIMC_DIFFSINGER_URL", "").rstrip("/")
    if not base:
        raise RuntimeError("AIMC_DIFFSINGER_URL is not set")

    payload = _plan_to_diffsinger_payload(plan, sample_rate, length)
    res = requests.post(f"{base}/synthesize", json=payload, timeout=900)
    res.raise_for_status()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(res.content)
        tmp_path = tmp.name
    try:
        return _read_stereo_wav(tmp_path, sample_rate, length)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _synthesize_with_diffsinger_cmd(plan: dict[str, Any], length: int, sample_rate: int) -> np.ndarray:
    cmd = os.environ.get("AIMC_DIFFSINGER_CMD", "").strip()
    if not cmd:
        raise RuntimeError("AIMC_DIFFSINGER_CMD is not set")

    with tempfile.TemporaryDirectory(prefix="aimc-ds-") as tmp:
        plan_path = os.path.join(tmp, "plan.json")
        out_path = os.path.join(tmp, "vocal.wav")
        with open(plan_path, "w", encoding="utf-8") as handle:
            json.dump(_plan_to_diffsinger_payload(plan, sample_rate, length), handle)

        env = os.environ.copy()
        if os.environ.get("AIMC_DIFFSINGER_MODEL_DIR"):
            env["DIFFSINGER_MODEL_DIR"] = os.environ["AIMC_DIFFSINGER_MODEL_DIR"]

        argv = [*cmd.split(), "--plan", plan_path, "--out", out_path, "--sr", str(sample_rate)]
        subprocess.run(argv, check=True, env=env, timeout=900)
        if not os.path.isfile(out_path):
            raise RuntimeError("DiffSinger command did not produce output WAV")
        return _read_stereo_wav(out_path, sample_rate, length)


def synthesize_with_diffsinger(
    plan: dict[str, Any],
    length: int,
    sample_rate: int,
    *,
    guide_vocal_raw: bytes | None = None,
) -> np.ndarray:
    """Invoke OpenVPI DiffSinger, HTTP service, or CLI bridge."""
    if not diffsinger_configured():
        raise RuntimeError("DiffSinger is not configured")
    if openvpi_configured():
        from ai_sidecar.diffsinger_openvpi import synthesize_with_openvpi  # noqa: PLC0415

        return (
            synthesize_with_openvpi(
                plan,
                length,
                sample_rate,
                guide_vocal_raw=guide_vocal_raw,
            ),
            "openvpi-diffsinger-v1",
        )
    if os.environ.get("AIMC_DIFFSINGER_URL", "").strip():
        return _synthesize_with_diffsinger_url(plan, length, sample_rate)
    return _synthesize_with_diffsinger_cmd(plan, length, sample_rate)
