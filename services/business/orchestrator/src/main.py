import asyncio
import base64
import hashlib
import io
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import asyncpg
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from minio import Minio
from minio.error import S3Error
from passlib.context import CryptContext

app = FastAPI()
logger = logging.getLogger("orchestrator")
logging.basicConfig(level=logging.INFO)

# agent_id -> websocket
agents: Dict[str, WebSocket] = {}
# agent_id -> asyncio.Queue of incoming messages from agent
agent_queues: Dict[str, asyncio.Queue] = {}
# agent_id -> runtime state
agent_state: Dict[str, Dict[str, Any]] = {}

security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
INITIAL_SETUP_TOKEN = os.getenv("INITIAL_SETUP_TOKEN", "")
ORCHESTRATOR_API_TOKEN = os.getenv("ORCHESTRATOR_API_TOKEN", "")
DATABASE_URL = (os.getenv("DATABASE_URL", "") or "").strip()
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "yaragent")
AGENT_STALE_SECONDS = int(os.getenv("AGENT_STALE_SECONDS", "90"))
AGENT_HEARTBEAT_INTERVAL_SECONDS = int(os.getenv("AGENT_HEARTBEAT_INTERVAL_SECONDS", "30"))
AGENT_MAX_MISSED_HEARTBEATS = int(os.getenv("AGENT_MAX_MISSED_HEARTBEATS", "3"))
AGENT_EPHEMERAL_LEASE_SECONDS = int(os.getenv("AGENT_EPHEMERAL_LEASE_SECONDS", "120"))
AGENT_EPHEMERAL_GRACE_SECONDS = int(os.getenv("AGENT_EPHEMERAL_GRACE_SECONDS", "300"))
AGENT_CLEANUP_INTERVAL_SECONDS = int(os.getenv("AGENT_CLEANUP_INTERVAL_SECONDS", "60"))
AGENT_AUTO_DELETE_EPHEMERAL = (os.getenv("AGENT_AUTO_DELETE_EPHEMERAL", "true").strip().lower() in {"1", "true", "yes", "on"})
AGENT_ORPHAN_DELETE_SECONDS = int(os.getenv("AGENT_ORPHAN_DELETE_SECONDS", "21600"))
AGENT_STALE_RETENTION_DAYS = int(os.getenv("AGENT_STALE_RETENTION_DAYS", "30"))
YARA_STORAGE_ENABLED = (os.getenv("YARA_STORAGE_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"})
YARA_STORAGE_ENDPOINT = os.getenv("YARA_STORAGE_ENDPOINT", "minio:9000")
YARA_STORAGE_ACCESS_KEY = os.getenv("YARA_STORAGE_ACCESS_KEY", "yaragent")
YARA_STORAGE_SECRET_KEY = os.getenv("YARA_STORAGE_SECRET_KEY", "yaragent-minio-secret")
YARA_STORAGE_BUCKET = os.getenv("YARA_STORAGE_BUCKET", "yaragent-rules")
YARA_STORAGE_USE_SSL = (os.getenv("YARA_STORAGE_USE_SSL", "false").strip().lower() in {"1", "true", "yes", "on"})
GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY", "") or os.getenv("VERTEX_API_KEY", "")).strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()
GEMINI_API_BASE = os.getenv("GEMINI_API_BASE", "https://generativelanguage.googleapis.com/v1beta").strip()

_db_pool: Optional[asyncpg.Pool] = None
_cleanup_task: Optional[asyncio.Task] = None


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire, "type": "access"}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


async def _db() -> asyncpg.Pool:
    if _db_pool is None:
        raise HTTPException(status_code=500, detail="database not initialized")
    return _db_pool


async def _fetch_user_by_username(username: str) -> Optional[asyncpg.Record]:
    db = await _db()
    query = "SELECT username, password_hash, settings_json FROM users WHERE username = $1"
    async with db.acquire() as conn:
        return await conn.fetchrow(query, username)


async def _is_initialized() -> bool:
    db = await _db()
    query = "SELECT COUNT(*)::int AS count FROM users"
    async with db.acquire() as conn:
        row = await conn.fetchrow(query)
        return bool(row and row["count"] > 0)


async def _upsert_agent_control_state(
    agent_id: str,
    *,
    tenant_id: Optional[str] = None,
    status_value: Optional[str] = None,
    connected_at: Optional[datetime] = None,
    last_seen: Optional[datetime] = None,
    last_heartbeat: Optional[datetime] = None,
    capabilities: Optional[dict] = None,
    policy_version: Optional[str] = None,
    policy_hash: Optional[str] = None,
    last_policy_result: Optional[str] = None,
    is_ephemeral: Optional[bool] = None,
    instance_id: Optional[str] = None,
    runtime_kind: Optional[str] = None,
    lease_expires_at: Optional[datetime] = None,
    asset_profile: Optional[dict] = None,
    sbom_snapshot: Optional[list] = None,
    cve_snapshot: Optional[list] = None,
    findings_count: Optional[int] = None,
) -> None:
    db = await _db()
    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO agents_control_state (
                agent_id, tenant_id, status, connected_at, last_seen, last_heartbeat,
                capabilities_json, policy_version, policy_hash, last_policy_applied_at,
                last_policy_result, is_ephemeral, instance_id, runtime_kind, lease_expires_at,
                asset_profile_json, sbom_json, cve_json, findings_count, updated_at
            )
            VALUES (
                $1::text, COALESCE($2::text, 'default'), COALESCE($3::text, 'disconnected'),
                $4::timestamptz, $5::timestamptz, $6::timestamptz,
                COALESCE($7::jsonb, '{}'::jsonb), $8::text, $9::text,
                CASE
                    WHEN $8::text IS NOT NULL OR $9::text IS NOT NULL OR $10::text IS NOT NULL THEN now()
                    ELSE NULL
                END,
                $10::text, COALESCE($11::boolean, false), $12::text, $13::text, $14::timestamptz,
                COALESCE($15::jsonb, '{}'::jsonb), COALESCE($16::jsonb, '[]'::jsonb), COALESCE($17::jsonb, '[]'::jsonb), COALESCE($18::int, 0),
                now()
            )
            ON CONFLICT (agent_id) DO UPDATE SET
                tenant_id = COALESCE(EXCLUDED.tenant_id, agents_control_state.tenant_id),
                status = COALESCE(EXCLUDED.status, agents_control_state.status),
                connected_at = COALESCE(EXCLUDED.connected_at, agents_control_state.connected_at),
                last_seen = COALESCE(EXCLUDED.last_seen, agents_control_state.last_seen),
                last_heartbeat = COALESCE(EXCLUDED.last_heartbeat, agents_control_state.last_heartbeat),
                capabilities_json = COALESCE(EXCLUDED.capabilities_json, agents_control_state.capabilities_json),
                policy_version = COALESCE(EXCLUDED.policy_version, agents_control_state.policy_version),
                policy_hash = COALESCE(EXCLUDED.policy_hash, agents_control_state.policy_hash),
                last_policy_applied_at = CASE
                    WHEN EXCLUDED.policy_version IS NOT NULL OR EXCLUDED.policy_hash IS NOT NULL OR EXCLUDED.last_policy_result IS NOT NULL
                        THEN now()
                    ELSE agents_control_state.last_policy_applied_at
                END,
                last_policy_result = COALESCE(EXCLUDED.last_policy_result, agents_control_state.last_policy_result),
                is_ephemeral = COALESCE(EXCLUDED.is_ephemeral, agents_control_state.is_ephemeral),
                instance_id = COALESCE(EXCLUDED.instance_id, agents_control_state.instance_id),
                runtime_kind = COALESCE(EXCLUDED.runtime_kind, agents_control_state.runtime_kind),
                lease_expires_at = COALESCE(EXCLUDED.lease_expires_at, agents_control_state.lease_expires_at),
                asset_profile_json = COALESCE(EXCLUDED.asset_profile_json, agents_control_state.asset_profile_json),
                sbom_json = COALESCE(EXCLUDED.sbom_json, agents_control_state.sbom_json),
                cve_json = COALESCE(EXCLUDED.cve_json, agents_control_state.cve_json),
                findings_count = COALESCE(EXCLUDED.findings_count, agents_control_state.findings_count),
                updated_at = now()
            """,
            agent_id,
            tenant_id,
            status_value,
            connected_at,
            last_seen,
            last_heartbeat,
            json.dumps(capabilities) if capabilities is not None else None,
            policy_version,
            policy_hash,
            last_policy_result,
            is_ephemeral,
            instance_id,
            runtime_kind,
            lease_expires_at,
            json.dumps(asset_profile) if asset_profile is not None else None,
            json.dumps(sbom_snapshot) if sbom_snapshot is not None else None,
            json.dumps(cve_snapshot) if cve_snapshot is not None else None,
            findings_count,
        )
        if (status_value or "").strip().lower() == "connected":
            await _restore_if_archived(conn, agent_id)


def _is_truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on", "y"}
    return False


def _lease_expiry(now: datetime) -> datetime:
    return now + timedelta(seconds=max(30, AGENT_EPHEMERAL_LEASE_SECONDS))


def _inactive_threshold_seconds() -> int:
    from_heartbeat = max(1, AGENT_HEARTBEAT_INTERVAL_SECONDS) * max(1, AGENT_MAX_MISSED_HEARTBEATS)
    return max(AGENT_STALE_SECONDS, from_heartbeat)


async def _restore_if_archived(conn: asyncpg.Connection, agent_id: str) -> None:
    await conn.execute("DELETE FROM agents_stale_state WHERE agent_id = $1", agent_id)


async def _cleanup_expired_ephemeral_agents() -> int:
    db = await _db()
    async with db.acquire() as conn:
        candidate_rows = await conn.fetch(
            """
            SELECT agent_id
            FROM agents_control_state
            WHERE is_ephemeral = true
              AND lease_expires_at IS NOT NULL
              AND lease_expires_at < (now() - make_interval(secs => $1::int))
            ORDER BY lease_expires_at ASC
            LIMIT 500
            """,
            max(0, AGENT_EPHEMERAL_GRACE_SECONDS),
        )
        if not candidate_rows:
            return 0
        candidate_ids = [str(row["agent_id"]) for row in candidate_rows]
        to_delete = [aid for aid in candidate_ids if aid not in agents]
        if not to_delete:
            return 0
        result = await conn.fetch(
            """
            DELETE FROM agents_control_state
            WHERE agent_id = ANY($1::text[])
            RETURNING agent_id
            """,
            to_delete,
        )
        return len(result)


async def _cleanup_orphan_agents() -> int:
    db = await _db()
    async with db.acquire() as conn:
        candidate_rows = await conn.fetch(
            """
            SELECT agent_id
            FROM agents_control_state
            WHERE updated_at < (now() - make_interval(secs => $1::int))
              AND (
                is_ephemeral = true
                OR (
                  (asset_profile_json = '{}'::jsonb OR asset_profile_json IS NULL)
                  AND COALESCE(jsonb_array_length(sbom_json), 0) = 0
                  AND COALESCE(jsonb_array_length(cve_json), 0) = 0
                  AND last_heartbeat IS NULL
                )
              )
            ORDER BY updated_at ASC
            LIMIT 1000
            """,
            max(300, AGENT_ORPHAN_DELETE_SECONDS),
        )
        if not candidate_rows:
            return 0
        candidate_ids = [str(row["agent_id"]) for row in candidate_rows]
        to_delete = [aid for aid in candidate_ids if aid not in agents]
        if not to_delete:
            return 0
        result = await conn.fetch(
            """
            DELETE FROM agents_control_state
            WHERE agent_id = ANY($1::text[])
            RETURNING agent_id
            """,
            to_delete,
        )
        return len(result)


async def _archive_inactive_agents() -> int:
    threshold_seconds = _inactive_threshold_seconds()
    db = await _db()
    async with db.acquire() as conn:
        candidate_rows = await conn.fetch(
            """
            SELECT agent_id
            FROM agents_control_state
            WHERE (
                status = 'disconnected'
                OR (
                    COALESCE(last_heartbeat, last_seen, connected_at) IS NOT NULL
                    AND COALESCE(last_heartbeat, last_seen, connected_at) < (now() - make_interval(secs => $1::int))
                )
            )
            ORDER BY updated_at ASC
            LIMIT 2000
            """,
            threshold_seconds,
        )
        if not candidate_rows:
            return 0
        candidate_ids = [str(row["agent_id"]) for row in candidate_rows]
        if not candidate_ids:
            return 0
        await conn.execute(
            """
            INSERT INTO agents_stale_state (
                agent_id, tenant_id, status, connected_at, last_seen, last_heartbeat,
                capabilities_json, is_ephemeral, instance_id, runtime_kind, lease_expires_at,
                asset_profile_json, sbom_json, cve_json, findings_count,
                policy_version, policy_hash, last_policy_applied_at, last_policy_result,
                updated_at, archived_reason, archived_at
            )
            SELECT
                a.agent_id, a.tenant_id, a.status, a.connected_at, a.last_seen, a.last_heartbeat,
                a.capabilities_json, a.is_ephemeral, a.instance_id, a.runtime_kind, a.lease_expires_at,
                a.asset_profile_json, a.sbom_json, a.cve_json, a.findings_count,
                a.policy_version, a.policy_hash, a.last_policy_applied_at, a.last_policy_result,
                a.updated_at,
                CASE
                    WHEN a.status = 'disconnected' THEN 'disconnected'
                    WHEN a.last_heartbeat IS NULL THEN 'missing_heartbeat'
                    ELSE 'stale_heartbeat'
                END AS archived_reason,
                now() AS archived_at
            FROM agents_control_state a
            WHERE a.agent_id = ANY($1::text[])
            ON CONFLICT (agent_id) DO UPDATE SET
                tenant_id = EXCLUDED.tenant_id,
                status = EXCLUDED.status,
                connected_at = EXCLUDED.connected_at,
                last_seen = EXCLUDED.last_seen,
                last_heartbeat = EXCLUDED.last_heartbeat,
                capabilities_json = EXCLUDED.capabilities_json,
                is_ephemeral = EXCLUDED.is_ephemeral,
                instance_id = EXCLUDED.instance_id,
                runtime_kind = EXCLUDED.runtime_kind,
                lease_expires_at = EXCLUDED.lease_expires_at,
                asset_profile_json = EXCLUDED.asset_profile_json,
                sbom_json = EXCLUDED.sbom_json,
                cve_json = EXCLUDED.cve_json,
                findings_count = EXCLUDED.findings_count,
                policy_version = EXCLUDED.policy_version,
                policy_hash = EXCLUDED.policy_hash,
                last_policy_applied_at = EXCLUDED.last_policy_applied_at,
                last_policy_result = EXCLUDED.last_policy_result,
                updated_at = EXCLUDED.updated_at,
                archived_reason = EXCLUDED.archived_reason,
                archived_at = EXCLUDED.archived_at
            """,
            candidate_ids,
        )
        result = await conn.fetch(
            """
            DELETE FROM agents_control_state
            WHERE agent_id = ANY($1::text[])
            RETURNING agent_id
            """,
            candidate_ids,
        )
        return len(result)


async def _purge_old_stale_agents() -> int:
    db = await _db()
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            DELETE FROM agents_stale_state
            WHERE archived_at < (now() - make_interval(days => $1::int))
            RETURNING agent_id
            """,
            max(1, AGENT_STALE_RETENTION_DAYS),
        )
        return len(rows)


async def _cleanup_loop() -> None:
    interval = max(10, AGENT_CLEANUP_INTERVAL_SECONDS)
    while True:
        try:
            archived = await _archive_inactive_agents()
            if archived > 0:
                logger.info("inactive archival moved %d agents to stale table", archived)
            purged = await _purge_old_stale_agents()
            if purged > 0:
                logger.info("stale retention purge removed %d archived agents", purged)
            if AGENT_AUTO_DELETE_EPHEMERAL:
                deleted = await _cleanup_expired_ephemeral_agents()
                if deleted > 0:
                    logger.info("ephemeral cleanup removed %d expired agent records", deleted)
                orphan_deleted = await _cleanup_orphan_agents()
                if orphan_deleted > 0:
                    logger.info("orphan cleanup removed %d stale/empty agent records", orphan_deleted)
        except Exception:
            logger.exception("ephemeral cleanup failed")
        await asyncio.sleep(interval)


async def _create_command_job(
    *,
    job_id: str,
    tenant_id: str,
    agent_id: str,
    command_type: str,
    payload: dict,
) -> None:
    db = await _db()
    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO command_jobs (id, tenant_id, agent_id, command_type, payload_json, status)
            VALUES ($1, $2, $3, $4, $5::jsonb, 'queued')
            ON CONFLICT (id) DO NOTHING
            """,
            job_id,
            tenant_id,
            agent_id,
            command_type,
            json.dumps(payload),
        )


async def _update_command_job(
    *,
    job_id: str,
    status_value: str,
    result: Optional[dict] = None,
    error_text: Optional[str] = None,
    mark_started: bool = False,
    mark_completed: bool = False,
) -> None:
    db = await _db()
    async with db.acquire() as conn:
        await conn.execute(
            """
            UPDATE command_jobs
            SET status = $2,
                result_json = COALESCE($3::jsonb, result_json),
                error_text = COALESCE($4, error_text),
                started_at = CASE WHEN $5 THEN COALESCE(started_at, now()) ELSE started_at END,
                completed_at = CASE WHEN $6 THEN now() ELSE completed_at END
            WHERE id = $1
            """,
            job_id,
            status_value,
            json.dumps(result) if result is not None else None,
            error_text,
            mark_started,
            mark_completed,
        )


def _tenant_for_request(user: dict, payload_tenant: Optional[str]) -> str:
    tenant = (payload_tenant or "").strip()
    if tenant:
        return tenant
    if user.get("role") == "service":
        return "default"
    return "default"


def _ensure_yara_storage_enabled() -> None:
    if not YARA_STORAGE_ENABLED:
        raise HTTPException(status_code=503, detail="YARA object storage is disabled")


def _validate_yara_rule_name(name: str) -> str:
    n = (name or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9._-]+\.yar", n):
        raise HTTPException(status_code=400, detail="invalid rule name; expected <name>.yar")
    return n


def _rule_object_key(tenant_id: str, name: str) -> str:
    return f"tenants/{tenant_id}/yara/{name}"


def _minio_client() -> Minio:
    return Minio(
        YARA_STORAGE_ENDPOINT,
        access_key=YARA_STORAGE_ACCESS_KEY,
        secret_key=YARA_STORAGE_SECRET_KEY,
        secure=YARA_STORAGE_USE_SSL,
    )


def _safe_string(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    return str(value)


def _parse_yarac_errors(stderr_text: str) -> list[dict]:
    errors: list[dict] = []
    for raw_line in (stderr_text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line_no: Optional[int] = None
        m = re.search(r"line\s+(\d+)", line, flags=re.IGNORECASE)
        if m:
            line_no = int(m.group(1))
        else:
            m2 = re.search(r":(\d+):", line)
            if m2:
                line_no = int(m2.group(1))
        errors.append(
            {
                "line": line_no,
                "message": line,
            }
        )
    return errors


def _validate_yara_with_yarac(name: str, content: str) -> dict:
    if shutil.which("yarac") is None:
        raise RuntimeError("yarac binary is not available in orchestrator container")

    with tempfile.TemporaryDirectory(prefix="yaraval-") as tmpdir:
        rule_path = os.path.join(tmpdir, name or "rule.yar")
        out_path = os.path.join(tmpdir, "compiled.yarc")
        with open(rule_path, "w", encoding="utf-8") as f:
            f.write(content)
        proc = subprocess.run(
            ["yarac", rule_path, out_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=10,
            check=False,
        )
        combined = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
        if proc.returncode == 0:
            return {
                "valid": True,
                "message": "YARA rule compiled successfully",
                "errors": [],
            }
        return {
            "valid": False,
            "message": "YARA rule failed to compile",
            "errors": _parse_yarac_errors(combined),
            "raw": combined,
        }


YARA_ASSISTANT_SYSTEM_PROMPT = """You are YARAgent Rule Assistant, an expert in writing, reviewing, and refactoring YARA rules.

Your responsibilities:
1) Help users create new YARA rules and improve existing rules.
2) Explain detection logic clearly and concisely.
3) Prefer safe, maintainable, and performant patterns.
4) If user asks for edits, provide complete updated rule text unless they asked for only a diff.
5) When giving suggestions, preserve existing intent and metadata when possible.

Constraints:
- Focus only on YARA-related tasks.
- Do not invent unsupported fields or syntax.
- If context is missing, ask one concise clarifying question.
- Keep responses actionable.
"""


def _call_gemini_yara_assistant(user_message: str, history: list[dict], rule_name: str, rule_content: str) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY (or VERTEX_API_KEY) is not configured")

    contents = []
    for item in history:
        role = str(item.get("role") or "user").strip().lower()
        text = str(item.get("content") or "").strip()
        if not text:
            continue
        if role not in {"user", "model"}:
            role = "user"
        contents.append({"role": role, "parts": [{"text": text}]})

    contextual_user_text = (
        f"Current rule file: {rule_name}\n\n"
        f"Current rule content:\n```yara\n{rule_content}\n```\n\n"
        f"User request:\n{user_message}"
    )
    contents.append({"role": "user", "parts": [{"text": contextual_user_text}]})

    payload = {
        "system_instruction": {
            "parts": [{"text": YARA_ASSISTANT_SYSTEM_PROMPT}],
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2048,
        },
    }

    req = urllib.request.Request(
        f"{GEMINI_API_BASE}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        err_body = ""
        try:
            err_body = exc.read().decode("utf-8")
        except Exception:
            pass
        raise RuntimeError(f"Gemini API error {exc.code}: {err_body or exc.reason}")
    except Exception as exc:
        raise RuntimeError(f"Gemini request failed: {exc}")

    data = json.loads(raw)
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("Gemini returned no candidates")
    parts = ((candidates[0] or {}).get("content") or {}).get("parts") or []
    out = []
    for p in parts:
        txt = p.get("text")
        if isinstance(txt, str) and txt.strip():
            out.append(txt.strip())
    if not out:
        raise RuntimeError("Gemini returned an empty response")
    return "\n\n".join(out)


async def _upsert_rule_metadata(
    *,
    tenant_id: str,
    name: str,
    object_key: str,
    etag: str,
    sha256_hex: str,
    size_bytes: int,
    actor: str,
) -> None:
    db = await _db()
    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO yara_rule_files (
                id, tenant_id, name, object_key, etag, sha256, size_bytes, created_by, updated_by, updated_at
            )
            VALUES (
                $8, $1, $2, $3, $4, $5, $6, $7, $7, now()
            )
            ON CONFLICT (tenant_id, name) DO UPDATE SET
                object_key = EXCLUDED.object_key,
                etag = EXCLUDED.etag,
                sha256 = EXCLUDED.sha256,
                size_bytes = EXCLUDED.size_bytes,
                updated_by = EXCLUDED.updated_by,
                updated_at = now(),
                deleted_at = NULL
            """,
            tenant_id,
            name,
            object_key,
            etag,
            sha256_hex,
            max(0, int(size_bytes)),
            actor,
            str(uuid.uuid4()),
        )


async def _get_rule_metadata(tenant_id: str, name: str) -> Optional[asyncpg.Record]:
    db = await _db()
    async with db.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT tenant_id, name, object_key, etag, sha256, size_bytes, created_at, updated_at, created_by, updated_by
            FROM yara_rule_files
            WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL
            """,
            tenant_id,
            name,
        )


async def _list_rule_metadata(tenant_id: str) -> Dict[str, asyncpg.Record]:
    db = await _db()
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT tenant_id, name, object_key, etag, sha256, size_bytes, created_at, updated_at, created_by, updated_by
            FROM yara_rule_files
            WHERE tenant_id = $1 AND deleted_at IS NULL
            ORDER BY updated_at DESC
            """,
            tenant_id,
        )
    return {str(r["name"]): r for r in rows}


async def _delete_rule_metadata(tenant_id: str, name: str) -> None:
    db = await _db()
    async with db.acquire() as conn:
        await conn.execute(
            """
            DELETE FROM yara_rule_files
            WHERE tenant_id = $1 AND name = $2
            """,
            tenant_id,
            name,
        )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials

    if ORCHESTRATOR_API_TOKEN and token == ORCHESTRATOR_API_TOKEN:
        return {"sub": "service", "role": "service"}

    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = await _fetch_user_by_username(str(sub))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return payload


@app.on_event("startup")
async def startup() -> None:
    global _db_pool, _cleanup_task
    if JWT_SECRET_KEY == "change-me":
        logger.warning("JWT_SECRET_KEY is using default value. Set it via environment secret.")
    if DATABASE_URL:
        _db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
    else:
        _db_pool = await asyncpg.create_pool(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            database=POSTGRES_DB,
            min_size=1,
            max_size=10,
        )
    # Run one archival/retention sweep at startup so UI immediately hides stale/disconnected rows.
    try:
        archived = await _archive_inactive_agents()
        if archived > 0:
            logger.info("startup archival moved %d agents to stale table", archived)
        purged = await _purge_old_stale_agents()
        if purged > 0:
            logger.info("startup stale retention purge removed %d agents", purged)
    except Exception:
        logger.exception("startup archival sweep failed")
    _cleanup_task = asyncio.create_task(_cleanup_loop())


@app.on_event("shutdown")
async def shutdown() -> None:
    global _db_pool, _cleanup_task
    if _cleanup_task is not None:
        _cleanup_task.cancel()
        try:
            await _cleanup_task
        except asyncio.CancelledError:
            pass
        _cleanup_task = None
    if _db_pool is not None:
        await _db_pool.close()
        _db_pool = None


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "healthy"})


@app.get("/setup/status")
async def setup_status() -> JSONResponse:
    initialized = await _is_initialized()
    setup_token_required = bool(INITIAL_SETUP_TOKEN.strip())
    return JSONResponse({"initialized": initialized, "setup_token_required": setup_token_required})


@app.post("/auth/setup")
async def setup_admin(payload: dict) -> JSONResponse:
    if await _is_initialized():
        raise HTTPException(status_code=409, detail="already initialized")

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    setup_token = payload.get("setup_token") or ""
    settings = payload.get("settings") or {}

    if INITIAL_SETUP_TOKEN and setup_token != INITIAL_SETUP_TOKEN:
        raise HTTPException(status_code=401, detail="invalid setup token")

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="username must be at least 3 characters")

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="password must be at least 8 characters")

    if not isinstance(settings, dict):
        raise HTTPException(status_code=400, detail="settings must be an object")

    db = await _db()
    password_hash = pwd_context.hash(password)

    try:
        async with db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO users (username, password_hash, role, settings_json)
                VALUES ($1, $2, 'admin', $3::jsonb)
                """,
                username,
                password_hash,
                json.dumps(settings),
            )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="already initialized")

    token = create_access_token(subject=username)
    return JSONResponse(
        {
            "access_token": token,
            "token_type": "bearer",
            "username": username,
            "settings": settings,
        }
    )


@app.post("/auth/login")
async def login(payload: dict) -> JSONResponse:
    if not await _is_initialized():
        raise HTTPException(status_code=412, detail="setup required")

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    user = await _fetch_user_by_username(username)
    if user is None or not pwd_context.verify(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="invalid username or password")

    db = await _db()
    async with db.acquire() as conn:
        await conn.execute("UPDATE users SET last_login = now() WHERE username = $1", username)

    token = create_access_token(subject=username)
    return JSONResponse(
        {
            "access_token": token,
            "token_type": "bearer",
            "username": username,
            "settings": user.get("settings_json") or {},
        }
    )


@app.get("/auth/validate")
async def validate_auth(user: dict = Depends(get_current_user)) -> JSONResponse:
    username = str(user.get("sub", "user"))
    headers = {
        "X-Auth-Request-User": username,
        "X-Auth-Request-Email": username,
    }
    return JSONResponse({"ok": True, "user": username}, headers=headers)


@app.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)) -> JSONResponse:
    username = str(user["sub"])
    row = await _fetch_user_by_username(username)
    if row is None:
        raise HTTPException(status_code=404, detail="user not found")
    return JSONResponse({"settings": row.get("settings_json") or {}})


@app.put("/settings")
async def update_settings(payload: dict, user: dict = Depends(get_current_user)) -> JSONResponse:
    settings = payload.get("settings")
    if not isinstance(settings, dict):
        raise HTTPException(status_code=400, detail="settings must be an object")

    username = str(user["sub"])
    db = await _db()
    async with db.acquire() as conn:
        await conn.execute(
            "UPDATE users SET settings_json = $2::jsonb WHERE username = $1",
            username,
            json.dumps(settings),
        )

    return JSONResponse({"settings": settings})


@app.get("/agents")
async def list_agents(_: dict = Depends(get_current_user)):
    db = await _db()
    rows = []
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT agent_id, tenant_id, status, connected_at, last_seen, last_heartbeat,
                   capabilities_json, is_ephemeral, instance_id, runtime_kind, lease_expires_at,
                   asset_profile_json, findings_count
            FROM agents_control_state
            ORDER BY updated_at DESC
            """
        )

    now = datetime.now(timezone.utc)
    out = []
    for row in rows:
        aid = row["agent_id"]
        connected_at = row["connected_at"]
        last_seen = row["last_seen"]
        last_heartbeat = row["last_heartbeat"]
        capabilities = row.get("capabilities_json") or {}
        tenant_id = row["tenant_id"]
        status_value = row["status"] or "disconnected"
        is_ephemeral = bool(row.get("is_ephemeral"))
        instance_id = row.get("instance_id")
        runtime_kind = row.get("runtime_kind")
        lease_expires_at = row.get("lease_expires_at")
        asset_profile = row.get("asset_profile_json") or {}
        findings_count = int(row.get("findings_count") or 0)

        status = status_value
        freshness_ts = last_heartbeat or last_seen or connected_at
        if freshness_ts is not None and (now - freshness_ts).total_seconds() > AGENT_STALE_SECONDS:
            if status_value == "connected":
                status = "stale"

        out.append(
            {
                "id": aid,
                "status": status,
                "tenant_id": tenant_id,
                "connected_at": connected_at.isoformat() if connected_at else None,
                "last_seen": last_seen.isoformat() if last_seen else None,
                "last_heartbeat": last_heartbeat.isoformat() if last_heartbeat else None,
                "capabilities": capabilities,
                "is_ephemeral": is_ephemeral,
                "instance_id": instance_id,
                "runtime_kind": runtime_kind,
                "lease_expires_at": lease_expires_at.isoformat() if lease_expires_at else None,
                "asset_profile": asset_profile,
                "findings_count": findings_count,
            }
        )
    return JSONResponse(out)


@app.get("/agents/{agent_id}/profile")
async def get_agent_profile(agent_id: str, _: dict = Depends(get_current_user)) -> JSONResponse:
    db = await _db()
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT agent_id, tenant_id, connected_at, last_seen, last_heartbeat,
                   asset_profile_json, sbom_json, cve_json, findings_count
            FROM agents_control_state
            WHERE agent_id = $1
            """,
            agent_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="agent not found")
    return JSONResponse(
        {
            "agent_id": row["agent_id"],
            "tenant_id": row["tenant_id"],
            "connected_at": row["connected_at"].isoformat() if row["connected_at"] else None,
            "last_seen": row["last_seen"].isoformat() if row["last_seen"] else None,
            "last_heartbeat": row["last_heartbeat"].isoformat() if row["last_heartbeat"] else None,
            "asset_profile": row.get("asset_profile_json") or {},
            "sbom": row.get("sbom_json") or [],
            "cves": row.get("cve_json") or [],
            "findings_count": int(row.get("findings_count") or 0),
        }
    )


@app.get("/yara/rules")
async def list_yara_rules(user: dict = Depends(get_current_user)) -> JSONResponse:
    _ensure_yara_storage_enabled()
    tenant_id = _tenant_for_request(user, None)
    client = _minio_client()
    prefix = f"tenants/{tenant_id}/yara/"
    actor = str(user.get("sub") or "system")
    metadata_by_name = await _list_rule_metadata(tenant_id)

    def _list_objects() -> list:
        return list(client.list_objects(YARA_STORAGE_BUCKET, prefix=prefix, recursive=True))

    try:
        objects = await asyncio.to_thread(_list_objects)
    except Exception as exc:
        logger.exception("failed to list yara rules")
        raise HTTPException(status_code=502, detail=f"yara storage list failed: {exc}")

    items = []
    for obj in objects:
        object_name = _safe_string(getattr(obj, "object_name", ""))
        if not object_name or not object_name.endswith(".yar"):
            continue
        name = object_name.split("/")[-1]
        row = metadata_by_name.get(name)
        etag = _safe_string(getattr(obj, "etag", ""))
        size_bytes = int(getattr(obj, "size", 0) or 0)
        updated_at_obj = getattr(obj, "last_modified", None)
        items.append(
            {
                "name": name,
                "tenant_id": tenant_id,
                "object_key": object_name,
                "etag": etag,
                "sha256": _safe_string(row["sha256"]) if row else "",
                "size_bytes": size_bytes,
                "created_at": row["created_at"].isoformat() if row and row.get("created_at") else None,
                "updated_at": row["updated_at"].isoformat() if row and row.get("updated_at") else (updated_at_obj.isoformat() if updated_at_obj else None),
                "created_by": _safe_string(row["created_by"]) if row else actor,
                "updated_by": _safe_string(row["updated_by"]) if row else actor,
            }
        )

    items.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return JSONResponse(items)


@app.get("/yara/rules/{name}")
async def get_yara_rule(name: str, user: dict = Depends(get_current_user)) -> JSONResponse:
    _ensure_yara_storage_enabled()
    tenant_id = _tenant_for_request(user, None)
    safe_name = _validate_yara_rule_name(name)
    object_key = _rule_object_key(tenant_id, safe_name)
    client = _minio_client()
    row = await _get_rule_metadata(tenant_id, safe_name)

    try:
        response = await asyncio.to_thread(client.get_object, YARA_STORAGE_BUCKET, object_key)
        data = response.read()
        response.close()
        response.release_conn()
        stat = await asyncio.to_thread(client.stat_object, YARA_STORAGE_BUCKET, object_key)
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject", "NoSuchBucket"}:
            raise HTTPException(status_code=404, detail="rule not found")
        logger.exception("failed to fetch yara rule")
        raise HTTPException(status_code=502, detail=f"yara storage read failed: {exc}")
    except Exception as exc:
        logger.exception("failed to fetch yara rule")
        raise HTTPException(status_code=502, detail=f"yara storage read failed: {exc}")

    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="rule content is not valid UTF-8")

    return JSONResponse(
        {
            "name": safe_name,
            "tenant_id": tenant_id,
            "object_key": object_key,
            "etag": _safe_string(getattr(stat, "etag", "")),
            "sha256": _safe_string(row["sha256"]) if row else hashlib.sha256(data).hexdigest(),
            "size_bytes": int(getattr(stat, "size", 0) or len(data)),
            "created_at": row["created_at"].isoformat() if row and row.get("created_at") else None,
            "updated_at": row["updated_at"].isoformat() if row and row.get("updated_at") else None,
            "created_by": _safe_string(row["created_by"]) if row else None,
            "updated_by": _safe_string(row["updated_by"]) if row else None,
            "content": content,
        }
    )


@app.post("/yara/rules")
async def create_yara_rule(payload: dict, user: dict = Depends(get_current_user)) -> JSONResponse:
    _ensure_yara_storage_enabled()
    tenant_id = _tenant_for_request(user, payload.get("tenant_id"))
    actor = str(user.get("sub") or "system")
    safe_name = _validate_yara_rule_name(str(payload.get("name") or ""))
    content = str(payload.get("content") or "")
    if not content.strip():
        raise HTTPException(status_code=400, detail="rule content must not be empty")
    encoded = content.encode("utf-8")
    if len(encoded) > 1024 * 1024:
        raise HTTPException(status_code=400, detail="rule content exceeds 1MB limit")

    object_key = _rule_object_key(tenant_id, safe_name)
    client = _minio_client()

    try:
        await asyncio.to_thread(client.stat_object, YARA_STORAGE_BUCKET, object_key)
        raise HTTPException(status_code=409, detail="rule already exists")
    except S3Error as exc:
        if exc.code not in {"NoSuchKey", "NoSuchObject", "NoSuchBucket"}:
            logger.exception("failed to check existing rule")
            raise HTTPException(status_code=502, detail=f"yara storage stat failed: {exc}")
    except HTTPException:
        raise

    try:
        await asyncio.to_thread(
            client.put_object,
            YARA_STORAGE_BUCKET,
            object_key,
            io.BytesIO(encoded),
            len(encoded),
            "text/plain; charset=utf-8",
        )
        stat = await asyncio.to_thread(client.stat_object, YARA_STORAGE_BUCKET, object_key)
    except Exception as exc:
        logger.exception("failed to create yara rule")
        raise HTTPException(status_code=502, detail=f"yara storage write failed: {exc}")

    sha256_hex = hashlib.sha256(encoded).hexdigest()
    await _upsert_rule_metadata(
        tenant_id=tenant_id,
        name=safe_name,
        object_key=object_key,
        etag=_safe_string(getattr(stat, "etag", "")),
        sha256_hex=sha256_hex,
        size_bytes=int(getattr(stat, "size", len(encoded)) or len(encoded)),
        actor=actor,
    )

    return JSONResponse(
        {
            "ok": True,
            "name": safe_name,
            "tenant_id": tenant_id,
            "object_key": object_key,
            "etag": _safe_string(getattr(stat, "etag", "")),
            "sha256": sha256_hex,
            "size_bytes": int(getattr(stat, "size", len(encoded)) or len(encoded)),
        },
        status_code=201,
    )


@app.put("/yara/rules/{name}")
async def update_yara_rule(name: str, payload: dict, user: dict = Depends(get_current_user)) -> JSONResponse:
    _ensure_yara_storage_enabled()
    tenant_id = _tenant_for_request(user, payload.get("tenant_id"))
    actor = str(user.get("sub") or "system")
    safe_name = _validate_yara_rule_name(name)
    content = str(payload.get("content") or "")
    if not content.strip():
        raise HTTPException(status_code=400, detail="rule content must not be empty")
    encoded = content.encode("utf-8")
    if len(encoded) > 1024 * 1024:
        raise HTTPException(status_code=400, detail="rule content exceeds 1MB limit")

    object_key = _rule_object_key(tenant_id, safe_name)
    client = _minio_client()
    try:
        await asyncio.to_thread(client.stat_object, YARA_STORAGE_BUCKET, object_key)
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject", "NoSuchBucket"}:
            raise HTTPException(status_code=404, detail="rule not found")
        logger.exception("failed to check rule before update")
        raise HTTPException(status_code=502, detail=f"yara storage stat failed: {exc}")

    try:
        await asyncio.to_thread(
            client.put_object,
            YARA_STORAGE_BUCKET,
            object_key,
            io.BytesIO(encoded),
            len(encoded),
            "text/plain; charset=utf-8",
        )
        stat = await asyncio.to_thread(client.stat_object, YARA_STORAGE_BUCKET, object_key)
    except Exception as exc:
        logger.exception("failed to update yara rule")
        raise HTTPException(status_code=502, detail=f"yara storage write failed: {exc}")

    sha256_hex = hashlib.sha256(encoded).hexdigest()
    await _upsert_rule_metadata(
        tenant_id=tenant_id,
        name=safe_name,
        object_key=object_key,
        etag=_safe_string(getattr(stat, "etag", "")),
        sha256_hex=sha256_hex,
        size_bytes=int(getattr(stat, "size", len(encoded)) or len(encoded)),
        actor=actor,
    )
    return JSONResponse(
        {
            "ok": True,
            "name": safe_name,
            "tenant_id": tenant_id,
            "object_key": object_key,
            "etag": _safe_string(getattr(stat, "etag", "")),
            "sha256": sha256_hex,
            "size_bytes": int(getattr(stat, "size", len(encoded)) or len(encoded)),
        }
    )


@app.delete("/yara/rules/{name}")
async def delete_yara_rule(name: str, user: dict = Depends(get_current_user)) -> JSONResponse:
    _ensure_yara_storage_enabled()
    tenant_id = _tenant_for_request(user, None)
    safe_name = _validate_yara_rule_name(name)
    object_key = _rule_object_key(tenant_id, safe_name)
    client = _minio_client()
    try:
        await asyncio.to_thread(client.remove_object, YARA_STORAGE_BUCKET, object_key)
    except Exception as exc:
        logger.exception("failed to delete yara rule")
        raise HTTPException(status_code=502, detail=f"yara storage delete failed: {exc}")

    await _delete_rule_metadata(tenant_id, safe_name)
    return JSONResponse({"ok": True, "name": safe_name, "tenant_id": tenant_id})


@app.post("/yara/validate")
async def validate_yara_rule(payload: dict, user: dict = Depends(get_current_user)) -> JSONResponse:
    _ensure_yara_storage_enabled()
    _ = _tenant_for_request(user, payload.get("tenant_id"))
    name = _validate_yara_rule_name(str(payload.get("name") or "rule.yar"))
    content = str(payload.get("content") or "")
    if not content.strip():
        raise HTTPException(status_code=400, detail="rule content must not be empty")
    encoded = content.encode("utf-8")
    if len(encoded) > 1024 * 1024:
        raise HTTPException(status_code=400, detail="rule content exceeds 1MB limit")

    try:
        result = await asyncio.to_thread(_validate_yara_with_yarac, name, content)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="validation timed out")
    except Exception as exc:
        logger.exception("yara validation failed")
        raise HTTPException(status_code=502, detail=f"validation failed: {exc}")

    return JSONResponse(result)


@app.post("/yara/assistant")
async def yara_assistant(payload: dict, user: dict = Depends(get_current_user)) -> JSONResponse:
    _ensure_yara_storage_enabled()
    _ = _tenant_for_request(user, payload.get("tenant_id"))
    rule_name = _validate_yara_rule_name(str(payload.get("rule_name") or "rule.yar"))
    rule_content = str(payload.get("rule_content") or "")
    if len(rule_content.encode("utf-8")) > 1024 * 1024:
        raise HTTPException(status_code=400, detail="rule content exceeds 1MB limit")
    message = str(payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    history = payload.get("history")
    if not isinstance(history, list):
        history = []
    clean_history = []
    for item in history[:20]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        content = str(item.get("content") or "").strip()
        if role not in {"user", "model"} or not content:
            continue
        clean_history.append({"role": role, "content": content})

    try:
        reply = await asyncio.to_thread(_call_gemini_yara_assistant, message, clean_history, rule_name, rule_content)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.exception("yara assistant request failed")
        raise HTTPException(status_code=502, detail=f"assistant error: {exc}")
    return JSONResponse({"reply": reply})


@app.websocket("/agent/ws")
async def agent_ws(ws: WebSocket):
    await ws.accept()
    requested_agent_id = (ws.query_params.get("agent_id") or "").strip()
    requested_ephemeral = _is_truthy(ws.query_params.get("ephemeral"))
    requested_instance_id = (ws.query_params.get("instance_id") or "").strip() or None
    requested_runtime = (ws.query_params.get("runtime") or "").strip() or None
    agent_id = requested_agent_id or str(uuid.uuid4())
    if len(agent_id) > 128:
        agent_id = agent_id[:128]
    now = datetime.now(timezone.utc)
    previous_ws = agents.get(agent_id)
    if previous_ws is not None and previous_ws is not ws:
        try:
            await previous_ws.close()
        except Exception:
            pass
    q: asyncio.Queue = asyncio.Queue()
    agents[agent_id] = ws
    agent_queues[agent_id] = q
    agent_state[agent_id] = {
        "connected_at": now,
        "last_seen": now,
        "last_heartbeat": None,
        "capabilities": {},
        "tenant_id": None,
        "is_ephemeral": requested_ephemeral,
        "instance_id": requested_instance_id,
        "runtime_kind": requested_runtime,
        "lease_expires_at": _lease_expiry(now) if requested_ephemeral else None,
        "asset_profile": {},
        "sbom": [],
        "cves": [],
        "findings_count": 0,
    }
    logger.info("agent connected: %s", agent_id)
    await _upsert_agent_control_state(
        agent_id,
        status_value="connected",
        connected_at=now,
        last_seen=now,
        tenant_id="default",
        capabilities={},
        is_ephemeral=requested_ephemeral,
        instance_id=requested_instance_id,
        runtime_kind=requested_runtime,
        lease_expires_at=_lease_expiry(now) if requested_ephemeral else None,
    )

    # send registration message to agent
    await ws.send_text(json.dumps({"type": "agent.registered", "id": agent_id}))

    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                logger.warning("received non-json from %s: %s", agent_id, data)
                continue
            state = agent_state.get(agent_id)
            if state is not None:
                state["last_seen"] = datetime.now(timezone.utc)
                await _upsert_agent_control_state(agent_id, status_value="connected", last_seen=state["last_seen"])

            msg_type = msg.get("type")
            if msg_type == "agent.heartbeat":
                if state is not None:
                    state["last_heartbeat"] = datetime.now(timezone.utc)
                    caps = msg.get("capabilities")
                    if isinstance(caps, dict):
                        state["capabilities"] = caps
                        cap_runtime = str(caps.get("runtime") or "").strip().lower()
                        cap_instance_id = str(caps.get("instance_id") or "").strip() or None
                        cap_containerized = _is_truthy(caps.get("containerized"))
                        if cap_runtime in {"container", "docker", "k8s", "kubernetes", "containerd"} or cap_containerized:
                            state["is_ephemeral"] = True
                        if cap_instance_id:
                            state["instance_id"] = cap_instance_id
                        if cap_runtime:
                            state["runtime_kind"] = cap_runtime
                    profile_payload = msg.get("asset_profile")
                    if isinstance(profile_payload, dict):
                        state["asset_profile"] = profile_payload
                    sbom_payload = msg.get("sbom")
                    if isinstance(sbom_payload, list):
                        state["sbom"] = sbom_payload
                    cve_payload = msg.get("cves")
                    if isinstance(cve_payload, list):
                        state["cves"] = cve_payload[:1000]
                    findings_payload = msg.get("findings_count")
                    if isinstance(findings_payload, int):
                        state["findings_count"] = max(0, findings_payload)
                    elif isinstance(state.get("cves"), list):
                        state["findings_count"] = len(state["cves"])
                    if _is_truthy(msg.get("ephemeral")):
                        state["is_ephemeral"] = True
                    msg_instance_id = str(msg.get("instance_id") or "").strip() or None
                    if msg_instance_id:
                        state["instance_id"] = msg_instance_id
                    if state.get("is_ephemeral"):
                        state["lease_expires_at"] = _lease_expiry(state["last_heartbeat"])
                    tenant_id = msg.get("tenant_id")
                    if isinstance(tenant_id, str) and tenant_id.strip():
                        state["tenant_id"] = tenant_id.strip()
                    await _upsert_agent_control_state(
                        agent_id,
                        tenant_id=state.get("tenant_id") or "default",
                        status_value="connected",
                        last_seen=state["last_seen"],
                        last_heartbeat=state["last_heartbeat"],
                        capabilities=state.get("capabilities") or {},
                        is_ephemeral=bool(state.get("is_ephemeral")),
                        instance_id=state.get("instance_id"),
                        runtime_kind=state.get("runtime_kind"),
                        lease_expires_at=state.get("lease_expires_at"),
                        asset_profile=state.get("asset_profile") or {},
                        sbom_snapshot=state.get("sbom") or [],
                        cve_snapshot=state.get("cves") or [],
                        findings_count=int(state.get("findings_count") or 0),
                    )

            # push message to agent queue for any waiting HTTP callers
            await q.put(msg)
    except WebSocketDisconnect:
        logger.info("agent disconnected: %s", agent_id)
    finally:
        # Ignore stale disconnects when a newer websocket already replaced this agent_id.
        if agents.get(agent_id) is ws:
            agents.pop(agent_id, None)
            agent_queues.pop(agent_id, None)
            agent_state.pop(agent_id, None)
            await _upsert_agent_control_state(
                agent_id,
                status_value="disconnected",
                last_seen=datetime.now(timezone.utc),
            )


@app.post("/push_rule")
async def push_rule(payload: dict, user: dict = Depends(get_current_user)):
    """Push a rule to an agent and wait for compile result.

    JSON body: { "agent_id": "...", "id": "optional-job-id", "rule_text": "..." }
    """
    agent_id = payload.get("agent_id")
    rule_text = payload.get("rule_text")
    if not agent_id or not rule_text:
        raise HTTPException(status_code=400, detail="missing agent_id or rule_text")

    ws = agents.get(agent_id)
    if ws is None:
        raise HTTPException(status_code=404, detail="agent not connected")

    requested_tenant = _tenant_for_request(user, payload.get("tenant_id"))
    state = agent_state.get(agent_id) or {}
    agent_tenant = (state.get("tenant_id") or "default").strip()
    if requested_tenant != agent_tenant:
        raise HTTPException(status_code=403, detail="agent tenant mismatch")

    job_id = payload.get("id") or str(uuid.uuid4())
    policy_version = (payload.get("policy_version") or job_id).strip()
    rule_hash = hashlib.sha256(rule_text.encode("utf-8")).hexdigest()
    encoded = base64.b64encode(rule_text.encode("utf-8")).decode("ascii")
    msg = {"type": "rule.push", "id": job_id, "payload": encoded}
    await _create_command_job(
        job_id=job_id,
        tenant_id=requested_tenant,
        agent_id=agent_id,
        command_type="rule.push",
        payload={"policy_version": policy_version, "rule_hash": rule_hash},
    )

    # send to agent
    await ws.send_text(json.dumps(msg))
    await _update_command_job(job_id=job_id, status_value="sent", mark_started=True)

    # wait for compile result from agent queue
    q = agent_queues.get(agent_id)
    if q is None:
        raise HTTPException(status_code=500, detail="internal queue missing")

    try:
        # wait up to 15s for response
        resp = await asyncio.wait_for(_wait_for_job_result(q, job_id), timeout=15.0)
    except asyncio.TimeoutError:
        await _update_command_job(
            job_id=job_id,
            status_value="timeout",
            error_text="agent did not respond in time",
            mark_completed=True,
        )
        raise HTTPException(status_code=504, detail="agent did not respond in time")

    success = bool(resp.get("success"))
    await _update_command_job(
        job_id=job_id,
        status_value="completed" if success else "failed",
        result=resp,
        error_text=None if success else str(resp.get("diagnostics") or "compile failed"),
        mark_completed=True,
    )
    await _upsert_agent_control_state(
        agent_id,
        tenant_id=agent_tenant,
        policy_version=policy_version,
        policy_hash=rule_hash,
        last_policy_result="success" if success else "failed",
    )

    return JSONResponse(resp)


async def _wait_for_job_result(q: asyncio.Queue, job_id: str):
    while True:
        msg = await q.get()
        # expect agent message with type 'rule.compile.result' and matching id
        try:
            if msg.get("type") == "rule.compile.result" and msg.get("id") == job_id:
                return msg
        finally:
            q.task_done()
