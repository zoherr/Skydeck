package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
)

type DatabaseQueryRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Engine    string `json:"engine" binding:"required"` // mysql, postgres, redis, sqlite
	Host      string `json:"host"`
	Port      string `json:"port"`
	User      string `json:"user"`
	Password  string `json:"password"`
	Database  string `json:"database"` // db name or file path for sqlite
	Query     string `json:"query" binding:"required"`
}

// DatabaseQueryHandler runs SQL or Redis commands locally on the VPS over SSH
func DatabaseQueryHandler(c *gin.Context) {
	var req DatabaseQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	host := req.Host
	if host == "" {
		host = "127.0.0.1"
	}
	if !isValidHost(host) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database host"})
		return
	}

	start := time.Now()
	var cmd string
	engine := strings.ToLower(req.Engine)

	switch engine {
	case "mysql":
		port := req.Port
		if port == "" {
			port = "3306"
		}
		user := req.User
		if user == "" {
			user = "root"
		}
		passEnv := ""
		if req.Password != "" {
			passEnv = fmt.Sprintf("MYSQL_PWD=%s ", shellQuote(req.Password))
		}
		dbArg := ""
		if req.Database != "" && isValidSafeIdent(req.Database) {
			dbArg = " -D " + shellQuote(req.Database)
		}
		cmd = fmt.Sprintf("%smysql -h %s -P %s -u %s%s --batch -e %s 2>&1",
			passEnv, shellQuote(host), shellQuote(port), shellQuote(user), dbArg, shellQuote(req.Query))

	case "postgres":
		port := req.Port
		if port == "" {
			port = "5432"
		}
		user := req.User
		if user == "" {
			user = "postgres"
		}
		db := req.Database
		if db == "" {
			db = "postgres"
		}
		passEnv := ""
		if req.Password != "" {
			passEnv = fmt.Sprintf("PGPASSWORD=%s ", shellQuote(req.Password))
		}
		// Use -A -F $'\t' for clean tab-separated parsing
		cmd = fmt.Sprintf("%spsql -h %s -p %s -U %s -d %s -A -F '\t' -c %s 2>&1",
			passEnv, shellQuote(host), shellQuote(port), shellQuote(user), shellQuote(db), shellQuote(req.Query))

	case "sqlite":
		if !isValidSafeIdent(req.Database) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Valid SQLite file path required in database field"})
			return
		}
		cmd = fmt.Sprintf("sqlite3 -header -separator '\t' %s %s 2>&1",
			shellQuote(req.Database), shellQuote(req.Query))

	case "redis":
		port := req.Port
		if port == "" {
			port = "6379"
		}
		authArg := ""
		if req.Password != "" {
			authArg = " -a " + shellQuote(req.Password) + " --no-auth-warning"
		}
		// Pass command via stdin safely without shell interpolation
		cmd = fmt.Sprintf("printf '%%s\\n' %s | redis-cli -h %s -p %s%s 2>&1",
			shellQuote(req.Query), shellQuote(host), shellQuote(port), authArg)

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported database engine. Use mysql, postgres, sqlite, or redis."})
		return
	}

	out, stderr, runErr := runSSHCommand(sess.SSHClient, cmd)
	durationMs := time.Since(start).Milliseconds()

	rawOut := strings.TrimSpace(out)
	if rawOut == "" && stderr != "" {
		rawOut = strings.TrimSpace(stderr)
	}

	// Attempt to parse tab-delimited structured table for SQL engines
	var columns []string
	var rows [][]string

	if engine != "redis" && runErr == nil && rawOut != "" {
		lines := strings.Split(rawOut, "\n")
		// For psql, filter out trailing "(N rows)" line
		var dataLines []string
		for _, l := range lines {
			if engine == "postgres" && strings.HasPrefix(l, "(") && (strings.HasSuffix(l, "row)") || strings.HasSuffix(l, "rows)")) {
				continue
			}
			if strings.TrimSpace(l) != "" {
				dataLines = append(dataLines, l)
			}
		}

		if len(dataLines) > 0 && strings.Contains(dataLines[0], "\t") {
			columns = strings.Split(dataLines[0], "\t")
			for _, rLine := range dataLines[1:] {
				rows = append(rows, strings.Split(rLine, "\t"))
			}
		} else if len(dataLines) > 0 && !strings.HasPrefix(strings.ToUpper(dataLines[0]), "ERROR") {
			columns = strings.Split(dataLines[0], "\t")
			for _, rLine := range dataLines[1:] {
				rows = append(rows, strings.Split(rLine, "\t"))
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"query_success": runErr == nil,
		"duration_ms":   durationMs,
		"raw_output":    rawOut,
		"columns":       columns,
		"rows":          rows,
	})
}

// GitStatusHandler reads git branch, status, and recent commit history in a remote directory
func GitStatusHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	repoPath := c.DefaultQuery("path", "/var/www")

	if sessionID == "" || !isValidSafeIdent(repoPath) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid session_id and path required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	script := fmt.Sprintf(`
cd %s || exit 1
echo "===ISGIT==="
git rev-parse --is-inside-work-tree 2>&1
echo "===BRANCH==="
git branch --show-current 2>/dev/null
echo "===REMOTE==="
git remote get-url origin 2>/dev/null
echo "===STATUS==="
git status -s 2>/dev/null
echo "===LOG==="
git log -n 12 --pretty=format:"%%h|%%an|%%ar|%%s" 2>/dev/null
`, shellQuote(repoPath))

	out, _, _ := runSSHCommand(sess.SSHClient, script)
	sections := parseTelemetrySections(out)

	isGit := strings.TrimSpace(sections["ISGIT"]) == "true"

	type GitCommit struct {
		Hash    string `json:"hash"`
		Author  string `json:"author"`
		Date    string `json:"date"`
		Message string `json:"message"`
	}
	var commits []GitCommit
	for _, line := range strings.Split(strings.TrimSpace(sections["LOG"]), "\n") {
		parts := strings.SplitN(line, "|", 4)
		if len(parts) == 4 {
			commits = append(commits, GitCommit{
				Hash:    parts[0],
				Author:  parts[1],
				Date:    parts[2],
				Message: parts[3],
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"is_git":  isGit,
		"path":    repoPath,
		"branch":  strings.TrimSpace(sections["BRANCH"]),
		"remote":  strings.TrimSpace(sections["REMOTE"]),
		"status":  strings.TrimSpace(sections["STATUS"]),
		"commits": commits,
	})
}

// DeployExecHandler pulls/builds/restarts applications in a directory
func DeployExecHandler(c *gin.Context) {
	var req struct {
		SessionID string `json:"session_id" binding:"required"`
		Path      string `json:"path" binding:"required"`
		Command   string `json:"command" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if !isValidSafeIdent(req.Path) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid target path"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	start := time.Now()
	cmd := fmt.Sprintf("cd %s && %s 2>&1", shellQuote(req.Path), req.Command)
	out, stderr, runErr := runSSHCommand(sess.SSHClient, cmd)
	durationMs := time.Since(start).Milliseconds()

	combined := strings.TrimSpace(out)
	if stderr != "" {
		combined += "\n" + strings.TrimSpace(stderr)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"cmd_success": runErr == nil,
		"duration_ms": durationMs,
		"output":      combined,
	})
}

// CronListHandler retrieves user crontab entries
func CronListHandler(c *gin.Context) {
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

	out, _, _ := runSSHCommand(sess.SSHClient, "crontab -l 2>/dev/null || true")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"raw":     out,
	})
}

// CronSaveHandler updates the remote crontab safely
func CronSaveHandler(c *gin.Context) {
	var req struct {
		SessionID string `json:"session_id" binding:"required"`
		Content   string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	content := strings.TrimSpace(req.Content)
	var cmd string
	if content == "" {
		cmd = "crontab -r 2>/dev/null || true"
	} else {
		cmd = fmt.Sprintf("printf '%%s\\n' %s | crontab -", shellQuote(content))
	}

	_, stderr, err := runSSHCommand(sess.SSHClient, cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save crontab: " + strings.TrimSpace(stderr)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Crontab updated successfully",
	})
}

// NetworkDiagHandler executes remote ping, dig, or curl checks
func NetworkDiagHandler(c *gin.Context) {
	var req struct {
		SessionID string `json:"session_id" binding:"required"`
		Tool      string `json:"tool" binding:"required"` // ping, dig, curl, traceroute
		Target    string `json:"target" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if !isValidSafeIdent(req.Target) && !strings.HasPrefix(req.Target, "http") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid target host or URL"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var cmd string
	switch req.Tool {
	case "ping":
		cmd = fmt.Sprintf("ping -c 4 %s 2>&1", shellQuote(req.Target))
	case "dig":
		cmd = fmt.Sprintf("dig +noall +answer %s 2>&1 || nslookup %s 2>&1", shellQuote(req.Target), shellQuote(req.Target))
	case "curl":
		cmd = fmt.Sprintf("curl -sI --max-time 10 %s 2>&1", shellQuote(req.Target))
	case "traceroute":
		cmd = fmt.Sprintf("traceroute -m 15 %s 2>&1 || tracepath -m 15 %s 2>&1", shellQuote(req.Target), shellQuote(req.Target))
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported network tool"})
		return
	}

	out, _, _ := runSSHCommand(sess.SSHClient, cmd)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"output":  strings.TrimSpace(out),
	})
}
