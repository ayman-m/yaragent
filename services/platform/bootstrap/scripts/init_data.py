#!/usr/bin/env python3
from __future__ import annotations

import os
import time
from pathlib import Path

import psycopg

TEMPLATES_DIR = Path("/app/bootstrap/nginx/templates")
OUTPUT_DIR = Path(os.getenv("INIT_NGINX_OUTPUT_DIR", "/tmp/nginx-generated"))
RENDER_ENABLED = os.getenv("INIT_NGINX_RENDER", "true").lower() == "true"

SERVER_NAME = os.getenv("INIT_NGINX_SERVER_NAME", "localhost")
UI_UPSTREAM = os.getenv("INIT_NGINX_UI_UPSTREAM", "ui:3000")
API_UPSTREAM = os.getenv("INIT_NGINX_API_UPSTREAM", "orchestrator:8002")
MCP_UPSTREAM = os.getenv("INIT_NGINX_MCP_UPSTREAM", "mcp-server:8001")
API_TIMEOUT_SECONDS = os.getenv("INIT_NGINX_API_TIMEOUT_SECONDS", "60")

NGINX_CERT_PRIV = os.getenv("INIT_NGINX_CERT_PRIV", "")
NGINX_CERT_PUB = os.getenv("INIT_NGINX_CERT_PUB", "")

POSTGRES_DSN = os.getenv("INIT_POSTGRES_DSN", "postgresql://postgres:postgres@postgres:5432/yaragent")


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _render_template(raw: str) -> str:
    replacements = {
        "${SERVER_NAME}": SERVER_NAME,
        "${UI_UPSTREAM}": UI_UPSTREAM,
        "${API_UPSTREAM}": API_UPSTREAM,
        "${MCP_UPSTREAM}": MCP_UPSTREAM,
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


def _wait_for_postgres(max_attempts: int = 60, sleep_seconds: float = 2.0) -> None:
    for _ in range(max_attempts):
        try:
            with psycopg.connect(POSTGRES_DSN, autocommit=True) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                return
        except Exception:
            time.sleep(sleep_seconds)
    raise RuntimeError("Postgres is not reachable for initializer")


def init_postgres_schema() -> None:
    with psycopg.connect(POSTGRES_DSN, autocommit=True) as conn:
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


def main() -> None:
    _wait_for_postgres()
    init_postgres_schema()
    print("[init] postgres schema initialized")

    if not RENDER_ENABLED:
        print("[init] nginx render disabled; nothing else to do")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    render_nginx_assets()
    print(f"[init] nginx assets rendered to {OUTPUT_DIR / 'nginx'}")


if __name__ == "__main__":
    main()
