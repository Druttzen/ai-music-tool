"""Local instruction planning, with an owned short-lived llama.cpp runtime."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import tempfile
import time
from typing import Any

MODEL_NAME = "Qwen3-4B-Q4_K_M"
MODEL_BYTES = 2497280256
MODEL_SHA256 = "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
_VERIFIED: tuple | None = None


def composer_home() -> Path:
    override = os.environ.get("AIMC_COMPOSER_HOME", "").strip()
    if override:
        return Path(override)
    data = os.environ.get("STUDIO_DATA_DIR", "").strip()
    if data:
        return Path(data) / "sidecar" / "cache" / "local-composer"
    hf = os.environ.get("HF_HOME", "").strip()
    if hf:
        return Path(hf).parent / "local-composer"
    return Path.home() / ".cache" / "ai-music" / "local-composer"


def instruction_composer_available() -> bool:
    home = composer_home()
    model = home / (MODEL_NAME + ".gguf")
    executable = home / "runtime" / ("llama-server.exe" if os.name == "nt" else "llama-server")
    try:
        return executable.is_file() and model.is_file() and model.stat().st_size == MODEL_BYTES
    except OSError:
        return False


def verify_model(model: Path) -> None:
    global _VERIFIED
    stat = model.stat()
    stamp = (str(model.resolve()), stat.st_size, stat.st_mtime_ns)
    if _VERIFIED == stamp:
        return
    digest = hashlib.sha256()
    with model.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    if stat.st_size != MODEL_BYTES or digest.hexdigest() != MODEL_SHA256:
        raise RuntimeError("Local composer checkpoint verification failed; reinstall the composer model")
    _VERIFIED = stamp


def plan_schema(*, instrumental: bool, lyrics: str, language: str, duration_sec: float = 60) -> dict[str, Any]:
    properties = {
        "caption": {"type": "string"}, "motif": {"type": "string"},
        "harmony": {"type": "string"},
        "arrangement": {"type": "array", "items": {"type": "object", "properties": {
            "start_sec": {"type": "number", "minimum": 0, "maximum": duration_sec},
            "end_sec": {"type": "number", "minimum": 0, "maximum": duration_sec},
            "direction": {"type": "string"}}, "required": ["start_sec", "end_sec", "direction"],
            "additionalProperties": False}, "minItems": 2, "maxItems": 6},
        "bpm": {"type": "integer", "minimum": 30, "maximum": 300},
        "key_scale": {"type": "string"},
        "time_signature": {"type": "string", "enum": ["2", "3", "4", "6"]},
        "vocal_language": {"type": "string", "const": language},
        "lyrics": {"type": "string"},
    }
    if instrumental or lyrics.strip():
        properties["lyrics"]["const"] = "[Instrumental]" if instrumental else lyrics
    else:
        # Bound output inside constrained decoding, before accepting a proposal.
        properties["lyrics"].update(minLength=1, maxLength=int(duration_sec * 12))
    return {"type": "object", "properties": properties,
            "required": list(properties), "additionalProperties": False}


def validate_plan(plan: Any, *, duration_sec: float, instrumental: bool,
                  lyrics: str, language: str) -> str:
    if not isinstance(plan, dict):
        return "The plan must be an object"
    for field in ("caption", "motif", "harmony", "key_scale", "lyrics"):
        if not isinstance(plan.get(field), str) or not plan[field].strip():
            return f"Missing {field}"
    if plan.get("vocal_language") != language:
        return "Use exactly the selected vocal language"
    if not isinstance(plan.get("bpm"), int) or isinstance(plan["bpm"], bool) or not 30 <= plan["bpm"] <= 300:
        return "Tempo must be 30–300 BPM"
    if plan.get("time_signature") not in {"2", "3", "4", "6"}:
        return "Use a supported meter"
    if not re.search(r"\b(?:[A-G][#b]?(?:m|maj|min|dim|sus|add)?\d*|I{1,3}|IV|VI{0,2}|i{1,3}|iv|vi{0,2})\b", plan["harmony"]):
        return "Harmony needs real named chords or Roman numerals (for example Am–F–C–G or i–VI–III–VII), not numeric placeholders"
    sections = plan.get("arrangement")
    if not isinstance(sections, list) or not 2 <= len(sections) <= 6:
        return "Write two to six arrangement sections"
    end = 0
    for section in sections:
        if not isinstance(section, dict) or not isinstance(section.get("direction"), str) or not section["direction"].strip():
            return "Each section needs timing and a musical direction"
        start, stop = section.get("start_sec"), section.get("end_sec")
        if not isinstance(start, (int, float)) or not isinstance(stop, (int, float)) or start != end or not start < stop <= duration_sec:
            return "Sections must be contiguous, start at zero and stay within the requested duration"
        end = stop
    if end != duration_sec:
        return "The final section must end at the requested duration"
    words = plan["lyrics"]
    if instrumental:
        return "Use [Instrumental] without sung words" if words != "[Instrumental]" else ""
    if lyrics.strip():
        return "Keep the supplied lyrics unchanged" if words != lyrics else ""
    count = len(re.sub(r"\[[^\]]*\]", "", words).split())
    if count < 1 or count > int(duration_sec * 2):
        return f"Write at most {int(duration_sec * 2)} sung words; the last proposal had {count}"
    tags = re.findall(r"\[(en|sv|de|es|fr|zh|ja|ko|ru|ar|pt|it|hi)\]", words)
    if any(tag != language for tag in tags):
        return "Remove words and tags from other languages"
    if language in {"en", "sv", "de", "es", "fr"} and re.search(r"[\u3400-\u9fff]", words):
        return "Write in the selected Latin language"
    return ""


def _stream_json(client, url: str, headers: dict, body: dict, check_cancelled) -> dict:
    content = []
    with client.stream("POST", url + "/v1/chat/completions", headers=headers, json=body) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if check_cancelled:
                check_cancelled()
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            event = json.loads(line[6:])
            if event.get("error"):
                raise RuntimeError("Local instruction inference failed")
            for choice in event.get("choices", []):
                token = choice.get("delta", {}).get("content")
                if token:
                    content.append(token)
    try:
        return json.loads("".join(content))
    except (ValueError, TypeError) as exc:
        raise RuntimeError("Local composer returned an incomplete JSON plan") from exc


def plan_with_instructions(prompt: str, *, duration_sec: float, instrumental: bool,
                           lyrics: str, language: str, bpm: int | None = None,
                           key_scale: str = "", on_progress=None, check_cancelled=None) -> dict[str, Any]:
    import httpx

    if not instruction_composer_available():
        raise RuntimeError("Instruction composer not installed — run npm run sidecar:composer")
    home = composer_home()
    model = home / (MODEL_NAME + ".gguf")
    executable = home / "runtime" / ("llama-server.exe" if os.name == "nt" else "llama-server")
    if check_cancelled:
        check_cancelled()
    verify_model(model)
    with socket.socket() as port_reservation:
        port_reservation.bind(("127.0.0.1", 0))
        port = port_reservation.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    token = secrets.token_urlsafe(32)
    env = os.environ.copy()
    env["LLAMA_API_KEY"] = token
    cuda_runtime = (home / "runtime" / "ggml-cuda.dll").is_file()
    gpu_layers = os.environ.get("AIMC_COMPOSER_GPU_LAYERS", "all" if cuda_runtime else "0")
    if gpu_layers != "all":
        gpu_layers = str(max(0, min(int(gpu_layers), 99)))
    threads = max(1, min(int(os.environ.get("AIMC_COMPOSER_THREADS", (os.cpu_count() or 2) // 2)), 32))
    cmd = [str(executable), "--model", str(model), "--host", "127.0.0.1", "--port", str(port),
           "--alias", MODEL_NAME, "--ctx-size", "4096", "--parallel", "1",
           "--gpu-layers", gpu_layers, "--threads", str(threads), "--threads-batch", str(threads),
           "--jinja", "--reasoning", "on", "--reasoning-budget", "1024"]
    log_dir = tempfile.TemporaryDirectory(prefix="aimc-composer-")
    runtime_log = Path(log_dir.name) / "runtime.log"
    cmd.extend(["--log-file", str(runtime_log), "--log-verbosity", "5"])
    log = tempfile.TemporaryFile(mode="w+b")
    try:
        process = subprocess.Popen(cmd, cwd=str(executable.parent), env=env,
            stdin=subprocess.DEVNULL, stdout=log, stderr=log,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    except OSError:
        log.close()
        log_dir.cleanup()
        raise
    try:
        if on_progress:
            on_progress(0.10, "Loading the local instruction composer")
        with httpx.Client(timeout=180) as client:
            deadline = time.monotonic() + 90
            while True:
                if check_cancelled:
                    check_cancelled()
                if process.poll() is not None:
                    raise RuntimeError("Local composer runtime could not start; check the cached runtime and GPU memory")
                try:
                    response = client.get(url + "/health", timeout=1)
                    if response.status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                if time.monotonic() >= deadline:
                    raise RuntimeError("Local composer startup timed out")
                time.sleep(0.2)
            instruction = (
                "You are a music composer. Develop the user's idea into a coherent, distinctive song plan. "
                "Keep the requested genre, instruments, mood and language. Design a recurring melodic motif, "
                "a harmonic progression, contrasting sections and a deliberate ending within the requested duration. "
                "Write an English caption suitable for a music generation model. Write sung words only in the "
                "selected language. For short songs write only a few lines: 30 seconds needs 20–40 sung words. "
                "Never write full-length lyrics for a short clip. Include exact section timings that sum to the "
                "requested duration. Use the same key and meter across the metadata and harmony. "
                "The harmony field must name actual chords in order (e.g. Am–F–C–G or C–G–Am–F), "
                "never numeric placeholders like 12-12-12-12. Give the motif concise note names and rhythm; "
                "omit theoretical interval explanations. "
                "For instrumental music use [Instrumental]. Return only the JSON plan.")
            request = {"idea": prompt, "duration_seconds": duration_sec, "instrumental": instrumental,
                       "vocal_language": language, "supplied_lyrics": lyrics,
                       "maximum_sung_words": int(duration_sec * 2), "maximum_lyrics_characters": int(duration_sec * 12),
                       "locked_bpm": bpm, "locked_key": key_scale}
            feedback = ""
            for attempt in range(3):
                if on_progress:
                    on_progress(0.12, f"AI designing motif, harmony and arrangement ({attempt + 1}/3)")
                body = {"model": MODEL_NAME, "messages": [
                    {"role": "system", "content": instruction},
                    {"role": "user", "content": json.dumps(request, ensure_ascii=False) + feedback}],
                    "stream": True, "temperature": 0.7, "top_p": 0.8, "top_k": 20,
                    "max_tokens": 3072,
                    "response_format": {"type": "json_object", "schema": plan_schema(instrumental=instrumental, lyrics=lyrics, language=language, duration_sec=duration_sec)}}
                plan = _stream_json(client, url, {"Authorization": "Bearer " + token}, body, check_cancelled)
                problem = validate_plan(plan, duration_sec=duration_sec, instrumental=instrumental, lyrics=lyrics, language=language)
                if not problem:
                    break
                feedback = "\nRevise your proposal: " + problem
            else:
                raise RuntimeError("Local AI could not produce a valid composition plan: " + problem)
        if bpm is not None:
            plan["bpm"] = bpm
        if key_scale:
            plan["key_scale"] = key_scale
        log.seek(0)
        runtime_text = log.read().decode("utf-8", errors="replace")
        if runtime_log.exists():
            runtime_text += runtime_log.read_text(encoding="utf-8", errors="replace")
        runtime_text = re.sub(r"\x1b\[[0-9;]*m", "", runtime_text)
        layers = re.findall(r"offloaded (\d+)/\d+ layers", runtime_text)
        actual_layers = int(layers[-1]) if layers else 0
        plan["arrangement"] = [f'{s["start_sec"]:g}–{s["end_sec"]:g}s: {s["direction"]}' for s in plan["arrangement"]]
        return {**plan, "planner_model": MODEL_NAME, "planner_device": "cuda" if actual_layers else "cpu",
                "planner_gpu_layers": actual_layers}
    except httpx.HTTPError as exc:
        raise RuntimeError("Local instruction composer request failed") from exc
    finally:
        # Release this model before the semantic planner and DiT use the GPU.
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)
        log.close()
        log_dir.cleanup()
