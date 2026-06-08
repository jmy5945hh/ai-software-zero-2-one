#!/bin/bash
set -e

echo "开始部署 agent-server..."

# 执行 git pull
echo "1. 执行 git pull..."
git pull

# 重启 pm2 的 agent-server 应用
echo "2. 重启 pm2 agent-server..."
pm2 restart agent-server

# 打印观测日志
echo "3. 打印观测日志..."
pm2 logs agent-server --lines 50

echo "部署完成！"