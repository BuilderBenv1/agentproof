"""
AgentProof Trust Oracle — main FastAPI application.

A standalone reputation oracle for the ERC-8004 agent ecosystem.
Queryable via REST API, Google A2A protocol, and Anthropic MCP protocol.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse

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

    # Optional self-registration (with timeout so a hanging RPC can't kill startup)
    if settings.self_register:
        logger.info("Attempting self-registration on ERC-8004 IdentityRegistry...")
        try:
            from services.registration import register_oracle_agent
            agent_id = await asyncio.wait_for(
                asyncio.to_thread(register_oracle_agent),
                timeout=15,
            )
            if agent_id is not None:
                logger.info(f"Registration complete — oracle agent_id={agent_id}")
            else:
                logger.info("Registration skipped (already registered or no key)")
        except asyncio.TimeoutError:
            logger.error("Self-registration timed out after 15s — skipping")
        except Exception as e:
            logger.error(f"Self-registration failed: {e}")

    # Ensure oracle agent is indexed in Supabase (backfill from chain if needed)
    if settings.oracle_agent_id:
        try:
            from services.chain import ensure_oracle_agent_indexed
            indexed = await asyncio.wait_for(
                asyncio.to_thread(ensure_oracle_agent_indexed),
                timeout=15,
            )
            if indexed:
                logger.info(f"Oracle agent #{settings.oracle_agent_id} confirmed in database")
        except asyncio.TimeoutError:
            logger.error("Oracle agent indexing check timed out")
        except Exception as e:
            logger.error(f"Oracle agent indexing check failed: {e}")

    # Start autonomous scheduler
    from services.autonomous import get_screener
    screener = get_screener()
    await screener.start()

    yield

    # Shutdown autonomous scheduler
    await screener.stop()
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

# x402 payment middleware (opt-in via X402_ENABLED env var)
if settings.x402_enabled:
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
app.include_router(rest.router)
app.include_router(a2a.router)
app.include_router(mcp.router)


LANDING_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AgentProof Trust Oracle</title>
<meta name="description" content="Reputation oracle for the ERC-8004 agent economy. Query agent trust scores via REST, A2A, or MCP.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e8e8ed;font-family:'SF Mono','Fira Code','JetBrains Mono',monospace;line-height:1.6;min-height:100vh}
a{color:#00e5a0;text-decoration:none}a:hover{text-decoration:underline}
.container{max-width:860px;margin:0 auto;padding:2rem 1.5rem}
header{text-align:center;padding:3rem 0 2rem;border-bottom:1px solid #1a1a2e}
h1{font-size:1.8rem;font-weight:700;color:#fff;letter-spacing:-0.5px}
.tagline{color:#8888a0;font-size:.95rem;margin-top:.5rem}
.version{display:inline-block;background:#1a1a2e;color:#00e5a0;padding:.15rem .6rem;border-radius:4px;font-size:.75rem;margin-top:.75rem}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:2rem 0}
.stat{background:#12121a;border:1px solid #1a1a2e;border-radius:8px;padding:1.2rem;text-align:center}
.stat .value{font-size:1.6rem;font-weight:700;color:#00e5a0}
.stat .label{font-size:.8rem;color:#6666880;margin-top:.25rem;text-transform:uppercase;letter-spacing:.5px;color:#666680}
section{margin:2.5rem 0}
h2{font-size:1.1rem;color:#fff;margin-bottom:1rem;padding-bottom:.5rem;border-bottom:1px solid #1a1a2e}
.skills{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
@media(max-width:600px){.skills{grid-template-columns:1fr}}
.skill{background:#12121a;border:1px solid #1a1a2e;border-radius:6px;padding:1rem}
.skill .name{color:#00e5a0;font-weight:600;font-size:.9rem}
.skill .desc{color:#8888a0;font-size:.8rem;margin-top:.3rem}
.try-it{background:#12121a;border:1px solid #1a1a2e;border-radius:8px;padding:1.5rem}
.try-it form{display:flex;gap:.75rem;align-items:center}
.try-it input[type=number]{background:#0a0a0f;border:1px solid #2a2a3e;color:#fff;padding:.6rem 1rem;border-radius:6px;font-family:inherit;font-size:.9rem;width:140px}
.try-it input:focus{outline:none;border-color:#00e5a0}
.try-it button{background:#00e5a0;color:#0a0a0f;border:none;padding:.6rem 1.5rem;border-radius:6px;font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer}
.try-it button:hover{background:#00cc8e}
.try-it button:disabled{opacity:.5;cursor:wait}
#result{margin-top:1rem;display:none}
#result.visible{display:block}
#result pre{background:#0a0a0f;border:1px solid #1a1a2e;border-radius:6px;padding:1rem;overflow-x:auto;font-size:.8rem;line-height:1.5}
#result .eval-card{background:#0a0a0f;border:1px solid #1a1a2e;border-radius:8px;padding:1.25rem;display:grid;grid-template-columns:auto 1fr;gap:.5rem .75rem;align-items:center}
#result .eval-card .k{color:#666680;font-size:.8rem;text-align:right}
#result .eval-card .v{font-size:.9rem}
.rec-TRUSTED{color:#00e5a0}.rec-CAUTION{color:#f5a623}.rec-HIGH_RISK{color:#e74c3c}.rec-UNVERIFIED{color:#666680}
.err{color:#e74c3c;font-size:.85rem;margin-top:.75rem}
.protocols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem}
@media(max-width:600px){.protocols{grid-template-columns:1fr}}
.proto{background:#12121a;border:1px solid #1a1a2e;border-radius:6px;padding:1rem}
.proto .pname{font-weight:600;font-size:.9rem;color:#fff}
.proto .purl{font-size:.75rem;color:#00e5a0;word-break:break-all;margin-top:.3rem}
.proto .pdesc{font-size:.78rem;color:#666680;margin-top:.3rem}
.links{display:flex;gap:1.5rem;flex-wrap:wrap;margin-top:2rem;padding-top:1.5rem;border-top:1px solid #1a1a2e;justify-content:center;font-size:.85rem}
footer{text-align:center;color:#444460;font-size:.75rem;padding:2rem 0 1rem}
</style>
</head>
<body>
<div class="container">
<header>
<h1>AgentProof Trust Oracle</h1>
<p class="tagline">Reputation oracle for the ERC-8004 agent economy</p>
<span class="version">v1.0.0</span>
</header>

<div class="stats-grid" id="stats">
<div class="stat"><div class="value" id="s-agents">&mdash;</div><div class="label">Agents Indexed</div></div>
<div class="stat"><div class="value" id="s-score">&mdash;</div><div class="label">Avg Trust Score</div></div>
<div class="stat"><div class="value" id="s-feedback">&mdash;</div><div class="label">Total Feedback</div></div>
<div class="stat"><div class="value" id="s-validations">&mdash;</div><div class="label">Screenings</div></div>
</div>

<section>
<h2>Skills</h2>
<div class="skills">
<div class="skill"><div class="name">evaluate_agent</div><div class="desc">Full trust evaluation &mdash; composite score, tier, recommendation, risk flags, score breakdown</div></div>
<div class="skill"><div class="name">find_trusted_agents</div><div class="desc">Search agents by category, minimum score, tier, and feedback count</div></div>
<div class="skill"><div class="name">risk_check</div><div class="desc">Risk assessment with concentrated-feedback detection, volatility, and uptime checks</div></div>
<div class="skill"><div class="name">network_stats</div><div class="desc">Network-wide statistics &mdash; total agents, averages, tier distribution</div></div>
</div>
</section>

<section>
<h2>Try It Live</h2>
<div class="try-it">
<form id="evalForm" onsubmit="return doEval(event)">
<input type="number" id="agentInput" min="0" placeholder="Agent ID" required>
<button type="submit" id="evalBtn">Evaluate</button>
</form>
<div id="result"></div>
</div>
</section>

<section>
<h2>Protocol Endpoints</h2>
<div class="protocols">
<div class="proto">
<div class="pname">REST API</div>
<div class="purl">/api/v1/trust/{id}</div>
<div class="pdesc">Standard JSON. GET endpoints for trust, risk, agents, stats.</div>
</div>
<div class="proto">
<div class="pname">A2A (Agent-to-Agent)</div>
<div class="purl">/.well-known/agent.json</div>
<div class="pdesc">Google A2A discovery. POST /a2a for JSON-RPC task execution.</div>
</div>
<div class="proto">
<div class="pname">MCP (Model Context)</div>
<div class="purl">/mcp</div>
<div class="pdesc">Anthropic MCP. JSON-RPC 2.0 &mdash; initialize, tools/list, tools/call.</div>
</div>
</div>
</section>

<section>
<h2>Pricing &mdash; x402 Micropayments</h2>
<p style="color:#8888a0;font-size:.85rem;margin-bottom:1rem">Premium endpoints accept USDC micropayments via the <a href="https://www.x402.org/">x402 protocol</a> (HTTP 402). Free endpoints require no payment.</p>
<div class="skills">
<div class="skill"><div class="name" style="color:#fff">Premium &mdash; $0.01 USDC</div><div class="desc">/api/v1/trust/{id} &mdash; trust evaluation<br>/api/v1/trust/{id}/risk &mdash; risk assessment<br>/api/v1/agents/trusted &mdash; search trusted agents</div></div>
<div class="skill"><div class="name" style="color:#fff">Free</div><div class="desc">/api/v1/network/stats &mdash; network statistics<br>/api/v1/health &mdash; health check<br>/api/v1/pricing &mdash; pricing details<br>/.well-known/agent.json &mdash; A2A card</div></div>
</div>
<p style="color:#666680;font-size:.75rem;margin-top:.75rem">Network: Base (USDC) &middot; <a href="/api/v1/pricing">GET /api/v1/pricing</a> for machine-readable details</p>
</section>

<div class="links">
<a href="https://agentproof.sh">agentproof.sh</a>
<a href="/.well-known/agent.json">A2A Agent Card</a>
<a href="/api/v1/pricing">Pricing API</a>
<a href="https://github.com/BuilderBenv1/agentproof">GitHub</a>
</div>
<footer>AgentProof Trust Oracle &middot; ERC-8004 Reputation Infrastructure</footer>
</div>
<script>
const BASE = window.location.origin;
async function loadStats(){
  try{
    const r = await fetch(BASE+'/api/v1/network/stats');
    if(!r.ok) return;
    const d = await r.json();
    document.getElementById('s-agents').textContent = (d.total_agents||0).toLocaleString();
    document.getElementById('s-score').textContent = (d.avg_score||0).toFixed(1);
    document.getElementById('s-feedback').textContent = (d.total_feedback||0).toLocaleString();
    document.getElementById('s-validations').textContent = (d.total_validations||0).toLocaleString();
  }catch(e){console.error('Stats load failed',e)}
}
async function doEval(e){
  e.preventDefault();
  const id = document.getElementById('agentInput').value;
  const btn = document.getElementById('evalBtn');
  const box = document.getElementById('result');
  btn.disabled = true; btn.textContent = '...';
  box.className = ''; box.innerHTML = '';
  try{
    const r = await fetch(BASE+'/api/v1/trust/'+encodeURIComponent(id));
    if(!r.ok){
      const err = await r.json().catch(()=>({detail:'Request failed'}));
      box.innerHTML = '<div class="err">Error: '+(err.detail||r.statusText)+'</div>';
      box.className = 'visible'; return;
    }
    const d = await r.json();
    const flags = (d.risk_flags||[]).length ? d.risk_flags.join(', ') : 'none';
    box.innerHTML = '<div class="eval-card">'
      +'<span class="k">Agent</span><span class="v">#'+d.agent_id+'</span>'
      +'<span class="k">Score</span><span class="v" style="color:#00e5a0;font-weight:700">'+d.composite_score.toFixed(1)+'</span>'
      +'<span class="k">Tier</span><span class="v">'+d.tier+'</span>'
      +'<span class="k">Recommendation</span><span class="v rec-'+d.recommendation+'">'+d.recommendation+'</span>'
      +'<span class="k">Feedback</span><span class="v">'+d.feedback_count+'</span>'
      +'<span class="k">Validation Rate</span><span class="v">'+(d.validation_success_rate||0).toFixed(1)+'%</span>'
      +'<span class="k">Age</span><span class="v">'+(d.account_age_days||0)+' days</span>'
      +'<span class="k">Risk Flags</span><span class="v">'+flags+'</span>'
      +'</div>';
    box.className = 'visible';
  }catch(err){
    box.innerHTML = '<div class="err">Network error: '+err.message+'</div>';
    box.className = 'visible';
  }finally{
    btn.disabled = false; btn.textContent = 'Evaluate';
  }
  return false;
}
loadStats();
</script>
</body>
</html>
"""


@app.get("/api/v1/info")
async def info():
    """Oracle info (JSON)."""
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


@app.get("/", response_class=HTMLResponse)
async def landing():
    """Landing page for humans."""
    return LANDING_HTML


@app.get("/health")
async def health():
    """Top-level health check."""
    return {"status": "healthy", "service": "agentproof-trust-oracle"}


@app.get("/api/v1/pricing")
async def pricing():
    """Return pricing information for premium endpoints."""
    settings = get_settings()
    if not settings.x402_enabled:
        return {"payment_required": False, "message": "All endpoints are currently free"}
    return {
        "payment_required": True,
        "protocol": "x402",
        "network": settings.x402_network,
        "pay_to": settings.x402_pay_to,
        "facilitator": settings.x402_facilitator_url,
        "price_per_request": settings.x402_price_usd,
        "premium_endpoints": {
            "GET /api/v1/trust/{agent_id}": "Full trust evaluation with score breakdown",
            "GET /api/v1/trust/{agent_id}/risk": "Risk assessment with flags and recommendation",
            "GET /api/v1/agents/trusted": "Search trusted agents by category, score, tier",
        },
        "free_endpoints": [
            "GET /api/v1/health",
            "GET /api/v1/network/stats",
            "GET /api/v1/info",
            "GET /api/v1/pricing",
            "GET /api/v1/autonomous/status",
            "GET /api/v1/reports/latest",
            "GET /.well-known/agent.json",
        ],
    }


@app.get("/api/v1/autonomous/status")
async def autonomous_status():
    """Show scheduler status — last run times and job counts."""
    from services.autonomous import get_screener
    return get_screener().status()


@app.get("/api/v1/reports/latest")
async def latest_report():
    """Return the most recent network report."""
    import asyncio
    from database import get_supabase

    def _fetch():
        db = get_supabase()
        result = (
            db.table("oracle_reports")
            .select("*")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        return result.data[0]

    report = await asyncio.to_thread(_fetch)
    if not report:
        return JSONResponse(status_code=404, content={"detail": "No reports generated yet"})
    return report


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
