from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Avalanche
    avalanche_rpc_url: str = "https://api.avax-test.network/ext/bc/C/rpc"

    # Ethereum
    ethereum_rpc_url: str = ""
    erc8004_eth_identity_registry: str = ""

    # Official ERC-8004 Registries (Avalanche)
    erc8004_identity_registry: str = ""
    erc8004_reputation_registry: str = ""
    use_official_erc8004: bool = True

    # AgentProof Custom Contracts (legacy identity/reputation kept for fallback)
    identity_registry_address: str = ""
    reputation_registry_address: str = ""
    validation_registry_address: str = ""
    agentproof_core_address: str = ""

    # Phase 3 contract addresses
    insurance_pool_address: str = ""
    agent_payments_address: str = ""
    reputation_gate_address: str = ""
    reputation_bridge_address: str = ""
    reputation_source_address: str = ""

    # Phase 4 contract addresses
    agent_monitor_address: str = ""
    agent_splits_address: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""

    # Backend
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        # Always include production domains
        production_origins = [
            "https://agentproof.sh",
            "https://www.agentproof.sh",
            "https://agentproof-production.up.railway.app",
        ]
        for origin in production_origins:
            if origin not in origins:
                origins.append(origin)
        return origins

    @property
    def active_identity_address(self) -> str:
        """Return the identity registry address based on the ERC-8004 flag."""
        if self.use_official_erc8004 and self.erc8004_identity_registry:
            return self.erc8004_identity_registry
        return self.identity_registry_address

    @property
    def active_reputation_address(self) -> str:
        """Return the reputation registry address based on the ERC-8004 flag."""
        if self.use_official_erc8004 and self.erc8004_reputation_registry:
            return self.erc8004_reputation_registry
        return self.reputation_registry_address

    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
