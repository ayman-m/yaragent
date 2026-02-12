package main

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
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

		if token != "" {
			// Send a best-effort hello/enroll message after connect.
			hello := map[string]string{"type": "hello", "token": token}
			_ = conn.WriteJSON(hello)
		}

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
						"type":      "agent.heartbeat",
						"tenant_id": envOrDefault("TENANT_ID", "default"),
						"capabilities": map[string]any{
							"yara_compile": true,
							"transport":    "websocket",
							"telemetry":    envBool("TELEMETRY_ENABLED", false),
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
