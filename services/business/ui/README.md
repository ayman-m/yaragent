YARA Agent UI (Next.js)

Minimal Next.js UI for managing YARA scanning agents and pushing rules.

Features:
- Display list of connected agents
- Real-time agent status (auto-refresh every 5s)
- Push YARA rules to agents and view compile results
- Tailwind CSS styling

Build & Run (local dev):

```bash
cd services/business/ui
npm install
npm run dev
```

Then visit http://localhost:3000

Build & Deploy (Docker):

```bash
docker build -t yaragent-ui:latest -f services/business/ui/Dockerfile .
docker run -e NEXT_PUBLIC_BACKEND_URL=http://backend:8000 -p 3000:3000 yaragent-ui:latest
```

Configuration:
- `NEXT_PUBLIC_BACKEND_URL`: Backend MCP server URL (default: http://localhost:8000)
