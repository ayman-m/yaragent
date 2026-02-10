Agent Orchestrator (FastAPI)

Endpoints:
- `GET /health` (public)
- `GET /setup/status` (public)
- `POST /auth/setup` (public, first run only)
- `POST /auth/login` (public)
- `GET /settings` (JWT/API-token protected)
- `PUT /settings` (JWT/API-token protected)
- `GET /agents` (JWT/API-token protected)
- `POST /push_rule` (JWT/API-token protected)
- `WS /agent/ws` (agent channel)

TLS is required in container runtime.

Required env vars:
- `ORCH_CERT_PRIV`
- `JWT_SECRET_KEY`
- `DATABASE_URL`

Optional env vars:
- `ORCH_CERT_PUB` (self-signed generated if omitted)
- `INITIAL_SETUP_TOKEN`
- `ORCHESTRATOR_API_TOKEN`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
