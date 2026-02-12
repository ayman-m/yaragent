import asyncio
import base64
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import asyncpg
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
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

_db_pool: Optional[asyncpg.Pool] = None


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
) -> None:
    db = await _db()
    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO agents_control_state (
                agent_id, tenant_id, status, connected_at, last_seen, last_heartbeat,
                capabilities_json, policy_version, policy_hash, last_policy_applied_at,
                last_policy_result, updated_at
            )
            VALUES (
                $1::text, COALESCE($2::text, 'default'), COALESCE($3::text, 'disconnected'),
                $4::timestamptz, $5::timestamptz, $6::timestamptz,
                COALESCE($7::jsonb, '{}'::jsonb), $8::text, $9::text,
                CASE
                    WHEN $8::text IS NOT NULL OR $9::text IS NOT NULL OR $10::text IS NOT NULL THEN now()
                    ELSE NULL
                END,
                $10::text, now()
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
        )


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
    global _db_pool
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


@app.on_event("shutdown")
async def shutdown() -> None:
    global _db_pool
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
            SELECT agent_id, tenant_id, status, connected_at, last_seen, last_heartbeat, capabilities_json
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

        status = status_value
        if last_heartbeat is not None and (now - last_heartbeat).total_seconds() > AGENT_STALE_SECONDS:
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
            }
        )
    return JSONResponse(out)


@app.websocket("/agent/ws")
async def agent_ws(ws: WebSocket):
    await ws.accept()
    agent_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    q: asyncio.Queue = asyncio.Queue()
    agents[agent_id] = ws
    agent_queues[agent_id] = q
    agent_state[agent_id] = {
        "connected_at": now,
        "last_seen": now,
        "last_heartbeat": None,
        "capabilities": {},
        "tenant_id": None,
    }
    logger.info("agent connected: %s", agent_id)
    await _upsert_agent_control_state(
        agent_id,
        status_value="connected",
        connected_at=now,
        last_seen=now,
        tenant_id="default",
        capabilities={},
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
                    )

            # push message to agent queue for any waiting HTTP callers
            await q.put(msg)
    except WebSocketDisconnect:
        logger.info("agent disconnected: %s", agent_id)
    finally:
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
