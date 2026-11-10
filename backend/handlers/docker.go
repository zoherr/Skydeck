package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"skydeck/backend/session"

	"github.com/gin-gonic/gin"
)

type DockerContainer struct {
	ID      string `json:"id"`
	Names   string `json:"names"`
	Image   string `json:"image"`
	Status  string `json:"status"`
	State   string `json:"state"`
	Ports   string `json:"ports"`
	Created string `json:"created"`
}

type DockerImage struct {
	ID         string `json:"id"`
	Repository string `json:"repository"`
	Tag        string `json:"tag"`
	Size       string `json:"size"`
	Created    string `json:"created"`
}

type DockerVolume struct {
	Name       string `json:"name"`
	Driver     string `json:"driver"`
	Mountpoint string `json:"mountpoint"`
}

// DockerOverviewHandler retrieves containers, images, and volumes
func DockerOverviewHandler(c *gin.Context) {
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

	// Check if docker CLI is available and accessible
	verOut, verErrOut, verErr := runSSHCommand(sess.SSHClient, "docker version --format '{{.Server.Version}}' 2>&1")
	if verErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"available": false,
			"reason":    strings.TrimSpace(verOut + " " + verErrOut),
		})
		return
	}

	script := `
echo "===CONTAINERS==="
docker ps -a --format '{{json .}}' 2>/dev/null
echo "===IMAGES==="
docker images --format '{{json .}}' 2>/dev/null
echo "===VOLUMES==="
docker volume ls --format '{{json .}}' 2>/dev/null
`
	out, _, _ := runSSHCommand(sess.SSHClient, script)
	sections := parseTelemetrySections(out)

	var containers []DockerContainer
	for _, line := range strings.Split(strings.TrimSpace(sections["CONTAINERS"]), "\n") {
		if line == "" {
			continue
		}
		var raw map[string]any
		if json.Unmarshal([]byte(line), &raw) == nil {
			containers = append(containers, DockerContainer{
				ID:      strField(raw, "ID"),
				Names:   strField(raw, "Names"),
				Image:   strField(raw, "Image"),
				Status:  strField(raw, "Status"),
				State:   strField(raw, "State"),
				Ports:   strField(raw, "Ports"),
				Created: strField(raw, "CreatedAt"),
			})
		}
	}

	var images []DockerImage
	for _, line := range strings.Split(strings.TrimSpace(sections["IMAGES"]), "\n") {
		if line == "" {
			continue
		}
		var raw map[string]any
		if json.Unmarshal([]byte(line), &raw) == nil {
			images = append(images, DockerImage{
				ID:         strField(raw, "ID"),
				Repository: strField(raw, "Repository"),
				Tag:        strField(raw, "Tag"),
				Size:       strField(raw, "Size"),
				Created:    strField(raw, "CreatedSince"),
			})
		}
	}

	var volumes []DockerVolume
	for _, line := range strings.Split(strings.TrimSpace(sections["VOLUMES"]), "\n") {
		if line == "" {
			continue
		}
		var raw map[string]any
		if json.Unmarshal([]byte(line), &raw) == nil {
			volumes = append(volumes, DockerVolume{
				Name:       strField(raw, "Name"),
				Driver:     strField(raw, "Driver"),
				Mountpoint: strField(raw, "Mountpoint"),
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"available":      true,
		"server_version": strings.TrimSpace(verOut),
		"containers":     containers,
		"images":         images,
		"volumes":        volumes,
	})
}

func strField(m map[string]any, k string) string {
	if v, ok := m[k]; ok && v != nil {
		return fmt.Sprintf("%v", v)
	}
	return ""
}

type DockerActionRequest struct {
	SessionID   string `json:"session_id" binding:"required"`
	ContainerID string `json:"container_id" binding:"required"`
	Action      string `json:"action" binding:"required"` // start, stop, restart, pause, unpause, rm
}

// DockerContainerActionHandler controls lifecycle state of a Docker container
func DockerContainerActionHandler(c *gin.Context) {
	var req DockerActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if !isValidSafeIdent(req.ContainerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid container identifier"})
		return
	}

	allowed := map[string]bool{
		"start":   true,
		"stop":    true,
		"restart": true,
		"pause":   true,
		"unpause": true,
		"rm":      true,
	}
	if !allowed[req.Action] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported docker action"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var cmd string
	if req.Action == "rm" {
		cmd = fmt.Sprintf("docker rm -f %s", shellQuote(req.ContainerID))
	} else {
		cmd = fmt.Sprintf("docker %s %s", req.Action, shellQuote(req.ContainerID))
	}

	_, stderr, err := runSSHCommand(sess.SSHClient, cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Docker action failed: " + strings.TrimSpace(stderr)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Container %s: %s succeeded", req.ContainerID, req.Action),
	})
}

// DockerContainerLogsHandler fetches container log output
func DockerContainerLogsHandler(c *gin.Context) {
	sessionID := c.Query("session_id")
	containerID := c.Query("container_id")
	tail := c.DefaultQuery("tail", "200")

	if sessionID == "" || !isValidSafeIdent(containerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid session_id and container_id required"})
		return
	}

	sess, err := session.DefaultManager.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("docker logs --tail %s %s 2>&1", shellQuote(tail), shellQuote(containerID))
	out, _, err := runSSHCommand(sess.SSHClient, cmd)
	if err != nil && out == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"logs":    out,
	})
}

// DockerPruneHandler cleans unused images and stopped containers
func DockerPruneHandler(c *gin.Context) {
	var req struct {
		SessionID string `json:"session_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	sess, err := session.DefaultManager.GetSession(req.SessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	out, stderr, err := runSSHCommand(sess.SSHClient, "docker system prune -f")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Prune failed: " + stderr})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"output":  out,
	})
}

