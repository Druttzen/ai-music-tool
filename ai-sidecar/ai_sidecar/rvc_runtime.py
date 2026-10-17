"""RVC's legacy Fairseq stack belongs to a separate Python 3.10 runtime."""
from pathlib import Path
import os
import platform
import subprocess

from . import managed_tools as tools


def install_runtime() -> None:
    root = tools.tool_root("vocal-rvc")
    constraints = root / "compatibility-constraints.txt"
    constraints.write_text(
        "torch==2.2.2\ntorchaudio==2.2.2\nnumpy==1.23.5\nnumba==0.60.0\n"
        "librosa==0.9.2\nsetuptools==75.8.2\ncython<3\n", encoding="utf-8")
    torch = ["torch==2.2.2", "torchaudio==2.2.2"]
    if platform.system() != "Darwin":
        torch += ["--index-url", "https://download.pytorch.org/whl/cpu"]
    tools.run(tools.command("vocal-rvc", "python", "-m", "pip", "install", "--only-binary=:all:", *torch), tool="vocal-rvc")
    tools.run(tools.command("vocal-rvc", "python", "-m", "pip", "install", "-c", str(constraints),
                            "setuptools==75.8.2", "cython==0.29.37", "wheel"), tool="vocal-rvc")
    tools.run(tools.command("vocal-rvc", "python", "-m", "pip", "install", "--no-build-isolation", "-c", str(constraints),
                            "rvc-python==0.1.5", "librosa==0.9.2", "numba==0.60.0", "huggingface_hub"), tool="vocal-rvc")
    tools.run(tools.command("vocal-rvc", "python", "-c", "from rvc_python.infer import RVCInference; print('RVC engine import verified')"), tool="vocal-rvc")
    # Download base encoders explicitly during installation; no user voice is selected.
    prepare = (
        "from huggingface_hub import hf_hub_download; import rvc_python,shutil; from pathlib import Path; "
        "dest=Path(rvc_python.__file__).parent/'base_model'; dest.mkdir(exist_ok=True); "
        "[shutil.copy2(hf_hub_download('Daswer123/RVC_Base',name),dest/name) "
        "for name in ('hubert_base.pt','rmvpe.pt','rmvpe.onnx')]"
    )
    tools.run(tools.command("vocal-rvc", "python", "-c", prepare), tool="vocal-rvc")


def available() -> bool:
    return tools.installed("vocal-rvc")


def convert(input_path: str, output_path: str, model: str, index: str | None, pitch: float) -> None:
    worker = Path(__file__).with_name("rvc_worker.py")
    if not worker.is_file():
        # PyInstaller keeps modules in its archive. The external interpreter
        # must use the editable package provisioned with the managed runtime.
        worker = tools.owned_path("sidecar", "pkg", "ai_sidecar", "rvc_worker.py")
    args = tools.command("vocal-rvc", "python", str(worker), "--input", input_path, "--output", output_path,
                         "--model", model, "--pitch", str(round(pitch)))
    if index:
        args += ["--index", index]
    result = subprocess.run(args, env=tools.tool_env("vocal-rvc"), cwd=tools.tool_root("vocal-rvc"),
                            capture_output=True, text=True, timeout=900,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    if result.returncode:
        raise RuntimeError("RVC conversion failed: " + result.stderr[-2000:])
