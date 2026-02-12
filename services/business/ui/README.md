YARA Agent UI (Next.js)

The UI now supports:
- Initial setup flow (create first admin)
- Login/logout with JWT
- Authenticated calls to orchestrator via Nginx `/api/*`

Runtime expectation:
- Public entrypoint: `https://<host>/`
- API base path: `/api`

Required env vars for container TLS:
- `UI_CERT_PRIV`
- `UI_CERT_PUB` (optional, self-signed generated if omitted)

Useful env vars:
- `NEXT_PUBLIC_API_BASE` (default `/api`)
- `NEXT_PUBLIC_GRAFANA_DASHBOARD_URL` (default `/grafana/d/yaragent-telemetry-overview?orgId=1&kiosk`)
