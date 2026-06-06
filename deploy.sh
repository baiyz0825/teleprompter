#!/usr/bin/env bash
set -euo pipefail

# ─── 配置 ───────────────────────────────────────────────
SSH_HOST="${SSH_HOST:-dual-gpu-server}"
REMOTE_DIR="${REMOTE_DIR:-/root/teleprompter}"
SERVICE_NAME="teleprompter"
BINARY_NAME="teleprompter"
PORT="${PORT:-8080}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── 颜色输出 ───────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── 解析参数 ───────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)     SSH_HOST="$2";     shift 2 ;;
    --dir)      REMOTE_DIR="$2";   shift 2 ;;
    --port)     PORT="$2";         shift 2 ;;
    --help|-h)
      echo "用法: $0 [选项]"
      echo ""
      echo "选项:"
      echo "  --host <host>    SSH 主机别名或地址 (默认: dual-gpu-server)"
      echo "  --dir  <path>    远程部署目录 (默认: /root/teleprompter)"
      echo "  --port <port>    服务监听端口 (默认: 8080)"
      echo "  -h, --help       显示帮助"
      exit 0
      ;;
    *) error "未知参数: $1" ;;
  esac
done

# ─── 步骤 1: 构建前端 ──────────────────────────────────
info "构建前端资源..."
cd "$SCRIPT_DIR/web"
npm run build
info "前端构建完成"

# ─── 步骤 2: 交叉编译 Go 二进制 ────────────────────────
info "交叉编译 Go 二进制 (linux/amd64)..."
cd "$SCRIPT_DIR"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o "${BINARY_NAME}" .
BINARY_SIZE=$(du -h "${BINARY_NAME}" | cut -f1)
info "二进制构建完成 (${BINARY_SIZE})"

# ─── 步骤 3: 创建远程目录 ──────────────────────────────
info "创建远程目录 ${REMOTE_DIR}..."
ssh -F ~/.ssh/config "${SSH_HOST}" "mkdir -p ${REMOTE_DIR}"

# ─── 步骤 4: 上传文件 ─────────────────────────────────
info "上传二进制文件..."
scp -F ~/.ssh/config "${SCRIPT_DIR}/${BINARY_NAME}" "${SSH_HOST}:${REMOTE_DIR}/${BINARY_NAME}"

info "上传完成"

# ─── 步骤 5: 创建 systemd 服务 ─────────────────────────
info "配置 systemd 服务..."
ssh -F ~/.ssh/config "${SSH_HOST}" bash <<REMOTE_EOF
set -euo pipefail

# 停止旧服务（如果存在）
systemctl stop ${SERVICE_NAME} 2>/dev/null || true

# 设置可执行权限
chmod +x ${REMOTE_DIR}/${BINARY_NAME}

# 创建 systemd service 文件
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Teleprompter Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}
ExecStart=${REMOTE_DIR}/${BINARY_NAME} -port ${PORT} --tls
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 重载 systemd 配置
systemctl daemon-reload

# 启用开机自启
systemctl enable ${SERVICE_NAME}

# 启动服务
systemctl start ${SERVICE_NAME}

# 等待启动
sleep 2

# 检查状态
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "✅ 服务启动成功"
    systemctl status ${SERVICE_NAME} --no-pager -l
else
    echo "❌ 服务启动失败"
    journalctl -u ${SERVICE_NAME} --no-pager -n 20
    exit 1
fi
REMOTE_EOF

info "部署完成！"
echo ""
echo "────────────────────────────────────────"
echo "  服务地址: https://192.168.9.207:${PORT}"
echo "  部署目录: ${REMOTE_DIR}"
echo "  服务名称: ${SERVICE_NAME}"
echo ""
echo "  常用命令:"
echo "    ssh ${SSH_HOST} systemctl status ${SERVICE_NAME}"
echo "    ssh ${SSH_HOST} journalctl -u ${SERVICE_NAME} -f"
echo "    ssh ${SSH_HOST} systemctl restart ${SERVICE_NAME}"
echo "────────────────────────────────────────"
