MCP Server (FastAPI + MCP Protocol)

This service exposes MCP (Model Context Protocol) tools for AI agents (Gemini, Claude, etc).
It delegates agent communication to the orchestrator via FastAPI.

Endpoints:
- `GET /health` — health check
- `GET /tools` — list available MCP tools
- `POST /tools/scan.listAgents` — MCP tool to list connected agents
- `POST /tools/scan.pushRule` — MCP tool to push rule to agent

Run locally:

```bash
cd services/platform/mcp-server
export ORCHESTRATOR_URL=http://localhost:8002
python3 -m pip install -r requirements.txt
python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8001
```

Docker:

```bash
docker build -t yaragent-mcp-server:latest -f services/platform/mcp-server/Dockerfile .
docker run -e ORCHESTRATOR_URL=http://orchestrator:8002 -p 8001:8001 yaragent-mcp-server:latest
```

MCP Tool Example (via Gemini):

```json
{
  "tool_name": "scan.pushRule",
  "inputs": {
    "agent_id": "...",
    "rule_text": "rule test { condition: true }"
  }
}
```
