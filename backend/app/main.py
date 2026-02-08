import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.routes import agents, reputation, validation, leaderboard, analytics, insurance, payments, discover
from app.routes import monitoring, marketplace, splits, profiles, audit

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("AgentProof API starting up...")
    settings = get_settings()
    logger.info(f"CORS origins: {settings.cors_origins_list}")

    # Try to start the indexer scheduler if blockchain is configured
    if settings.identity_registry_address:
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from app.services.indexer import run_indexer_cycle

            scheduler = BackgroundScheduler()
            scheduler.add_job(run_indexer_cycle, "interval", seconds=10, id="indexer")
            scheduler.start()
            logger.info("Indexer scheduler started (10s interval)")
        except Exception as e:
            logger.warning(f"Could not start indexer scheduler: {e}")
    else:
        logger.info("No contract addresses configured — indexer disabled")

    yield

    logger.info("AgentProof API shutting down...")


app = FastAPI(
    title="AgentProof API",
    description="Transparent reputation infrastructure for autonomous AI agents on Avalanche",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.include_router(agents.router)
app.include_router(reputation.router)
app.include_router(validation.router)
app.include_router(leaderboard.router)
app.include_router(analytics.router)
app.include_router(insurance.router)
app.include_router(payments.router)
app.include_router(discover.router)
app.include_router(monitoring.router)
app.include_router(marketplace.router)
app.include_router(splits.router)
app.include_router(profiles.router)
app.include_router(audit.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    blockchain_status = "unknown"
    try:
        from app.services.blockchain import get_blockchain_service
        bc = get_blockchain_service()
        blockchain_status = "connected" if bc.is_connected() else "disconnected"
    except Exception:
        blockchain_status = "error"

    return {
        "status": "healthy",
        "service": "agentproof-api",
        "version": "1.0.0",
        "blockchain": blockchain_status,
    }


@app.get("/api/categories")
async def get_categories():
    """List all agent categories with counts."""
    return await analytics.get_categories()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
