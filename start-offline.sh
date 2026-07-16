#!/usr/bin/env bash
set -euo pipefail
# 离线部署包启动脚本
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/dist"
export PATH="$DIR/dist/node_modules/.bin:$PATH"
# 修复解压后丢失的执行权限
chmod +x node_modules/.bin/* 2>/dev/null || true
find node_modules -name "*.node" -type f -exec chmod +x {} \; 2>/dev/null || true
# 预览时 --base 固定为 /，因为 Nginx rewrite 会去掉路径前缀
concurrently -n server,ui "node server/index.js" "vite preview --config vite.config.ts --base / --host 0.0.0.0 --port 4173"
