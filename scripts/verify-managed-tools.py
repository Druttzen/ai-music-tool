"""Real native-tool smoke checks; uses only the explicitly selected Studio data root."""
import json
from pathlib import Path
import subprocess

from ai_sidecar.managed_tools import command, configure, data_root, installed, tool_env

root = data_root()
for tool in ("mfa", "diffsinger", "java", "ffmpeg"):
    assert installed(tool), f"{tool} installation is incomplete"

exports = root / "exports"
exports.mkdir(parents=True, exist_ok=True)
wav = exports / "managed-ffmpeg-test.wav"
subprocess.run(command("ffmpeg", "ffmpeg", "-y", "-f", "lavfi", "-i",
                       "sine=frequency=440:duration=0.2", "-ar", "48000", str(wav)),
               env=tool_env("ffmpeg"), check=True, timeout=90)
assert wav.is_file() and wav.stat().st_size > 1000
probe = subprocess.run(command("ffmpeg", "ffprobe", "-v", "error", "-show_streams", "-of", "json", str(wav)),
                       env=tool_env("ffmpeg"), capture_output=True, check=True, timeout=90)
assert json.loads(probe.stdout)["streams"][0]["sample_rate"] == "48000"

source = exports / "StudioToolCheck.java"
source.write_text('class StudioToolCheck { public static void main(String[] args) { System.out.print("studio-java-ok"); } }', encoding="utf-8")
java = subprocess.run(command("java", "java", str(source)), env=tool_env("java"), capture_output=True, check=True, timeout=90)
assert b"studio-java-ok" in java.stdout

configure()
from ai_sidecar.vocal_align import mfa_ready
from ai_sidecar.diffsinger_openvpi import openvpi_root
assert mfa_ready()
assert openvpi_root() == root / "addons/diffsinger/source"
print(json.dumps({"dataRoot": str(root), "javaProgram": "passed", "ffmpeg48kHz": "passed", "mfa": "ready",
                  "diffsinger": "engine installed; voice checkpoints required"}))
