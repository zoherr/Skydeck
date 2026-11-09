package handlers

import (
	"crypto/subtle"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// TokenAuthMiddleware enforces security token validation on all API endpoints
func TokenAuthMiddleware(validToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Token can be sent in Header X-Skydeck-Token or Authorization: Bearer <token>
		// or query param "token" (for direct download streams)
		providedToken := c.GetHeader("X-Skydeck-Token")
		if providedToken == "" {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				providedToken = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}
		if providedToken == "" {
			providedToken = c.Query("token")
		}

		if providedToken == "" || subtle.ConstantTimeCompare([]byte(providedToken), []byte(validToken)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Unauthorized: missing or invalid security token",
			})
			return
		}

		c.Next()
	}
}

// CORSMiddleware allows local cross-origin requests from the Electron frontend
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		if origin == "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Skydeck-Token")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// LoggingMiddleware logs detailed request data with timestamps
func LoggingMiddleware(logger *log.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()

		if raw != "" {
			path = path + "?" + raw
		}

		msg := "[HTTP] " + time.Now().Format("2006-01-02 15:04:05") + " | " +
			method + " " + path + " | Status: " + http.StatusText(statusCode) +
			" (" + string(rune(statusCode)) + ") | Latency: " + latency.String() + " | IP: " + clientIP

		logger.Println(msg)
	}
}
