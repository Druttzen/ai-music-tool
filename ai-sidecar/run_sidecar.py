"""Entry point for the packaged AI sidecar (PyInstaller one-file binary)."""

from __future__ import annotations

import multiprocessing
import os
import sys

from ai_sidecar.idle import configure_idle_exit


def main() -> None:
    import uvicorn

    host = "127.0.0.1"
    port = 8723
    idle_exit_sec = float(os.environ.get("SIDECAR_IDLE_EXIT_SEC", "300"))
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
        if args[i] == "--idle-exit-sec" and i + 1 < len(args):
            idle_exit_sec = float(args[i + 1])
            i += 2
            continue
        i += 1

    configure_idle_exit(idle_exit_sec)
    os.environ["SIDECAR_IDLE_EXIT_SEC"] = str(idle_exit_sec)

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
