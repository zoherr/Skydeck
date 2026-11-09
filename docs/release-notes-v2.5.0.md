# Skydeck v2.5.0 — Productivity & Power Tools

> **Skydeck** — Your servers from above. A fast, secure VPS workstation combining Go, Electron, React, Monaco, and xterm.js.

---

## 🚀 What's New in v2.5.0

Skydeck v2.5.0 is a major productivity release designed to eliminate context switching between terminals, FTP clients, and code editors.

### 1. 🖥️ Integrated SSH Terminal (PTY Stream)
- Embedded **xterm.js** terminal emulator directly inside Skydeck.
- Go backend allocates true interactive pseudo-terminals (`crypto/ssh` session PTY) streamed bidirectionally over WebSockets (`gorilla/websocket`).
- **Multi-Tab Shell**: Open multiple concurrent terminal sessions (`Terminal 1`, `Terminal 2`, `+ New Tab`).
- **Responsive Layout**: Auto-resizes terminal columns and rows (`SIGWINCH` propagation via FitAddon).
- **Toggleable Drawer**: Press <kbd>Ctrl+`</kbd> or click the Terminal button in the top bar to slide the terminal in or out. Maximize to 75vh or restore height with one click.
- Full 24-bit TrueColor and ANSI 256-color palette.

### 2. 🗂️ Dual-Pane File Manager
- Toggle between single-pane and side-by-side **Dual-Pane** mode.
- Browse two remote directories simultaneously (e.g. `/var/www` on Left Pane, `/root` or `/backup` on Right Pane).
- **Cross-Pane Transfers**:
  - Press <kbd>F5</kbd> to copy selected items to the opposite pane.
  - Press <kbd>F6</kbd> to move selected items to the opposite pane.
  - Drag and drop files between panes.

### 3. 🔍 Advanced Remote Search & Content Grep
- **Filename Pattern Search**: Fast server-side wildcard matching (`*.conf`, `nginx*`, `docker-compose.yml`).
- **In-File Content Grep**: Search for text snippets, function names, and environment variables *inside* remote files on the server using optimized Go routines with regex support.
- **Search Scope**: Search within current directory or scan the entire server filesystem (`/`).
- **Direct Jump**: Click any search result to open it in Monaco editor or navigate directly to its containing directory.

### 4. 💾 Disk Usage Analyzer
- Interactive visual storage breakdown for mounted filesystems (`/`, `/home`, `/var`, etc.) with progress meters and alert thresholds (green < 70%, amber 70-85%, red > 85%).
- Instant listing of the largest folders and files consuming disk space in any target directory (`du -sh`).

### 5. 📦 Archive Manager (Extract & Compress)
- **Archive Extraction**: Right-click any `.zip`, `.tar.gz`, `.tgz`, `.tar.bz2`, or `.tar` archive and choose **Extract Archive** to unpack directly on the remote server without downloading.
- **Compression**: Select any file or folder and choose **Compress (ZIP/TAR)** to generate `.zip` or `.tar.gz` archives on the fly.

### 6. 🔖 Directory Bookmarks & Power Utilities
- **Bookmarks**: Pin frequently accessed folders (`/var/www`, `/etc`, `/var/log`, custom directories) directly in the sidebar for one-click access.
- **File Duplication**: Instant duplicate action via right-click context menu.
- **Frameless Sleek UI**: Complete removal of default Electron window menus for a clean, modern aesthetic.

---

## 🔒 Security Summary
- **Master Password**: Protected with bcrypt (cost 12) and 5-attempt automatic lockout.
- **Encrypted Profiles**: Saved server profiles encrypted with **AES-256-GCM** and PBKDF2 (100,000 iterations).
- **Zero Plaintext**: SSH passwords are never written to disk.
- **Localhost Bound**: Backend strictly listens on `127.0.0.1:48921` with mandatory crypto token authentication.

---

## 📦 Assets
- `Skydeck-Setup.exe` (Windows x64 NSIS Installer)

