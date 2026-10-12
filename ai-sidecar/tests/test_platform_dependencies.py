"""The frozen Intel-Mac sidecar must resolve a binary-compatible Numba stack."""
from pathlib import Path
try:
    import tomllib
except ImportError:  # CPython 3.10 uses pytest's tomli dependency.
    import tomli as tomllib
from packaging.requirements import Requirement


def test_numba_pin_applies_only_to_intel_macos():
    metadata = tomllib.loads((Path(__file__).parents[1] / "pyproject.toml").read_text())
    requirement = next(Requirement(item) for item in metadata["project"]["dependencies"] if item.startswith("numba"))
    assert str(requirement.specifier) == "==0.62.1"
    assert requirement.marker.evaluate({"sys_platform": "darwin", "platform_machine": "x86_64"})
    for system, machine in [("darwin", "arm64"), ("win32", "AMD64"), ("linux", "x86_64")]:
        assert not requirement.marker.evaluate({"sys_platform": system, "platform_machine": machine})
