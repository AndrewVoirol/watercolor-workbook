#!/usr/bin/env bash
# ==============================================================================
# Chrome Dev Agent Launcher (macOS)
# Optimized for WebGPU, HTML-in-Canvas, WebNN, Skia Graphite, & CDP / DevTools MCP
# ==============================================================================

set -euo pipefail

# 1. Locate Chrome Binary
CHROME_BIN=""
if [ -d "/Applications/Google Chrome Dev.app" ]; then
  CHROME_BIN="/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev"
elif [ -d "/Applications/Google Chrome Canary.app" ]; then
  CHROME_BIN="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
elif [ -d "/Applications/Google Chrome Beta.app" ]; then
  CHROME_BIN="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta"
elif [ -d "/Applications/Google Chrome.app" ]; then
  CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi

if [ -z "$CHROME_BIN" ] || [ ! -f "$CHROME_BIN" ]; then
  echo "Error: No Google Chrome installation found in /Applications" >&2
  exit 1
fi

# 2. Configuration
PORT="${CHROME_PORT:-9222}"
PROFILE_DIR="${CHROME_PROFILE_DIR:-$HOME/.config/chrome-agent-profile}"
mkdir -p "$PROFILE_DIR"

TARGET_URL="${1:-http://localhost:5173}"
shift || true

echo "🚀 Launching Chrome ($(basename "$(dirname "$(dirname "$(dirname "$CHROME_BIN")")")")) on CDP port $PORT..."
echo "📂 Profile: $PROFILE_DIR"
echo "🌐 Target URL: $TARGET_URL"

# 3. Launch with full WebGPU, Metal ANGLE, HTML-in-Canvas, WebNN, and CDP flags
exec "$CHROME_BIN" \
  --remote-debugging-port="$PORT" \
  --remote-allow-origins="*" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --use-angle=metal \
  --enable-unsafe-webgpu \
  --ignore-gpu-blocklist \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --enable-experimental-web-platform-features \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --enable-features=WebGPU,DefaultANGLEMetal,CanvasOopRasterization,CanvasDrawElement,SkiaGraphite,WebMachineLearningNeuralNetwork,WebNNCoreML,PromptAPIForGeminiNano,WriterAPI,RewriterAPI,SummarizerAPI \
  "$TARGET_URL" "$@"
