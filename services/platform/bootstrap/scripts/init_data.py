#!/usr/bin/env python3
from __future__ import annotations

import os
import time
from pathlib import Path

import psycopg

TEMPLATES_DIR = Path("/app/bootstrap/nginx/templates")
OUTPUT_DIR = Path(os.getenv("INIT_NGINX_OUTPUT_DIR", "/tmp/nginx-generated"))
RENDER_ENABLED = os.getenv("INIT_NGINX_RENDER", "true").lower() == "true"

OBS_TEMPLATES_DIR = Path("/app/bootstrap/observability/templates")
OBS_OUTPUT_DIR = Path(os.getenv("INIT_OBSERVABILITY_OUTPUT_DIR", "/tmp/observability-generated"))
OBS_RENDER_ENABLED = os.getenv("INIT_OBSERVABILITY_RENDER", "true").lower() == "true"
OBS_LOKI_RETENTION_PERIOD = os.getenv("INIT_OBSERVABILITY_LOKI_RETENTION_PERIOD", "168h")
OBS_LOKI_MAX_QUERY_LENGTH = os.getenv("INIT_OBSERVABILITY_LOKI_MAX_QUERY_LENGTH", "168h")

KEYCLOAK_TEMPLATES_DIR = Path("/app/bootstrap/keycloak/templates")
KEYCLOAK_OUTPUT_DIR = Path(os.getenv("INIT_KEYCLOAK_OUTPUT_DIR", "/tmp/keycloak-generated"))
KEYCLOAK_RENDER_ENABLED = os.getenv("INIT_KEYCLOAK_RENDER", "true").lower() == "true"
KEYCLOAK_OAUTH2_CLIENT_SECRET = os.getenv("INIT_KEYCLOAK_OAUTH2_CLIENT_SECRET", "yaragent-client-secret-change-me")
KEYCLOAK_REDIRECT_URI = os.getenv("INIT_KEYCLOAK_REDIRECT_URI", "https://localhost/oauth2/callback")
KEYCLOAK_DEMO_USER = os.getenv("INIT_KEYCLOAK_DEMO_USER", "yaradmin")
KEYCLOAK_DEMO_PASSWORD = os.getenv("INIT_KEYCLOAK_DEMO_PASSWORD", "yaradmin123!")

SERVER_NAME = os.getenv("INIT_NGINX_SERVER_NAME", "localhost")
UI_UPSTREAM = os.getenv("INIT_NGINX_UI_UPSTREAM", "ui:3000")
API_UPSTREAM = os.getenv("INIT_NGINX_API_UPSTREAM", "orchestrator:8002")
MCP_UPSTREAM = os.getenv("INIT_NGINX_MCP_UPSTREAM", "mcp-server:8001")
GRAFANA_UPSTREAM = os.getenv("INIT_NGINX_GRAFANA_UPSTREAM", "grafana:3000")
OAUTH2_PROXY_UPSTREAM = os.getenv("INIT_NGINX_OAUTH2_PROXY_UPSTREAM", "oauth2-proxy:4180")
KEYCLOAK_UPSTREAM = os.getenv("INIT_NGINX_KEYCLOAK_UPSTREAM", "keycloak:8080")
API_TIMEOUT_SECONDS = os.getenv("INIT_NGINX_API_TIMEOUT_SECONDS", "60")

NGINX_CERT_PRIV = os.getenv("INIT_NGINX_CERT_PRIV", "")
NGINX_CERT_PUB = os.getenv("INIT_NGINX_CERT_PUB", "")

POSTGRES_DSN = (os.getenv("INIT_POSTGRES_DSN", "") or "").strip()
POSTGRES_HOST = os.getenv("INIT_POSTGRES_HOST", "postgres")
POSTGRES_PORT = int(os.getenv("INIT_POSTGRES_PORT", "5432"))
POSTGRES_USER = os.getenv("INIT_POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("INIT_POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("INIT_POSTGRES_DB", "yaragent")


def _pg_connect():
    dsn = (POSTGRES_DSN or "").strip()
    if dsn:
        return psycopg.connect(dsn, autocommit=True)

    return psycopg.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        dbname=POSTGRES_DB,
        autocommit=True,
    )


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _render_template(raw: str) -> str:
    replacements = {
        "${SERVER_NAME}": SERVER_NAME,
        "${UI_UPSTREAM}": UI_UPSTREAM,
        "${API_UPSTREAM}": API_UPSTREAM,
        "${MCP_UPSTREAM}": MCP_UPSTREAM,
        "${GRAFANA_UPSTREAM}": GRAFANA_UPSTREAM,
        "${OAUTH2_PROXY_UPSTREAM}": OAUTH2_PROXY_UPSTREAM,
        "${KEYCLOAK_UPSTREAM}": KEYCLOAK_UPSTREAM,
        "${API_TIMEOUT_SECONDS}": API_TIMEOUT_SECONDS,
        "${NGINX_CERT_FILE}": "/etc/nginx/ssl/nginx_cert.pem",
        "${NGINX_KEY_FILE}": "/etc/nginx/ssl/nginx_key.pem",
    }
    out = raw
    for key, val in replacements.items():
        out = out.replace(key, val)
    return out


def render_nginx_assets() -> None:
    if not NGINX_CERT_PRIV:
        raise RuntimeError("INIT_NGINX_CERT_PRIV is required")

    if not NGINX_CERT_PUB:
        raise RuntimeError("INIT_NGINX_CERT_PUB is required")

    nginx_out = OUTPUT_DIR / "nginx"

    for tmpl in TEMPLATES_DIR.rglob("*.template"):
        rel = tmpl.relative_to(TEMPLATES_DIR)
        out_rel = rel.with_suffix("")
        rendered = _render_template(tmpl.read_text(encoding="utf-8"))
        _write(nginx_out / out_rel, rendered)

    # Accept both real multiline PEM and escaped \n secrets.
    priv_text = NGINX_CERT_PRIV.replace("\\n", "\n").strip() + "\n"
    pub_text = NGINX_CERT_PUB.replace("\\n", "\n").strip() + "\n"
    _write(nginx_out / "ssl/nginx_key.pem", priv_text)
    _write(nginx_out / "ssl/nginx_cert.pem", pub_text)


def render_observability_assets() -> None:
    if not OBS_TEMPLATES_DIR.exists():
        return
    replacements = {
        "${LOKI_RETENTION_PERIOD}": OBS_LOKI_RETENTION_PERIOD,
        "${LOKI_MAX_QUERY_LENGTH}": OBS_LOKI_MAX_QUERY_LENGTH,
    }

    for tmpl in OBS_TEMPLATES_DIR.rglob("*.template"):
        rel = tmpl.relative_to(OBS_TEMPLATES_DIR)
        out_rel = rel.with_suffix("")
        rendered = tmpl.read_text(encoding="utf-8")
        for key, val in replacements.items():
            rendered = rendered.replace(key, val)
        _write(OBS_OUTPUT_DIR / out_rel, rendered)


def render_keycloak_assets() -> None:
    if not KEYCLOAK_TEMPLATES_DIR.exists():
        return
    replacements = {
        "${KEYCLOAK_OAUTH2_CLIENT_SECRET}": KEYCLOAK_OAUTH2_CLIENT_SECRET,
        "${KEYCLOAK_REDIRECT_URI}": KEYCLOAK_REDIRECT_URI,
        "${KEYCLOAK_DEMO_USER}": KEYCLOAK_DEMO_USER,
        "${KEYCLOAK_DEMO_PASSWORD}": KEYCLOAK_DEMO_PASSWORD,
    }
    for tmpl in KEYCLOAK_TEMPLATES_DIR.rglob("*.template"):
        rel = tmpl.relative_to(KEYCLOAK_TEMPLATES_DIR)
        out_rel = rel.with_suffix("")
        rendered = tmpl.read_text(encoding="utf-8")
        for key, val in replacements.items():
            rendered = rendered.replace(key, val)
        _write(KEYCLOAK_OUTPUT_DIR / out_rel, rendered)


def _wait_for_postgres(max_attempts: int = 60, sleep_seconds: float = 2.0) -> None:
    for _ in range(max_attempts):
        try:
            with _pg_connect() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                return
        except Exception:
            time.sleep(sleep_seconds)
    raise RuntimeError("Postgres is not reachable for initializer")


def init_postgres_schema() -> None:
    with _pg_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id BIGSERIAL PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'admin',
                    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    last_login TIMESTAMPTZ
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS agents_control_state (
                    agent_id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL DEFAULT 'default',
                    status TEXT NOT NULL DEFAULT 'disconnected',
                    connected_at TIMESTAMPTZ,
                    last_seen TIMESTAMPTZ,
                    last_heartbeat TIMESTAMPTZ,
                    capabilities_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                    policy_version TEXT,
                    policy_hash TEXT,
                    last_policy_applied_at TIMESTAMPTZ,
                    last_policy_result TEXT,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS command_jobs (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL DEFAULT 'default',
                    agent_id TEXT NOT NULL,
                    command_type TEXT NOT NULL,
                    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                    status TEXT NOT NULL DEFAULT 'queued',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    started_at TIMESTAMPTZ,
                    completed_at TIMESTAMPTZ,
                    result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                    error_text TEXT
                )
                """
            )


def main() -> None:
    _wait_for_postgres()
    init_postgres_schema()
    print("[init] postgres schema initialized")

    if RENDER_ENABLED:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        render_nginx_assets()
        print(f"[init] nginx assets rendered to {OUTPUT_DIR / 'nginx'}")

    if OBS_RENDER_ENABLED:
        OBS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        render_observability_assets()
        print(f"[init] observability assets rendered to {OBS_OUTPUT_DIR}")

    if KEYCLOAK_RENDER_ENABLED:
        KEYCLOAK_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        render_keycloak_assets()
        print(f"[init] keycloak assets rendered to {KEYCLOAK_OUTPUT_DIR}")

    if not RENDER_ENABLED and not OBS_RENDER_ENABLED and not KEYCLOAK_RENDER_ENABLED:
        print("[init] render disabled; nothing else to do")


if __name__ == "__main__":
    main()
