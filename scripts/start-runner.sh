#!/usr/bin/env bash
# Start hapi-power runner with correct environment
# Usage: ./scripts/start-runner.sh [--workspace-root <path>]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure dependencies
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  cd "$PROJECT_DIR" && bun install
fi

# Configure environment
export HAPI_POWER_HOME="${HAPI_POWER_HOME:-$HOME/.hapi-power}"
export HAPI_POWER_API_URL="${HAPI_POWER_API_URL:-http://localhost:3206}"

# Prevent proxy from intercepting localhost requests
# This is critical: without NO_PROXY, axios routes localhost through http_proxy, causing 502
export NO_PROXY="${NO_PROXY:+$NO_PROXY,}localhost,127.0.0.1"
export no_proxy="${no_proxy:-$NO_PROXY}"

# Default workspace root: user home directory
WORKSPACE_ROOT="${1:-$HOME}"

echo "[start-runner] HAPI_POWER_HOME=$HAPI_POWER_HOME"
echo "[start-runner] HAPI_POWER_API_URL=$HAPI_POWER_API_URL"
echo "[start-runner] NO_PROXY=$NO_PROXY"
echo "[start-runner] workspace-root=$WORKSPACE_ROOT"

cd "$PROJECT_DIR"
exec bun run cli/src/index.ts runner start --workspace-root "$WORKSPACE_ROOT"
