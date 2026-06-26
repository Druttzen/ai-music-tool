def pytest_configure(config):
    config.addinivalue_line("markers", "slow: slow integration tests (real Demucs)")
