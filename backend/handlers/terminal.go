package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Local communication only (127.0.0.1)
		return true
	},
}

type TerminalMessage struct {
	Type string `json:"type"` // "input", "resize"
	Data string `json:"data,omitempty"`
	Cols int    `json:"cols,omitempty"`
	Rows int    `json:"rows,omitempty"`
}

// WebSocketTerminalHandler establishes an interactive PTY terminal stream over WebSocket
func WebSocketTerminalHandler(c *gin.Context) {
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

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[Terminal] WebSocket upgrade failed: %v", err)
		return
	}
	defer ws.Close()

	sshSession, err := sess.SSHClient.NewSession()
	if err != nil {
		log.Printf("[Terminal] Failed to create SSH session: %v", err)
		ws.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31mFailed to allocate SSH session: "+err.Error()+"\x1b[0m\r\n"))
		return
	}
	defer sshSession.Close()

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}

	// Default dimensions 80x24 until frontend sends initial resize
	if err := sshSession.RequestPty("xterm-256color", 24, 80, modes); err != nil {
		log.Printf("[Terminal] Failed to request PTY: %v", err)
		ws.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31mPTY allocation failed: "+err.Error()+"\x1b[0m\r\n"))
		return
	}

	stdinPipe, err := sshSession.StdinPipe()
	if err != nil {
		log.Printf("[Terminal] Stdin pipe error: %v", err)
		return
	}

	stdoutPipe, err := sshSession.StdoutPipe()
	if err != nil {
		log.Printf("[Terminal] Stdout pipe error: %v", err)
		return
	}

	stderrPipe, err := sshSession.StderrPipe()
	if err != nil {
		log.Printf("[Terminal] Stderr pipe error: %v", err)
		return
	}

	if err := sshSession.Shell(); err != nil {
		log.Printf("[Terminal] Shell startup error: %v", err)
		ws.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31mShell startup failed: "+err.Error()+"\x1b[0m\r\n"))
		return
	}

	var writeMutex sync.Mutex

	// Pump stdout/stderr to WebSocket
	pumpOutput := func(r io.Reader) {
		buf := make([]byte, 4096)
		for {
			n, err := r.Read(buf)
			if n > 0 {
				writeMutex.Lock()
				_ = ws.WriteMessage(websocket.BinaryMessage, buf[:n])
				writeMutex.Unlock()
			}
			if err != nil {
				break
			}
		}
	}

	go pumpOutput(stdoutPipe)
	go pumpOutput(stderrPipe)

	// Pump WebSocket messages to stdin / window resize
	for {
		messageType, p, err := ws.ReadMessage()
		if err != nil {
			break
		}

		if messageType == websocket.TextMessage {
			var msg TerminalMessage
			if err := json.Unmarshal(p, &msg); err == nil {
				if msg.Type == "resize" && msg.Cols > 0 && msg.Rows > 0 {
					_ = sshSession.WindowChange(msg.Rows, msg.Cols)
					continue
				}
				if msg.Type == "input" {
					_, _ = stdinPipe.Write([]byte(msg.Data))
					continue
				}
			}
			// If not a JSON control message, treat raw text as stdin
			_, _ = stdinPipe.Write(p)
		} else if messageType == websocket.BinaryMessage {
			_, _ = stdinPipe.Write(p)
		}
	}
}

