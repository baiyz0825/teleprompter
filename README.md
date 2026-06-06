# Teleprompter 提词器

独立提词器应用 — 单 Go 二进制 + 内嵌 React SPA + SQLite。

## 功能

- **稿件管理**: 创建、编辑、删除、搜索稿件（Markdown 格式）
- **提词器显示**: 逐字高亮滚动，阅读区域指示器
- **滚动模式**: 手动 / 自动(WPM 可调，5 档预设) / 语音跟读(FunASR)
- **镜像模式**: 水平翻转 / 垂直翻转（用于分光镜）
- **沉浸模式**: 全屏隐藏 UI，Esc 退出
- **进度保存**: 每个稿件的光标位置持久化
- **HTTPS 支持**: 自动生成自签名证书，支持麦克风权限

## 快速开始

### 本地开发

```bash
# 安装前端依赖
cd web && npm install && cd ..

# 开发模式
make dev   # 前端 Vite dev server + Go 后端

# 或者分别启动
cd web && npm run dev   # 前端 :5173
go run . -port 8080     # 后端 :8080
```

### 生产构建

```bash
make build                    # 构建前端 + Go 二进制
./teleprompter -port 8080     # HTTP 模式
./teleprompter -port 8080 --tls  # HTTPS 模式（自动生成自签名证书）
```

### 部署到远程服务器

```bash
# 一键部署（构建 + 上传 + systemd 配置）
bash deploy.sh

# 自定义参数
bash deploy.sh --host my-server --dir /opt/teleprompter --port 443
```

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go 1.22+ net/http |
| 数据库 | SQLite (modernc.org/sqlite, 纯 Go 无 CGO) |
| 前端 | React 19 + Vite + Tailwind CSS 4 |
| Markdown | @uiw/react-md-editor |
| 状态管理 | Zustand + localStorage |
| ASR | FunASR WebSocket |

## API

```
GET    /health               # 健康检查
GET    /api/scripts           # 稿件列表
POST   /api/scripts           # 创建稿件
GET    /api/scripts/{id}      # 获取稿件
PUT    /api/scripts/{id}      # 更新稿件
DELETE /api/scripts/{id}      # 删除稿件
GET    /api/settings          # 获取设置
PUT    /api/settings          # 更新设置
```

## 项目结构

```
teleprompter/
├── main.go                    # 入口, embed web/dist, HTTP/TLS 路由
├── deploy.sh                  # 一键部署脚本
├── internal/
│   ├── db/                    # SQLite 数据库操作
│   ├── handler/               # HTTP API handlers
│   └── model/                 # 数据模型
├── web/
│   ├── src/
│   │   ├── pages/             # 首页、编辑器
│   │   ├── components/        # 提词器、设置面板、稿件卡片
│   │   ├── lib/               # ASR 客户端、文本对齐、类型
│   │   ├── store/             # Zustand 状态管理
│   │   └── api/               # REST API 客户端
│   └── dist/                  # 构建产出 (go:embed 嵌入)
├── Makefile
├── CLAUDE.md
└── README.md
```

## 语音跟读

语音跟读模式使用 FunASR 实时语音识别，需要单独部署 FunASR 服务。

1. 部署 FunASR 服务（默认 `ws://localhost:7860/ws/stream`）
2. 在首页设置面板中配置 ASR 服务地址
3. 使用"测试连接"验证服务可用性
4. 在提词器中切换到"语音跟读"模式

**注意**: 麦克风权限需要 HTTPS 环境，使用 `--tls` 参数启用 HTTPS。

## License

MIT
