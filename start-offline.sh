#!/usr/bin/env bash
set -euo pipefail
# 离线部署包启动脚本
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/dist"
export PATH="$DIR/dist/node_modules/.bin:$PATH"
concurrently -n server,ui "node server/index.js" "vite preview --host 0.0.0.0 --port 4173"
