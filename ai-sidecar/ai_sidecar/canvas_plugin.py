"""Offline Canvas rendering inside Studio's managed Python sidecar runtime."""
from __future__ import annotations
import json
import math
import os
from pathlib import Path
import shutil
import sys
import tempfile
from .internal_plugins import activate, active_plugin, plugin_root

def render(handoff_path: Path) -> Path:
    root = active_plugin("canvas")
    if not root:
        raise RuntimeError("Activate the internal Canvas plugin in Plugins")
    data = Path(os.environ["STUDIO_DATA_DIR"]).resolve()
    if handoff_path.resolve() != data / "handoff.json":
        raise ValueError("Canvas only reads Studio's handoff")
    handoff = json.loads(handoff_path.read_text(encoding="utf-8"))
    image_path = Path(handoff["track"]["albumArtPath"])
    if not image_path.resolve().is_relative_to(data / "exports"):
        raise ValueError("Artwork must be inside Studio's exports")
    import av
    import numpy as np
    from PIL import Image, ImageOps
    duration = max(3, min(8, int(handoff.get("canvas", {}).get("durationSec", 8))))
    width, height, fps = 720, 1280, 30
    with Image.open(image_path) as image:
        image = ImageOps.exif_transpose(image)
        image = ImageOps.fit(image.convert("RGB"), (width, height))
    fd, name = tempfile.mkstemp(suffix=".mp4", dir=root)
    os.close(fd)
    temp = Path(name)
    try:
        with av.open(str(temp), "w", format="mp4") as output:
            stream = output.add_stream("libx264", rate=fps)
            stream.width, stream.height = width, height
            stream.pix_fmt = "yuv420p"
            stream.options = {"crf": "18", "preset": "fast"}
            for i in range(duration * fps):
                # Periodic zoom returns smoothly to the first frame for a clean loop.
                zoom = 1 + 0.04 * (1 - math.cos(2 * math.pi * i / (duration * fps)))
                resized = image.resize((round(width * zoom), round(height * zoom)), Image.Resampling.LANCZOS)
                x, y = (resized.width - width) // 2, (resized.height - height) // 2
                frame = av.VideoFrame.from_ndarray(np.asarray(resized.crop((x, y, x + width, y + height))), format="rgb24")
                for packet in stream.encode(frame):
                    output.mux(packet)
            for packet in stream.encode():
                output.mux(packet)
        dest = data / "exports" / f"canvas-{image_path.stem}.mp4"
        shutil.copyfile(temp, dest)
        os.replace(temp, root / "preview.mp4")
        return dest
    finally:
        temp.unlink(missing_ok=True)

if __name__ == "__main__":
    if sys.argv[1:] == ["--install"]:
        import av
        from PIL import Image
        _ = (av, Image)
        activate("canvas")
    elif len(sys.argv) == 2:
        print(render(Path(sys.argv[1])))
    else:
        raise SystemExit("Unsupported Canvas plugin action")
