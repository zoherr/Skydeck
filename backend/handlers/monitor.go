package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
)

type TelemetryData struct {
	Hostname     string           `json:"hostname"`
	OS           string           `json:"os"`
	Kernel       string           `json:"kernel"`
	Arch         string           `json:"arch"`
	IPAddresses  string           `json:"ip_addresses"`
	Uptime       string           `json:"uptime"`
	CPUCores     int              `json:"cpu_cores"`
	CPUUsagePct  float64          `json:"cpu_usage_pct"`
	LoadAverage  [3]string        `json:"load_average"`
	RAMTotalMB   int64            `json:"ram_total_mb"`
	RAMUsedMB    int64            `json:"ram_used_mb"`
	RAMFreeMB    int64            `json:"ram_free_mb"`
	RAMCachedMB  int64            `json:"ram_cached_mb"`
	SwapTotalMB  int64            `json:"swap_total_mb"`
	SwapUsedMB   int64            `json:"swap_used_mb"`
	Mounts       []DiskUsageMount `json:"mounts"`
	NetworkIfaces []NetIfaceStat  `json:"network_ifaces"`
}

type NetIfaceStat struct {
	Name    string `json:"name"`
	RxBytes int64  `json:"rx_bytes"`
	TxBytes int64  `json:"tx_bytes"`
}

// TelemetryHandler fetches real-time VPS system metrics in a single optimized SSH execution
func TelemetryHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	script := `
echo "===HOSTNAME==="
hostname
echo "===UNAME==="
uname -srm
echo "===OS==="
grep -m1 '^PRETTY_NAME=' /etc/os-release 2>/dev/null | cut -d= -f2- | tr -d '"' || uname -o
echo "===IPS==="
hostname -I 2>/dev/null || ip -4 addr show scope global | awk '/inet/{print $2}' | tr '\n' ' '
echo "===UPTIME==="
uptime -p 2>/dev/null || uptime | awk -F'(up |, [0-9]+ user)' '{print $2}'
echo "===CORES==="
nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo
echo "===LOADAVG==="
cat /proc/loadavg
echo "===CPU==="
grep '^cpu ' /proc/stat
sleep 0.2
grep '^cpu ' /proc/stat
echo "===MEM==="
free -m
echo "===DF==="
df -hP | grep -E '^/dev/'
echo "===NET==="
cat /proc/net/dev | tail -n +3
`
	out, _, err := runSSHCommand(sess.SSHClient, script)
	if err != nil && out == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to gather telemetry: " + err.Error()})
		return
	}

	sections := parseTelemetrySections(out)

	tData := TelemetryData{
		Hostname:    strings.TrimSpace(sections["HOSTNAME"]),
		OS:          strings.TrimSpace(sections["OS"]),
		IPAddresses: strings.TrimSpace(sections["IPS"]),
		Uptime:      strings.TrimSpace(sections["UPTIME"]),
	}

	unameParts := strings.Fields(sections["UNAME"])
	if len(unameParts) >= 3 {
		tData.Kernel = unameParts[1]
		tData.Arch = unameParts[2]
	}

	if cores, err := strconv.Atoi(strings.TrimSpace(sections["CORES"])); err == nil {
		tData.CPUCores = cores
	} else {
		tData.CPUCores = 1
	}

	loadFields := strings.Fields(sections["LOADAVG"])
	if len(loadFields) >= 3 {
		tData.LoadAverage = [3]string{loadFields[0], loadFields[1], loadFields[2]}
	}

	// Calculate delta CPU usage between two /proc/stat reads (200ms apart)
	cpuLines := strings.Split(strings.TrimSpace(sections["CPU"]), "\n")
	if len(cpuLines) >= 2 {
		idle1, total1 := parseProcStatCPU(cpuLines[0])
		idle2, total2 := parseProcStatCPU(cpuLines[1])
		totalDelta := float64(total2 - total1)
		idleDelta := float64(idle2 - idle1)
		if totalDelta > 0 {
			usage := 100.0 * (1.0 - (idleDelta / totalDelta))
			if usage < 0 {
				usage = 0
			}
			if usage > 100 {
				usage = 100
			}
			tData.CPUUsagePct = float64(int(usage*10)) / 10.0
		}
	}

	// Parse free -m
	memLines := strings.Split(strings.TrimSpace(sections["MEM"]), "\n")
	for _, line := range memLines {
		fields := strings.Fields(line)
		if len(fields) >= 4 && strings.HasPrefix(fields[0], "Mem:") {
			tData.RAMTotalMB, _ = strconv.ParseInt(fields[1], 10, 64)
			tData.RAMUsedMB, _ = strconv.ParseInt(fields[2], 10, 64)
			tData.RAMFreeMB, _ = strconv.ParseInt(fields[3], 10, 64)
			if len(fields) >= 6 {
				tData.RAMCachedMB, _ = strconv.ParseInt(fields[5], 10, 64)
			}
		} else if len(fields) >= 3 && strings.HasPrefix(fields[0], "Swap:") {
			tData.SwapTotalMB, _ = strconv.ParseInt(fields[1], 10, 64)
			tData.SwapUsedMB, _ = strconv.ParseInt(fields[2], 10, 64)
		}
	}

	// Parse df -hP
	for _, line := range strings.Split(strings.TrimSpace(sections["DF"]), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 6 {
			pct, _ := strconv.Atoi(strings.TrimSuffix(fields[4], "%"))
			tData.Mounts = append(tData.Mounts, DiskUsageMount{
				Filesystem: fields[0],
				Total:      fields[1],
				Used:       fields[2],
				Available:  fields[3],
				Percent:    pct,
				MountedOn:  fields[5],
			})
		}
	}

	// Parse /proc/net/dev
	for _, line := range strings.Split(strings.TrimSpace(sections["NET"]), "\n") {
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		ifName := strings.TrimSpace(parts[0])
		if ifName == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) >= 9 {
			rx, _ := strconv.ParseInt(fields[0], 10, 64)
			tx, _ := strconv.ParseInt(fields[8], 10, 64)
			tData.NetworkIfaces = append(tData.NetworkIfaces, NetIfaceStat{
				Name:    ifName,
				RxBytes: rx,
				TxBytes: tx,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    tData,
	})
}

func parseTelemetrySections(output string) map[string]string {
	result := make(map[string]string)
	lines := strings.Split(output, "\n")
	currentKey := ""
	var buf strings.Builder

	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if strings.HasPrefix(trimmed, "===") && strings.HasSuffix(trimmed, "===") && len(trimmed) > 6 {
			if currentKey != "" {
				result[currentKey] = buf.String()
			}
			currentKey = strings.TrimSuffix(strings.TrimPrefix(trimmed, "==="), "===")
			buf.Reset()
		} else if currentKey != "" {
			buf.WriteString(l + "\n")
		}
	}
	if currentKey != "" {
		result[currentKey] = buf.String()
	}
	return result
}

func parseProcStatCPU(line string) (idle uint64, total uint64) {
	fields := strings.Fields(line)
	if len(fields) < 5 {
		return 0, 0
	}
	var vals []uint64
	for _, f := range fields[1:] {
		v, _ := strconv.ParseUint(f, 10, 64)
		vals = append(vals, v)
		total += v
	}
	if len(vals) >= 4 {
		idle = vals[3]
		if len(vals) >= 5 {
			idle += vals[4] // iowait
		}
	}
	return idle, total
}

type ProcessInfo struct {
	PID     int     `json:"pid"`
	PPID    int     `json:"ppid"`
	User    string  `json:"user"`
	CPUPct  float64 `json:"cpu_pct"`
	MemPct  float64 `json:"mem_pct"`
	Nice    string  `json:"nice"`
	State   string  `json:"state"`
	Command string  `json:"command"`
	Args    string  `json:"args"`
}

// ProcessesListHandler returns active Linux processes sorted by CPU/MEM
func ProcessesListHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	sortBy := c.DefaultQuery("sort", "cpu") // "cpu" or "mem"

	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	sortFlag := "-%cpu"
	if sortBy == "mem" {
		sortFlag = "-%mem"
	}

	cmd := fmt.Sprintf("ps -eo pid,ppid,user:20,%%cpu,%%mem,nice,stat,comm,args --sort=%s --no-headers | head -n 150", sortFlag)
	out, stderr, err := runSSHCommand(sess.SSHClient, cmd)
	if err != nil && out == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list processes: " + stderr})
		return
	}

	var procs []ProcessInfo
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 9 {
			pid, _ := strconv.Atoi(fields[0])
			ppid, _ := strconv.Atoi(fields[1])
			cpuPct, _ := strconv.ParseFloat(fields[3], 64)
			memPct, _ := strconv.ParseFloat(fields[4], 64)
			args := strings.Join(fields[8:], " ")

			procs = append(procs, ProcessInfo{
				PID:     pid,
				PPID:    ppid,
				User:    fields[2],
				CPUPct:  cpuPct,
				MemPct:  memPct,
				Nice:    fields[5],
				State:   fields[6],
				Command: fields[7],
				Args:    args,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    procs,
	})
}

type KillProcessRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	PID       int    `json:"pid" binding:"required"`
	Signal    string `json:"signal"` // TERM, KILL, HUP
}

// ProcessKillHandler sends a POSIX signal to a specific PID
func ProcessKillHandler(c *gin.Context) {
	var req KillProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.PID <= 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot terminate kernel/init PID <= 1"})
		return
	}

	sig := strings.ToUpper(strings.TrimSpace(req.Signal))
	if sig == "" {
		sig = "TERM"
	}
	if sig != "TERM" && sig != "KILL" && sig != "HUP" && sig != "INT" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid signal. Allowed: TERM, KILL, HUP, INT"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("kill -s %s %d", sig, req.PID)
	_, stderr, err := runSSHCommand(sess.SSHClient, cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Signal failed: " + strings.TrimSpace(stderr)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Sent SIG%s to PID %d", sig, req.PID),
	})
}

