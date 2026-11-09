package handlers

import (
	"net/http"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
)

type DisconnectRequest struct {
	SessionID string `json:"session_id" binding:"required"`
}

// ConnectHandler establishes an SSH/SFTP connection
func ConnectHandler(c *gin.Context) {
	var req session.ConnectConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid connection payload: " + err.Error(),
		})
		return
	}

	if req.Host == "" || req.Username == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Host and username are required",
		})
		return
	}

	sess, initialPath, err := session.DefaultManager.CreateSession(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"session_id":   sess.ID,
			"host":         req.Host,
			"port":         req.Port,
			"username":     req.Username,
			"initial_path": initialPath,
		},
	})
}

// DisconnectHandler terminates an active session
func DisconnectHandler(c *gin.Context) {
	var req DisconnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "session_id is required",
		})
		return
	}

	_ = session.DefaultManager.CloseSession(req.SessionID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
	})
}

// PingHandler checks health and optional session status
func PingHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	sessionActive := false

	if sessionID != "" {
		_, err := session.DefaultManager.GetSession(sessionID)
		sessionActive = (err == nil)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"status":         "ok",
			"session_active": sessionActive,
		},
	})
}
