package main

import (
    "encoding/base64"
    "flag"
    "fmt"
    "log"
    "net/url"
    "os"
    "path/filepath"
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

    log.Printf("connecting to %s", u.String())
    dialer := websocket.DefaultDialer
    conn, _, err := dialer.Dial(u.String(), nil)
    if err != nil {
        log.Fatalf("dial error: %v", err)
    }
    defer conn.Close()

    if token != "" {
        // send a hello/enroll message
        hello := map[string]string{"type": "hello", "token": token}
        _ = conn.WriteJSON(hello)
    }

    // ensure rules dir
    baseDir := filepath.Join(os.TempDir(), "yaragent_rules")
    _ = os.MkdirAll(baseDir, 0o755)

    for {
        var msg Message
        conn.SetReadDeadline(time.Now().Add(300 * time.Second))
        if err := conn.ReadJSON(&msg); err != nil {
            log.Printf("read error: %v", err)
            time.Sleep(2 * time.Second)
            continue
        }

        switch msg.Type {
        case "rule.push":
            log.Printf("received rule.push id=%s", msg.ID)
            data, err := base64.StdEncoding.DecodeString(msg.Payload)
            if err != nil {
                sendCompileResult(conn, msg.ID, false, fmt.Sprintf("base64 decode error: %v", err))
                continue
            }
            filename := filepath.Join(baseDir, fmt.Sprintf("%s.yar", msg.ID))
            if err := os.WriteFile(filename, data, 0o644); err != nil {
                sendCompileResult(conn, msg.ID, false, fmt.Sprintf("write file error: %v", err))
                continue
            }

            diagnostics, err := compileRule(string(data))
            if err != nil {
                sendCompileResult(conn, msg.ID, false, fmt.Sprintf("compile error: %v", err))
                continue
            }
            sendCompileResult(conn, msg.ID, true, diagnostics)

        default:
            log.Printf("unknown message type: %s", msg.Type)
        }
    }
}

func sendCompileResult(conn *websocket.Conn, id string, success bool, diag string) {
    res := CompileResult{
        Type:        "rule.compile.result",
        ID:          id,
        Success:     success,
        Diagnostics: diag,
    }
    conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
    if err := conn.WriteJSON(res); err != nil {
        log.Printf("write error: %v", err)
    }
}
