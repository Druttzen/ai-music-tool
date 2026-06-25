"""Entry point for the packaged AI sidecar (PyInstaller one-file binary)."""

from __future__ import annotations

import multiprocessing
import sys


def main() -> None:
    import uvicorn

    host = "127.0.0.1"
    port = 8723
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--host" and i + 1 < len(args):
            host = args[i + 1]
            i += 2
            continue
        if args[i] == "--port" and i + 1 < len(args):
            port = int(args[i + 1])
            i += 2
            continue
        i += 1

    uvicorn.run(
        "ai_sidecar.main:app",
        host=host,
        port=port,
        log_level="warning",
        access_log=False,
    )


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
