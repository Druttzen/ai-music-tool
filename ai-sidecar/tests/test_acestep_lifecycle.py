"""Unit tests for ACE-Step lifecycle helpers (no live ACE / uv spawn)."""

from pathlib import Path
import pytest

from ai_sidecar.acestep_lifecycle import (
    QUALITY_MODEL,
    SFT_MODEL,
    TURBO_MODEL,
    _parse_loaded_model,
    ace_home_candidates,
    preset_catalog,
    resolve_acestep_dit_model,
    should_restart_our_acestep_child,
)


def install_fixture_checkpoint(tmp_path, model):
    checkpoint = tmp_path / "checkpoints" / model
    checkpoint.mkdir(parents=True, exist_ok=True)
    (checkpoint / "config.json").write_text("{}")
    (checkpoint / "model.safetensors").write_bytes(b"fixture")


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
    install_fixture_checkpoint(tmp_path, QUALITY_MODEL)
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


def test_missing_explicit_sft_never_silently_downgrades(tmp_path):
    with pytest.raises(RuntimeError, match="install it"):
        resolve_acestep_dit_model(SFT_MODEL, home=tmp_path)
    (tmp_path / "checkpoints" / SFT_MODEL).mkdir(parents=True)
    with pytest.raises(RuntimeError, match="install it"):
        resolve_acestep_dit_model(SFT_MODEL, home=tmp_path)
    install_fixture_checkpoint(tmp_path, SFT_MODEL)
    assert resolve_acestep_dit_model(SFT_MODEL, home=tmp_path) == (SFT_MODEL, None)


def test_ace_home_candidates_prefer_explicit_environment(monkeypatch):
    monkeypatch.setenv("AIMC_ACESTEP_HOME", r"D:\custom\ACE-Step-1.5")
    monkeypatch.setenv("ACESTEP_HOME", r"E:\other\ACE-Step-1.5")
    candidates = ace_home_candidates()
    assert candidates[:2] == [r"D:\custom\ACE-Step-1.5", r"E:\other\ACE-Step-1.5"]


def test_preset_catalog_tracks_quality_checkpoint(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("ai_sidecar.acestep_lifecycle._ace_home", lambda: tmp_path)
    (tmp_path / "pyproject.toml").write_text("[project]\nname='ace'\n", encoding="utf-8")
    catalog = preset_catalog()
    assert catalog["quality_available"] is False
    assert QUALITY_MODEL in catalog["note"]
    install_fixture_checkpoint(tmp_path, QUALITY_MODEL)
    catalog = preset_catalog()
    assert catalog["quality_available"] is True
    assert catalog["note"] == ""


def test_incomplete_checkpoint_is_unavailable(tmp_path, monkeypatch):
    monkeypatch.setattr("ai_sidecar.acestep_lifecycle._ace_home", lambda: tmp_path)
    install_fixture_checkpoint(tmp_path, SFT_MODEL)
    weights = tmp_path / "checkpoints" / SFT_MODEL / "model.safetensors"
    weights.write_bytes(b"")
    assert preset_catalog()["sft_available"] is False
    weights.unlink()
    checkpoint = weights.parent
    (checkpoint / "model.safetensors.index.json").write_text('{"weight_map":{"a":"part1.safetensors","b":"part2.safetensors"}}')
    (checkpoint / "part1.safetensors").write_bytes(b"fixture")
    assert preset_catalog()["sft_available"] is False
    (checkpoint / "part2.safetensors").write_bytes(b"fixture")
    assert preset_catalog()["sft_available"] is True


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


def test_managed_server_enables_cached_planner_with_memory_offload(tmp_path, monkeypatch):
    import ai_sidecar.acestep_lifecycle as lifecycle
    install_fixture_checkpoint(tmp_path, "acestep-5Hz-lm-1.7B")
    for key in ("ACESTEP_INIT_LLM", "ACESTEP_LM_MODEL_PATH", "ACESTEP_LM_BACKEND", "ACESTEP_LM_OFFLOAD_TO_CPU"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(lifecycle, "_which", lambda _: True)
    monkeypatch.setattr(lifecycle, "_CHILD", None)
    monkeypatch.setattr(lifecycle, "_CHILD_CONFIG", "")
    monkeypatch.setattr(lifecycle, "_LOG_HANDLE", None)
    captured = {}
    def spawn(cmd, **kwargs):
        captured.update(kwargs)
        return object()
    monkeypatch.setattr(lifecycle.subprocess, "Popen", spawn)
    lifecycle._spawn_acestep_api(tmp_path, port="8001", config_path=SFT_MODEL)
    try:
        env = captured["env"]
        assert env["ACESTEP_INIT_LLM"] == "true"
        assert env["ACESTEP_LM_MODEL_PATH"] == "acestep-5Hz-lm-1.7B"
        assert env["ACESTEP_LM_OFFLOAD_TO_CPU"] == "true"
        import os
        if os.name == "nt":
            assert env["ACESTEP_LM_BACKEND"] == "pt"
    finally:
        lifecycle._LOG_HANDLE.close()
