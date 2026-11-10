# Skydeck v3.0.0 — Complete VPS Management Platform

> **Skydeck** — Your servers from above. The unified desktop control center for developers, DevOps engineers, and server administrators.

---

## 🌐 What's New in v3.0.0

**Skydeck v3.0.0** expands beyond file transfers and SSH terminals into an all-in-one Linux server operating console — eliminating the need to juggle separate tools for hardware telemetry, process monitoring, Docker management, systemd services, database administration, deployments, and server security.

### 1. 📊 Real-Time Server Monitoring Dashboard
- **Live Telemetry**: Instant metrics collected natively from `/proc` and Linux system interfaces with zero remote agent installation required.
- **CPU & Load**: Real-time CPU utilization percentage, core count, and 1m / 5m / 15m load averages.
- **Memory & Swap**: Used, free, cached RAM breakdown and Swap monitoring.
- **OS & Networking**: Distribution details, kernel version, architecture, IP addresses, uptime, storage mount bars, and cumulative RX/TX interface traffic.
- Auto-refresh toggle (every 3.5s) or on-demand polling.

### 2. ⚡ Interactive Linux Process Manager
- View all active processes with PID, User, CPU%, MEM%, State, and full command arguments.
- Search & sort dynamically by CPU or Memory hogs.
- Terminate (`SIGTERM`) or Force Kill (`SIGKILL`) misbehaving processes safely (with root PID 1 protection).

### 3. 🐳 Docker Engine Management
- **Containers**: Live running/stopped container status, port bindings, Start, Stop, Restart, Remove, and System Prune controls.
- **Images & Volumes**: Inspect pulled Docker images, tags, sizes, and persistent volume mounts.
- **Live Container Logs**: Stream tail logs directly in an in-app viewer.
- **Container Shell Exec**: Click **Shell** on any running container to drop straight into an interactive `docker exec` PTY shell tab right inside Skydeck!

### 4. ⚙️ Systemd Services & Visual Cron Manager
- **Systemd Browser**: Search all system units (`nginx`, `mysql`, `docker`, `ssh`, custom daemons), view active/failed status badges, Start/Stop/Restart services, and inspect live `journalctl` output.
- **Visual Cron Manager**: Load, edit, and save user `crontab` entries with 1-click schedule templates.

### 5. 🗄️ Database Explorer & Query Runner
- Execute queries safely against **MySQL / MariaDB**, **PostgreSQL**, **SQLite**, and **Redis** directly over SSH — without ever opening database ports (`3306`, `5432`, `6379`) to the public internet!
- Built-in query presets (`SHOW DATABASES;`, `\dt`, `KEYS *`, etc.), structured HTML data table rendering, raw output view, and millisecond execution timer.

### 6. 🚀 Deployment Manager, Log Hub & Network Tools
- **Git & App Deployer**: Inspect remote Git branches, remote origins, recent commit history, and execute one-click `git pull`, build triggers (`npm run build`, `go build`, `pm2 restart all`), or custom deploy scripts with captured console output.
- **System Log Hub**: Instant tail viewer for `/var/log/syslog`, `/var/log/auth.log`, `/var/log/nginx/error.log`, and custom log paths.
- **Network Diagnostics**: Run server-side `ping`, `dig` DNS lookups, `traceroute`, and HTTP header `curl -I` checks directly from your VPS.

### 7. 🛡️ Security Center & Auditing
- **UFW Firewall Manager**: View firewall active status, toggle firewall enforcement, add port/protocol allow/deny rules (`443/tcp`), and delete rules.
- **Open Ports Inspector**: Live socket table (`ss -tulpn`) mapping listening TCP/UDP ports to their bound processes.
- **SSH Auth Audit Log**: Highlights accepted SSH sessions and flags brute-force failed authentication attempts.
- **User Accounts**: Inspect interactive shell accounts (`/etc/passwd`) and active logged-in `who` sessions.

---

## 🔒 Zero-Trust Architecture
- All SSH inputs strictly sanitized against shell injection; zero hardcoded secrets.
- Backend bound strictly to `127.0.0.1:48921` guarded by cryptographically generated `X-Skydeck-Token`.
- Saved server profiles encrypted at rest with AES-256-GCM + PBKDF2 behind bcrypt-protected Master Password.

---

## 📦 Assets
- `Skydeck-Setup.exe` (Windows x64 NSIS Installer)

