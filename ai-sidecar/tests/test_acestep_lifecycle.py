"""Unit tests for ACE-Step lifecycle helpers (no live ACE / uv spawn)."""

from pathlib import Path

from ai_sidecar.acestep_lifecycle import (
    QUALITY_MODEL,
    TURBO_MODEL,
    _parse_loaded_model,
    ace_home_candidates,
    cmdline_looks_like_acestep,
    preset_catalog,
    resolve_acestep_dit_model,
    should_restart_our_acestep_child,
)
from ai_sidecar.mei_cleanup import cleanup_stale_mei_dirs


def test_resolve_turbo_defaults(tmp_path: Path):
    model, warning = resolve_acestep_dit_model("", home=tmp_path)
    assert model == TURBO_MODEL
    assert warning is None
    model, warning = resolve_acestep_dit_model("turbo", home=tmp_path)
    assert model == TURBO_MODEL
    assert warning is None


def test_resolve_quality_falls_back_without_base_checkpoint(tmp_path: Path):
    (tmp_path / "checkpoints" / TURBO_MODEL).mkdir(parents=True)
    for raw in ("quality", "base", "acestep-v15", QUALITY_MODEL):
        model, warning = resolve_acestep_dit_model(raw, home=tmp_path)
        assert model == TURBO_MODEL
        assert warning is not None
        assert QUALITY_MODEL in warning


def test_resolve_quality_uses_base_when_present(tmp_path: Path):
    (tmp_path / "checkpoints" / QUALITY_MODEL).mkdir(parents=True)
    model, warning = resolve_acestep_dit_model("acestep-v15", home=tmp_path)
    assert model == QUALITY_MODEL
    assert warning is None
    model, warning = resolve_acestep_dit_model(QUALITY_MODEL, home=tmp_path)
    assert model == QUALITY_MODEL
    assert warning is None


def test_resolve_unknown_falls_back_to_turbo(tmp_path: Path):
    model, warning = resolve_acestep_dit_model("not-a-model", home=tmp_path)
    assert model == TURBO_MODEL
    assert warning is not None


def test_ace_home_candidates_prefer_env(monkeypatch):
    monkeypatch.setenv("AIMC_ACESTEP_HOME", r"D:\custom\ACE-Step-1.5")
    monkeypatch.setenv("ACESTEP_HOME", r"E:\other\ACE-Step-1.5")
    found = ace_home_candidates()
    assert found[0] == r"D:\custom\ACE-Step-1.5"
    assert r"E:\other\ACE-Step-1.5" in found
    assert any(item.endswith("ACE-Step-1.5") for item in found[2:])


def test_cmdline_looks_like_acestep():
    assert cmdline_looks_like_acestep("uv run acestep-api --port 8001")
    assert cmdline_looks_like_acestep("python -m uvicorn acestep.api_server:app")
    assert not cmdline_looks_like_acestep("python -m uvicorn ai_sidecar.main:app")
    assert not cmdline_looks_like_acestep("")


def test_should_restart_foreign_ace_listener():
    assert should_restart_our_acestep_child(
        reachable=True,
        loaded_model=TURBO_MODEL,
        desired_model=QUALITY_MODEL,
        we_own_child=False,
        listener_is_ace=True,
    )
    assert not should_restart_our_acestep_child(
        reachable=True,
        loaded_model=TURBO_MODEL,
        desired_model=QUALITY_MODEL,
        we_own_child=False,
        listener_is_ace=False,
    )


def test_preset_catalog_hides_quality_without_checkpoint(tmp_path, monkeypatch):
    monkeypatch.setenv("AIMC_ACESTEP_HOME", str(tmp_path))
    monkeypatch.delenv("ACESTEP_HOME", raising=False)
    (tmp_path / "pyproject.toml").write_text("[project]\nname='ace'\n", encoding="utf-8")
    (tmp_path / "checkpoints" / TURBO_MODEL).mkdir(parents=True)
    catalog = preset_catalog()
    assert catalog["quality_available"] is False
    assert QUALITY_MODEL in catalog["note"]
    (tmp_path / "checkpoints" / QUALITY_MODEL).mkdir()
    catalog = preset_catalog()
    assert catalog["quality_available"] is True
    assert catalog["note"] == ""


def test_cleanup_stale_mei_dirs_skips_live(tmp_path, monkeypatch):
    live = tmp_path / "_MEI_live"
    stale = tmp_path / "_MEI_stale"
    live.mkdir()
    stale.mkdir()
    (stale / "junk.txt").write_text("x", encoding="utf-8")
    monkeypatch.setattr("ai_sidecar.mei_cleanup.tempfile.gettempdir", lambda: str(tmp_path))
    monkeypatch.setattr("ai_sidecar.mei_cleanup.sys._MEIPASS", str(live), raising=False)
    removed = cleanup_stale_mei_dirs()
    assert removed == 1
    assert live.is_dir()
    assert not stale.exists()


def test_should_restart_only_when_we_own_and_model_differs():
    assert should_restart_our_acestep_child(
        reachable=True,
        loaded_model=TURBO_MODEL,
        desired_model=QUALITY_MODEL,
        we_own_child=True,
    )
    assert not should_restart_our_acestep_child(
        reachable=True,
        loaded_model=TURBO_MODEL,
        desired_model=QUALITY_MODEL,
        we_own_child=False,
    )
    assert not should_restart_our_acestep_child(
        reachable=True,
        loaded_model=TURBO_MODEL,
        desired_model=TURBO_MODEL,
        we_own_child=True,
    )
    assert not should_restart_our_acestep_child(
        reachable=False,
        loaded_model=TURBO_MODEL,
        desired_model=QUALITY_MODEL,
        we_own_child=True,
    )
    assert not should_restart_our_acestep_child(
        reachable=True,
        loaded_model="",
        desired_model=QUALITY_MODEL,
        we_own_child=True,
    )


def test_parse_loaded_model_shapes():
    assert _parse_loaded_model({"default_model": TURBO_MODEL}) == TURBO_MODEL
    assert (
        _parse_loaded_model(
            {"data": {"default_model": QUALITY_MODEL, "models": [{"name": TURBO_MODEL}]}}
        )
        == QUALITY_MODEL
    )
    assert _parse_loaded_model({"data": {"models": [{"name": TURBO_MODEL}]}}) == TURBO_MODEL
    assert (
        _parse_loaded_model(
            {
                "object": "list",
                "data": [{"id": "acestep/acestep-v15-turbo", "name": "ACE-Step acestep-v15-turbo"}],
            }
        )
        == TURBO_MODEL
    )
    assert _parse_loaded_model({}) == ""
    assert _parse_loaded_model(None) == ""
