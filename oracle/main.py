"""
AgentProof Trust Oracle — main FastAPI application.

A standalone reputation oracle for the ERC-8004 agent ecosystem.
Queryable via REST API, Google A2A protocol, and Anthropic MCP protocol.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from routes import rest, a2a, mcp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    settings = get_settings()
    logger.info(f"Trust Oracle starting — {settings.oracle_agent_name} v{settings.oracle_version}")

    # Verify Supabase connection
    try:
        from database import get_supabase
        db = get_supabase()
        result = db.table("agents").select("agent_id", count="exact").limit(1).execute()
        logger.info(f"Supabase connected — {result.count or 0} agents in database")
    except Exception as e:
        logger.error(f"Supabase connection failed: {e}")

    # Optional self-registration
    if settings.self_register:
        try:
            from services.registration import register_oracle_agent
            register_oracle_agent()
        except Exception as e:
            logger.error(f"Self-registration failed: {e}")

    yield

    logger.info("Trust Oracle shutting down")


app = FastAPI(
    title="AgentProof Trust Oracle",
    description="Reputation oracle for autonomous AI agents on ERC-8004. "
    "Supports REST, A2A (Google Agent-to-Agent), and MCP (Model Context Protocol).",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(rest.router)
app.include_router(a2a.router)
app.include_router(mcp.router)


@app.get("/")
async def root():
    """Oracle info."""
    settings = get_settings()
    return {
        "name": settings.oracle_agent_name,
        "version": settings.oracle_version,
        "protocols": ["rest", "a2a", "mcp"],
        "endpoints": {
            "rest": "/api/v1",
            "a2a_card": "/.well-known/agent.json",
            "a2a_rpc": "/a2a",
            "mcp": "/mcp",
            "health": "/api/v1/health",
        },
    }


@app.get("/health")
async def health():
    """Top-level health check."""
    return {"status": "healthy", "service": "agentproof-trust-oracle"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
