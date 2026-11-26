#!/usr/bin/env bash
# One-time setup for Docent's walkthrough skill.
# Dependencies go in ~/.cache/docent (override with DOCENT_HOME) so they survive plugin updates.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
home="${DOCENT_HOME:-$HOME/.cache/docent}"

missing=0
need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing: $1  ->  $2"
    missing=1
  fi
}
need node    "install Node.js 20 or newer"
need ffmpeg  "brew install ffmpeg   (Linux: apt install ffmpeg)"
need ffprobe "installed together with ffmpeg"
need python3 "install Python 3 (used to run terminal scenes)"
need uv      "brew install uv   (runs the Kokoro narration voice)"
[ "$missing" -eq 0 ] || { echo "Install the tools above, then run this script again."; exit 1; }

mkdir -p "$home/node"
cp "$here/package.json" "$here/package-lock.json" "$home/node/"
cd "$home/node"
npm ci --no-audit --no-fund
npx playwright install chromium
echo "Docent is ready. Dependencies are in $home"
