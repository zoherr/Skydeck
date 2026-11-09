# Skydeck

> **Skydeck** is a fast, secure cross-platform VPS workstation combining a high-performance Go SSH/SFTP backend with an Electron and React desktop experience. It provides visual remote file operations, an integrated SSH terminal, dual-pane browsing, Monaco-powered in-app editing, deep grep search, and multi-layer encryption without context switching.

---

## 📸 Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│  Skydeck v2.5.0                      [ - ] [ □ ] [ ✕ ]                 │
├───────────────┬────────────────────────────────────────────────────────┤
│ 🖥️ Production │  /var/www/html/              [🔍 Find] [Dual] [Terminal]│
│   192.168.1.1 │  [+ Folder]  [↑ Upload]  [Filter...]                   │
│   root : 22   ├────────────────────────────────────────────────────────┤
│   ● active    │  Name            Size       Modified      Permissions  │
│               │  📁 assets       —          Today 14:20   0755 drwxr-xr│
│ 📁 Staging    │  📄 index.html   14.2 KB    Today 14:18   0644 -rw-r--r│
│ 📁 Backup     │  📄 config.json  2.1 KB     Yesterday     0600 -rw-----│
│               ├────────────────────────────────────────────────────────┤
│ 🔖 Bookmarks  │ >_ SSH Shell (Terminal 1)                              │
│   /var/www    │ root@vps:~# uname -a                                   │
│   /etc/nginx  │ Linux skydeck-server 6.1.0-x86_64 GNU/Linux            │
│ [⚙️ Settings] │ root@vps:~# _                                          │
└───────────────┴────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture & Tech Stack

```
[ Electron Frontend (React + Tailwind + Monaco + xterm.js) ]
                    ↕ REST API & WebSockets (127.0.0.1:48921 with crypto token)
[ Embedded Go Backend (Gin + crypto/ssh + pkg/sftp + gorilla/websocket) ]
                    ↕ SSH / SFTP / PTY Stream
[ Remote VPS Server ]
```

| Component | Technology | Description |
|---|---|---|
| **Desktop Shell** | Electron 33 | Isolated context, sandboxed renderer, secure preload IPC |
| **Frontend UI** | React 18 + Tailwind CSS | Custom dark theme (`#0a0c10`), Inter font, Lucide icons |
| **Terminal** | `xterm.js` + FitAddon | Full TrueColor SSH PTY terminal with multi-tabs & resize |
| **Code Editor** | Monaco Editor | Syntax highlighting, line numbers, unsaved indicators, Ctrl+S |
| **Backend Server** | Go 1.22+ + Gin HTTP | High-concurrency, strictly bound to `127.0.0.1:48921` |
| **Remote Protocol** | `golang.org/x/crypto/ssh` + `pkg/sftp` | SSH2 & SFTP connection multiplexing with auto-reconnect |
| **Power Tools** | Go Search + Archive + Disk Usage | Server-side grep, find, zip/tar creation & extraction |
| **Storage Security** | AES-256-GCM + PBKDF2 + bcrypt | Profiles encrypted at rest; master password lockout policy |
| **Packaging** | electron-builder | Windows NSIS installer (`.exe`) with embedded binary |

---

## 🗺️ Product Roadmap & Specifications

- 📄 [**Skydeck v1.0.1 Release Notes**](docs/v1.0.1.md) — Initial remote file management release.
- 🚀 [**Skydeck v2.0.0 Release Notes**](docs/v2.0.0.md) — Secure desktop application with Monaco Editor, AES-256-GCM encryption, and Windows installer.
- ⚡ [**Skydeck v2.5.0 Specification**](docs/v2.5.0.md) — *Productivity & Power Tools*: Integrated SSH PTY terminal, dual-pane explorer, content grep search, rich file previews, and resumable transfer manager.
- 🌐 [**Skydeck v3.0.0 Architecture**](docs/v3.0.0.md) — *Complete VPS Management Platform*: Real-time server telemetry, process manager, Docker management, systemd service control, database explorer, and security center.

---

## 🔒 Security Model

1. **App Password Protection**:
   - Master password hashed with **bcrypt (cost 12)** and stored in `userData/auth.json`.
   - Lock screen on every launch.
   - Enforced **lockout after 5 failed attempts** for 30 seconds with exponential protection.
2. **Profile & Credential Privacy**:
   - SSH passwords are **never stored on disk** (session memory only).
   - Saved profiles are encrypted at rest with **AES-256-GCM** using keys derived via **PBKDF2-HMAC-SHA256 (100,000 iterations)**.
   - Profiles stored at `userData/profiles.enc`.
3. **Internal API Protection**:
   - Go backend binds strictly to `127.0.0.1:48921` (never `0.0.0.0`).
   - Every request requires a cryptographically random secret token (`X-Skydeck-Token`).
   - Unauthorized requests immediately return `401 Unauthorized`.
   - Inactive sessions expire after 30 minutes.
4. **Electron Isolation**:
   - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
   - Node primitives never exposed directly to DOM.

---

## 🚀 Quick Start (Development Mode)

### Prerequisites
- Node.js 18+ and npm
- Go 1.21+

### Step-by-Step

1. **Clone repository**:
   ```bash
   git clone https://github.com/zoherr/Skydeck.git
   cd Skydeck
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

3. **Build the backend binary**:
   ```bash
   cd backend
   go build -ldflags="-s -w" -o ../electron/bin/skydeck-backend.exe
   cd ..
   ```

4. **Run Vite frontend dev server** (Terminal 1):
   ```bash
   cd frontend
   npm run dev
   ```

5. **Start Electron** (Terminal 2):
   ```bash
   npx cross-env VITE_DEV_SERVER_URL=http://localhost:5173 electron .
   ```

---

## 📦 Production Build (Create Windows `.exe` Installer)

Run the automated build script on Windows:

```cmd
build.bat
```

Or execute manually:

```bash
# 1. Compile Go backend binary
cd backend
go build -ldflags="-s -w" -o ../electron/bin/skydeck-backend.exe
cd ..

# 2. Build frontend React bundle
cd frontend
npm install
npm run build
cd ..

# 3. Package Windows NSIS installer
npx electron-builder --win
```

The installer will be generated in `dist/Skydeck-Setup.exe`.

---

## 🔌 Backend API Reference & Curl Examples

All endpoints require the security token passed via header `X-Skydeck-Token: <TOKEN>`.

### 1. Health Check
```bash
curl -X GET http://127.0.0.1:48921/health
```

### 2. Connect (SSH/SFTP)
```bash
curl -X POST http://127.0.0.1:48921/api/connect \
  -H "X-Skydeck-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "auth_type": "password",
    "password": "your-password",
    "trust_host": true
  }'
```

### 3. List Directory
```bash
curl -X GET "http://127.0.0.1:48921/api/files?session_id=SESSION_ID&path=/var/www" \
  -H "X-Skydeck-Token: YOUR_TOKEN"
```

### 4. Upload File
```bash
curl -X POST http://127.0.0.1:48921/api/upload \
  -H "X-Skydeck-Token: YOUR_TOKEN" \
  -F "session_id=SESSION_ID" \
  -F "remote_dir=/var/www/html" \
  -F "files=@local_file.txt"
```

### 5. Download File
```bash
curl -X GET "http://127.0.0.1:48921/api/download?session_id=SESSION_ID&path=/var/www/html/index.html" \
  -H "X-Skydeck-Token: YOUR_TOKEN" \
  --output downloaded_index.html
```

### 6. Read File (for Monaco Editor)
```bash
curl -X GET "http://127.0.0.1:48921/api/read?session_id=SESSION_ID&path=/etc/nginx/nginx.conf" \
  -H "X-Skydeck-Token: YOUR_TOKEN"
```

### 7. Write File Content
```bash
curl -X POST http://127.0.0.1:48921/api/write \
  -H "X-Skydeck-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION_ID",
    "path": "/var/www/html/index.html",
    "content": "<h1>Hello from Skydeck</h1>"
  }'
```

### 8. Change Permissions (chmod)
```bash
curl -X POST http://127.0.0.1:48921/api/chmod \
  -H "X-Skydeck-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION_ID",
    "path": "/var/www/html/index.html",
    "mode": "0644"
  }'
```

### 9. Create Directory
```bash
curl -X POST http://127.0.0.1:48921/api/mkdir \
  -H "X-Skydeck-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION_ID",
    "path": "/var/www/html/new_folder"
  }'
```

### 10. Rename / Move
```bash
curl -X POST http://127.0.0.1:48921/api/rename \
  -H "X-Skydeck-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION_ID",
    "old_path": "/var/www/html/old.txt",
    "new_path": "/var/www/html/new.txt"
  }'
```

### 11. Delete File or Directory
```bash
curl -X POST http://127.0.0.1:48921/api/delete \
  -H "X-Skydeck-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION_ID",
    "path": "/var/www/html/obsolete_dir",
    "is_dir": true
  }'
```

### 12. Disconnect
```bash
curl -X POST http://127.0.0.1:48921/api/disconnect \
  -H "X-Skydeck-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION_ID"
  }'
```

---

## 📄 License
MIT License. Built for developers with ❤️.
