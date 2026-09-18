"""HTTP error details must not leak exception strings unless debug is on."""

from ai_sidecar.main import _http_safe_detail


def test_http_safe_detail_hides_exception(monkeypatch):
    monkeypatch.delenv("AIMC_SIDECAR_DEBUG", raising=False)
    assert _http_safe_detail(RuntimeError("/secret/path leaked"), "YouTube resolve failed") == (
        "YouTube resolve failed"
    )


def test_http_safe_detail_debug_includes_exception(monkeypatch):
    monkeypatch.setenv("AIMC_SIDECAR_DEBUG", "1")
    detail = _http_safe_detail(RuntimeError("/secret/path leaked"), "separation failed")
    assert detail.startswith("separation failed:")
    assert "/secret/path leaked" in detail
