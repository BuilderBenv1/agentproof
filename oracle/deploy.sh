#!/bin/bash
# ===========================================
# AgentProof Trust Oracle — Railway Deployment
# ===========================================
#
# Usage:
#   export RAILWAY_TOKEN="your-token-here"
#   bash oracle/deploy.sh
#
# Or, if already logged in via `railway login`:
#   bash oracle/deploy.sh
#
# Prerequisites:
#   npm install -g @railway/cli
# ===========================================

set -e

cd "$(dirname "$0")"

echo "=== AgentProof Trust Oracle — Railway Deploy ==="

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo "ERROR: Railway CLI not found. Install with: npm install -g @railway/cli"
    exit 1
fi

# Check auth
if ! railway whoami &> /dev/null; then
    echo "ERROR: Not logged in. Run: railway login"
    echo "  Or set: export RAILWAY_TOKEN=your-token"
    exit 1
fi

echo "Authenticated as: $(railway whoami)"

# Link to existing project (interactive — select the agentproof project)
echo ""
echo "=== Step 1: Link to Railway project ==="
echo "Select your AgentProof project and create/select the oracle service."
railway link

# Set environment variables
echo ""
echo "=== Step 2: Setting environment variables ==="
railway variables set \
    SUPABASE_URL="https://oztrefgbigvtzncodcys.supabase.co" \
    SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dHJlZmdiaWd2dHpuY29kY3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjMxMzEsImV4cCI6MjA4NTk5OTEzMX0.jCDzHOIZGAvC4aDAXJ_uOGNCLTrKpaX2ApE1pmPF7AM" \
    AVALANCHE_RPC_URL="https://api.avax.network/ext/bc/C/rpc" \
    ORACLE_BASE_URL="https://oracle.agentproof.sh" \
    CORS_ORIGINS="http://localhost:3000,https://agentproof.sh,https://www.agentproof.sh,https://oracle.agentproof.sh"

echo "Environment variables set."

# Deploy
echo ""
echo "=== Step 3: Deploying ==="
railway up --detach

echo ""
echo "=== Deployment initiated! ==="
echo "Check status: railway status"
echo "View logs:    railway logs"
echo ""
echo "After deployment succeeds:"
echo "  1. Add custom domain: railway domain oracle.agentproof.sh"
echo "  2. Add DNS CNAME record: oracle -> <railway-provided-target>"
echo "  3. Test: curl https://oracle.agentproof.sh/.well-known/agent.json"
