import asyncio
import base64
import json
import logging
import uuid
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI()
logger = logging.getLogger("orchestrator")
logging.basicConfig(level=logging.INFO)

# agent_id -> websocket
agents: Dict[str, WebSocket] = {}
# agent_id -> asyncio.Queue of incoming messages from agent
agent_queues: Dict[str, asyncio.Queue] = {}


@app.get("/agents")
async def list_agents():
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
async def push_rule(payload: dict):
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
