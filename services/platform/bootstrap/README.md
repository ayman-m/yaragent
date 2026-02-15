# Platform Bootstrap (One-Shot Init)

This one-shot container prepares runtime artifacts for infra/services.

Current responsibilities:
- Wait for Postgres
- Initialize Postgres schema (`users` table)
- Render Nginx templates into `/tmp/nginx-generated/nginx`
- Materialize Nginx TLS files from env vars
- Initialize MinIO bucket for YARA rule storage (bucket + versioning + optional seed)

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

MinIO init env vars:
- `INIT_MINIO_ENABLED`
- `INIT_MINIO_ENDPOINT`
- `INIT_MINIO_ACCESS_KEY`
- `INIT_MINIO_SECRET_KEY`
- `INIT_MINIO_USE_SSL`
- `INIT_MINIO_BUCKET`
- `INIT_MINIO_SEED_DIR`
