#!/bin/bash

echo "======================================"
echo "招财银行北京分行运营门户系统 - 后端启动脚本"
echo "======================================"
echo ""

# 检查 Python 版本
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "当前 Python 版本: $python_version"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  警告: .env 文件不存在"
    echo "正在从 .env.example 创建 .env 文件..."
    cp .env.example .env
    echo "✓ 已创建 .env 文件,请修改其中的配置"
    echo ""
fi

# 检查数据库连接
echo "正在检查数据库连接..."
python3 -c "
from app.core.config import get_settings
from sqlalchemy import create_engine
try:
    settings = get_settings()
    engine = create_engine(settings.database_url)
    conn = engine.connect()
    conn.close()
    print('✓ 数据库连接正常')
except Exception as e:
    print(f'✗ 数据库连接失败: {e}')
    print('请检查 .env 文件中的数据库配置')
    exit(1)
"

if [ $? -ne 0 ]; then
    echo "数据库连接失败,请先解决数据库问题"
    exit 1
fi

echo ""
echo "======================================"
echo "启动 FastAPI 服务..."
echo "======================================"
echo ""

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
