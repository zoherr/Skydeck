package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
)

type UFWRule struct {
	Number string `json:"number"`
	To     string `json:"to"`
	Action string `json:"action"`
	From   string `json:"from"`
	Raw    string `json:"raw"`
}

type ListeningPort struct {
	Proto   string `json:"proto"`
	Local   string `json:"local"`
	Process string `json:"process"`
}

type SSHAuthEntry struct {
	Line   string `json:"line"`
	Status string `json:"status"` // "accepted", "failed", "other"
}

type SystemUser struct {
	Username string `json:"username"`
	UID      string `json:"uid"`
	Home     string `json:"home"`
	Shell    string `json:"shell"`
}

// SecurityOverviewHandler retrieves UFW rules, listening ports, SSH auth logs, and users
func SecurityOverviewHandler(c *gin.Context) {
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
echo "===UFW==="
ufw status numbered 2>&1 || echo "UFW_UNAVAILABLE"
echo "===PORTS==="
ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null
echo "===AUTHLOG==="
(grep -E 'sshd|Accepted|Failed' /var/log/auth.log 2>/dev/null || grep -E 'sshd|Accepted|Failed' /var/log/secure 2>/dev/null || journalctl -u ssh -u sshd -n 60 --no-pager 2>/dev/null) | tail -n 50
echo "===WHO==="
who 2>/dev/null
echo "===USERS==="
awk -F: '$7 !~ /(false|nologin|sync)/ {print $1 ":" $3 ":" $6 ":" $7}' /etc/passwd 2>/dev/null
`
	out, _, _ := runSSHCommand(sess.SSHClient, script)
	sections := parseTelemetrySections(out)

	// Parse UFW
	ufwRaw := strings.TrimSpace(sections["UFW"])
	ufwAvailable := !strings.Contains(ufwRaw, "not found") && !strings.Contains(ufwRaw, "UFW_UNAVAILABLE")
	ufwActive := strings.Contains(strings.ToLower(ufwRaw), "status: active")
	var ufwRules []UFWRule
	for _, line := range strings.Split(ufwRaw, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "[") && strings.Contains(line, "]") {
			closeIdx := strings.Index(line, "]")
			num := strings.TrimSpace(line[1:closeIdx])
			rest := strings.TrimSpace(line[closeIdx+1:])
			fields := strings.Fields(rest)
			to := ""
			action := ""
			from := ""
			if len(fields) >= 1 {
				to = fields[0]
			}
			if len(fields) >= 2 {
				action = fields[1]
				if len(fields) >= 3 && (fields[2] == "IN" || fields[2] == "OUT") {
					action += " " + fields[2]
					if len(fields) >= 4 {
						from = strings.Join(fields[3:], " ")
					}
				} else if len(fields) >= 3 {
					from = strings.Join(fields[2:], " ")
				}
			}
			ufwRules = append(ufwRules, UFWRule{
				Number: num,
				To:     to,
				Action: action,
				From:   from,
				Raw:    line,
			})
		}
	}

	// Parse Listening Ports (ss -tulpn)
	var ports []ListeningPort
	for i, line := range strings.Split(strings.TrimSpace(sections["PORTS"]), "\n") {
		if i == 0 || strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 5 {
			proto := fields[0]
			local := fields[4]
			proc := ""
			if len(fields) >= 7 {
				proc = strings.Join(fields[6:], " ")
			}
			ports = append(ports, ListeningPort{
				Proto:   proto,
				Local:   local,
				Process: proc,
			})
		}
	}

	// Parse SSH Auth Logs
	var authEntries []SSHAuthEntry
	failedCount := 0
	for _, line := range strings.Split(strings.TrimSpace(sections["AUTHLOG"]), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		status := "other"
		if strings.Contains(line, "Accepted") {
			status = "accepted"
		} else if strings.Contains(line, "Failed") || strings.Contains(line, "Invalid user") {
			status = "failed"
			failedCount++
		}
		authEntries = append(authEntries, SSHAuthEntry{
			Line:   line,
			Status: status,
		})
	}
	// Reverse auth entries so newest are first
	for i, j := 0, len(authEntries)-1; i < j; i, j = i+1, j-1 {
		authEntries[i], authEntries[j] = authEntries[j], authEntries[i]
	}

	// Parse Users
	var users []SystemUser
	for _, line := range strings.Split(strings.TrimSpace(sections["USERS"]), "\n") {
		parts := strings.Split(line, ":")
		if len(parts) >= 4 {
			users = append(users, SystemUser{
				Username: parts[0],
				UID:      parts[1],
				Home:     parts[2],
				Shell:    parts[3],
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":          true,
		"ufw_available":    ufwAvailable,
		"ufw_active":       ufwActive,
		"ufw_rules":        ufwRules,
		"listening_ports":  ports,
		"auth_logs":        authEntries,
		"failed_ssh_count": failedCount,
		"active_sessions":  strings.TrimSpace(sections["WHO"]),
		"users":            users,
	})
}

type UFWActionRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Action    string `json:"action" binding:"required"` // enable, disable, allow, deny, delete
	Target    string `json:"target"`                    // port e.g. "443/tcp" or rule number for delete
}

// UFWActionHandler manages UFW firewall configuration safely
func UFWActionHandler(c *gin.Context) {
	var req UFWActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var cmd string
	switch req.Action {
	case "enable":
		cmd = "ufw --force enable"
	case "disable":
		cmd = "ufw disable"
	case "allow", "deny":
		if !isValidPortSpec(req.Target) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid port/protocol spec (use e.g. 443/tcp or 8080)"})
			return
		}
		cmd = fmt.Sprintf("ufw %s %s", req.Action, shellQuote(req.Target))
	case "delete":
		num, convErr := strconv.Atoi(strings.TrimSpace(req.Target))
		if convErr != nil || num <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Valid rule number required to delete"})
			return
		}
		cmd = fmt.Sprintf("ufw --force delete %d", num)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UFW action"})
		return
	}

	out, stderr, err := runSSHCommand(sess.SSHClient, cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "UFW command failed: " + strings.TrimSpace(out+" "+stderr)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": strings.TrimSpace(out),
	})
}

