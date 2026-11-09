package main

import (
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"skydeck/backend/handlers"

	"github.com/gin-gonic/gin"
)

// RotatingFileWriter implements a simple rotating file logger
type RotatingFileWriter struct {
	mu      sync.Mutex
	dir     string
	base    string
	maxSize int64
	file    *os.File
	size    int64
}

func NewRotatingFileWriter(dir, base string, maxSize int64) (*RotatingFileWriter, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	w := &RotatingFileWriter{
		dir:     dir,
		base:    base,
		maxSize: maxSize,
	}

	if err := w.openFile(); err != nil {
		return nil, err
	}
	return w, nil
}

func (w *RotatingFileWriter) openFile() error {
	path := filepath.Join(w.dir, w.base)
	info, err := os.Stat(path)
	if err == nil {
		w.size = info.Size()
	} else {
		w.size = 0
	}

	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return err
	}
	w.file = f
	return nil
}

func (w *RotatingFileWriter) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	writeLen := int64(len(p))
	if w.size+writeLen > w.maxSize {
		_ = w.file.Close()
		currentPath := filepath.Join(w.dir, w.base)
		backupPath := filepath.Join(w.dir, fmt.Sprintf("%s.%s", w.base, time.Now().Format("20060102-150405")))
		_ = os.Rename(currentPath, backupPath)
		_ = w.openFile()
	}

	n, err = w.file.Write(p)
	w.size += int64(n)
	return n, err
}

func generateSecureToken() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		// Fallback timestamp token
		return fmt.Sprintf("skydeck_%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func main() {
	port := flag.Int("port", 48921, "Port to listen on (localhost only)")
	tokenFlag := flag.String("token", "", "Pre-shared security token")
	logDir := flag.String("log-dir", "./logs", "Directory for application logs")
	flag.Parse()

	// Environment variable overrides
	if envToken := os.Getenv("SKYDECK_TOKEN"); envToken != "" && *tokenFlag == "" {
		*tokenFlag = envToken
	}

	token := *tokenFlag
	if token == "" {
		token = generateSecureToken()
	}

	// Setup rotating file logger + stdout
	rotator, err := NewRotatingFileWriter(*logDir, "skydeck-backend.log", 10*1024*1024)
	var multiWriter io.Writer
	if err != nil {
		fmt.Printf("[Warning] Could not initialize rotating log file: %v\n", err)
		multiWriter = os.Stdout
	} else {
		multiWriter = io.MultiWriter(os.Stdout, rotator)
	}

	logger := log.New(multiWriter, "[Skydeck] ", log.LstdFlags|log.Lmicroseconds)
	logger.Printf("Starting Skydeck Backend on 127.0.0.1:%d", *port)
	logger.Printf("Log directory: %s", *logDir)

	// Explicitly print token to stdout for parent Electron process handshake
	fmt.Printf("SKYDECK_TOKEN=%s\n", token)
	logger.Println("Security token initialized.")

	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(handlers.CORSMiddleware())
	router.Use(handlers.LoggingMiddleware(logger))

	// Public ping endpoint (allows checking backend health before token handshake if needed, or with token)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "app": "Skydeck"})
	})

	// Protected API routes
	api := router.Group("/api")
	api.Use(handlers.TokenAuthMiddleware(token))
	{
		// Connection & Session
		api.POST("/connect", handlers.ConnectHandler)
		api.POST("/disconnect", handlers.DisconnectHandler)
		api.GET("/ping", handlers.PingHandler)

		// File operations
		api.GET("/files", handlers.ListFilesHandler)
		api.POST("/upload", handlers.UploadHandler)
		api.POST("/download", handlers.DownloadHandler)
		api.GET("/download", handlers.DownloadHandler) // Support GET download with query token
		api.POST("/delete", handlers.DeleteHandler)
		api.POST("/rename", handlers.RenameHandler)
		api.POST("/mkdir", handlers.MkdirHandler)
		api.GET("/stat", handlers.StatHandler)
		api.POST("/chmod", handlers.ChmodHandler)

		// Text Editor
		api.GET("/read", handlers.ReadFileHandler)
		api.POST("/write", handlers.WriteFileHandler)

		// Interactive SSH Terminal (PTY Stream)
		api.GET("/terminal/ws", handlers.WebSocketTerminalHandler)
	}

	// Strictly bind to 127.0.0.1 ONLY (never 0.0.0.0)
	bindAddr := fmt.Sprintf("127.0.0.1:%d", *port)
	logger.Printf("Skydeck backend listening strictly on %s", bindAddr)

	server := &http.Server{
		Addr:         bindAddr,
		Handler:      router,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Fatalf("Server failed to run: %v", err)
	}
}

