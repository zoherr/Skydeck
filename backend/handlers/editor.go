package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
)

const maxEditorFileSize = 15 * 1024 * 1024 // 15 MB limit for in-app text editor

type WriteFileRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Path      string `json:"path" binding:"required"`
	Content   string `json:"content"`
}

// ReadFileHandler loads the text contents of a remote file for editing
func ReadFileHandler(c *gin.Context) {
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

	stat, err := sess.SFTPClient.Stat(filePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "File not found: " + err.Error()})
		return
	}

	if stat.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Cannot open a directory as text"})
		return
	}

	if stat.Size() > maxEditorFileSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   fmt.Sprintf("File is too large (%d MB) to open in text editor. Max allowed is 15MB.", stat.Size()/(1024*1024)),
		})
		return
	}

	remoteFile, err := sess.SFTPClient.Open(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to open file: " + err.Error()})
		return
	}
	defer remoteFile.Close()

	contentBytes, err := io.ReadAll(remoteFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to read file contents: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"path":    filePath,
			"content": string(contentBytes),
			"size":    len(contentBytes),
		},
	})
}

// WriteFileHandler writes updated text back to the remote file
func WriteFileHandler(c *gin.Context) {
	var req WriteFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	f, err := sess.SFTPClient.OpenFile(req.Path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to open remote file for writing: " + err.Error()})
		return
	}
	defer f.Close()

	written, err := f.Write([]byte(req.Content))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to write content: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"path":          req.Path,
			"bytes_written": written,
		},
	})
}

