Agent Orchestrator (FastAPI)

Endpoints:
- `GET /health` (public)
- `GET /setup/status` (public)
- `POST /auth/setup` (public, first run only)
- `POST /auth/login` (public)
- `GET /agents` (JWT/API-token protected)
- `POST /push_rule` (JWT/API-token protected)
- `WS /agent/ws` (agent channel)

TLS is required in container runtime.

Required env vars:
- `ORCH_CERT_PRIV`
- `ORCH_CERT_PUB` (optional, self-signed generated if omitted)
- `JWT_SECRET_KEY`

Optional env vars:
- `INITIAL_SETUP_TOKEN`
- `ORCHESTRATOR_API_TOKEN`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `AUTH_DATA_FILE` (default `/app/data/auth.json`)
