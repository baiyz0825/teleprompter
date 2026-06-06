# Teleprompter

独立提词器应用 — 单 Go 二进制 + 内嵌 React SPA + SQLite。

## 开发命令

```bash
# 前端开发（热更新）
cd web && npm run dev

# 前端构建
cd web && npm run build

# 后端构建
go build -o teleprompter .

# 完整构建 + 运行（HTTP）
make build && ./teleprompter -port 8080

# 启用 HTTPS（自动生成自签名证书）
./teleprompter -port 8080 --tls

# 指定证书路径
./teleprompter -port 8080 --tls --cert /path/to/cert.pem --key /path/to/key.pem

# 一键部署到远程服务器
bash deploy.sh --host dual-gpu-server --dir /root/teleprompter

# 开发模式（前后端分开跑）
make dev   # 启动 Go 后端 + Vite 前端 dev server
```

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go 1.22+ net/http |
| 数据库 | SQLite (modernc.org/sqlite, 纯 Go 无 CGO) |
| 前端 | React 19 + Vite + Tailwind CSS 4 |
| Markdown 编辑器 | @uiw/react-md-editor |
| 状态管理 | Zustand + localStorage |
| ASR | FunASR WebSocket (ws://localhost:7860/ws/stream) |

## 项目结构

```
teleprompter/
├── main.go                    # 入口, embed web/dist, HTTP 路由
├── internal/
│   ├── db/
│   │   ├── db.go              # SQLite 初始化 + 建表
│   │   ├── scripts.go         # 稿件 CRUD
│   │   └── settings.go        # 设置读写
│   ├── handler/
│   │   ├── scripts.go         # /api/scripts REST handlers
│   │   ├── settings.go        # /api/settings handlers
│   │   └── static.go          # 嵌入式 SPA 静态文件服务
│   └── model/
│       └── model.go           # 数据模型
├── web/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx       # 首页 - 稿件列表
│   │   │   └── Editor.tsx     # Markdown 编辑器
│   │   ├── components/
│   │   │   ├── TeleprompterView.tsx  # 提词器主视图
│   │   │   ├── SettingsPanel.tsx     # 设置面板
│   │   │   └── ScriptCard.tsx        # 稿件卡片
│   │   ├── lib/
│   │   │   ├── asr-client.ts  # FunASR WebSocket + AudioCapture
│   │   │   ├── alignment.ts   # ASR 文本对齐引擎
│   │   │   └── types.ts       # TypeScript 类型定义
│   │   ├── store/index.ts     # Zustand 状态管理
│   │   └── api/index.ts       # REST API 客户端
│   └── dist/                  # 构建产出 (go:embed 嵌入)
├── Makefile
└── CLAUDE.md
```

## API 端点

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

## 路由

- `/` — 首页（稿件列表）
- `/editor/{id}` — Markdown 编辑器
- `/prompter/{id}` — 提词器视图

## 提词器功能

- **滚动模式**: 手动 / 自动(WPM 可调) / 语音跟读(FunASR)
- **镜像模式**: 水平翻转 / 垂直翻转（用于分光镜）
- **沉浸模式**: 全屏隐藏 UI，Esc 退出
- **进度保存**: 每个稿件的光标位置持久化到 localStorage

## 部署

```bash
# 一键部署（前端构建 + 交叉编译 + 上传 + systemd 配置）
bash deploy.sh

# 自定义部署参数
bash deploy.sh --host my-server --dir /opt/teleprompter --port 443
```

远程服务使用 systemd 管理，开机自启，启用 HTTPS（自签名证书自动生成）。

## 注意事项

- 所有 UI 文本使用中文
- Go 二进制内嵌前端资源，修改前端后必须 `cd web && npm run build` 再 `go build`
- SQLite 数据库文件默认 `teleprompter.db`，在项目根目录
- `web/dist/` 必须存在才能 `go build`（否则需要先 `cd web && npm run build`）
- HTTPS 模式下自动生成自签名证书（`cert.pem` / `key.pem`），首次访问需接受浏览器安全警告
- 麦风权限需要 HTTPS（安全上下文），HTTP 下浏览器会阻止 `getUserMedia()`
