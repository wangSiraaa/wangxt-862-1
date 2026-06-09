#!/usr/bin/env bash
set -euo pipefail

PORT=9528
cd "$(dirname "$0")/.."

echo "============================================"
echo "🚀 布控网格热力图 · 离线指挥中心"
echo "============================================"
echo "📁 $(pwd)"
echo "🔌 端口: $PORT"
echo ""

if [ ! -d node_modules ]; then
  echo "📦 首次启动：安装依赖..."
  npm install --no-audit --no-fund
fi

echo ""
echo "🌐 开发服务器启动中，请稍候..."
echo "   浏览器打开: http://localhost:$PORT"
echo ""

npm run dev
