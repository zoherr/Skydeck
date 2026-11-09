package session

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

// ConnectConfig stores credentials to allow auto-reconnect if dropped
type ConnectConfig struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	AuthType   string `json:"auth_type"` // "password" or "key"
	Password   string `json:"password,omitempty"`
	KeyPath    string `json:"key_path,omitempty"`
	Passphrase string `json:"passphrase,omitempty"`
	TrustHost  bool   `json:"trust_host"`
}

// Session represents an active SSH/SFTP session
type Session struct {
	ID         string
	SSHClient  *ssh.Client
	SFTPClient *sftp.Client
	Config     ConnectConfig
	LastUsed   time.Time
	CreatedAt  time.Time
	mu         sync.Mutex
}

// Manager maintains all active SSH/SFTP sessions
type Manager struct {
	sessions sync.Map // map[string]*Session
	timeout  time.Duration
}

// Global session manager instance
var DefaultManager *Manager

func init() {
	DefaultManager = NewManager(30 * time.Minute)
}

// NewManager creates a new SessionManager and starts the reaper goroutine
func NewManager(timeout time.Duration) *Manager {
	m := &Manager{
		timeout: timeout,
	}
	go m.sweepExpired()
	return m
}

// CreateSession establishes an SSH and SFTP connection and registers the session
func (m *Manager) CreateSession(cfg ConnectConfig) (*Session, string, error) {
	if cfg.Port <= 0 {
		cfg.Port = 22
	}

	sshClient, err := dialSSH(cfg)
	if err != nil {
		return nil, "", fmt.Errorf("ssh connection failed: %w", err)
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		sshClient.Close()
		return nil, "", fmt.Errorf("sftp client creation failed: %w", err)
	}

	initialPath, err := sftpClient.Getwd()
	if err != nil || initialPath == "" {
		initialPath = "/"
	}

	sess := &Session{
		ID:         uuid.New().String(),
		SSHClient:  sshClient,
		SFTPClient: sftpClient,
		Config:     cfg,
		LastUsed:   time.Now(),
		CreatedAt:  time.Now(),
	}

	m.sessions.Store(sess.ID, sess)
	log.Printf("[Session] Created new session %s for %s@%s:%d", sess.ID, cfg.Username, cfg.Host, cfg.Port)
	return sess, initialPath, nil
}

// GetSession retrieves an active session by ID and updates its last-used timestamp
func (m *Manager) GetSession(id string) (*Session, error) {
	val, ok := m.sessions.Load(id)
	if !ok {
		return nil, errors.New("session not found or expired")
	}

	sess := val.(*Session)
	sess.mu.Lock()
	defer sess.mu.Unlock()

	// Check if session timed out
	if time.Since(sess.LastUsed) > m.timeout {
		m.closeSessionLocked(sess)
		m.sessions.Delete(id)
		return nil, errors.New("session expired due to inactivity")
	}

	sess.LastUsed = time.Now()

	// Verify SFTP connection is still alive, attempt auto-reconnect if broken
	if sess.SFTPClient == nil || isClosed(sess.SFTPClient) {
		log.Printf("[Session] Session %s connection lost. Attempting auto-reconnect...", sess.ID)
		if err := m.reconnectLocked(sess); err != nil {
			return nil, fmt.Errorf("session connection lost and auto-reconnect failed: %w", err)
		}
		log.Printf("[Session] Session %s successfully auto-reconnected", sess.ID)
	}

	return sess, nil
}

// CloseSession terminates and removes a session
func (m *Manager) CloseSession(id string) error {
	val, ok := m.sessions.LoadAndDelete(id)
	if !ok {
		return nil
	}
	sess := val.(*Session)
	sess.mu.Lock()
	defer sess.mu.Unlock()
	m.closeSessionLocked(sess)
	log.Printf("[Session] Closed session %s", id)
	return nil
}

func (m *Manager) closeSessionLocked(sess *Session) {
	if sess.SFTPClient != nil {
		_ = sess.SFTPClient.Close()
		sess.SFTPClient = nil
	}
	if sess.SSHClient != nil {
		_ = sess.SSHClient.Close()
		sess.SSHClient = nil
	}
}

func (m *Manager) reconnectLocked(sess *Session) error {
	m.closeSessionLocked(sess)

	sshClient, err := dialSSH(sess.Config)
	if err != nil {
		return err
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		sshClient.Close()
		return err
	}

	sess.SSHClient = sshClient
	sess.SFTPClient = sftpClient
	sess.LastUsed = time.Now()
	return nil
}

// Background reaper for expired sessions
func (m *Manager) sweepExpired() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		m.sessions.Range(func(key, value any) bool {
			sess := value.(*Session)
			sess.mu.Lock()
			if now.Sub(sess.LastUsed) > m.timeout {
				log.Printf("[Session] Sweeping inactive session %s (last used: %v ago)", sess.ID, now.Sub(sess.LastUsed))
				m.closeSessionLocked(sess)
				m.sessions.Delete(key)
			}
			sess.mu.Unlock()
			return true
		})
	}
}

func isClosed(client *sftp.Client) bool {
	// Try a lightweight stat check on current directory
	_, err := client.Getwd()
	return err != nil
}

func dialSSH(cfg ConnectConfig) (*ssh.Client, error) {
	var authMethods []ssh.AuthMethod

	if cfg.AuthType == "password" {
		if cfg.Password == "" {
			return nil, errors.New("password cannot be empty for password auth")
		}
		authMethods = append(authMethods, ssh.Password(cfg.Password))
	} else if cfg.AuthType == "key" {
		if cfg.KeyPath == "" {
			return nil, errors.New("private key path cannot be empty")
		}
		keyBytes, err := os.ReadFile(cfg.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read private key file: %w", err)
		}

		var signer ssh.Signer
		if cfg.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(keyBytes, []byte(cfg.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(keyBytes)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	} else {
		return nil, fmt.Errorf("unsupported auth type: %s", cfg.AuthType)
	}

	var hostKeyCallback ssh.HostKeyCallback
	if cfg.TrustHost {
		hostKeyCallback = ssh.InsecureIgnoreHostKey()
	} else {
		// Attempt known_hosts lookup in user home
		homeDir, err := os.UserHomeDir()
		if err == nil {
			knownHostsPath := filepath.Join(homeDir, ".ssh", "known_hosts")
			if _, err := os.Stat(knownHostsPath); err == nil {
				cb, err := knownhosts.New(knownHostsPath)
				if err == nil {
					hostKeyCallback = cb
				}
			}
		}
		if hostKeyCallback == nil {
			// If no known_hosts file exists and user did not specify trust, fallback to accepting with warning
			log.Println("[SSH] Warning: known_hosts not found, accepting host key")
			hostKeyCallback = ssh.InsecureIgnoreHostKey()
		}
	}

	sshConfig := &ssh.ClientConfig{
		User:            cfg.Username,
		Auth:            authMethods,
		HostKeyCallback: hostKeyCallback,
		Timeout:         10 * time.Second,
	}

	addr := net.JoinHostPort(cfg.Host, fmt.Sprintf("%d", cfg.Port))
	return ssh.Dial("tcp", addr, sshConfig)
}

// CopyFileStream streams an io.Reader to a remote path via SFTP
func (s *Session) CopyFileStream(remotePath string, src io.Reader) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	f, err := s.SFTPClient.Create(remotePath)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	return io.Copy(f, src)
}

