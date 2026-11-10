package handlers

import (
	"bytes"
	"fmt"
	"regexp"
	"strings"

	"golang.org/x/crypto/ssh"
)

var (
	safeIdentRegex = regexp.MustCompile(`^[a-zA-Z0-9_.\-:@/]+$`)
	safeHostRegex  = regexp.MustCompile(`^[a-zA-Z0-9.\-:]+$`)
	safePortRegex  = regexp.MustCompile(`^[0-9]{1,5}(/[a-zA-Z]{3})?$`)
)

// isValidSafeIdent checks if an identifier (container ID, service name, host, etc.) is free of shell metacharacters
func isValidSafeIdent(s string) bool {
	return s != "" && len(s) <= 256 && safeIdentRegex.MatchString(s) && !strings.Contains(s, "..")
}

// isValidHost checks hostnames / IP strings
func isValidHost(s string) bool {
	return s != "" && len(s) <= 255 && safeHostRegex.MatchString(s)
}

// isValidPortSpec validates ports like "80", "443/tcp", "53/udp"
func isValidPortSpec(s string) bool {
	return safePortRegex.MatchString(s)
}

// shellQuote wraps an argument safely for POSIX sh single-quoting
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

// runSSHCommand runs a single command over an SSH client and captures stdout/stderr
func runSSHCommand(client *ssh.Client, cmd string) (string, string, error) {
	sess, err := client.NewSession()
	if err != nil {
		return "", "", fmt.Errorf("failed to create SSH session: %w", err)
	}
	defer sess.Close()

	var stdout, stderr bytes.Buffer
	sess.Stdout = &stdout
	sess.Stderr = &stderr

	runErr := sess.Run(cmd)
	return stdout.String(), stderr.String(), runErr
}

