from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Avalanche
    avalanche_rpc_url: str = "https://api.avax-test.network/ext/bc/C/rpc"

    # Ethereum
    ethereum_rpc_url: str = ""
    ethereum_rpc_fallback_urls: str = ""  # Comma-separated fallback RPCs
    erc8004_eth_identity_registry: str = ""

    @property
    def ethereum_rpc_urls(self) -> list[str]:
        """Return all Ethereum RPC URLs (primary + fallbacks) for failover."""
        urls = []
        if self.ethereum_rpc_url:
            urls.append(self.ethereum_rpc_url)
        if self.ethereum_rpc_fallback_urls:
            for url in self.ethereum_rpc_fallback_urls.split(","):
                url = url.strip()
                if url and url not in urls:
                    urls.append(url)
        return urls

    # Base
    base_rpc_url: str = ""
    base_rpc_fallback_urls: str = ""  # Comma-separated fallback RPCs
    erc8004_base_identity_registry: str = ""

    @property
    def base_rpc_urls(self) -> list[str]:
        """Return all Base RPC URLs (primary + fallbacks) for failover."""
        urls = []
        if self.base_rpc_url:
            urls.append(self.base_rpc_url)
        if self.base_rpc_fallback_urls:
            for url in self.base_rpc_fallback_urls.split(","):
                url = url.strip()
                if url and url not in urls:
                    urls.append(url)
        return urls

    # Linea
    linea_rpc_url: str = ""
    linea_rpc_fallback_urls: str = ""  # Comma-separated fallback RPCs
    erc8004_linea_identity_registry: str = ""

    @property
    def linea_rpc_urls(self) -> list[str]:
        """Return all Linea RPC URLs (primary + fallbacks) for failover."""
        urls = []
        if self.linea_rpc_url:
            urls.append(self.linea_rpc_url)
        if self.linea_rpc_fallback_urls:
            for url in self.linea_rpc_fallback_urls.split(","):
                url = url.strip()
                if url and url not in urls:
                    urls.append(url)
        return urls

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
