Agent Orchestrator (FastAPI)

This service manages agent connections, job queuing, and rule distribution.

Endpoints:
- WebSocket `/agent/ws` — agent connection and message routing
- `GET /agents` — list connected agents
- `POST /push_rule` — push rule to agent (body: { "agent_id": "...", "rule_text": "..." })

Run locally:

```bash
cd services/business/orchestrator
python3 -m pip install -r requirements.txt
python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Docker:

```bash
docker build -t yaragent-orchestrator:latest -f services/business/orchestrator/Dockerfile .
docker run -p 8000:8000 yaragent-orchestrator:latest
```
