"""URL safety checks — block SSRF via private IPs and non-HTTP schemes."""

import ipaddress
import socket
from urllib.parse import urlparse

_BLOCKED_NETS = [
    ipaddress.IPv4Network("127.0.0.0/8"),
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.168.0.0/16"),
    ipaddress.IPv4Network("169.254.0.0/16"),
    ipaddress.IPv6Network("::1/128"),
    ipaddress.IPv6Network("fc00::/7"),
    ipaddress.IPv6Network("fe80::/10"),
]


def is_safe_url(url: str) -> bool:
    """Return True if the URL is safe to request (no SSRF risk)."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False

    if parsed.scheme not in ("http", "https"):
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    if hostname in ("localhost", "0.0.0.0"):
        return False

    # Check if hostname is a raw IP
    try:
        ip = ipaddress.ip_address(hostname)
        return not any(ip in net for net in _BLOCKED_NETS)
    except ValueError:
        pass

    # Hostname is a domain — resolve and check
    try:
        for info in socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM):
            addr = info[4][0]
            ip = ipaddress.ip_address(addr)
            if any(ip in net for net in _BLOCKED_NETS):
                return False
    except socket.gaierror:
        return False

    return True
