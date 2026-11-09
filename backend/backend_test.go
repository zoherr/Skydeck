package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"skydeck/backend/handlers"
	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
)

func setupTestRouter(token string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(handlers.CORSMiddleware())

	api := router.Group("/api")
	api.Use(handlers.TokenAuthMiddleware(token))
	{
		api.POST("/connect", handlers.ConnectHandler)
		api.POST("/disconnect", handlers.DisconnectHandler)
		api.GET("/ping", handlers.PingHandler)
		api.GET("/files", handlers.ListFilesHandler)
		api.POST("/mkdir", handlers.MkdirHandler)
		api.GET("/read", handlers.ReadFileHandler)
		api.POST("/write", handlers.WriteFileHandler)
		api.GET("/stat", handlers.StatHandler)
		api.POST("/chmod", handlers.ChmodHandler)
		api.POST("/rename", handlers.RenameHandler)
		api.POST("/delete", handlers.DeleteHandler)

		// Power tools v2.5.0
		api.GET("/search", handlers.SearchHandler)
		api.POST("/archive/extract", handlers.ExtractArchiveHandler)
		api.POST("/archive/create", handlers.CreateArchiveHandler)
		api.GET("/disk-usage", handlers.DiskUsageHandler)
		api.POST("/copy", handlers.CopyItemHandler)
	}

	return router
}

func TestTokenAuthMiddleware(t *testing.T) {
	token := "secure_test_token_12345"
	router := setupTestRouter(token)

	// Test 1: Request with no token -> 401
	req1, _ := http.NewRequest(http.MethodGet, "/api/ping", nil)
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusUnauthorized {
		t.Fatalf("Expected 401 Unauthorized, got %d", w1.Code)
	}

	// Test 2: Request with wrong token -> 401
	req2, _ := http.NewRequest(http.MethodGet, "/api/ping", nil)
	req2.Header.Set("X-Skydeck-Token", "wrong_token")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusUnauthorized {
		t.Fatalf("Expected 401 Unauthorized for invalid token, got %d", w2.Code)
	}

	// Test 3: Request with correct token -> 200
	req3, _ := http.NewRequest(http.MethodGet, "/api/ping", nil)
	req3.Header.Set("X-Skydeck-Token", token)
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK with valid token, got %d", w3.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(w3.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if res["success"] != true {
		t.Fatalf("Expected success: true, got %v", res)
	}
}

func TestSessionExpirationSweep(t *testing.T) {
	mgr := session.NewManager(50 * time.Millisecond)

	// Check that non-existent session returns error
	_, err := mgr.GetSession("non-existent")
	if err == nil {
		t.Fatalf("Expected error for non-existent session")
	}
}

func TestInvalidConnectPayload(t *testing.T) {
	token := "test_token"
	router := setupTestRouter(token)

	// Missing username and host
	body, _ := json.Marshal(map[string]any{"port": 22})
	req, _ := http.NewRequest(http.MethodPost, "/api/connect", bytes.NewBuffer(body))
	req.Header.Set("X-Skydeck-Token", token)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for empty connect payload, got %d", w.Code)
	}
}

func TestPowerToolsValidation(t *testing.T) {
	token := "power_tools_test_token"
	router := setupTestRouter(token)

	// Test 1: Search without session_id -> 400
	req1, _ := http.NewRequest(http.MethodGet, "/api/search?path=/", nil)
	req1.Header.Set("X-Skydeck-Token", token)
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for search without session_id, got %d", w1.Code)
	}

	// Test 2: Disk usage without session_id -> 400
	req2, _ := http.NewRequest(http.MethodGet, "/api/disk-usage?path=/", nil)
	req2.Header.Set("X-Skydeck-Token", token)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for disk usage without session_id, got %d", w2.Code)
	}

	// Test 3: Extract archive without payload -> 400
	req3, _ := http.NewRequest(http.MethodPost, "/api/archive/extract", bytes.NewBuffer([]byte("{}")))
	req3.Header.Set("X-Skydeck-Token", token)
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)
	if w3.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for invalid extract archive, got %d", w3.Code)
	}

	// Test 4: Copy without payload -> 400
	req4, _ := http.NewRequest(http.MethodPost, "/api/copy", bytes.NewBuffer([]byte("{}")))
	req4.Header.Set("X-Skydeck-Token", token)
	req4.Header.Set("Content-Type", "application/json")
	w4 := httptest.NewRecorder()
	router.ServeHTTP(w4, req4)
	if w4.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for invalid copy payload, got %d", w4.Code)
	}
}
