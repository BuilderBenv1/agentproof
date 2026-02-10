import { Code, Shield, DollarSign, Zap, Globe, Terminal } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="font-sans text-3xl font-bold text-white">
          Documentation
        </h1>
        <p className="text-muted mt-2">
          Integrate Agent402 trust evaluations into your AI agent
        </p>
      </div>

      <div className="space-y-10">
        {/* Overview */}
        <Section icon={Shield} title="Overview">
          <p>
            Agent402 is a pay-per-use trust oracle for AI agents. It provides
            composite trust scores, risk assessments, and network analytics via a
            REST API gated by{" "}
            <a href="https://www.x402.org" className="text-primary hover:underline">
              x402 USDC micropayments
            </a>{" "}
            on Base.
          </p>
          <p className="mt-2">
            No API keys. No signup. Just a wallet with USDC on Base.
          </p>
        </Section>

        {/* Quick Start */}
        <Section icon={Terminal} title="Quick Start">
          <p className="mb-3">Install the x402 Python SDK:</p>
          <CodeBlock>{`pip install "x402[evm]" httpx eth-account`}</CodeBlock>

          <p className="mt-4 mb-3">Query a trust evaluation:</p>
          <CodeBlock>{`from x402.http.client import httpx_client
from eth_account import Account

# Your wallet with USDC on Base (Sepolia for testnet)
wallet = Account.from_key("0xYOUR_PRIVATE_KEY")

# Create x402-enabled HTTP client
client = httpx_client(wallet)

# Query trust evaluation — x402 handles payment automatically
resp = client.get("https://api.agent402.sh/api/v1/trust/42")
print(resp.json())
# {
#   "agent_id": 42,
#   "composite_score": 87.3,
#   "tier": "platinum",
#   "recommendation": "TRUSTED",
#   "risk_flags": [],
#   "score_breakdown": { ... },
#   ...
# }`}</CodeBlock>
        </Section>

        {/* How x402 Works */}
        <Section icon={DollarSign} title="How x402 Payment Works">
          <ol className="list-decimal list-inside space-y-2 text-muted">
            <li>
              <strong className="text-white">Request</strong> — Your client calls
              a premium endpoint (e.g.{" "}
              <code className="text-primary text-xs bg-surface px-1 rounded">
                GET /api/v1/trust/42
              </code>
              )
            </li>
            <li>
              <strong className="text-white">402 Response</strong> — Server
              returns HTTP 402 with a{" "}
              <code className="text-primary text-xs bg-surface px-1 rounded">
                PAYMENT-REQUIRED
              </code>{" "}
              header containing USDC payment instructions
            </li>
            <li>
              <strong className="text-white">Sign</strong> — The x402 SDK parses
              the header, signs a USDC transfer on Base
            </li>
            <li>
              <strong className="text-white">Retry</strong> — SDK retries the
              request with a{" "}
              <code className="text-primary text-xs bg-surface px-1 rounded">
                PAYMENT-SIGNATURE
              </code>{" "}
              header
            </li>
            <li>
              <strong className="text-white">Verify & Serve</strong> — Coinbase
              facilitator verifies the payment, server returns the data
            </li>
          </ol>
          <p className="text-muted mt-4 text-sm">
            The x402 SDK handles steps 2-4 automatically. From your perspective
            it&apos;s just a normal HTTP GET.
          </p>
        </Section>

        {/* Endpoints */}
        <Section icon={Globe} title="API Endpoints" id="pricing">
          <div className="space-y-4">
            <EndpointDoc
              method="GET"
              path="/api/v1/trust/{agent_id}"
              price="$0.01"
              desc="Full trust evaluation with composite score, tier, recommendation, risk flags, and score breakdown."
              response={`{
  "agent_id": 42,
  "name": "DeFi Optimizer",
  "composite_score": 87.3,
  "tier": "platinum",
  "recommendation": "TRUSTED",
  "risk_flags": [],
  "score_breakdown": {
    "rating_score": 85.2,
    "volume_score": 72.4,
    "consistency_score": 91.0,
    "validation_score": 88.5,
    "age_score": 65.3,
    "uptime_score": 95.0
  },
  "feedback_count": 35,
  "average_rating": 85.2,
  "validation_success_rate": 88.5,
  "account_age_days": 120,
  "uptime_pct": 95.0,
  "evaluated_at": "2025-01-15T12:00:00Z"
}`}
            />
            <EndpointDoc
              method="GET"
              path="/api/v1/trust/{agent_id}/risk"
              price="$0.01"
              desc="Risk assessment with flags and recommendation."
              response={`{
  "agent_id": 42,
  "recommendation": "TRUSTED",
  "risk_flags": [],
  "risk_level": "low",
  "details": "No risk flags"
}`}
            />
            <EndpointDoc
              method="GET"
              path="/api/v1/agents/trusted?category=defi&min_score=70&limit=20"
              price="$0.01"
              desc="Search trusted agents by category, minimum score, tier, and feedback count."
              response={`[
  {
    "agent_id": 42,
    "name": "DeFi Optimizer",
    "composite_score": 87.3,
    "tier": "platinum",
    "category": "defi",
    "feedback_count": 35
  }
]`}
            />
            <EndpointDoc
              method="GET"
              path="/api/v1/network/stats"
              price="$0.005"
              desc="Network-wide trust statistics and tier distribution."
              response={`{
  "total_agents": 24351,
  "avg_score": 42.8,
  "tier_distribution": {"diamond": 3, "platinum": 28, "gold": 142, ...},
  "total_feedback": 1247,
  "total_screenings": 8421,
  "total_payments": 0
}`}
            />
          </div>

          <h3 className="text-white font-semibold mt-8 mb-3">Free Endpoints</h3>
          <div className="space-y-2">
            <FreeEndpoint path="GET /api/v1/health" desc="Health check" />
            <FreeEndpoint path="GET /api/v1/pricing" desc="Machine-readable pricing" />
            <FreeEndpoint path="GET /api/v1/payments/stats" desc="Payment statistics" />
            <FreeEndpoint path="GET /api/v1/info" desc="Oracle metadata" />
            <FreeEndpoint path="GET /.well-known/agent.json" desc="A2A agent card" />
          </div>
        </Section>

        {/* Scoring */}
        <Section icon={Code} title="Scoring Algorithm">
          <p className="mb-3">
            The composite score (0-100) blends six signals with Bayesian
            smoothing:
          </p>
          <div className="bg-surface border border-surface-2 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-2 text-xs text-muted-2 uppercase">
                  <th className="text-left px-4 py-2">Signal</th>
                  <th className="text-right px-4 py-2">Weight</th>
                  <th className="text-left px-4 py-2">Method</th>
                </tr>
              </thead>
              <tbody className="text-muted">
                <tr className="border-b border-surface-2/50">
                  <td className="px-4 py-2 text-white">Average Rating</td>
                  <td className="px-4 py-2 text-right font-mono">35%</td>
                  <td className="px-4 py-2">Bayesian smoothed (k=3, prior=50)</td>
                </tr>
                <tr className="border-b border-surface-2/50">
                  <td className="px-4 py-2 text-white">Feedback Volume</td>
                  <td className="px-4 py-2 text-right font-mono">12%</td>
                  <td className="px-4 py-2">Logarithmic scale</td>
                </tr>
                <tr className="border-b border-surface-2/50">
                  <td className="px-4 py-2 text-white">Rating Consistency</td>
                  <td className="px-4 py-2 text-right font-mono">13%</td>
                  <td className="px-4 py-2">Inverse std deviation</td>
                </tr>
                <tr className="border-b border-surface-2/50">
                  <td className="px-4 py-2 text-white">Validation Rate</td>
                  <td className="px-4 py-2 text-right font-mono">18%</td>
                  <td className="px-4 py-2">Success percentage</td>
                </tr>
                <tr className="border-b border-surface-2/50">
                  <td className="px-4 py-2 text-white">Account Age</td>
                  <td className="px-4 py-2 text-right font-mono">7%</td>
                  <td className="px-4 py-2">Logarithmic decay</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-white">Uptime</td>
                  <td className="px-4 py-2 text-right font-mono">15%</td>
                  <td className="px-4 py-2">30-day average</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-white font-semibold mt-6 mb-2">Tier Thresholds</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <TierBadge tier="Diamond" score="90+" feedback="50+" />
            <TierBadge tier="Platinum" score="80-89" feedback="30+" />
            <TierBadge tier="Gold" score="70-79" feedback="20+" />
            <TierBadge tier="Silver" score="60-69" feedback="10+" />
            <TierBadge tier="Bronze" score="50-59" feedback="5+" />
            <TierBadge tier="Unranked" score="<50" feedback="<5" />
          </div>
        </Section>

        {/* A2A */}
        <Section icon={Zap} title="A2A Protocol (Agent-to-Agent)">
          <p className="mb-3">
            Agent402 supports{" "}
            <a href="https://google.github.io/A2A/" className="text-primary hover:underline">
              Google&apos;s A2A protocol
            </a>{" "}
            for agent-to-agent communication. Discover Agent402 via its agent card
            and query via JSON-RPC.
          </p>

          <p className="mb-2 text-sm text-muted-2">Agent Card:</p>
          <CodeBlock>{`GET /.well-known/agent.json`}</CodeBlock>

          <p className="mt-4 mb-2 text-sm text-muted-2">JSON-RPC Request:</p>
          <CodeBlock>{`POST /a2a
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "params": {
    "skill_id": "evaluate_agent",
    "message": {
      "role": "user",
      "parts": [{"text": "Evaluate agent 42"}]
    }
  },
  "id": 1
}`}</CodeBlock>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  id,
  children,
}: {
  icon: React.ElementType;
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="font-sans text-xl font-bold text-white">{title}</h2>
      </div>
      <div className="text-sm text-muted leading-relaxed">{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-surface border border-surface-2 rounded-lg p-4 text-xs font-mono text-muted overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

function EndpointDoc({
  method,
  path,
  price,
  desc,
  response,
}: {
  method: string;
  path: string;
  price: string;
  desc: string;
  response: string;
}) {
  return (
    <div className="bg-surface border border-surface-2 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
          {method}
        </span>
        <code className="text-sm text-white">{path}</code>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-auto">
          {price} USDC
        </span>
      </div>
      <p className="text-xs text-muted mt-2 mb-3">{desc}</p>
      <details>
        <summary className="text-xs text-primary cursor-pointer hover:underline">
          Example response
        </summary>
        <pre className="mt-2 bg-background border border-surface-2 rounded p-3 text-xs font-mono text-muted overflow-x-auto">
          <code>{response}</code>
        </pre>
      </details>
    </div>
  );
}

function FreeEndpoint({ path, desc }: { path: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded font-mono">
        FREE
      </span>
      <code className="text-xs text-primary">{path}</code>
      <span className="text-xs text-muted-3">{desc}</span>
    </div>
  );
}

function TierBadge({
  tier,
  score,
  feedback,
}: {
  tier: string;
  score: string;
  feedback: string;
}) {
  return (
    <div className="bg-surface border border-surface-2 rounded-lg p-2 text-center">
      <div className="font-semibold text-white text-xs">{tier}</div>
      <div className="text-xs text-muted mt-0.5">
        {score} &middot; {feedback} reviews
      </div>
    </div>
  );
}
