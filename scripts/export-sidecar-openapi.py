"""Export actual FastAPI schemas without launching a server or loading AI models."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai-sidecar"))

from ai_sidecar.main import app  # noqa: E402

print(json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=True))
