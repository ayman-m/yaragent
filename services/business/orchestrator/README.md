Agent Orchestrator (FastAPI)

Endpoints:
- `GET /health` (public)
- `GET /setup/status` (public)
- `POST /auth/setup` (public, first run only)
- `POST /auth/login` (public)
- `GET /settings` (JWT/API-token protected)
- `PUT /settings` (JWT/API-token protected)
- `GET /agents` (JWT/API-token protected)
- `GET /yara/rules` (JWT/API-token protected)
- `GET /yara/rules/{name}` (JWT/API-token protected)
- `POST /yara/rules` (JWT/API-token protected)
- `PUT /yara/rules/{name}` (JWT/API-token protected)
- `DELETE /yara/rules/{name}` (JWT/API-token protected)
- `POST /yara/validate` (JWT/API-token protected)
- `POST /yara/assistant` (JWT/API-token protected)
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
- `YARA_STORAGE_ENABLED`
- `YARA_STORAGE_ENDPOINT`
- `YARA_STORAGE_ACCESS_KEY`
- `YARA_STORAGE_SECRET_KEY`
- `YARA_STORAGE_BUCKET`
- `YARA_STORAGE_USE_SSL`
- `GEMINI_API_KEY` (or `VERTEX_API_KEY` fallback)
- `GEMINI_MODEL` (default `gemini-1.5-flash`)
- `GEMINI_API_BASE` (default `https://generativelanguage.googleapis.com/v1beta`)
