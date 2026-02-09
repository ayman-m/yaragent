Go agent PoC (WebSocket + rule compile)

Overview
 - Minimal PoC agent that connects to a backend WebSocket, accepts `rule.push` messages
   (JSON with base64-encoded rule text), writes the rule to disk, and returns a `rule.compile.result`.

Build & Run (no libyara required)
```bash
cd agents/windows-go/poc
go build -o agent-poc
./agent-poc --url ws://localhost:8000/agent/ws --token my-enroll-token
```

Using real YARA compilation
- To enable real compilation you must install libyara (headers + libs) on the build host and
  add the `go-yara` dependency. Then build with the `yara` build tag:

```bash
# install libyara via your package manager (platform-specific)
# on macOS (homebrew): brew install yara

cd agents/windows-go/poc
go get github.com/hillu/go-yara/v4
go build -tags=yara -o agent-poc
```

Notes
- The PoC includes a stub `compileRule` implementation used when building without the `yara` tag.
- WS protocol (PoC): backend -> agent messages: `{ "type": "rule.push", "id": "...", "payload": "<base64>" }`
  agent -> backend responses: `{ "type": "rule.compile.result", "id": "...", "success": true|false, "diagnostics": "..." }`
- For evidence storage we recommend MinIO (S3-compatible) — backend will provide presigned URLs.
