package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
	"github.com/pkg/sftp"
)

type FileItem struct {
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	IsDir     bool      `json:"is_dir"`
	IsSymlink bool      `json:"is_symlink"`
	Size      int64     `json:"size"`
	Mode      string    `json:"mode"`
	OctalMode string    `json:"octal_mode"`
	ModTime   time.Time `json:"mod_time"`
	Extension string    `json:"extension"`
}

type DeleteRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Path      string `json:"path" binding:"required"`
	IsDir     bool   `json:"is_dir"`
}

type RenameRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	OldPath   string `json:"old_path" binding:"required"`
	NewPath   string `json:"new_path" binding:"required"`
}

type MkdirRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Path      string `json:"path" binding:"required"`
}

type ChmodRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Path      string `json:"path" binding:"required"`
	Mode      string `json:"mode" binding:"required"` // e.g. "0755" or "755"
}

// ListFilesHandler lists the contents of a remote directory
func ListFilesHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	dirPath := c.Query("path")

	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "session_id is required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	if dirPath == "" {
		wd, err := sess.SFTPClient.Getwd()
		if err != nil || wd == "" {
			dirPath = "/"
		} else {
			dirPath = wd
		}
	}

	// SFTP paths always use unix forward slashes
	cleanPath := path.Clean(dirPath)
	if !strings.HasPrefix(cleanPath, "/") {
		cleanPath = "/" + cleanPath
	}

	entries, err := sess.SFTPClient.ReadDir(cleanPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": fmt.Sprintf("Failed to read directory: %v", err)})
		return
	}

	var items []FileItem
	for _, entry := range entries {
		itemPath := path.Join(cleanPath, entry.Name())
		isDir := entry.IsDir()
		isSymlink := (entry.Mode() & os.ModeSymlink) != 0

		ext := ""
		if !isDir {
			ext = strings.ToLower(path.Ext(entry.Name()))
		}

		items = append(items, FileItem{
			Name:      entry.Name(),
			Path:      itemPath,
			IsDir:     isDir,
			IsSymlink: isSymlink,
			Size:      entry.Size(),
			Mode:      entry.Mode().String(),
			OctalMode: fmt.Sprintf("%04o", entry.Mode().Perm()),
			ModTime:   entry.ModTime(),
			Extension: ext,
		})
	}

	// Sort folders first alphabetically, then files alphabetically
	sort.Slice(items, func(i, j int) bool {
		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	parentPath := path.Dir(cleanPath)
	if cleanPath == "/" {
		parentPath = "/"
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"path":        cleanPath,
			"parent_path": parentPath,
			"entries":     items,
			"total":       len(items),
		},
	})
}

// UploadHandler handles multipart file uploads
func UploadHandler(c *gin.Context) {
	sessionID := c.PostForm("session_id")
	remoteDir := c.PostForm("remote_dir")

	if sessionID == "" || remoteDir == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "session_id and remote_dir are required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Multipart form parse error: " + err.Error()})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		files = form.File["file"]
	}
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "No files provided in upload request"})
		return
	}

	var uploaded []gin.H
	for _, fileHeader := range files {
		src, err := fileHeader.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to open upload stream: " + err.Error()})
			return
		}

		targetRemotePath := path.Join(remoteDir, filepath.Base(fileHeader.Filename))
		written, err := sess.CopyFileStream(targetRemotePath, src)
		src.Close()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": fmt.Sprintf("Failed to write %s: %v", fileHeader.Filename, err)})
			return
		}

		uploaded = append(uploaded, gin.H{
			"filename": fileHeader.Filename,
			"path":     targetRemotePath,
			"bytes":    written,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"uploaded": uploaded,
		},
	})
}

// DownloadHandler streams remote file content to the client
func DownloadHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	filePath := c.Query("path")

	if sessionID == "" {
		sessionID = c.PostForm("session_id")
	}
	if filePath == "" {
		filePath = c.PostForm("path")
	}

	if sessionID == "" || filePath == "" {
		var req struct {
			SessionID string `json:"session_id"`
			Path      string `json:"path"`
		}
		if err := c.ShouldBindJSON(&req); err == nil {
			sessionID = req.SessionID
			filePath = req.Path
		}
	}

	if sessionID == "" || filePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "session_id and path are required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	stat, err := sess.SFTPClient.Stat(filePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Remote file not found: " + err.Error()})
		return
	}

	if stat.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Cannot download directory directly"})
		return
	}

	remoteFile, err := sess.SFTPClient.Open(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to open remote file: " + err.Error()})
		return
	}
	defer remoteFile.Close()

	fileName := path.Base(filePath)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Length", strconv.FormatInt(stat.Size(), 10))

	_, err = io.Copy(c.Writer, remoteFile)
	if err != nil {
		// Connection may have been severed mid-stream
		return
	}
}

// DeleteHandler removes a remote file or directory
func DeleteHandler(c *gin.Context) {
	var req DeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.IsDir {
		err = removeAllSFTP(sess.SFTPClient, req.Path)
	} else {
		err = sess.SFTPClient.Remove(req.Path)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to delete: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// removeAllSFTP recursively deletes remote directories and files
func removeAllSFTP(client *sftp.Client, remotePath string) error {
	entries, err := client.ReadDir(remotePath)
	if err != nil {
		// Maybe it's a file, try remove directly
		return client.Remove(remotePath)
	}

	for _, entry := range entries {
		subPath := path.Join(remotePath, entry.Name())
		if entry.IsDir() {
			if err := removeAllSFTP(client, subPath); err != nil {
				return err
			}
		} else {
			if err := client.Remove(subPath); err != nil {
				return err
			}
		}
	}

	return client.RemoveDirectory(remotePath)
}

// RenameHandler renames or moves a remote file/directory
func RenameHandler(c *gin.Context) {
	var req RenameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := sess.SFTPClient.Rename(req.OldPath, req.NewPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to rename: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// MkdirHandler creates a remote directory
func MkdirHandler(c *gin.Context) {
	var req MkdirRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := sess.SFTPClient.MkdirAll(req.Path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create directory: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// StatHandler retrieves details and permissions of a file
func StatHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	filePath := c.Query("path")

	if sessionID == "" || filePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "session_id and path are required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	entry, err := sess.SFTPClient.Stat(filePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Stat failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": FileItem{
			Name:      entry.Name(),
			Path:      filePath,
			IsDir:     entry.IsDir(),
			IsSymlink: (entry.Mode() & os.ModeSymlink) != 0,
			Size:      entry.Size(),
			Mode:      entry.Mode().String(),
			OctalMode: fmt.Sprintf("%04o", entry.Mode().Perm()),
			ModTime:   entry.ModTime(),
			Extension: strings.ToLower(path.Ext(entry.Name())),
		},
	})
}

// ChmodHandler changes permissions of a remote file or directory
func ChmodHandler(c *gin.Context) {
	var req ChmodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	modeClean := strings.TrimPrefix(req.Mode, "0")
	parsed, err := strconv.ParseUint(modeClean, 8, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid octal mode string: " + req.Mode})
		return
	}

	if err := sess.SFTPClient.Chmod(req.Path, os.FileMode(parsed)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to chmod: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"path": req.Path,
			"mode": fmt.Sprintf("0%03o", parsed),
		},
	})
}

