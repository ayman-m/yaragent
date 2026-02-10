# YARAgent Nginx Infra

This folder contains the reverse-proxy/TLS assets for YARAgent.

## What it does

- Redirects HTTP to HTTPS
- Terminates TLS at Nginx
- Proxies `/` to UI (`https://ui:3000`)
- Proxies `/api/*` and `/ws/*` to orchestrator (`https://orchestrator:8002`)
- Optionally proxies `/mcp/*` to MCP server (`http://mcp-server:8001`)

## Required environment variables

- `NGINX_CERT_PRIV` (private key PEM)
- `NGINX_CERT_PUB` (certificate PEM)

Optional:

- `SERVER_NAME` (default: `localhost`)
- `UI_UPSTREAM` (default: `ui:3000`)
- `API_UPSTREAM` (default: `orchestrator:8002`)
- `MCP_UPSTREAM` (default: `mcp-server:8001`)
- `API_TIMEOUT_SECONDS` (default: `60`)
