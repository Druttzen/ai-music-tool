from types import SimpleNamespace

import pytest

from ai_sidecar import install_validation


def test_rvc_legacy_engine_error_is_not_an_install_success(monkeypatch):
    def broken_import(name):
        assert name == "rvc_python.infer"
        raise ValueError("mutable default CommonConfig is not allowed: use default_factory")
    monkeypatch.setattr(install_validation, "import_module", broken_import)
    with pytest.raises(RuntimeError, match="vocal-rvc engine verification failed") as failure:
        install_validation.verify_extra("vocal-rvc")
    assert "not activated" in str(failure.value)
    assert isinstance(failure.value.__cause__, ValueError)


def test_present_package_without_inference_symbol_is_rejected(monkeypatch):
    monkeypatch.setattr(install_validation, "import_module", lambda _: SimpleNamespace())
    with pytest.raises(RuntimeError, match="MusicGen"):
        install_validation.verify_extra("generate")


def test_verification_imports_without_loading_models(monkeypatch):
    def forbidden_load(*args, **kwargs):
        raise AssertionError("Install verification must not load or download checkpoints")
    fake = SimpleNamespace(MusicGen=SimpleNamespace(get_pretrained=forbidden_load))
    monkeypatch.setattr(install_validation, "import_module", lambda _: fake)
    install_validation.verify_extra("generate")


def test_unknown_extra_never_imports_arbitrary_modules(monkeypatch):
    monkeypatch.setattr(install_validation, "import_module", lambda _: pytest.fail("unexpected import"))
    with pytest.raises(ValueError, match="Unknown sidecar extra"):
        install_validation.verify_extra("os")


@pytest.mark.parametrize("extra,force_cpu", [("vocal", ""), ("generate", "1")])
def test_cpu_opt_out_and_non_torch_extra_do_not_install(extra, force_cpu, monkeypatch):
    monkeypatch.setenv("AIMC_FORCE_CPU", force_cpu)
    monkeypatch.setattr(install_validation.subprocess, "run", lambda *a, **k: pytest.fail("unexpected subprocess"))
    install_validation.prepare_cuda(extra)


def test_cuda_repair_uses_exclusive_wheel_index_and_verifies_in_fresh_process(monkeypatch):
    monkeypatch.delenv("AIMC_FORCE_CPU", raising=False)
    monkeypatch.delenv("AIMC_TORCH_CUDA_INDEX", raising=False)
    calls = []
    responses = iter([SimpleNamespace(returncode=0, stdout=b"GPU 0: NVIDIA"),
                      SimpleNamespace(returncode=1), SimpleNamespace(returncode=0),
                      SimpleNamespace(returncode=0)])
    def run(args, **kwargs):
        calls.append(args)
        return next(responses)
    monkeypatch.setattr(install_validation.subprocess, "run", run)
    install_validation.prepare_cuda("generate")
    assert "--index-url" in calls[2]
    assert "--extra-index-url" not in calls[2]
    assert calls[2][-1] == "https://download.pytorch.org/whl/cu126"
    assert calls[1] == calls[3]


def test_failed_cuda_probe_after_install_cannot_report_success(monkeypatch):
    monkeypatch.delenv("AIMC_FORCE_CPU", raising=False)
    responses = iter([SimpleNamespace(returncode=0, stdout=b"GPU 0: NVIDIA"),
                      SimpleNamespace(returncode=1), SimpleNamespace(returncode=0),
                      SimpleNamespace(returncode=1)])
    monkeypatch.setattr(install_validation.subprocess, "run", lambda *a, **k: next(responses))
    with pytest.raises(RuntimeError, match="CUDA engine verification failed"):
        install_validation.prepare_cuda("generate")
