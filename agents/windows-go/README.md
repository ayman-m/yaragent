Windows Go Agent

- Purpose: native Windows agent built with Go and `go-yara` that connects to backend via WebSocket.
- Build: use CI to cross-compile and produce signed EXE, then package with WiX/MSI.
- Local run (example):

```powershell
# Set backend URL and run
setx BACKEND_WS wss://backend.example/ws
.\yara-agent.exe --enroll-token "short-lived-token"
```
