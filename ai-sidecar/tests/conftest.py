import warnings


def pytest_configure(config):
    config.addinivalue_line("markers", "slow: slow integration tests (real Demucs)")
    warnings.filterwarnings(
        "ignore",
        message="Using `httpx` with `starlette.testclient` is deprecated",
        category=DeprecationWarning,
    )
    warnings.filterwarnings(
        "ignore",
        message="invalid value encountered in power",
        category=RuntimeWarning,
    )
