"""One-time download for offline draft comparison; use the Studio Python runtime."""
import argparse
import os

parser = argparse.ArgumentParser()
parser.add_argument("--cache-dir", required=True, help="Installed Studio sidecar/cache/huggingface folder")
args = parser.parse_args()
os.environ["HF_HOME"] = args.cache_dir
os.environ["HF_HUB_CACHE"] = args.cache_dir
os.environ.pop("HF_HUB_OFFLINE", None)
os.environ.pop("TRANSFORMERS_OFFLINE", None)

from transformers import ClapModel, ClapProcessor
from huggingface_hub import hf_hub_download
from pathlib import Path

model_id = "laion/clap-htsat-unfused"
processor = ClapProcessor.from_pretrained(model_id)
model = ClapModel.from_pretrained(model_id).eval().to("cpu")
config_path = Path(hf_hub_download(model_id, "config.json", local_files_only=True))
print(f"Offline draft ranker ready: {model_id}, revision {config_path.parent.name}")
