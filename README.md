# YARA Agent

Distributed YARA scanning agent system with MCP protocol support for AI-powered security automation.

## Quick Start

### Local Development

```bash
# Start all services
docker-compose up --build

# Services:
# - Orchestrator: http://localhost:8000 (WebSocket broker for agents)
# - MCP Server: http://localhost:8001 (MCP tools for AI agents)
# - UI: http://localhost:3000 (Dashboard)
# - Agent PoC: Connects to orchestrator via WebSocket
```

### Check Health

```bash
curl http://localhost:8000/agents         # Orchestrator
curl http://localhost:8001/health         # MCP Server
curl http://localhost:8001/tools          # Available MCP tools
```

## Architecture

```
┌─────────────────┐
│    Gemini       │
└────────┬────────┘
         │ (MCP calls)
    ┌────▼─────────────┐
    │   MCP Server     │  (Platform Service)
    │   port 8001      │
    └────┬─────────────┘
         │ (REST/FastAPI)
    ┌────▼──────────────────┐
    │   Orchestrator        │  (Business Service)
    │   port 8000           │
    └────┬──────────────────┘
         │ (WebSocket)
    ┌────▼─────────────┐
    │  Windows Agents  │
    │  (via WS)        │
    └──────────────────┘

UI (Next.js, port 3000) → Orchestrator (direct API calls)
```

## Services

- **Orchestrator** (`services/business/orchestrator/`): WebSocket broker for agent connections and job queue
- **MCP Server** (`services/platform/mcp-server/`): Middleware exposing MCP tools for AI agents
- **UI** (`services/business/ui/`): Next.js dashboard for manual agent management
- **Agent PoC** (`agents/windows-go/poc/`): Go proof-of-concept agent for testing

## Documentation

See [plans/](plans/) folder for:
- [PROJECT_STRUCTURE.md](plans/PROJECT_STRUCTURE.md) — Complete architecture
- [SCAN_ENGINE_CAPABILITIES.md](plans/SCAN_ENGINE_CAPABILITIES.md) — Engine analysis
- [MCP_TOOLS_PLANNING.md](plans/MCP_TOOLS_PLANNING.md) — MCP protocol design
- [AGENT_WINDOWS_GO.md](plans/AGENT_WINDOWS_GO.md) — Windows agent design
- [DOCKER_COMPOSE.md](plans/DOCKER_COMPOSE.md) — Deployment guide
- [TODO.md](plans/TODO.md) — Progress tracking

## CI/CD

GitHub Actions pipeline: [.github/workflows/build-and-deploy.yml](.github/workflows/build-and-deploy.yml)

Triggers on:
- Push to `main` branch
- Changes in `services/`, `agents/`, or `docker-compose.yml`

Builds and pushes Docker images to Docker Hub, then deploys via docker-compose.

## Development Workflow

### Local Run (Without Docker)

**Terminal 1: Orchestrator**
```bash
cd services/business/orchestrator
python3 -m pip install -r requirements.txt
python3 -m uvicorn src.main:app --port 8000
```

**Terminal 2: MCP Server**
```bash
export ORCHESTRATOR_URL=http://localhost:8000
cd services/platform/mcp-server
python3 -m pip install -r requirements.txt
python3 -m uvicorn src.main:app --port 8001
```

**Terminal 3: UI**
```bash
cd services/business/ui
npm install
npm run dev
```

**Terminal 4: Agent PoC**
```bash
cd agents/windows-go/poc
go build -o agent-poc
./agent-poc --url ws://localhost:8000/agent/ws
```

## Next Steps

1. Test GitHub Actions pipeline on self-hosted runner
2. Fix agent PoC registration message handling
3. Integrate MinIO for evidence storage
4. Implement rule signing and verification
5. Build Windows MSI agent installer

## References

- [YARA Rule Language](https://yara.readthedocs.io/)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/)