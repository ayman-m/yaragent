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
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	osuser "os/user"
	"path/filepath"
	"runtime"
	"sort"
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

func readOSRelease() map[string]string {
	out := map[string]string{}
	b, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return out
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		val := strings.Trim(strings.TrimSpace(parts[1]), "\"")
		out[key] = val
	}
	return out
}

func detectKernelVersion() string {
	if out, err := exec.Command("uname", "-r").Output(); err == nil {
		if v := strings.TrimSpace(string(out)); v != "" {
			return v
		}
	}
	if b, err := os.ReadFile("/proc/sys/kernel/osrelease"); err == nil {
		if v := strings.TrimSpace(string(b)); v != "" {
			return v
		}
	}
	return ""
}

func detectOSVersion(osRelease map[string]string) string {
	candidates := []string{
		strings.TrimSpace(osRelease["VERSION"]),
		strings.TrimSpace(osRelease["VERSION_ID"]),
		strings.TrimSpace(osRelease["PRETTY_NAME"]),
	}
	for _, v := range candidates {
		if v != "" {
			return v
		}
	}
	return ""
}

func domainFromHost(host string) string {
	h := strings.TrimSpace(host)
	if h == "" || !strings.Contains(h, ".") {
		return ""
	}
	parts := strings.SplitN(h, ".", 2)
	if len(parts) == 2 {
		return strings.TrimSpace(parts[1])
	}
	return ""
}

func domainFromResolvConf() string {
	b, err := os.ReadFile("/etc/resolv.conf")
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		if fields[0] == "search" || fields[0] == "domain" {
			v := strings.TrimSpace(fields[1])
			if v != "" && v != "." {
				return v
			}
		}
	}
	return ""
}

func readDNSServers() []string {
	out := []string{}
	b, err := os.ReadFile("/etc/resolv.conf")
	if err != nil {
		return out
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "nameserver ") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				out = append(out, parts[1])
			}
		}
	}
	return out
}

func firstNonLoopbackIPv4() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil {
				continue
			}
			ip = ip.To4()
			if ip == nil || ip.IsLoopback() {
				continue
			}
			return ip.String()
		}
	}
	return ""
}

func firstMACAddress() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if mac := strings.TrimSpace(iface.HardwareAddr.String()); mac != "" {
			return mac
		}
	}
	return ""
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

func collectAssetProfile(agentID, instanceID string, containerized bool, cveSnapshot []map[string]any) map[string]any {
	host, _ := os.Hostname()
	currentUser := "unknown"
	if u, err := osuser.Current(); err == nil {
		if strings.TrimSpace(u.Username) != "" {
			currentUser = u.Username
		}
	}
	domain := "unknown"
	username := currentUser
	if strings.Contains(currentUser, `\`) {
		parts := strings.SplitN(currentUser, `\`, 2)
		if len(parts) == 2 {
			domain = strings.TrimSpace(parts[0])
			username = strings.TrimSpace(parts[1])
		}
	}
	if strings.Contains(currentUser, "@") {
		parts := strings.SplitN(currentUser, "@", 2)
		if len(parts) == 2 {
			username = strings.TrimSpace(parts[0])
			domain = strings.TrimSpace(parts[1])
		}
	}
	if domain == "unknown" {
		if d := domainFromHost(host); d != "" {
			domain = d
		} else if d := domainFromResolvConf(); d != "" {
			domain = d
		}
	}
	osRelease := readOSRelease()
	osName := strings.TrimSpace(osRelease["NAME"])
	if osName == "" {
		osName = strings.TrimSpace(osRelease["PRETTY_NAME"])
	}
	osVersion := detectOSVersion(osRelease)
	kernel := detectKernelVersion()
	primaryIP := firstNonLoopbackIPv4()
	primaryMAC := firstMACAddress()
	memBytes := readTotalMemoryBytes()
	memMB := int64(0)
	if memBytes > 0 {
		memMB = memBytes / (1024 * 1024)
	}
	sevCount := map[string]int{
		"critical": 0,
		"high":     0,
		"medium":   0,
		"low":      0,
	}
	for _, c := range cveSnapshot {
		sev := strings.ToLower(strings.TrimSpace(fmt.Sprint(c["severity"])))
		if _, ok := sevCount[sev]; ok {
			sevCount[sev]++
		}
	}
	riskScore := sevCount["critical"]*10 + sevCount["high"]*6 + sevCount["medium"]*3 + sevCount["low"]
	complianceStatus := "Compliant"
	if len(cveSnapshot) > 0 {
		complianceStatus = "Needs Review"
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
		"asset_id":       envOrDefault("ASSET_ID", agentID),
		"asset_name":     envOrDefault("ASSET_NAME", host),
		"provider":       envOrDefault("CLOUD_PROVIDER", "unknown"),
		"cloud_region":   envOrDefault("CLOUD_REGION", "unknown"),
		"account_id":     envOrDefault("CLOUD_ACCOUNT_ID", "unknown"),
		"asset_category": envOrDefault("ASSET_CATEGORY", "host"),
		"instance_id":    instanceID,
		"runtime_kind":   map[bool]string{true: "container", false: "host"}[containerized],
		"os": map[string]any{
			"name":         envOrDefault("OS_NAME", osName),
			"version":      envOrDefault("OS_VERSION", osVersion),
			"kernel":       envOrDefault("OS_KERNEL", kernel),
			"architecture": runtime.GOARCH,
			"go_version":   runtime.Version(),
		},
		"hardware": map[string]any{
			"cpu_cores": runtime.NumCPU(),
			"memory_mb": memMB,
		},
		"network": map[string]any{
			"primary_ip":  envOrDefault("PRIMARY_IP", primaryIP),
			"mac_address": envOrDefault("PRIMARY_MAC", primaryMAC),
			"dns_servers": readDNSServers(),
			"interfaces":  collectNetworkInterfaces(),
		},
		"identity": map[string]any{
			"username": username,
			"domain":   domain,
		},
		"asset_groups": groups,
		"posture": map[string]any{
			"compliance_status": complianceStatus,
			"patch_level":       envOrDefault("PATCH_LEVEL", "Unknown"),
			"hardening_profile": envOrDefault("HARDENING_PROFILE", "Baseline"),
			"risk_score":        riskScore,
			"identity_risk":     envOrDefault("IDENTITY_RISK", "Low"),
			"network_exposure":  envOrDefault("NETWORK_EXPOSURE", "Medium"),
			"last_scan_at":      time.Now().UTC().Format(time.RFC3339),
		},
		"last_scanned": time.Now().UTC().Format(time.RFC3339),
	}
}

func collectSBOMSnapshot() []map[string]any {
	packages := []map[string]any{}
	seen := map[string]struct{}{}

	addPackage := func(name, version, kind string) {
		name = strings.TrimSpace(name)
		if name == "" {
			return
		}
		version = strings.TrimSpace(version)
		if version == "" {
			version = "unknown"
		}
		kind = strings.TrimSpace(kind)
		if kind == "" {
			kind = "package"
		}
		key := strings.ToLower(name) + "|" + strings.ToLower(version) + "|" + strings.ToLower(kind)
		if _, exists := seen[key]; exists {
			return
		}
		seen[key] = struct{}{}
		packages = append(packages, map[string]any{
			"name":    name,
			"version": version,
			"type":    kind,
		})
	}

	addPackage("yaragent-agent-poc", envOrDefault("AGENT_VERSION", "dev"), "application")

	// Alpine packages.
	if b, err := os.ReadFile("/lib/apk/db/installed"); err == nil {
		name := ""
		version := ""
		for _, line := range strings.Split(string(b), "\n") {
			line = strings.TrimSpace(line)
			switch {
			case strings.HasPrefix(line, "P:"):
				name = strings.TrimSpace(strings.TrimPrefix(line, "P:"))
			case strings.HasPrefix(line, "V:"):
				version = strings.TrimSpace(strings.TrimPrefix(line, "V:"))
			case line == "":
				if name != "" {
					addPackage(name, version, "apk")
				}
				name = ""
				version = ""
			}
		}
		if name != "" {
			addPackage(name, version, "apk")
		}
	}

	// Debian/Ubuntu packages.
	if b, err := os.ReadFile("/var/lib/dpkg/status"); err == nil {
		name := ""
		version := ""
		for _, line := range strings.Split(string(b), "\n") {
			line = strings.TrimSpace(line)
			switch {
			case strings.HasPrefix(line, "Package:"):
				name = strings.TrimSpace(strings.TrimPrefix(line, "Package:"))
			case strings.HasPrefix(line, "Version:"):
				version = strings.TrimSpace(strings.TrimPrefix(line, "Version:"))
			case line == "":
				if name != "" {
					addPackage(name, version, "dpkg")
				}
				name = ""
				version = ""
			}
		}
		if name != "" {
			addPackage(name, version, "dpkg")
		}
	}

	// RPM packages.
	if _, err := exec.LookPath("rpm"); err == nil {
		if out, err := exec.Command("rpm", "-qa", "--qf", "%{NAME}\t%{VERSION}-%{RELEASE}\n").Output(); err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}
				parts := strings.SplitN(line, "\t", 2)
				if len(parts) == 2 {
					addPackage(parts[0], parts[1], "rpm")
				}
			}
		}
	}

	// Operator-provided extras.
	raw := strings.TrimSpace(os.Getenv("SBOM_PACKAGES"))
	if raw != "" {
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
			addPackage(name, version, "package")
		}
	}

	sort.SliceStable(packages, func(i, j int) bool {
		ni := strings.ToLower(fmt.Sprint(packages[i]["name"]))
		nj := strings.ToLower(fmt.Sprint(packages[j]["name"]))
		if ni == nj {
			return strings.ToLower(fmt.Sprint(packages[i]["version"])) < strings.ToLower(fmt.Sprint(packages[j]["version"]))
		}
		return ni < nj
	})
	return packages
}

func collectCVESnapshot() []map[string]any {
	if rawJSON := strings.TrimSpace(os.Getenv("MOCK_CVES_JSON")); rawJSON != "" {
		items := []map[string]any{}
		if err := json.Unmarshal([]byte(rawJSON), &items); err == nil {
			return items
		}
		log.Printf("warning: failed to parse MOCK_CVES_JSON, falling back to MOCK_CVES")
	}
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
		severity := "unknown"
		status := "open"
		if strings.Contains(id, ":") {
			parts := strings.SplitN(id, ":", 3)
			id = strings.TrimSpace(parts[0])
			if len(parts) > 1 && strings.TrimSpace(parts[1]) != "" {
				severity = strings.ToLower(strings.TrimSpace(parts[1]))
			}
			if len(parts) > 2 && strings.TrimSpace(parts[2]) != "" {
				status = strings.ToLower(strings.TrimSpace(parts[2]))
			}
		}
		items = append(items, map[string]any{
			"id":       id,
			"severity": severity,
			"status":   status,
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
					sbomSnapshot := collectSBOMSnapshot()
					cveSnapshot := collectCVESnapshot()
					findingsCount := len(cveSnapshot)
					assetProfile := collectAssetProfile(agentID, instanceID, containerized, cveSnapshot)
					hb := map[string]any{
						"type":           "agent.heartbeat",
						"agent_id":       agentID,
						"tenant_id":      envOrDefault("TENANT_ID", "default"),
						"ephemeral":      containerized,
						"instance_id":    instanceID,
						"asset_profile":  assetProfile,
						"sbom":           sbomSnapshot,
						"cves":           cveSnapshot,
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
