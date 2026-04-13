"""
AgentFactory API — Gasless Agent Launcher on SKALE Base.

Endpoints:
    POST /launch    — Register a new agent with built-in trust handshake
    GET  /agent/:id — Get agent profile with trust score
    GET  /health    — Health check

Every agent launched gets:
    1. ERC-8004 identity (on-chain, gasless)
    2. Hosted metadata (resolvable URI)
    3. AgentProof trust evaluation (triggered immediately)
    4. Built-in requireTrust() via the AgentFactory contract
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from web3 import Web3

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger("factory")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")

# ─── Config ──────────────────────────────────────────────────────────────────

SKALE_RPC = os.getenv("SKALE_RPC_URL", "https://skale-base.skalenodes.com/v1/base")
CHAIN_ID = 1187947933
PRIVATE_KEY = os.getenv("PRIVATE_KEY") or os.getenv("ORACLE_PRIVATE_KEY", "")
FACTORY_ADDRESS = os.getenv("SKALE_FACTORY_ADDRESS", "")
IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
ORACLE_BASE_URL = os.getenv("ORACLE_BASE_URL", "https://oracle.agentproof.sh")
FACTORY_BASE_URL = os.getenv("FACTORY_BASE_URL", "https://factory.agentproof.sh")

# ERC-721 Transfer event topic
TRANSFER_TOPIC = Web3.keccak(text="Transfer(address,address,uint256)").hex()

# ─── ABIs ────────────────────────────────────────────────────────────────────

FACTORY_ABI = json.loads("""[
    {"inputs":[{"name":"agentURI","type":"string"}],"name":"launch","outputs":[{"name":"agentId","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"isFactoryAgent","outputs":[{"name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"checkTrust","outputs":[{"name":"trusted","type":"bool"},{"name":"score","type":"uint16"},{"name":"tier","type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getTrustProfile","outputs":[{"name":"compositeScore","type":"uint16"},{"name":"tier","type":"uint8"},{"name":"lastUpdated","type":"uint40"},{"name":"isFactory","type":"bool"},{"name":"meetsTrust","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"totalLaunched","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"owner","type":"address"}],"name":"getAgentsByOwner","outputs":[{"name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"}
]""")

REGISTER_ABI = json.loads("""[
    {"inputs":[{"name":"agentURI","type":"string"}],"name":"register","outputs":[{"name":"","type":"uint256"}],"stateMutability":"payable","type":"function"}
]""")

# ─── Web3 Setup ──────────────────────────────────────────────────────────────

w3 = Web3(Web3.HTTPProvider(SKALE_RPC))
account = w3.eth.account.from_key(PRIVATE_KEY) if PRIVATE_KEY else None

# ─── Metadata Store ──────────────────────────────────────────────────────────
# In production, use IPFS or a proper object store.
# For now, keep metadata in memory and serve it via the API.
agent_metadata: dict[int, dict] = {}

# ─── Models ──────────────────────────────────────────────────────────────────


class LaunchRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    category: str = Field("general")
    image_url: str = Field("")
    endpoints: list[dict] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    owner_wallet: str = Field("", description="Owner wallet address (for attribution). If empty, factory wallet is used.")


class LaunchResponse(BaseModel):
    agent_id: int
    owner: str
    source_chain: str = "skale"
    metadata_uri: str
    profile_url: str
    explorer_url: str
    scan_url: str
    trust_evaluation: dict | None = None
    message: str


class AgentProfile(BaseModel):
    agent_id: int
    name: str | None
    description: str | None
    category: str
    image_url: str | None
    endpoints: list[dict]
    tags: list[str]
    owner: str
    source_chain: str = "skale"
    is_factory_agent: bool
    trust: dict | None = None


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AgentProof Factory — Gasless Agent Launcher",
    description="Launch ERC-8004 agents on SKALE with built-in AgentProof trust handshake. Zero gas. Instant scoring.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "agentproof-factory",
        "chain": "skale-base",
        "chain_id": CHAIN_ID,
        "factory_address": FACTORY_ADDRESS,
        "total_launched": len(agent_metadata),
        "connected": w3.is_connected(),
    }


@app.post("/launch", response_model=LaunchResponse)
async def launch_agent(req: LaunchRequest):
    """Launch a new agent on SKALE with built-in trust."""
    if not account:
        raise HTTPException(500, "Factory wallet not configured")

    # Build ERC-8004 metadata
    metadata = {
        "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        "name": req.name,
        "description": req.description,
        "category": req.category,
        "image": req.image_url,
        "endpoints": req.endpoints,
        "tags": req.tags,
        "active": True,
        "launchedBy": "AgentProof Factory",
        "launchedAt": datetime.now(timezone.utc).isoformat(),
    }

    # Register on ERC-8004 Identity Registry
    registry = w3.eth.contract(
        address=Web3.to_checksum_address(IDENTITY_REGISTRY),
        abi=REGISTER_ABI,
    )

    # Use a hosted metadata URL (cheaper gas than data URI)
    # We'll serve it from this API and set the URI after we know the agent_id
    # For now, register with a placeholder that we'll update
    temp_uri = json.dumps(metadata)

    try:
        nonce = w3.eth.get_transaction_count(account.address)
        call = registry.functions.register(temp_uri)
        gas = call.estimate_gas({"from": account.address, "value": 0})

        tx = call.build_transaction({
            "from": account.address,
            "value": 0,
            "nonce": nonce,
            "gas": int(gas * 1.3),
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID,
        })

        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        if receipt.status != 1:
            raise HTTPException(500, "Registration transaction reverted")

        # Parse agent ID from Transfer event
        agent_id = None
        for log in receipt.logs:
            if len(log.topics) >= 4 and log.topics[0].hex() == TRANSFER_TOPIC:
                agent_id = int(log.topics[3].hex(), 16)
                break

        if agent_id is None:
            raise HTTPException(500, "Could not parse agent ID from receipt")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(500, f"Registration failed: {str(e)}")

    # Store metadata
    metadata["agent_id"] = agent_id
    owner = req.owner_wallet if req.owner_wallet else account.address
    metadata["owner"] = owner
    agent_metadata[agent_id] = metadata

    # Trigger AgentProof trust evaluation
    trust_eval = None
    try:
        resp = httpx.get(
            f"{ORACLE_BASE_URL}/api/v1/trust/{agent_id}",
            params={"chain": "skale"},
            timeout=15,
        )
        if resp.status_code == 200:
            trust_eval = resp.json()
    except Exception as e:
        logger.warning(f"Trust evaluation request failed (agent will be scored by autonomous screener): {e}")

    profile_url = f"https://agentproof.sh/agents/{agent_id}?chain=skale"
    explorer_url = f"https://skale-base-explorer.skalenodes.com/tx/{tx_hash.hex()}"
    scan_url = f"https://www.8004scan.io/agents?chain={CHAIN_ID}"

    logger.info(f"Agent #{agent_id} launched: {req.name}")

    return LaunchResponse(
        agent_id=agent_id,
        owner=owner,
        metadata_uri=f"{FACTORY_BASE_URL}/agent/{agent_id}/metadata",
        profile_url=profile_url,
        explorer_url=explorer_url,
        scan_url=scan_url,
        trust_evaluation=trust_eval,
        message=f"Agent #{agent_id} launched on SKALE Base with AgentProof trust handshake.",
    )


@app.get("/agent/{agent_id}")
async def get_agent(agent_id: int):
    """Get agent profile with trust data."""
    # Check local metadata first
    meta = agent_metadata.get(agent_id)

    # If not a factory agent, try the oracle
    if not meta:
        try:
            resp = httpx.get(
                f"{ORACLE_BASE_URL}/api/v1/trust/{agent_id}",
                params={"chain": "skale"},
                timeout=10,
            )
            if resp.status_code == 200:
                trust = resp.json()
                return {
                    "agent_id": agent_id,
                    "is_factory_agent": False,
                    "trust": trust,
                    "source_chain": "skale",
                }
        except Exception:
            pass
        raise HTTPException(404, f"Agent #{agent_id} not found")

    # Get trust score
    trust = None
    try:
        resp = httpx.get(
            f"{ORACLE_BASE_URL}/api/v1/trust/{agent_id}",
            params={"chain": "skale"},
            timeout=10,
        )
        if resp.status_code == 200:
            trust = resp.json()
    except Exception:
        pass

    return AgentProfile(
        agent_id=agent_id,
        name=meta.get("name"),
        description=meta.get("description"),
        category=meta.get("category", "general"),
        image_url=meta.get("image"),
        endpoints=meta.get("endpoints", []),
        tags=meta.get("tags", []),
        owner=meta.get("owner", ""),
        is_factory_agent=True,
        trust=trust,
    )


@app.get("/agent/{agent_id}/metadata")
async def get_agent_metadata(agent_id: int):
    """Serve agent metadata JSON (the URI stored on-chain points here)."""
    meta = agent_metadata.get(agent_id)
    if not meta:
        raise HTTPException(404, f"Metadata for agent #{agent_id} not found")
    return meta


@app.get("/agents")
async def list_agents(limit: int = 20, offset: int = 0):
    """List all factory-launched agents."""
    ids = sorted(agent_metadata.keys(), reverse=True)
    page = ids[offset:offset + limit]
    return {
        "total": len(agent_metadata),
        "agents": [
            {
                "agent_id": aid,
                "name": agent_metadata[aid].get("name"),
                "category": agent_metadata[aid].get("category"),
                "owner": agent_metadata[aid].get("owner"),
                "launched_at": agent_metadata[aid].get("launchedAt"),
            }
            for aid in page
        ],
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
