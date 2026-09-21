"""Unit tests for ACE-Step lifecycle helpers (no live ACE / uv spawn)."""

from pathlib import Path

from ai_sidecar.acestep_lifecycle import (
    QUALITY_MODEL,
    TURBO_MODEL,
    _parse_loaded_model,
    resolve_acestep_dit_model,
    should_restart_our_acestep_child,
)


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
