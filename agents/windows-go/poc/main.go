package main

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net"
	"net/url"
	"os"
	osuser "os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Message struct {
	Type    string `json:"type"`
	ID      string `json:"id,omitempty"`
	Payload string `json:"payload,omitempty"`
}

type CompileResult struct {
	Type        string `json:"type"`
	ID          string `json:"id,omitempty"`
	Success     bool   `json:"success"`
	Diagnostics string `json:"diagnostics,omitempty"`
}

type TelemetryEvent struct {
	Timestamp string            `json:"timestamp"`
	TenantID  string            `json:"tenant_id"`
	AgentID   string            `json:"agent_id"`
	Host      string            `json:"host"`
	Env       string            `json:"env"`
	EventType string            `json:"event_type"`
	Severity  string            `json:"severity"`
	Message   string            `json:"message"`
	Fields    map[string]string `json:"fields,omitempty"`
}

type lokiPushRequest struct {
	Streams []struct {
		Stream map[string]string `json:"stream"`
		Values [][]string        `json:"values"`
	} `json:"streams"`
}

type TelemetryClient struct {
	enabled   bool
	pushURL   string
	tenantID  string
	host      string
	env       string
	queue     chan TelemetryEvent
	http      *http.Client
	agentID   string
	agentIDMu sync.RWMutex
}

func NewTelemetryClient(enabled bool, pushURL, tenantID, env string) *TelemetryClient {
	host, err := os.Hostname()
	if err != nil {
		host = "unknown-host"
	}
	c := &TelemetryClient{
		enabled:  enabled,
		pushURL:  pushURL,
		tenantID: tenantID,
		host:     host,
		env:      env,
		queue:    make(chan TelemetryEvent, 200),
		http: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
	if enabled {
		go c.run()
	}
	return c
}

func (c *TelemetryClient) SetAgentID(agentID string) {
	c.agentIDMu.Lock()
	c.agentID = agentID
	c.agentIDMu.Unlock()
}

func (c *TelemetryClient) currentAgentID() string {
	c.agentIDMu.RLock()
	defer c.agentIDMu.RUnlock()
	if c.agentID == "" {
		return "unassigned"
	}
	return c.agentID
}

func (c *TelemetryClient) Emit(eventType, severity, message string, fields map[string]string) {
	if !c.enabled {
		return
	}
	event := TelemetryEvent{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		TenantID:  c.tenantID,
		AgentID:   c.currentAgentID(),
		Host:      c.host,
		Env:       c.env,
		EventType: eventType,
		Severity:  severity,
		Message:   message,
		Fields:    fields,
	}

	select {
	case c.queue <- event:
	default:
		log.Printf("telemetry queue full, dropping event type=%s", eventType)
	}
}

func (c *TelemetryClient) run() {
	for event := range c.queue {
		if err := c.push(event); err != nil {
			log.Printf("telemetry push failed: %v", err)
		}
	}
}

func (c *TelemetryClient) push(event TelemetryEvent) error {
	line, err := json.Marshal(event)
	if err != nil {
		return err
	}

	payload := lokiPushRequest{
		Streams: []struct {
			Stream map[string]string `json:"stream"`
			Values [][]string        `json:"values"`
		}{
			{
				Stream: map[string]string{
					"service":    "yaragent-agent-poc",
					"tenant_id":  event.TenantID,
					"agent_id":   event.AgentID,
					"event_type": event.EventType,
					"severity":   event.Severity,
					"env":        event.Env,
				},
				Values: [][]string{
					{fmt.Sprintf("%d", time.Now().UTC().UnixNano()), string(line)},
				},
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, c.pushURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected telemetry status code: %d", resp.StatusCode)
	}
	return nil
}

func envOrDefault(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func envBool(key string, fallback bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if v == "" {
		return fallback
	}
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func runningInContainer() bool {
	if envBool("AGENT_EPHEMERAL", false) {
		return true
	}
	if strings.TrimSpace(os.Getenv("KUBERNETES_SERVICE_HOST")) != "" {
		return true
	}
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return true
	}
	if b, err := os.ReadFile("/proc/1/cgroup"); err == nil {
		txt := strings.ToLower(string(b))
		if strings.Contains(txt, "docker") || strings.Contains(txt, "containerd") || strings.Contains(txt, "kubepods") || strings.Contains(txt, "podman") {
			return true
		}
	}
	return false
}

func loadOrCreateAgentID() string {
	if explicit := strings.TrimSpace(os.Getenv("AGENT_ID")); explicit != "" {
		return explicit
	}

	idFile := envOrDefault("AGENT_ID_FILE", "/tmp/yaragent-agent-id")
	if b, err := os.ReadFile(idFile); err == nil {
		if existing := strings.TrimSpace(string(b)); existing != "" {
			return existing
		}
	}

	randomBytes := make([]byte, 16)
	if _, err := rand.Read(randomBytes); err != nil {
		return fmt.Sprintf("agent-%d", time.Now().UnixNano())
	}
	agentID := hex.EncodeToString(randomBytes)
	if err := os.WriteFile(idFile, []byte(agentID+"\n"), 0o600); err != nil {
		log.Printf("warning: failed to persist AGENT_ID_FILE=%s: %v", idFile, err)
	}
	return agentID
}

func readTotalMemoryBytes() int64 {
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	lines := strings.Split(string(b), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				v, err := strconv.ParseInt(fields[1], 10, 64)
				if err == nil {
					return v * 1024
				}
			}
		}
	}
	return 0
}

func collectNetworkInterfaces() []map[string]any {
	out := make([]map[string]any, 0)
	ifaces, err := net.Interfaces()
	if err != nil {
		return out
	}
	for _, iface := range ifaces {
		entry := map[string]any{
			"name":  iface.Name,
			"mtu":   iface.MTU,
			"flags": iface.Flags.String(),
		}
		if hw := strings.TrimSpace(iface.HardwareAddr.String()); hw != "" {
			entry["mac"] = hw
		}
		addrs, err := iface.Addrs()
		if err == nil && len(addrs) > 0 {
			addrVals := make([]string, 0, len(addrs))
			for _, a := range addrs {
				addrVals = append(addrVals, a.String())
			}
			entry["addresses"] = addrVals
		}
		out = append(out, entry)
	}
	return out
}

func collectAssetProfile(agentID, instanceID string, containerized bool) map[string]any {
	host, _ := os.Hostname()
	currentUser := "unknown"
	if u, err := osuser.Current(); err == nil {
		if strings.TrimSpace(u.Username) != "" {
			currentUser = u.Username
		}
	}
	groupsRaw := strings.TrimSpace(os.Getenv("ASSET_GROUPS"))
	groups := []string{}
	if groupsRaw != "" {
		for _, g := range strings.Split(groupsRaw, ",") {
			if gg := strings.TrimSpace(g); gg != "" {
				groups = append(groups, gg)
			}
		}
	}
	return map[string]any{
		"asset_id":     envOrDefault("ASSET_ID", agentID),
		"asset_name":   envOrDefault("ASSET_NAME", host),
		"provider":     envOrDefault("CLOUD_PROVIDER", "unknown"),
		"cloud_region": envOrDefault("CLOUD_REGION", "unknown"),
		"account_id":   envOrDefault("CLOUD_ACCOUNT_ID", "unknown"),
		"asset_category": envOrDefault("ASSET_CATEGORY", "host"),
		"instance_id":  instanceID,
		"runtime_kind": map[bool]string{true: "container", false: "host"}[containerized],
		"os": map[string]any{
			"name":       runtime.GOOS,
			"arch":       runtime.GOARCH,
			"go_version": runtime.Version(),
		},
		"hardware": map[string]any{
			"cpu_cores":          runtime.NumCPU(),
			"memory_total_bytes": readTotalMemoryBytes(),
		},
		"network": map[string]any{
			"interfaces": collectNetworkInterfaces(),
		},
		"user": map[string]any{
			"current_user": currentUser,
		},
		"asset_groups": groups,
		"last_scanned": time.Now().UTC().Format(time.RFC3339),
	}
}

func collectSBOMSnapshot() []map[string]any {
	base := []map[string]any{
		{
			"name":    "yaragent-agent-poc",
			"version": envOrDefault("AGENT_VERSION", "dev"),
			"type":    "application",
		},
	}
	raw := strings.TrimSpace(os.Getenv("SBOM_PACKAGES"))
	if raw == "" {
		return base
	}
	parts := strings.Split(raw, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		name := p
		version := "unknown"
		if strings.Contains(p, ":") {
			kv := strings.SplitN(p, ":", 2)
			name = strings.TrimSpace(kv[0])
			version = strings.TrimSpace(kv[1])
		}
		base = append(base, map[string]any{
			"name":    name,
			"version": version,
			"type":    "package",
		})
	}
	return base
}

func collectCVESnapshot() []map[string]any {
	raw := strings.TrimSpace(os.Getenv("MOCK_CVES"))
	if raw == "" {
		return []map[string]any{}
	}
	items := []map[string]any{}
	for _, part := range strings.Split(raw, ",") {
		id := strings.TrimSpace(part)
		if id == "" {
			continue
		}
		items = append(items, map[string]any{
			"id":       id,
			"severity": "unknown",
			"status":   "open",
		})
	}
	return items
}

func main() {
	var wsURL string
	var token string
	flag.StringVar(&wsURL, "url", "ws://localhost:8002/agent/ws", "WebSocket URL for backend")
	flag.StringVar(&token, "token", "", "Enrollment token (optional)")
	flag.Parse()

	u, err := url.Parse(wsURL)
	if err != nil {
		log.Fatalf("invalid url: %v", err)
	}
	agentID := loadOrCreateAgentID()
	containerized := runningInContainer()
	instanceID := strings.TrimSpace(os.Getenv("HOSTNAME"))
	if instanceID == "" {
		instanceID = agentID
	}
	query := u.Query()
	query.Set("agent_id", agentID)
	if containerized {
		query.Set("ephemeral", "1")
		query.Set("runtime", "container")
	}
	query.Set("instance_id", instanceID)
	u.RawQuery = query.Encode()
	log.Printf("using stable agent_id=%s", agentID)
	assetProfile := collectAssetProfile(agentID, instanceID, containerized)
	sbomSnapshot := collectSBOMSnapshot()
	cveSnapshot := collectCVESnapshot()
	findingsCount := len(cveSnapshot)

	telemetry := NewTelemetryClient(
		envBool("TELEMETRY_ENABLED", false),
		envOrDefault("TELEMETRY_PUSH_URL", "http://alloy:9999/loki/api/v1/push"),
		envOrDefault("TENANT_ID", "default"),
		envOrDefault("DEPLOY_ENV", "dev"),
	)

	// ensure rules dir
	baseDir := filepath.Join(os.TempDir(), "yaragent_rules")
	_ = os.MkdirAll(baseDir, 0o755)

	dialer := websocket.DefaultDialer
	if u.Scheme == "wss" {
		// Internal containers use self-signed certs by default.
		dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}
	for {
		log.Printf("connecting to %s", u.String())
		telemetry.Emit("agent.connection.attempt", "info", "attempting websocket connection", map[string]string{
			"url": u.String(),
		})
		conn, _, err := dialer.Dial(u.String(), nil)
		if err != nil {
			log.Printf("dial error: %v", err)
			telemetry.Emit("agent.connection.error", "warning", "websocket dial failed", map[string]string{
				"error": err.Error(),
			})
			time.Sleep(2 * time.Second)
			continue
		}
		telemetry.Emit("agent.connection.open", "info", "websocket connected", nil)

		// Send a best-effort hello/enroll message after connect.
		hello := map[string]string{"type": "hello", "token": token, "agent_id": agentID}
		_ = conn.WriteJSON(hello)

		var connWriteMu sync.Mutex
		writeJSON := func(v any) error {
			connWriteMu.Lock()
			defer connWriteMu.Unlock()
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			return conn.WriteJSON(v)
		}
		done := make(chan struct{})

		go func() {
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-done:
					return
				case <-ticker.C:
					hb := map[string]any{
						"type":        "agent.heartbeat",
						"agent_id":    agentID,
						"tenant_id":   envOrDefault("TENANT_ID", "default"),
						"ephemeral":   containerized,
						"instance_id": instanceID,
						"asset_profile": assetProfile,
						"sbom":          sbomSnapshot,
						"cves":          cveSnapshot,
						"findings_count": findingsCount,
						"capabilities": map[string]any{
							"yara_compile":  true,
							"transport":     "websocket",
							"telemetry":     envBool("TELEMETRY_ENABLED", false),
							"containerized": containerized,
							"runtime":       map[bool]string{true: "container", false: "host"}[containerized],
							"instance_id":   instanceID,
						},
					}
					if err := writeJSON(hb); err != nil {
						return
					}
					telemetry.Emit("agent.heartbeat.sent", "info", "heartbeat sent", nil)
				}
			}
		}()

		// Read loop for this connection; break to reconnect on failure.
		for {
			var msg Message
			conn.SetReadDeadline(time.Now().Add(300 * time.Second))
			if err := conn.ReadJSON(&msg); err != nil {
				log.Printf("read error: %v", err)
				_ = conn.Close()
				time.Sleep(2 * time.Second)
				break
			}

			switch msg.Type {
			case "agent.registered":
				log.Printf("agent registered id=%s", msg.ID)
				telemetry.SetAgentID(msg.ID)
				telemetry.Emit("agent.registered", "info", "agent registration acknowledged", map[string]string{
					"agent_id": msg.ID,
				})

			case "rule.push":
				log.Printf("received rule.push id=%s", msg.ID)
				telemetry.Emit("policy.rule.push", "info", "received rule push command", map[string]string{
					"rule_id": msg.ID,
				})
				data, err := base64.StdEncoding.DecodeString(msg.Payload)
				if err != nil {
					sendCompileResult(writeJSON, msg.ID, false, fmt.Sprintf("base64 decode error: %v", err))
					telemetry.Emit("policy.rule.compile", "error", "rule payload decode failed", map[string]string{
						"rule_id": msg.ID,
						"error":   err.Error(),
					})
					continue
				}
				filename := filepath.Join(baseDir, fmt.Sprintf("%s.yar", msg.ID))
				if err := os.WriteFile(filename, data, 0o644); err != nil {
					sendCompileResult(writeJSON, msg.ID, false, fmt.Sprintf("write file error: %v", err))
					telemetry.Emit("policy.rule.compile", "error", "rule write failed", map[string]string{
						"rule_id": msg.ID,
						"error":   err.Error(),
					})
					continue
				}

				diagnostics, err := compileRule(string(data))
				if err != nil {
					sendCompileResult(writeJSON, msg.ID, false, fmt.Sprintf("compile error: %v", err))
					telemetry.Emit("policy.rule.compile", "error", "rule compile failed", map[string]string{
						"rule_id": msg.ID,
						"error":   err.Error(),
					})
					continue
				}
				sendCompileResult(writeJSON, msg.ID, true, diagnostics)
				telemetry.Emit("policy.rule.compile", "info", "rule compile succeeded", map[string]string{
					"rule_id": msg.ID,
				})
				if strings.Contains(strings.ToLower(string(data)), "matches") {
					telemetry.Emit("scan.finding", "warning", "simulated finding event", map[string]string{
						"rule_id": msg.ID,
					})
				}

			default:
				log.Printf("unknown message type: %s", msg.Type)
				telemetry.Emit("agent.message.unknown", "warning", "unknown message type", map[string]string{
					"type": msg.Type,
				})
			}
		}
		close(done)
	}
}

func sendCompileResult(writeJSON func(any) error, id string, success bool, diag string) {
	res := CompileResult{
		Type:        "rule.compile.result",
		ID:          id,
		Success:     success,
		Diagnostics: diag,
	}
	if err := writeJSON(res); err != nil {
		log.Printf("write error: %v", err)
	}
}
