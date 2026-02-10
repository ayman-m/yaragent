MCP Server (FastAPI)

Endpoints:
- `GET /health`
- `GET /tools`
- `POST /tools/scan.listAgents`
- `POST /tools/scan.pushRule`

Environment:
- `ORCHESTRATOR_URL` (default `https://orchestrator:8002`)
- `ORCHESTRATOR_API_TOKEN` (recommended)
- `ORCHESTRATOR_TLS_VERIFY` (`false` by default for self-signed internal certs)
