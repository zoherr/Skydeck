package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"path"
	"strconv"
	"strings"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
)

// SearchResult represents a matching file or folder
type SearchResult struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDir       bool   `json:"is_dir"`
	Size        int64  `json:"size"`
	Permissions string `json:"permissions"`
	MatchLine   string `json:"match_line,omitempty"`
}

// SearchHandler performs fast remote file and content search
func SearchHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	searchPath := c.Query("path")
	nameQuery := strings.TrimSpace(c.Query("query"))
	contentQuery := strings.TrimSpace(c.Query("content_query"))
	maxResultsStr := c.DefaultQuery("max_results", "100")

	maxResults, err := strconv.Atoi(maxResultsStr)
	if err != nil || maxResults <= 0 || maxResults > 500 {
		maxResults = 100
	}

	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}
	if searchPath == "" {
		searchPath = "/"
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var results []SearchResult

	// Execute via SSH command for maximum speed
	sshSession, err := sess.SSHClient.NewSession()
	if err == nil {
		defer sshSession.Close()

		var stdout, stderr bytes.Buffer
		sshSession.Stdout = &stdout
		sshSession.Stderr = &stderr

		var cmd string
		if contentQuery != "" {
			// Grep inside files
			safeContent := strings.ReplaceAll(contentQuery, "'", "'\\''")
			cmd = fmt.Sprintf("grep -rnIs -m 1 --exclude-dir={.git,.cache,node_modules} '%s' '%s' 2>/dev/null | head -n %d",
				safeContent, searchPath, maxResults)
		} else if nameQuery != "" {
			// Fast find by filename pattern
			safeName := strings.ReplaceAll(nameQuery, "'", "'\\''")
			if !strings.Contains(safeName, "*") {
				safeName = "*" + safeName + "*"
			}
			cmd = fmt.Sprintf("find '%s' -maxdepth 6 -iname '%s' 2>/dev/null | head -n %d",
				searchPath, safeName, maxResults)
		} else {
			cmd = fmt.Sprintf("find '%s' -maxdepth 2 2>/dev/null | head -n %d", searchPath, maxResults)
		}

		_ = sshSession.Run(cmd)
		output := stdout.String()

		lines := strings.Split(output, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			if contentQuery != "" {
				// Parse grep output: filepath:linenumber:linecontent
				parts := strings.SplitN(line, ":", 3)
				if len(parts) >= 2 {
					filePath := parts[0]
					matchSnippet := ""
					if len(parts) == 3 {
						matchSnippet = strings.TrimSpace(parts[2])
					}

					stat, statErr := sess.SFTPClient.Stat(filePath)
					var sz int64 = 0
					var isDir bool = false
					var perm = "0644"
					if statErr == nil {
						sz = stat.Size()
						isDir = stat.IsDir()
						perm = stat.Mode().String()
					}

					results = append(results, SearchResult{
						Name:        path.Base(filePath),
						Path:        filePath,
						IsDir:       isDir,
						Size:        sz,
						Permissions: perm,
						MatchLine:   matchSnippet,
					})
				}
			} else {
				// Parse find output: filepath
				filePath := line
				stat, statErr := sess.SFTPClient.Stat(filePath)
				var sz int64 = 0
				var isDir bool = false
				var perm = "0644"
				if statErr == nil {
					sz = stat.Size()
					isDir = stat.IsDir()
					perm = stat.Mode().String()
				}

				results = append(results, SearchResult{
					Name:        path.Base(filePath),
					Path:        filePath,
					IsDir:       isDir,
					Size:        sz,
					Permissions: perm,
				})
			}

			if len(results) >= maxResults {
				break
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    results,
		"count":   len(results),
	})
}

// ExtractArchiveRequest holds params for extracting an archive
type ExtractArchiveRequest struct {
	SessionID   string `json:"session_id" binding:"required"`
	ArchivePath string `json:"archive_path" binding:"required"`
	DestDir     string `json:"dest_dir"`
}

// ExtractArchiveHandler unpacks .zip, .tar.gz, .tgz, .tar.bz2 on the remote server
func ExtractArchiveHandler(c *gin.Context) {
	var req ExtractArchiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	if req.DestDir == "" {
		req.DestDir = path.Dir(req.ArchivePath)
	}

	sshSession, err := sess.SSHClient.NewSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create SSH session: " + err.Error()})
		return
	}
	defer sshSession.Close()

	var stdout, stderr bytes.Buffer
	sshSession.Stdout = &stdout
	sshSession.Stderr = &stderr

	lower := strings.ToLower(req.ArchivePath)
	var cmd string

	if strings.HasSuffix(lower, ".zip") {
		cmd = fmt.Sprintf("unzip -q -o '%s' -d '%s'", req.ArchivePath, req.DestDir)
	} else if strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tgz") {
		cmd = fmt.Sprintf("tar -xzf '%s' -C '%s'", req.ArchivePath, req.DestDir)
	} else if strings.HasSuffix(lower, ".tar.bz2") {
		cmd = fmt.Sprintf("tar -xjf '%s' -C '%s'", req.ArchivePath, req.DestDir)
	} else if strings.HasSuffix(lower, ".tar") {
		cmd = fmt.Sprintf("tar -xf '%s' -C '%s'", req.ArchivePath, req.DestDir)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported archive format. Supported formats: .zip, .tar.gz, .tgz, .tar.bz2, .tar"})
		return
	}

	if runErr := sshSession.Run(cmd); runErr != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg == "" {
			errMsg = runErr.Error()
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Archive extraction failed: " + errMsg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Archive successfully extracted to " + req.DestDir,
	})
}

// CreateArchiveRequest holds parameters for creating a compressed archive
type CreateArchiveRequest struct {
	SessionID   string   `json:"session_id" binding:"required"`
	Items       []string `json:"items" binding:"required"`
	ArchivePath string   `json:"archive_path" binding:"required"`
	Format      string   `json:"format"` // "zip" or "tar.gz"
}

// CreateArchiveHandler compresses items into a .zip or .tar.gz archive
func CreateArchiveHandler(c *gin.Context) {
	var req CreateArchiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No items specified for compression"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	sshSession, err := sess.SSHClient.NewSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create SSH session: " + err.Error()})
		return
	}
	defer sshSession.Close()

	var stdout, stderr bytes.Buffer
	sshSession.Stdout = &stdout
	sshSession.Stderr = &stderr

	baseDir := path.Dir(req.Items[0])
	var itemBasenames []string
	for _, it := range req.Items {
		itemBasenames = append(itemBasenames, fmt.Sprintf("'%s'", path.Base(it)))
	}
	itemsArg := strings.Join(itemBasenames, " ")

	format := strings.ToLower(req.Format)
	if format == "" {
		if strings.HasSuffix(strings.ToLower(req.ArchivePath), ".zip") {
			format = "zip"
		} else {
			format = "tar.gz"
		}
	}

	var cmd string
	if format == "zip" {
		cmd = fmt.Sprintf("cd '%s' && zip -r -q '%s' %s", baseDir, req.ArchivePath, itemsArg)
	} else {
		cmd = fmt.Sprintf("cd '%s' && tar -czf '%s' %s", baseDir, req.ArchivePath, itemsArg)
	}

	if runErr := sshSession.Run(cmd); runErr != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg == "" {
			errMsg = runErr.Error()
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Archive creation failed: " + errMsg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Archive created at " + req.ArchivePath,
	})
}

// DiskUsageMount represents a parsed filesystem row from df
type DiskUsageMount struct {
	Filesystem string `json:"filesystem"`
	Total      string `json:"total"`
	Used       string `json:"used"`
	Available  string `json:"available"`
	Percent    int    `json:"percent"`
	MountedOn  string `json:"mounted_on"`
}

// DiskUsageHandler retrieves disk usage breakdown and folder sizes
func DiskUsageHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	checkPath := c.DefaultQuery("path", "/")

	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	sshSession, err := sess.SSHClient.NewSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create SSH session: " + err.Error()})
		return
	}
	defer sshSession.Close()

	var stdout, stderr bytes.Buffer
	sshSession.Stdout = &stdout
	sshSession.Stderr = &stderr

	// Run df -hP and du -sh on the target folder
	cmd := fmt.Sprintf("df -hP && echo '---DU---' && du -sh '%s'/* 2>/dev/null | sort -hr | head -n 12", checkPath)
	_ = sshSession.Run(cmd)

	parts := strings.Split(stdout.String(), "---DU---")
	dfOutput := ""
	duOutput := ""
	if len(parts) > 0 {
		dfOutput = strings.TrimSpace(parts[0])
	}
	if len(parts) > 1 {
		duOutput = strings.TrimSpace(parts[1])
	}

	var mounts []DiskUsageMount
	dfLines := strings.Split(dfOutput, "\n")
	for i, l := range dfLines {
		if i == 0 {
			continue // skip header
		}
		fields := strings.Fields(l)
		if len(fields) >= 6 {
			pctStr := strings.TrimSuffix(fields[4], "%")
			pct, _ := strconv.Atoi(pctStr)

			mounts = append(mounts, DiskUsageMount{
				Filesystem: fields[0],
				Total:      fields[1],
				Used:       fields[2],
				Available:  fields[3],
				Percent:    pct,
				MountedOn:  fields[5],
			})
		}
	}

	type FolderSize struct {
		Size string `json:"size"`
		Path string `json:"path"`
		Name string `json:"name"`
	}
	var folderSizes []FolderSize
	duLines := strings.Split(duOutput, "\n")
	for _, l := range duLines {
		fields := strings.Fields(l)
		if len(fields) >= 2 {
			folderSizes = append(folderSizes, FolderSize{
				Size: fields[0],
				Path: fields[1],
				Name: path.Base(fields[1]),
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"mounts":       mounts,
		"folder_sizes": folderSizes,
	})
}

// CopyItemRequest holds parameters for duplicating or moving items
type CopyItemRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	SrcPath   string `json:"src_path" binding:"required"`
	DestPath  string `json:"dest_path" binding:"required"`
	Move      bool   `json:"move"`
}

// CopyItemHandler performs fast server-side duplication or moving
func CopyItemHandler(c *gin.Context) {
	var req CopyItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	sshSession, err := sess.SSHClient.NewSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create SSH session: " + err.Error()})
		return
	}
	defer sshSession.Close()

	var stdout, stderr bytes.Buffer
	sshSession.Stdout = &stdout
	sshSession.Stderr = &stderr

	var cmd string
	if req.Move {
		cmd = fmt.Sprintf("mv '%s' '%s'", req.SrcPath, req.DestPath)
	} else {
		cmd = fmt.Sprintf("cp -r '%s' '%s'", req.SrcPath, req.DestPath)
	}

	if runErr := sshSession.Run(cmd); runErr != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg == "" {
			errMsg = runErr.Error()
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Operation failed: " + errMsg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Item successfully transferred",
	})
}

