# Python Registration

Full flow: create agent → configure capabilities → register to IPFS (or HTTP).

```python
from agent0_sdk import SDK
import os

sdk = SDK(
    chainId=11155111,
    rpcUrl=os.getenv("RPC_URL"),
    signer=os.getenv("PRIVATE_KEY"),
    ipfs="pinata",
    pinataJwt=os.getenv("PINATA_JWT"),
)

# 1. Create agent with basic metadata
agent = sdk.createAgent(
    name="My AI Agent",
    description="An intelligent assistant for various tasks.",
    image="https://example.com/agent-image.png"
)

# 2. Configure capabilities
agent.setMCP("https://mcp.example.com/")
agent.setA2A("https://a2a.example.com/agent-card.json")
agent.setENS("myagent.eth")

# 3. Add OASF skills and domains (validate against taxonomy)
agent.addSkill("data_engineering/data_transformation_pipeline", validate_oasf=True)
agent.addDomain("finance_and_business/investment_services", validate_oasf=True)

# 4. Set trust mechanisms
agent.setTrust(reputation=True, cryptoEconomic=True)

# 5. Set active status
agent.setActive(True)

# 6. Register (pins metadata to IPFS + on-chain tx)
reg_tx = agent.registerIPFS()
reg = reg_tx.wait_confirmed(timeout=180).result
print(f"Agent registered: {reg.agentId}")
```

Alternative: `agent.registerHTTP("https://your-metadata-url.com/")` to skip IPFS.

For updates, mutate agent fields and call `registerIPFS()` / `registerHTTP()` again.

> Version-sensitive: `createAgent`, `setMCP`, `setA2A`, `setENS`, `addSkill`, `addDomain`, `setTrust`, `setActive`, `registerIPFS`, `wait_confirmed` reflect v1.5.3.
