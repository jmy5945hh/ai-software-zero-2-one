#!/bin/bash

# 检查是否安装了Python
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.10+ first."
    exit 1
fi

# 创建虚拟环境
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
echo "Installing dependencies..."
pip install -r requirements.txt

# 检查是否存在.env文件，如果不存在则从.env.example复制
if [ ! -f ".env" ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "Please update the .env file with your actual configuration."
fi

# 启动应用
echo "Starting application..."
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
