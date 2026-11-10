package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
)

type SystemdService struct {
	Unit        string `json:"unit"`
	Load        string `json:"load"`
	Active      string `json:"active"`
	Sub         string `json:"sub"`
	Description string `json:"description"`
}

// SystemdListHandler lists all systemd service units
func SystemdListHandler(c *gin.Context) {
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

	cmd := "systemctl list-units --type=service --all --no-pager --no-legend --plain 2>/dev/null | head -n 250"
	out, stderr, err := runSSHCommand(sess.SSHClient, cmd)
	if err != nil && out == "" {
		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"available": false,
			"reason":    "systemd not available or insufficient permissions: " + strings.TrimSpace(stderr),
			"services":  []SystemdService{},
		})
		return
	}

	var services []SystemdService
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 5 {
			services = append(services, SystemdService{
				Unit:        fields[0],
				Load:        fields[1],
				Active:      fields[2],
				Sub:         fields[3],
				Description: strings.Join(fields[4:], " "),
			})
		} else if len(fields) == 4 {
			services = append(services, SystemdService{
				Unit:        fields[0],
				Load:        fields[1],
				Active:      fields[2],
				Sub:         fields[3],
				Description: "",
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"available": true,
		"services":  services,
	})
}

type ServiceActionRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Unit      string `json:"unit" binding:"required"`
	Action    string `json:"action" binding:"required"` // start, stop, restart, reload, enable, disable
}

// SystemdActionHandler executes start/stop/restart/enable/disable on a unit
func SystemdActionHandler(c *gin.Context) {
	var req ServiceActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if !isValidSafeIdent(req.Unit) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service unit name"})
		return
	}

	allowed := map[string]bool{
		"start":   true,
		"stop":    true,
		"restart": true,
		"reload":  true,
		"enable":  true,
		"disable": true,
	}
	if !allowed[req.Action] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported service action"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("systemctl %s %s", req.Action, shellQuote(req.Unit))
	_, stderr, err := runSSHCommand(sess.SSHClient, cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "systemctl action failed: " + strings.TrimSpace(stderr)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("%s %s completed", req.Action, req.Unit),
	})
}

// SystemdLogsHandler retrieves journalctl output for a unit
func SystemdLogsHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	unit := c.Query("unit")
	lines := c.DefaultQuery("lines", "150")

	if sessionID == "" || !isValidSafeIdent(unit) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid session_id and unit required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("journalctl -u %s -n %s --no-pager 2>&1", shellQuote(unit), shellQuote(lines))
	out, _, err := runSSHCommand(sess.SSHClient, cmd)
	if err != nil && out == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch journal logs: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"logs":    out,
	})
}

// SystemLogTailHandler reads standard Linux log files safely
func SystemLogTailHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	logPath := c.DefaultQuery("path", "/var/log/syslog")
	lines := c.DefaultQuery("lines", "150")

	if sessionID == "" || !isValidSafeIdent(logPath) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid session_id and log path required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("tail -n %s %s 2>&1", shellQuote(lines), shellQuote(logPath))
	out, _, _ := runSSHCommand(sess.SSHClient, cmd)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"path":    logPath,
		"content": out,
	})
}

