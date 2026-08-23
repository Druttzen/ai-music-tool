import os
import warnings


def pytest_configure(config):
    # Never download MMS / BLIP / diffusion weights during unit tests.
    os.environ.setdefault("AIMC_VOCAL_TTS_OFF", "1")
    os.environ.setdefault("AIMC_CAPTION_OFF", "1")
    config.addinivalue_line("markers", "slow: slow integration tests (real Demucs)")
    warnings.filterwarnings(
        "ignore",
        message="Using `httpx` with `starlette.testclient` is deprecated",
    )
    warnings.filterwarnings(
        "ignore",
        category=UserWarning,
        module=r"librosa\.core\.spectrum",
    )
    warnings.filterwarnings(
        "ignore",
        message="invalid value encountered in power",
        category=RuntimeWarning,
    )
