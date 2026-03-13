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
from routes import rest, a2a, mcp, webhooks, integrations, batch, hook, badges
from middleware.api_key import ApiKeyMiddleware

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

    # Warm the trust cache so first API calls are instant
    try:
        from services.trust import warm_cache
        warmed = await asyncio.wait_for(asyncio.to_thread(warm_cache), timeout=20)
        logger.info(f"Cache warm complete — {warmed} agents pre-loaded")
    except asyncio.TimeoutError:
        logger.warning("Cache warm timed out after 20s — will warm on demand")
    except Exception as e:
        logger.warning(f"Cache warm failed: {e}")

    # Start usage tracker flush thread
    from services.usage import get_usage_tracker
    usage_tracker = get_usage_tracker()
    usage_tracker.start()

    # Start autonomous scheduler
    from services.autonomous import get_screener
    screener = get_screener()
    await screener.start()

    yield

    # Shutdown autonomous scheduler
    await screener.stop()
    # Flush and stop usage tracker
    usage_tracker.stop()
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

# API key authentication middleware (after CORS, before routes)
app.add_middleware(ApiKeyMiddleware)

# Include routers
app.include_router(rest.router)
app.include_router(a2a.router)
app.include_router(mcp.router)
app.include_router(webhooks.router)
app.include_router(integrations.router)
app.include_router(batch.router)
app.include_router(hook.router)
app.include_router(badges.router)


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

<div class="links">
<a href="https://agentproof.sh">agentproof.sh</a>
<a href="/.well-known/agent.json">A2A Agent Card</a>
<a href="https://agentproof.sh/docs">Developer Docs</a>
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


INTEGRATE_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Integrate with AgentProof</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0A0A0F;color:#E8E8ED;font-family:'Space Grotesk',system-ui,sans-serif;line-height:1.6}
.container{max-width:800px;margin:0 auto;padding:2rem 1.5rem}
h1{font-size:2rem;color:#00E5A0;margin-bottom:.5rem}
h2{font-size:1.3rem;color:#00C8FF;margin:2rem 0 .75rem;border-bottom:1px solid #1a1a2e;padding-bottom:.5rem}
p{margin-bottom:1rem;color:#b0b0ba}
code{background:#12121a;color:#00E5A0;padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:.85em}
pre{background:#12121a;padding:1rem;border-radius:8px;overflow-x:auto;margin:1rem 0;font-family:'JetBrains Mono',monospace;font-size:.85em;border:1px solid #1a1a2e}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #1a1a2e}
th{color:#00E5A0;font-weight:600}
.tier-paygo{color:#888}
.tier-starter{color:#00E5A0}
.tier-growth{color:#00C8FF}
.tier-scale{color:#F59E0B}
.tier-enterprise{color:#A78BFA}
.highlight{background:#00E5A015;border:1px solid #00E5A040;border-radius:6px;padding:.75rem 1rem;margin:1rem 0}
.btn{display:inline-block;background:#00E5A0;color:#0A0A0F;padding:.6rem 1.5rem;border-radius:6px;text-decoration:none;font-weight:600;margin-top:.5rem}
.btn:hover{opacity:.9}
a{color:#00C8FF;text-decoration:none}
a:hover{text-decoration:underline}
.step{display:flex;gap:1rem;margin:1rem 0;align-items:flex-start}
.step-num{background:#00E5A0;color:#0A0A0F;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:.85em}
</style>
</head>
<body>
<div class="container">
<h1>Integrate with AgentProof</h1>
<p>Add trust scoring to your protocol in 3 steps. Gate DeFi actions, filter agent marketplaces, or verify agent reputation before transacting.</p>

<h2>Pricing</h2>
<div class="highlight">
<strong>Pay-per-call:</strong> $0.05 per API call. No commitment, no minimum. Register and start querying.
</div>

<p>Volume subscriptions for lower per-call pricing:</p>
<table>
<tr><th></th><th class="tier-paygo">Pay-per-call</th><th class="tier-starter">Starter</th><th class="tier-growth">Growth</th><th class="tier-scale">Scale</th><th class="tier-enterprise">Enterprise</th></tr>
<tr><td>Monthly calls</td><td>Unlimited</td><td>10,000</td><td>25,000</td><td>75,000</td><td>200,000</td></tr>
<tr><td>Per call</td><td>$0.05</td><td>$0.025</td><td>$0.02</td><td>$0.013</td><td>$0.01</td></tr>
<tr><td>Monthly price</td><td>Usage-based</td><td>$250</td><td>$500</td><td>$1,000</td><td>$2,000</td></tr>
<tr><td>Batch size</td><td>50</td><td>100</td><td>200</td><td>300</td><td>500</td></tr>
<tr><td>Webhooks</td><td>3</td><td>5</td><td>10</td><td>25</td><td>Unlimited</td></tr>
</table>

<h2>Quick Start</h2>
<div class="step"><div class="step-num">1</div><div>
<strong>Get your API key</strong>
<pre>curl -X POST https://oracle.agentproof.sh/api/v1/integrations/register \\
  -H "Content-Type: application/json" \\
  -d '{"protocol_name": "My Protocol", "contact_email": "dev@example.com"}'</pre>
</div></div>

<div class="step"><div class="step-num">2</div><div>
<strong>Query trust scores</strong>
<pre>curl https://oracle.agentproof.sh/api/v1/trust/1380 \\
  -H "X-Api-Key: ap_live_your_key_here"</pre>
<p>Returns: <code>{ composite_score, tier, recommendation, risk_flags, score_breakdown }</code></p>
</div></div>

<div class="step"><div class="step-num">3</div><div>
<strong>Set up webhooks</strong> (get notified when agent scores or tiers change)
<pre>curl -X POST https://oracle.agentproof.sh/api/v1/webhooks \\
  -H "X-Api-Key: ap_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"subscriber_name": "My Protocol", "webhook_url": "https://my-app.com/webhooks/agentproof", "events": ["score_change", "tier_change"]}'</pre>
</div></div>

<h2>Batch Evaluation (Growth+)</h2>
<pre>curl -X POST https://oracle.agentproof.sh/api/v1/trust/batch \\
  -H "X-Api-Key: ap_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"agent_ids": [1380, 1375, 1199, 888], "chain": "base"}'</pre>

<h2>Python Example</h2>
<pre>import httpx

ORACLE = "https://oracle.agentproof.sh"
API_KEY = "ap_live_your_key_here"
headers = {"X-Api-Key": API_KEY}

# Single evaluation
r = httpx.get(f"{ORACLE}/api/v1/trust/1380", headers=headers)
eval = r.json()
print(f"Score: {eval['composite_score']}, Tier: {eval['tier']}")

# Gate by tier
if eval["tier"] not in ("gold", "platinum", "diamond"):
    raise Exception("Agent does not meet minimum trust tier")</pre>

<h2>JavaScript Example</h2>
<pre>const ORACLE = "https://oracle.agentproof.sh";
const API_KEY = "ap_live_your_key_here";

const res = await fetch(`${ORACLE}/api/v1/trust/1380`, {
  headers: { "X-Api-Key": API_KEY }
});
const { composite_score, tier, recommendation } = await res.json();

if (tier === "diamond" || tier === "platinum") {
  // Reduce collateral requirements for trusted agents
}</pre>

<h2>On-Chain Integration</h2>
<p>For fully on-chain reputation gating, use the <code>TrustScoreOracle</code> contract. The oracle pushes composite scores on-chain; your contracts read them with a small per-query fee.</p>
<pre>// Solidity
ITrustScoreOracle oracle = ITrustScoreOracle(ORACLE_ADDRESS);
(uint16 score, uint8 tier, ) = oracle.getScore{value: oracle.queryFee()}(agentId);
require(tier >= 3, "Agent must be Gold or above");</pre>

<h2>Endpoints Reference</h2>
<table>
<tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
<tr><td><code>POST</code></td><td>/api/v1/integrations/register</td><td>Get API key</td></tr>
<tr><td><code>GET</code></td><td>/api/v1/integrations/usage</td><td>Usage dashboard</td></tr>
<tr><td><code>POST</code></td><td>/api/v1/integrations/upgrade</td><td>Upgrade tier</td></tr>
<tr><td><code>GET</code></td><td>/api/v1/trust/{agent_id}</td><td>Trust evaluation</td></tr>
<tr><td><code>GET</code></td><td>/api/v1/trust/{agent_id}/risk</td><td>Risk assessment</td></tr>
<tr><td><code>POST</code></td><td>/api/v1/trust/batch</td><td>Batch evaluation (Growth+)</td></tr>
<tr><td><code>GET</code></td><td>/api/v1/agents/trusted</td><td>Search trusted agents</td></tr>
<tr><td><code>POST</code></td><td>/api/v1/webhooks</td><td>Register webhook</td></tr>
<tr><td><code>GET</code></td><td>/api/v1/network/stats</td><td>Network statistics</td></tr>
</table>

<p style="margin-top:2rem;color:#666;font-size:.85em">Questions? Contact <a href="mailto:team@agentproof.sh">team@agentproof.sh</a> &middot; <a href="/">Back to Oracle</a></p>
</div>
</body>
</html>
"""


@app.get("/integrate", response_class=HTMLResponse)
async def integrate_page():
    """Protocol integration landing page with self-serve docs."""
    return INTEGRATE_HTML


@app.get("/health")
async def health():
    """Top-level health check."""
    return {"status": "healthy", "service": "agentproof-trust-oracle"}


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
