"""
Agent402 Trust Oracle — pay-per-use reputation oracle for AI agents.

Trust evaluations via x402 USDC micropayments.
Supports REST API and Google A2A protocol.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse

from config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown."""
    settings = get_settings()
    logger.info(f"Agent402 starting — {settings.oracle_name} v{settings.oracle_version}")

    # Verify Supabase
    try:
        from database import get_supabase
        db = get_supabase()
        result = db.table("agents").select("agent_id", count="exact").limit(1).execute()
        logger.info(f"Supabase connected — {result.count or 0} agents")
    except Exception as e:
        logger.error(f"Supabase connection failed: {e}")

    yield
    logger.info("Agent402 shutting down")


app = FastAPI(
    title="Agent402 Trust Oracle",
    description="Pay-per-use reputation oracle for AI agents. "
    "Trust evaluations via x402 USDC micropayments on Base.",
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

# x402 payment middleware
try:
    from middleware.x402 import setup_x402_middleware
    setup_x402_middleware(app, settings)
except ImportError:
    logger.warning(
        "x402 package not installed — payment gating disabled. "
        "Install with: pip install 'x402[fastapi,evm]'"
    )
except Exception as e:
    logger.error(f"x402 middleware setup failed: {e}")

# Include routers
from routes import rest, a2a
app.include_router(rest.router)
app.include_router(a2a.router)


# ─── Landing Page ─────────────────────────────────────────────────────

LANDING_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent402 — Pay-Per-Use Trust Oracle</title>
<meta name="description" content="AI agent reputation oracle with x402 USDC micropayments. Trust evaluations for $0.01.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e8e8ed;font-family:'SF Mono','Fira Code','JetBrains Mono',monospace;line-height:1.6;min-height:100vh}
a{color:#0052ff;text-decoration:none}a:hover{text-decoration:underline}
.container{max-width:860px;margin:0 auto;padding:2rem 1.5rem}
header{text-align:center;padding:3rem 0 2rem;border-bottom:1px solid #1a1a2e}
h1{font-size:1.8rem;font-weight:700;color:#fff;letter-spacing:-0.5px}
.tagline{color:#8888a0;font-size:.95rem;margin-top:.5rem}
.badge{display:inline-block;background:#0052ff20;color:#0052ff;padding:.15rem .6rem;border-radius:4px;font-size:.75rem;margin-top:.75rem;border:1px solid #0052ff40}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:2rem 0}
.stat{background:#12121a;border:1px solid #1a1a2e;border-radius:8px;padding:1.2rem;text-align:center}
.stat .value{font-size:1.6rem;font-weight:700;color:#0052ff}
.stat .label{font-size:.8rem;color:#666680;margin-top:.25rem;text-transform:uppercase;letter-spacing:.5px}
section{margin:2.5rem 0}
h2{font-size:1.1rem;color:#fff;margin-bottom:1rem;padding-bottom:.5rem;border-bottom:1px solid #1a1a2e}
.pricing-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
@media(max-width:600px){.pricing-grid{grid-template-columns:1fr}}
.price-card{background:#12121a;border:1px solid #1a1a2e;border-radius:6px;padding:1rem}
.price-card .endpoint{color:#0052ff;font-weight:600;font-size:.9rem}
.price-card .cost{color:#fff;font-size:.85rem;margin-top:.3rem}
.price-card .desc{color:#8888a0;font-size:.8rem;margin-top:.3rem}
.free-tag{background:#00e5a020;color:#00e5a0;padding:.1rem .4rem;border-radius:3px;font-size:.7rem}
.paid-tag{background:#0052ff20;color:#0052ff;padding:.1rem .4rem;border-radius:3px;font-size:.7rem}
.how-it-works{background:#12121a;border:1px solid #1a1a2e;border-radius:8px;padding:1.5rem}
.step{display:flex;gap:1rem;margin-bottom:1rem;align-items:flex-start}
.step:last-child{margin-bottom:0}
.step-num{background:#0052ff;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0}
.step-text{font-size:.85rem;color:#8888a0}
.step-text strong{color:#fff}
code{background:#0a0a0f;border:1px solid #1a1a2e;padding:.1rem .4rem;border-radius:3px;font-size:.8rem;color:#0052ff}
.protocols{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
@media(max-width:600px){.protocols{grid-template-columns:1fr}}
.proto{background:#12121a;border:1px solid #1a1a2e;border-radius:6px;padding:1rem}
.proto .pname{font-weight:600;font-size:.9rem;color:#fff}
.proto .purl{font-size:.75rem;color:#0052ff;word-break:break-all;margin-top:.3rem}
.proto .pdesc{font-size:.78rem;color:#666680;margin-top:.3rem}
.links{display:flex;gap:1.5rem;flex-wrap:wrap;margin-top:2rem;padding-top:1.5rem;border-top:1px solid #1a1a2e;justify-content:center;font-size:.85rem}
footer{text-align:center;color:#444460;font-size:.75rem;padding:2rem 0 1rem}
</style>
</head>
<body>
<div class="container">
<header>
<h1>Agent402</h1>
<p class="tagline">Pay-per-use trust oracle for AI agents</p>
<span class="badge">x402 &middot; USDC on Base &middot; $0.01/call</span>
</header>

<div class="stats-grid" id="stats">
<div class="stat"><div class="value" id="s-agents">&mdash;</div><div class="label">Agents Indexed</div></div>
<div class="stat"><div class="value" id="s-score">&mdash;</div><div class="label">Avg Trust Score</div></div>
<div class="stat"><div class="value" id="s-feedback">&mdash;</div><div class="label">Total Feedback</div></div>
<div class="stat"><div class="value" id="s-payments">&mdash;</div><div class="label">Payments</div></div>
</div>

<section>
<h2>How It Works</h2>
<div class="how-it-works">
<div class="step"><div class="step-num">1</div><div class="step-text"><strong>Request</strong> — Call any premium endpoint. Get a <code>402 Payment Required</code> response with USDC payment instructions.</div></div>
<div class="step"><div class="step-num">2</div><div class="step-text"><strong>Sign</strong> — Your wallet signs a USDC transfer on Base. The x402 SDK handles this automatically.</div></div>
<div class="step"><div class="step-num">3</div><div class="step-text"><strong>Pay &amp; Receive</strong> — Retry with the payment proof. Coinbase verifies, settles on-chain, and you get your data.</div></div>
</div>
</section>

<section>
<h2>Endpoints &amp; Pricing</h2>
<div class="pricing-grid">
<div class="price-card"><div class="endpoint">/api/v1/trust/{id}</div><div class="cost"><span class="paid-tag">$0.01 USDC</span></div><div class="desc">Full trust evaluation &mdash; composite score, tier, risk flags, score breakdown</div></div>
<div class="price-card"><div class="endpoint">/api/v1/trust/{id}/risk</div><div class="cost"><span class="paid-tag">$0.01 USDC</span></div><div class="desc">Risk assessment with concentrated-feedback detection and volatility checks</div></div>
<div class="price-card"><div class="endpoint">/api/v1/agents/trusted</div><div class="cost"><span class="paid-tag">$0.01 USDC</span></div><div class="desc">Search agents by category, score, tier, and feedback count</div></div>
<div class="price-card"><div class="endpoint">/api/v1/network/stats</div><div class="cost"><span class="paid-tag">$0.005 USDC</span></div><div class="desc">Network-wide statistics, tier distribution, payment totals</div></div>
<div class="price-card"><div class="endpoint">/api/v1/health</div><div class="cost"><span class="free-tag">FREE</span></div><div class="desc">Health check</div></div>
<div class="price-card"><div class="endpoint">/api/v1/pricing</div><div class="cost"><span class="free-tag">FREE</span></div><div class="desc">Machine-readable pricing for x402 clients</div></div>
<div class="price-card"><div class="endpoint">/.well-known/agent.json</div><div class="cost"><span class="free-tag">FREE</span></div><div class="desc">A2A agent card for discovery</div></div>
<div class="price-card"><div class="endpoint">/api/v1/payments/stats</div><div class="cost"><span class="free-tag">FREE</span></div><div class="desc">Payment statistics and revenue</div></div>
</div>
</section>

<section>
<h2>Protocol Endpoints</h2>
<div class="protocols">
<div class="proto">
<div class="pname">REST API + x402</div>
<div class="purl">/api/v1/*</div>
<div class="pdesc">Standard JSON endpoints. Premium routes return 402 with USDC payment instructions.</div>
</div>
<div class="proto">
<div class="pname">A2A (Agent-to-Agent)</div>
<div class="purl">/.well-known/agent.json</div>
<div class="pdesc">Google A2A discovery + POST /a2a for JSON-RPC task execution.</div>
</div>
</div>
</section>

<div class="links">
<a href="https://agent402.sh">agent402.sh</a>
<a href="/.well-known/agent.json">A2A Agent Card</a>
<a href="/api/v1/pricing">Pricing API</a>
<a href="https://www.x402.org/">x402 Protocol</a>
</div>
<footer>Agent402 &middot; x402 Micropayments &middot; USDC on Base</footer>
</div>
<script>
const B=window.location.origin;
fetch(B+'/api/v1/network/stats').then(r=>r.ok?r.json():null).then(d=>{
  if(!d)return;
  document.getElementById('s-agents').textContent=(d.total_agents||0).toLocaleString();
  document.getElementById('s-score').textContent=(d.avg_score||0).toFixed(1);
  document.getElementById('s-feedback').textContent=(d.total_feedback||0).toLocaleString();
  document.getElementById('s-payments').textContent=(d.total_payments||0).toLocaleString();
}).catch(()=>{});
</script>
</body>
</html>
"""


@app.get("/api/v1/pricing")
async def pricing():
    """Machine-readable pricing for x402 clients (free)."""
    settings = get_settings()
    return {
        "protocol": "x402",
        "network": settings.x402_network,
        "pay_to": settings.x402_pay_to,
        "facilitator": settings.x402_facilitator_url,
        "endpoints": {
            "GET /api/v1/trust/{agent_id}": {"price": settings.x402_price_eval, "description": "Trust evaluation"},
            "GET /api/v1/trust/{agent_id}/risk": {"price": settings.x402_price_eval, "description": "Risk assessment"},
            "GET /api/v1/agents/trusted": {"price": settings.x402_price_search, "description": "Search trusted agents"},
            "GET /api/v1/network/stats": {"price": settings.x402_price_stats, "description": "Network statistics"},
        },
        "free_endpoints": [
            "GET /api/v1/health",
            "GET /api/v1/pricing",
            "GET /api/v1/payments/stats",
            "GET /.well-known/agent.json",
        ],
    }


@app.get("/api/v1/payments/stats")
async def payment_stats():
    """Payment statistics (free)."""
    import asyncio
    from services.payments import get_payment_stats
    return await asyncio.to_thread(get_payment_stats)


@app.get("/api/v1/info")
async def info():
    """Oracle info (free)."""
    settings = get_settings()
    return {
        "name": settings.oracle_name,
        "version": settings.oracle_version,
        "protocol": "x402",
        "network": settings.x402_network,
        "endpoints": {
            "rest": "/api/v1",
            "a2a_card": "/.well-known/agent.json",
            "a2a_rpc": "/a2a",
            "health": "/api/v1/health",
            "pricing": "/api/v1/pricing",
        },
    }


@app.get("/", response_class=HTMLResponse)
async def landing():
    """Landing page."""
    return LANDING_HTML


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "agent402"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
