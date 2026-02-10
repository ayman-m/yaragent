# Platform Bootstrap (One-Shot Init)

This one-shot container prepares runtime artifacts for infra/services.

Current responsibilities:
- Wait for Postgres
- Initialize Postgres schema (`users` table)
- Render Nginx templates into `/tmp/nginx-generated/nginx`
- Materialize Nginx TLS files from env vars

Required env vars:
- `INIT_POSTGRES_DSN`
- `INIT_NGINX_CERT_PRIV`
- `INIT_NGINX_CERT_PUB`

Template env vars:
- `INIT_NGINX_SERVER_NAME`
- `INIT_NGINX_UI_UPSTREAM`
- `INIT_NGINX_API_UPSTREAM`
- `INIT_NGINX_MCP_UPSTREAM`
- `INIT_NGINX_API_TIMEOUT_SECONDS`
