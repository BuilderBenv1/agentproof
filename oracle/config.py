from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class OracleSettings(BaseSettings):
    # Supabase (read-only access to existing DB)
    supabase_url: str = ""
    supabase_key: str = ""

    # Avalanche (for optional self-registration and on-chain feedback)
    avalanche_rpc_url: str = "https://api.avax.network/ext/bc/C/rpc"
    private_key: str = Field(
        default="",
        validation_alias=AliasChoices("ORACLE_PRIVATE_KEY", "PRIVATE_KEY"),
    )

    # Official ERC-8004 Identity Registry
    erc8004_identity_registry: str = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"

    # ReputationRegistry contract — mainnet ERC-8004 (Ava Labs official)
    reputation_registry: str = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"

    # Ethereum mainnet (same CREATE2 addresses as Avalanche)
    ethereum_rpc_url: str = Field(
        default="",
        validation_alias=AliasChoices("ETHEREUM_RPC_URL", "ETH_RPC_URL"),
    )
    eth_identity_registry: str = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    eth_reputation_registry: str = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"

    # Base mainnet (same CREATE2 addresses)
    base_rpc_url: str = Field(
        default="",
        validation_alias=AliasChoices("BASE_RPC_URL", "BASE_RPC"),
    )
    base_identity_registry: str = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    base_reputation_registry: str = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"

    # Oracle identity
    oracle_agent_name: str = "AgentProof Trust Oracle"
    oracle_agent_description: str = (
        "Official reputation oracle for the ERC-8004 agent ecosystem. "
        "Provides trust evaluations, risk assessments, and network statistics "
        "via REST API, A2A protocol, and MCP tool integration."
    )
    oracle_version: str = "1.0.0"

    # Server
    oracle_host: str = "0.0.0.0"
    oracle_port: int = 8001
    port: int = 0  # Railway sets PORT automatically; takes precedence over oracle_port
    oracle_base_url: str = "https://oracle.agentproof.sh"
    cors_origins: str = "http://localhost:3000"

    # Self-registration (opt-in)
    self_register: bool = False

    # Oracle's own agent token ID (set after registration to skip event scanning)
    oracle_agent_id: int = 0

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        for prod in [
            "https://agentproof.sh",
            "https://www.agentproof.sh",
            "https://oracle.agentproof.sh",
        ]:
            if prod not in origins:
                origins.append(prod)
        return origins

    model_config = SettingsConfigDict(
        env_file="../.env", env_file_encoding="utf-8", extra="ignore"
    )


@lru_cache()
def get_settings() -> OracleSettings:
    return OracleSettings()
