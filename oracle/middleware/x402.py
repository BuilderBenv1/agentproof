"""
x402 payment middleware for the Trust Oracle.

Gates premium endpoints behind USDC micropayments using Coinbase's x402 protocol.
Free endpoints (health, stats, pricing, agent card) pass through unaffected.
"""

import logging
import re

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.server import x402ResourceServer

from config import OracleSettings

logger = logging.getLogger(__name__)


class PaymentLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs successful x402 payments to Supabase.

    Runs inside PaymentMiddlewareASGI. If a request to a premium route
    succeeded (2xx) and contained a payment header, the payment was
    verified — log it.
    """

    PREMIUM_PATH_PATTERNS = [
        re.compile(r"^/api/v1/trust/\d+(/risk)?$"),
        re.compile(r"^/api/v1/agents/trusted$"),
    ]

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        payment_header = (
            request.headers.get("payment-signature")
            or request.headers.get("x-payment")
        )

        if payment_header and 200 <= response.status_code < 300:
            path = request.url.path
            if any(p.match(path) for p in self.PREMIUM_PATH_PATTERNS):
                agent_id = None
                match = re.search(r"/trust/(\d+)", path)
                if match:
                    agent_id = int(match.group(1))

                try:
                    from services.payments import log_payment
                    from config import get_settings

                    settings = get_settings()
                    log_payment(
                        payer_address="x402-payer",
                        amount_usd=float(settings.x402_price_usd.replace("$", "")),
                        network=settings.x402_network,
                        http_method=request.method,
                        http_path=path,
                        agent_id_queried=agent_id,
                    )
                except Exception as e:
                    logger.error(f"Payment logging failed: {e}")

        return response


def setup_x402_middleware(app: FastAPI, settings: OracleSettings) -> None:
    """Register x402 payment middleware on premium oracle endpoints."""

    if not settings.x402_pay_to:
        logger.warning("X402_PAY_TO not set — x402 payments disabled")
        return

    # Initialize x402 resource server with Coinbase facilitator
    facilitator = HTTPFacilitatorClient(
        FacilitatorConfig(url=settings.x402_facilitator_url)
    )
    server = x402ResourceServer(facilitator)
    server.register(settings.x402_network, ExactEvmServerScheme())

    # Payment option used for all premium routes
    payment_option = PaymentOption(
        scheme="exact",
        pay_to=settings.x402_pay_to,
        price=settings.x402_price_usd,
        network=settings.x402_network,
    )

    # Routes gated behind x402 payment
    routes: dict[str, RouteConfig] = {
        "GET /api/v1/trust/*": RouteConfig(
            accepts=[payment_option],
            description="Trust evaluation and risk assessment for an ERC-8004 agent",
        ),
        "GET /api/v1/agents/trusted": RouteConfig(
            accepts=[payment_option],
            description="Search for trusted agents by category, score, and tier",
        ),
    }

    # Middleware ordering: PaymentLoggingMiddleware is inner (added first),
    # PaymentMiddlewareASGI is outer (added second). Starlette applies
    # middleware in reverse order — last added is outermost.
    app.add_middleware(PaymentLoggingMiddleware)
    app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)

    logger.info(
        f"x402 payment middleware enabled — "
        f"network={settings.x402_network} "
        f"pay_to={settings.x402_pay_to[:10]}... "
        f"price={settings.x402_price_usd}/request "
        f"facilitator={settings.x402_facilitator_url}"
    )
