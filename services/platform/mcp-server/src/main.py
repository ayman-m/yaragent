import os
import logging
from typing import Any, Optional
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI()
logger = logging.getLogger("mcp-server")
logging.basicConfig(level=logging.INFO)

# Orchestrator backend URL
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://orchestrator:8002")
http_client = httpx.AsyncClient(base_url=ORCHESTRATOR_URL)


@app.on_event("startup")
async def startup():
    logger.info("MCP Server starting, connecting to orchestrator at %s", ORCHESTRATOR_URL)


@app.on_event("shutdown")
async def shutdown():
    await http_client.aclose()


@app.get("/health")
async def health():
    """Health check endpoint."""
    try:
        resp = await http_client.get("/agents")
        if resp.status_code == 200:
            return JSONResponse({"status": "healthy"})
    except Exception as e:
        logger.error("health check failed: %s", e)
    raise HTTPException(status_code=503, detail="orchestrator unavailable")


@app.get("/tools")
async def list_tools():
    """List available MCP tools for AI agents (Gemini, Claude, etc)."""
    return JSONResponse({
        "tools": [
            {
                "name": "scan.listAgents",
                "description": "List all connected scanning agents",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "scan.pushRule",
                "description": "Push a YARA rule to a scanning agent and get compilation result",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "agent_id": {"type": "string", "description": "ID of the target agent"},
                        "rule_text": {"type": "string", "description": "YARA rule content"},
                        "rule_id": {"type": "string", "description": "Optional rule identifier"}
                    },
                    "required": ["agent_id", "rule_text"]
                }
            }
        ]
    })


@app.post("/tools/scan.listAgents")
async def tool_list_agents():
    """MCP tool: list agents via orchestrator."""
    try:
        resp = await http_client.get("/agents")
        resp.raise_for_status()
        agents = resp.json()
        return JSONResponse({
            "success": True,
            "agents": agents,
            "count": len(agents)
        })
    except Exception as e:
        logger.error("list_agents error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/scan.pushRule")
async def tool_push_rule(payload: dict):
    """MCP tool: push rule to agent via orchestrator."""
    agent_id = payload.get("agent_id")
    rule_text = payload.get("rule_text")
    rule_id = payload.get("rule_id")

    if not agent_id or not rule_text:
        raise HTTPException(status_code=400, detail="missing agent_id or rule_text")

    try:
        resp = await http_client.post(
            "/push_rule",
            json={
                "agent_id": agent_id,
                "rule_text": rule_text,
                "id": rule_id
            }
        )
        resp.raise_for_status()
        result = resp.json()
        return JSONResponse({
            "success": True,
            "result": result
        })
    except httpx.HTTPStatusError as e:
        logger.error("push_rule error: %s", e)
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error("push_rule error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
