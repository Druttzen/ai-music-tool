"""One resource lock for jobs and direct model operations in this process.

Nested vocal/stem jobs share the lock. Completed operations drop cached models
so the next engine has the GPU to itself. External engines retain ownership of
their processes; admission checks free VRAM instead of terminating them.
"""
from contextlib import contextmanager
from functools import wraps
import gc
import sys
import threading
from .idle import activity_session

_LOCK = threading.RLock()
_LOCAL = threading.local()
_CACHES = {
    "musicgen": ("_MODEL",), "genre_classifier": ("_PIPE",),
    "vision_analyzer": ("_PIPE", "_CLIP_PIPE"),
    "cover_generator": ("_PIPE",), "cover_ref_generator": ("_PIPE",),
    "vocal_ml_models": ("_RVC_ENGINE",),
    "stems_separate": ("_MODEL_CACHE",), "stems_melband": ("_MODEL_CACHE",),
}


def release_models() -> None:
    for name, attributes in _CACHES.items():
        module = sys.modules.get("ai_sidecar." + name)
        if module is None:
            continue
        for attr in attributes:
            value = getattr(module, attr, None)
            if isinstance(value, dict):
                value.clear()
            elif value is not None:
                setattr(module, attr, None)
    gc.collect()
    torch = sys.modules.get("torch")
    if torch is not None:
        try:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except (AttributeError, RuntimeError):
            pass


@contextmanager
def model_session():
    with activity_session(), _LOCK:
        depth = getattr(_LOCAL, "depth", 0)
        _LOCAL.depth = depth + 1
        try:
            yield
        finally:
            _LOCAL.depth = depth
            if depth == 0:
                release_models()


def require_free_vram(device: str, minimum_gb: float) -> None:
    if device != "cuda":
        return
    import torch
    if not torch.cuda.is_available():
        return
    query = getattr(torch.cuda, "mem_get_info", None)
    if query is None:
        return
    free, _ = query()
    if free < minimum_gb * 1024 ** 3:
        raise RuntimeError(
            f"Insufficient free GPU memory ({free / 1024 ** 3:.1f} GB). "
            f"This engine needs at least {minimum_gb:g} GB free. "
            "Pause another local engine or select CPU before retrying."
        )


def model_operation(minimum_gb: float = 0):
    def decorate(fn):
        @wraps(fn)
        def run(*args, **kwargs):
            with model_session():
                if minimum_gb:
                    device = kwargs.get("device", "cpu")
                    require_free_vram(device, minimum_gb)
                return fn(*args, **kwargs)
        return run
    return decorate
