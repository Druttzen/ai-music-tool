import json
from pathlib import Path
import pytest
from ai_sidecar.internal_plugins import activate, active_plugin, plugin_root, enforce_internal_integrations, extract_source
from ai_sidecar.acestep_bridge import configure_internal_acestep, acestep_api_url, acestep_api_key

def test_external_ace_is_ignored(tmp_path, monkeypatch):
    monkeypatch.setattr("ai_sidecar.acestep_bridge._PLUGIN_URL", "")
    monkeypatch.setattr("ai_sidecar.acestep_bridge._PLUGIN_KEY", "")
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("AIMC_ACESTEP_API_URL", "http://127.0.0.1:8001")
    configure_internal_acestep()
    assert acestep_api_url() == ""
    activate("acestep")
    configure_internal_acestep()
    assert acestep_api_url().startswith("http://127.0.0.1:")
    assert acestep_api_url() != "http://127.0.0.1:8001"
    assert len(acestep_api_key()) >= 32

def test_plugins_require_app_owned_manifest(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    assert active_plugin("canvas") is None
    activate("canvas")
    root = plugin_root("canvas")
    assert active_plugin("canvas") == root
    (root / "plugin.json").write_text(json.dumps({"id": "canvas", "kind": "standalone"}))
    assert active_plugin("canvas") is None
    with pytest.raises(ValueError):
        plugin_root("../outside")

def test_external_vocal_services_and_commands_removed(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    for key in ("AIMC_RVC_API_URL", "AIMC_DIFFSINGER_URL", "AIMC_DIFFSINGER_CMD", "AIMC_DIFFSINGER_PYTHON"):
        monkeypatch.setenv(key, "external")
    monkeypatch.setenv("AIMC_DIFFSINGER_ROOT", str(tmp_path.parent / "outside"))
    enforce_internal_integrations()
    import os
    assert not os.environ.get("AIMC_RVC_API_URL")
    assert not os.environ.get("AIMC_DIFFSINGER_CMD")
    assert not os.environ.get("AIMC_DIFFSINGER_ROOT")

def test_source_requires_pinned_checksum(tmp_path):
    archive = tmp_path / "bad.zip"
    archive.write_bytes(b"unverified source")
    with pytest.raises(RuntimeError, match="checksum"):
        extract_source(archive, tmp_path / "source")

def test_canvas_renders_offline_mp4(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    from PIL import Image
    import av
    from ai_sidecar.canvas_plugin import render
    activate("canvas")
    exports = tmp_path / "exports"
    exports.mkdir()
    art = exports / "art.png"
    Image.new("RGB", (50, 50), "blue").save(art)
    handoff = tmp_path / "handoff.json"
    handoff.write_text(json.dumps({"track": {"albumArtPath": str(art)}, "canvas": {"durationSec": 3}}))
    result = render(handoff)
    assert result.is_file()
    with av.open(str(result)) as media:
        stream = media.streams.video[0]
        assert (stream.width, stream.height) == (720, 1280)
        assert stream.frames == 90
    with pytest.raises(ValueError, match="handoff"):
        render(tmp_path / "outside.json")


def test_offline_plugin_only_allows_loopback_network(monkeypatch):
    import socket
    from ai_sidecar.acestep_plugin_host import loopback, restrict_network
    assert loopback("127.0.0.1") and loopback("::1") and loopback("localhost")
    assert not loopback("example.com") and not loopback("8.8.8.8")
    # Register originals with monkeypatch so all process-global changes are restored.
    monkeypatch.setattr(socket, "getaddrinfo", socket.getaddrinfo)
    monkeypatch.setattr(socket.socket, "connect", socket.socket.connect)
    monkeypatch.setattr(socket.socket, "connect_ex", socket.socket.connect_ex)
    restrict_network()
    with pytest.raises(OSError, match="external network"):
        socket.getaddrinfo("example.com", 443)
    assert socket.getaddrinfo("localhost", 12345)
    with socket.socket() as sock:
        with pytest.raises(OSError, match="external network"):
            sock.connect(("8.8.8.8", 443))
