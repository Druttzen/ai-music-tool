"""Remove stale PyInstaller ``_MEI*`` folders left in the sidecar temp dir.

The folder for the running process (``sys._MEIPASS``) is kept. Folders still
locked by another sidecar fail ``rmtree`` and are skipped.
"""

from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path


def cleanup_stale_mei_dirs() -> int:
    live = getattr(sys, "_MEIPASS", "") or ""
    live_resolved: Path | None = None
    if live:
        try:
            live_resolved = Path(live).resolve()
        except OSError:
            live_resolved = None

    roots: list[Path] = [Path(tempfile.gettempdir())]
    if live_resolved is not None:
        roots.append(live_resolved.parent)

    removed = 0
    seen: set[str] = set()
    for root in roots:
        try:
            if not root.is_dir():
                continue
            children = list(root.glob("_MEI*"))
        except OSError:
            continue
        for child in children:
            try:
                if not child.is_dir():
                    continue
                resolved = child.resolve()
            except OSError:
                continue
            key = str(resolved)
            if key in seen:
                continue
            seen.add(key)
            if live_resolved is not None and resolved == live_resolved:
                continue
            try:
                shutil.rmtree(child)
                removed += 1
            except OSError:
                continue
    return removed
