# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro-onnx>=0.4.0", "soundfile"]
# ///
"""Batch text-to-speech with Kokoro (local, offline after the first model download).

Reads a JSON job on stdin: {"voice", "speed", "lang", "items": [{"text", "out"}]}
and writes one WAV per item.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]


def model_dir() -> Path:
    base = os.environ.get("DOCENT_MODEL_DIR") or Path.home() / ".cache" / "docent" / "models"
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path


def fetch(name: str, dest: Path) -> None:
    if dest.exists():
        return
    print(f"narration: downloading {name} (first run only)", file=sys.stderr, flush=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    urllib.request.urlretrieve(f"{RELEASE}/{name}", tmp)
    tmp.rename(dest)


def main() -> None:
    job = json.load(sys.stdin)
    models = model_dir()
    for name in FILES:
        fetch(name, models / name)

    import soundfile as sf
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(str(models / FILES[0]), str(models / FILES[1]))
    for item in job["items"]:
        samples, rate = kokoro.create(
            item["text"],
            voice=job.get("voice") or "af_heart",
            speed=float(job.get("speed") or 1.0),
            lang=job.get("lang") or "en-us",
        )
        sf.write(item["out"], samples, rate)


if __name__ == "__main__":
    main()
