"""Filesystem-only offline readiness. Health never loads weights or downloads them."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re


def addon_enabled(capability: str) -> bool:
    aliases = {"genre": "classify", "vocal_ml": "vocal", "rvc": "vocal-rvc", "mfa-align": "mfa"}
    path = os.environ.get("AIMC_DISABLED_EXTRAS_FILE", "")
    if not path:
        return True
    try:
        disabled = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return True
    except (OSError, ValueError):
        return False  # damaged activation state needs repair
    return aliases.get(capability, capability) not in disabled


def _weights_ready(folder: Path) -> bool:
    indexes = list(folder.glob("*.index.json"))
    if indexes:
        try:
            return all(all((folder / shard).is_file() and (folder / shard).stat().st_size > 0
                           for shard in set(json.loads(index.read_text())["weight_map"].values()))
                       for index in indexes)
        except (OSError, ValueError, KeyError):
            return False
    return any(path.is_file() and path.stat().st_size > 0
               for pattern in ("*.safetensors", "*.bin") for path in folder.glob(pattern))


def hf_model_cached(model_id: str, *, musicgen: bool = False) -> bool:
    local = Path(model_id).expanduser()
    roots = [Path(os.environ.get("HF_HUB_CACHE", ""))] if os.environ.get("HF_HUB_CACHE") else []
    home = Path(os.environ.get("HF_HOME", str(Path.home() / ".cache/huggingface")))
    roots += [home / "hub", home]
    if os.environ.get("TRANSFORMERS_CACHE"):
        roots.append(Path(os.environ["TRANSFORMERS_CACHE"]))
    candidates = [local] if local.is_dir() else []
    for root in roots:
        repo = root / ("models--" + model_id.replace("/", "--"))
        ref = repo / "refs/main"
        if ref.is_file():
            candidates.append(repo / "snapshots" / ref.read_text().strip())
        elif (repo / "snapshots").is_dir():
            candidates.extend((repo / "snapshots").iterdir())
    for folder in candidates:
        if musicgen:
            if all((folder / name).is_file() and (folder / name).stat().st_size > 0
                   for name in ("state_dict.bin", "compression_state_dict.bin")):
                return True
            continue
        index = folder / "model_index.json"
        if index.is_file():
            try:
                components = json.loads(index.read_text())
                required = [name for name, value in components.items()
                            if not name.startswith("_") and isinstance(value, list) and value[0] is not None]
                if required and all((folder / name).is_dir() for name in required) and all(
                    _weights_ready(folder / name) for name in required if name in {"transformer", "unet", "vae", "text_encoder", "text_encoder_2"}
                ):
                    return True
            except (OSError, ValueError, IndexError):
                pass
        elif (folder / "config.json").is_file() and _weights_ready(folder):
            return True
    return False


def melband_models_cached() -> dict[str, bool]:
    result = {"melband-clean": False, "melband": False}
    try:
        import importlib.util
        spec = importlib.util.find_spec("mel_band_roformer")
        if not spec or not spec.origin:
            return result
        metadata = json.loads((Path(spec.origin).parent / "data/melband_models.json").read_text())["models"]
        roots = [Path(os.environ.get("MELBAND_ROFORMER_MODELS_PATH", str(Path.home() / ".cache/melband-roformer-infer"))), Path("models")]
        ids = {"melband-clean": "melband-roformer-kimmel-ft2-bleedless",
               "melband": os.environ.get("AIMC_MELBAND_MODEL", "").strip() or "melband-roformer-kim-vocals"}
        sizes = {"melband-roformer-kimmel-ft2-bleedless": 913101368, "melband-roformer-kim-vocals": 913106900}
        for name, slug in ids.items():
            entry = metadata.get(slug)
            if entry:
                result[name] = any(
                    (base / slug / entry["checkpoint"]).is_file()
                    and (base / slug / entry["checkpoint"]).stat().st_size >= sizes.get(slug, 1)
                    and (base / slug / entry["config"]).is_file()
                    and (base / slug / entry["config"]).stat().st_size > 0 for base in roots)
        return result
    except (ImportError, AttributeError, OSError, ValueError, KeyError):
        return result


def demucs_cached(model: str = "htdemucs") -> bool:
    try:
        # Demucs 4.1 loads named models from Hugging Face before its legacy
        # Torch checkpoint cache. Inspect both layouts without loading weights.
        import yaml
        home = Path(os.environ.get("HF_HOME", str(Path.home() / ".cache/huggingface")))
        roots = [home / "hub", home]
        if os.environ.get("HF_HUB_CACHE"):
            roots.insert(0, Path(os.environ["HF_HUB_CACHE"]))
        repo_name = "HTDemucs" if model == "htdemucs" else "HTDemucs-" + model[len("htdemucs_"):]
        if model == "htdemucs" or model.startswith("htdemucs_"):
            for root in roots:
                repo = root / ("models--adefossez--" + repo_name)
                ref = repo / "refs/main"
                snapshots = ([repo / "snapshots" / ref.read_text().strip()] if ref.is_file() else
                             list((repo / "snapshots").iterdir()) if (repo / "snapshots").is_dir() else [])
                for folder in snapshots:
                    bag = folder / (model + ".yaml")
                    if not bag.is_file():
                        continue
                    try:
                        definition = yaml.safe_load(bag.read_text())
                    except yaml.YAMLError:
                        continue
                    signatures = definition.get("models", []) if isinstance(definition, dict) else []
                    if signatures and all(re.fullmatch(r"[0-9a-f]{8}", str(sig)) and
                                          (folder / f"{sig}.safetensors").is_file() and
                                          (folder / f"{sig}.safetensors").stat().st_size > 0 for sig in signatures):
                        return True
        import importlib.util
        spec = importlib.util.find_spec("demucs")
        if not spec or not spec.origin:
            return False
        bag = Path(spec.origin).parent / "remote" / (model + ".yaml")
        signatures = re.findall(r"\b[0-9a-f]{8}\b", bag.read_text())
        cache = Path(os.environ.get("TORCH_HOME", str(Path.home() / ".cache/torch"))) / "hub/checkpoints"
        return bool(signatures) and all(any(path.stat().st_size > 0 for path in cache.glob(sig + "-*.th")) for sig in signatures)
    except (OSError, ImportError, ValueError):
        return False


def readiness(capability: str) -> dict:
    models: dict[str, bool] = {}
    cached = True
    configured = True
    offline = True
    if capability == "generate":
        from .musicgen import active_musicgen_model_id, active_musicgen_melody_model_id, MEDIUM_MODEL_ID
        models = {name: hf_model_cached(name, musicgen=True) for name in
                  (active_musicgen_model_id(), active_musicgen_melody_model_id(), MEDIUM_MODEL_ID,
                   "facebook/musicgen-stereo-small", "facebook/musicgen-stereo-medium", "facebook/musicgen-stereo-melody")}
        cached = models[active_musicgen_model_id()] and hf_model_cached("t5-base") and hf_model_cached("facebook/encodec_32khz")
    elif capability == "stems-melband":
        models = melband_models_cached()
        cached = any(models.values())
    elif capability == "stems":
        cached = demucs_cached()
        models = {"htdemucs": cached}
    elif capability == "mfa-align":
        from .vocal_align import mfa_configured, mfa_ready
        configured = mfa_configured()
        cached = mfa_ready()
    elif capability == "vocal-transform":
        cached = ((addon_enabled("stems") and demucs_cached()) or
                  (addon_enabled("stems-melband") and any(melband_models_cached().values())))
    elif capability in {"cover", "cover-ref", "genre", "vision"}:
        if capability == "genre":
            from .genre_classifier import active_genre_model_id
            names = [active_genre_model_id()]
        elif capability == "vision":
            from .vision_analyzer import MODEL_ID, CLIP_MODEL_ID
            names = [MODEL_ID, CLIP_MODEL_ID]
        else:
            from .cover_generator import active_cover_model_id
            from .cover_ref_generator import active_cover_ref_model_id
            names = [active_cover_ref_model_id() if capability == "cover-ref" else active_cover_model_id()]
        models = {name: hf_model_cached(name) for name in names}
        cached = all(models.values())
    elif capability == "rvc":
        from .vocal_ml_models import rvc_model_configured, rvc_ready, rvc_api_configured
        cached = rvc_model_configured()
        configured = rvc_ready()
        offline = not rvc_api_configured()
    elif capability == "diffsinger":
        from .vocal_ml_models import diffsinger_ready, diffsinger_configured
        configured = diffsinger_configured()
        cached = diffsinger_ready()
        offline = not bool(os.environ.get("AIMC_DIFFSINGER_URL", ""))
    elif capability in {"java", "ffmpeg"}:
        from .managed_tools import installed
        cached = configured = installed(capability)
    elif capability == "acestep":
        from .internal_plugins import active_plugin
        root = active_plugin("acestep")
        configured = root is not None
        if root:
            checkpoints = root / "source" / "checkpoints"
            models = {name: (checkpoints / name / "config.json").is_file() and _weights_ready(checkpoints / name)
                      for name in ("acestep-v15-turbo", "vae", "Qwen3-Embedding-0.6B", "acestep-5Hz-lm-0.6B", "acestep-5Hz-lm-1.7B")}
            cached = all(models[name] for name in ("acestep-v15-turbo", "vae", "Qwen3-Embedding-0.6B")) and (models["acestep-5Hz-lm-0.6B"] or models["acestep-5Hz-lm-1.7B"])
        else:
            cached = False
    return {"modelCached": cached, "configured": configured,
            "offlineReady": bool(cached and configured and offline),
            "runtimeReady": bool(configured and (cached or not offline)), "models": models}


MUSICGEN_PRESETS = frozenset({"small", "medium", "melody", "stereo-small", "stereo-medium", "stereo-melody"})


def provision(extra: str, *, musicgen_model: str | None = None) -> None:
    """Explicit install phase; downloads are permitted only in this process."""
    os.environ["HF_HUB_OFFLINE"] = "0"
    os.environ["TRANSFORMERS_OFFLINE"] = "0"
    if extra == "generate":
        from .musicgen import _get_model, active_musicgen_model_id
        if musicgen_model is not None and musicgen_model not in MUSICGEN_PRESETS:
            raise ValueError("Unknown MusicGen model preset")
        requested_models = (f"facebook/musicgen-{musicgen_model}",) if musicgen_model else (
            active_musicgen_model_id(), "facebook/musicgen-stereo-small")
        for model in dict.fromkeys(requested_models):
            print(f"Preparing offline model: {model}", flush=True)
            _get_model("cpu", model)
            if not hf_model_cached(model, musicgen=True):
                raise RuntimeError(f"Model setup incomplete: {model}")
        from .model_resources import release_models
        release_models()
    elif extra == "stems":
        from demucs.pretrained import get_model
        get_model("htdemucs")
    elif extra in {"classify", "vision", "cover", "cover-ref"}:
        from huggingface_hub import snapshot_download
        cap = "genre" if extra == "classify" else extra
        for name in readiness(cap)["models"]:
            print(f"Preparing offline model: {name}", flush=True)
            if cap in {"cover", "cover-ref"}:
                # Diffusers uses component folders; original single-file Flux
                # checkpoints in the same repo would download duplicate weights.
                snapshot_download(name, allow_patterns=["model_index.json", "scheduler/*", "tokenizer/*", "tokenizer_2/*",
                                                        "text_encoder/*", "text_encoder_2/*", "transformer/*", "vae/*"])
            else:
                snapshot_download(name)
    else:
        return
    cap = "genre" if extra == "classify" else extra
    if not readiness(cap)["offlineReady"]:
        raise RuntimeError("Model setup incomplete; repair the addon before offline use")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--provision", required=True)
    parser.add_argument("--musicgen-model", choices=sorted(MUSICGEN_PRESETS))
    args = parser.parse_args()
    provision(args.provision, musicgen_model=args.musicgen_model)
