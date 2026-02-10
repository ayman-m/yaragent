import asyncio
import base64
import json
import logging
import os
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Optional

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
AUTH_DATA_FILE = Path(os.getenv("AUTH_DATA_FILE", "/app/data/auth.json"))


class AuthStore:
    def __init__(self, auth_file: Path):
        self.auth_file = auth_file
        self.lock = threading.Lock()

    def _ensure_parent(self) -> None:
        self.auth_file.parent.mkdir(parents=True, exist_ok=True)

    def is_initialized(self) -> bool:
        return self.auth_file.exists()

    def load(self) -> Optional[dict]:
        if not self.auth_file.exists():
            return None
        try:
            return json.loads(self.auth_file.read_text(encoding="utf-8"))
        except Exception:
            logger.exception("failed to read auth data")
            return None

    def initialize(self, username: str, password_hash: str) -> None:
        with self.lock:
            if self.auth_file.exists():
                raise ValueError("already initialized")
            self._ensure_parent()
            payload = {
                "username": username,
                "password_hash": password_hash,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.auth_file.write_text(json.dumps(payload), encoding="utf-8")


auth_store = AuthStore(AUTH_DATA_FILE)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire, "type": "access"}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
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

    return payload


@app.on_event("startup")
async def startup() -> None:
    if JWT_SECRET_KEY == "change-me":
        logger.warning("JWT_SECRET_KEY is using default value. Set it via environment secret.")


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "healthy"})


@app.get("/setup/status")
async def setup_status() -> JSONResponse:
    return JSONResponse({"initialized": auth_store.is_initialized()})


@app.post("/auth/setup")
async def setup_admin(payload: dict) -> JSONResponse:
    if auth_store.is_initialized():
        raise HTTPException(status_code=409, detail="already initialized")

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    setup_token = payload.get("setup_token") or ""

    if INITIAL_SETUP_TOKEN and setup_token != INITIAL_SETUP_TOKEN:
        raise HTTPException(status_code=401, detail="invalid setup token")

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="username must be at least 3 characters")

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="password must be at least 8 characters")

    password_hash = pwd_context.hash(password)
    try:
        auth_store.initialize(username=username, password_hash=password_hash)
    except ValueError:
        raise HTTPException(status_code=409, detail="already initialized")

    token = create_access_token(subject=username)
    return JSONResponse({"access_token": token, "token_type": "bearer", "username": username})


@app.post("/auth/login")
async def login(payload: dict) -> JSONResponse:
    if not auth_store.is_initialized():
        raise HTTPException(status_code=412, detail="setup required")

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    data = auth_store.load()
    if data is None:
        raise HTTPException(status_code=500, detail="auth store unavailable")

    if username != data.get("username") or not pwd_context.verify(password, data.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="invalid username or password")

    token = create_access_token(subject=username)
    return JSONResponse({"access_token": token, "token_type": "bearer", "username": username})


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
