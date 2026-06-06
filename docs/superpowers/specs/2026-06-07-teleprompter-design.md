# Teleprompter - Standalone Design Spec

## Overview

A standalone teleprompter application built as a single Go binary with embedded React SPA. No external dependencies at runtime (no Node.js, no PostgreSQL). SQLite for persistence, FunASR WebSocket for ASR.

## Architecture

```
┌─────────────────────────────────────┐
│           Go Binary                 │
│  ┌───────────┐  ┌────────────────┐  │
│  │ HTTP API  │  │ Static Files   │  │
│  │ /api/*    │  │ (embedded SPA) │  │
│  └─────┬─────┘  └───────┬────────┘  │
│        │                │           │
│  ┌─────┴─────┐          │           │
│  │  SQLite   │          │           │
│  └───────────┘          │           │
└─────────────────────────┼───────────┘
                          │
            ┌─────────────┴──────────┐
            │     Browser (SPA)      │
            │  React + Tailwind      │
            │  Markdown Editor       │
            │  Teleprompter View     │
            │  ASR WebSocket Client  │
            └────────────┬───────────┘
                         │ WebSocket
                         ▼
              ┌─────────────────────┐
              │   FunASR Service    │
              │  (external, user-   │
              │   configurable)     │
              └─────────────────────┘
```

## Features to Keep (from existing code/)

1. **Script Management**: CRUD for scripts (title + markdown content)
2. **Teleprompter Display**: Full-screen text scrolling with reading area indicator
3. **Scroll Modes**:
   - Manual: drag/tap to scroll
   - Auto: constant speed scrolling (configurable WPM)
   - ASR: FunASR WebSocket real-time speech following
4. **Mirror Modes**: Horizontal flip (for beam splitter), Vertical flip
5. **Settings Panel**: Font size, line height, padding, responsive presets
6. **Responsive Design**: Mobile-first, landscape lock on mobile
7. **Progress Tracking**: Cursor position saved per script

## Features to Remove

- 飞书/妙搭 SDK dependencies (`@lark-apaas/*`)
- Sherpa-onnx local WASM ASR
- Cloud ASR mode
- Feishu proxy APIs
- Tiptap rich text editor (replaced with Markdown)
- AI text optimization plugin
- Temporary browser-only scripts (all scripts persisted to SQLite)

## API Design

### REST Endpoints

```
GET    /api/scripts          - List all scripts
POST   /api/scripts          - Create script
GET    /api/scripts/:id      - Get script
PUT    /api/scripts/:id      - Update script
DELETE /api/scripts/:id      - Delete script
GET    /api/settings         - Get global settings
PUT    /api/settings         - Update global settings
GET    /health               - Health check
```

### WebSocket Protocol (FunASR compatible)

```
Client → Server:
  {"type": "config", "model": "sensevoice", "language": "zh"}
  {"type": "audio", "data": "<base64-encoded-pcm-chunk>"}
  {"type": "end"}

Server → Client:
  {"type": "config_ack", "model": "...", "language": "..."}
  {"type": "result", "text": "...", "is_final": false, "timestamp": 0.0}
  {"type": "error", "message": "..."}
```

## Data Model

### scripts table
```sql
CREATE TABLE scripts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  cover_image TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### settings table
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22+ net/http |
| Database | SQLite (modernc.org/sqlite, pure Go) |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| Markdown | @uiw/react-md-editor or similar |
| ASR Client | Native WebSocket API |
| Build | Go embed for static files |
| Deploy | Single binary |

## Directory Structure

```
teleprompter/
├── main.go
├── go.mod
├── go.sum
├── internal/
│   ├── db/
│   │   ├── db.go           # SQLite init + migrations
│   │   └── scripts.go      # Script CRUD
│   ├── handler/
│   │   ├── scripts.go      # Script API handlers
│   │   ├── settings.go     # Settings API handlers
│   │   └── static.go       # SPA static file serving
│   └── model/
│       └── model.go        # Data models
├── web/                     # React SPA source
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   │   └── index.ts    # REST API client
│   │   ├── pages/
│   │   │   ├── Home.tsx    # Script list + management
│   │   │   └── Editor.tsx  # Markdown editor
│   │   ├── components/
│   │   │   ├── TeleprompterView.tsx  # Main teleprompter
│   │   │   ├── SettingsPanel.tsx     # Settings drawer
│   │   │   └── ScriptCard.tsx        # Script list card
│   │   ├── lib/
│   │   │   ├── asr-client.ts         # FunASR WebSocket client
│   │   │   ├── alignment.ts          # Text alignment engine
│   │   │   └── types.ts              # TypeScript types
│   │   └── styles/
│   │       └── index.css
│   └── tailwind.config.ts
├── Makefile
└── README.md
```
