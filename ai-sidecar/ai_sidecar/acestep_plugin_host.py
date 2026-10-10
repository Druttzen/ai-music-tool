"""Private offline-only ACE-Step process. Provisioning is a separate explicit step."""
from __future__ import annotations
import argparse
import ipaddress
import os
from pathlib import Path
import socket
import sys

def loopback(host) -> bool:
    if host in {"localhost", b"localhost"}:
        return True
    try:
        return ipaddress.ip_address(host.decode() if isinstance(host, bytes) else host).is_loopback
    except ValueError:
        return False

def restrict_network() -> None:
    original_resolve = socket.getaddrinfo
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex
    def resolve(host, *args, **kwargs):
        if not loopback(host):
            raise OSError("Offline plugin: external network access is disabled")
        return original_resolve(host, *args, **kwargs)
    def connect(sock, address):
        if sock.family in (socket.AF_INET, socket.AF_INET6) and not loopback(address[0]):
            raise OSError("Offline plugin: external network access is disabled")
        return original_connect(sock, address)
    def connect_ex(sock, address):
        if sock.family in (socket.AF_INET, socket.AF_INET6) and not loopback(address[0]):
            return 10013 if os.name == "nt" else 13
        return original_connect_ex(sock, address)
    socket.getaddrinfo = resolve
    socket.socket.connect = connect
    socket.socket.connect_ex = connect_ex

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    root = Path(os.environ["STUDIO_DATA_DIR"]).resolve() / "addons" / "acestep" / "source"
    if Path.cwd().resolve() != root or root.resolve() != root:
        raise SystemExit("ACE-Step must run inside Studio’s internal plugin source directory")
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["MODELSCOPE_OFFLINE"] = "1"
    restrict_network()
    sys.path.insert(0, str(root))
    import uvicorn
    uvicorn.run("acestep.api_server:app", host="127.0.0.1", port=args.port, access_log=False)
