import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

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

security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    return JSONResponse({"initialized": initialized})


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
    return JSONResponse([{"id": aid} for aid in agents.keys()])


@app.websocket("/agent/ws")
async def agent_ws(ws: WebSocket):
    await ws.accept()
    agent_id = str(uuid.uuid4())
    q: asyncio.Queue = asyncio.Queue()
    agents[agent_id] = ws
    agent_queues[agent_id] = q
    logger.info("agent connected: %s", agent_id)

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
            # push message to agent queue for any waiting HTTP callers
            await q.put(msg)
    except WebSocketDisconnect:
        logger.info("agent disconnected: %s", agent_id)
    finally:
        agents.pop(agent_id, None)
        agent_queues.pop(agent_id, None)


@app.post("/push_rule")
async def push_rule(payload: dict, _: dict = Depends(get_current_user)):
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

    job_id = payload.get("id") or str(uuid.uuid4())
    encoded = base64.b64encode(rule_text.encode("utf-8")).decode("ascii")
    msg = {"type": "rule.push", "id": job_id, "payload": encoded}

    # send to agent
    await ws.send_text(json.dumps(msg))

    # wait for compile result from agent queue
    q = agent_queues.get(agent_id)
    if q is None:
        raise HTTPException(status_code=500, detail="internal queue missing")

    try:
        # wait up to 15s for response
        resp = await asyncio.wait_for(_wait_for_job_result(q, job_id), timeout=15.0)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="agent did not respond in time")

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
