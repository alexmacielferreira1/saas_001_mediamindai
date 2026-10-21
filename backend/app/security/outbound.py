"""Server-side request guard (SSRF) for user-configurable destination URLs.

Every URL that a tenant can configure and that the server will call must pass
``validate_outbound_url`` right before the request. Rules:
- only ``http``/``https``; no credentials embedded in the URL;
- host must not be loopback, private, link-local (cloud metadata 169.254.169.254),
  CGNAT, multicast, reserved or unspecified, either as a literal IP or after DNS
  resolution (all resolved addresses are checked; resolution failure fails closed);
- well-known internal names (``localhost``, ``*.local``, ``*.internal``,
  ``metadata.google.internal``) are refused before any lookup.

``OUTBOUND_ALLOW_PRIVATE_NETWORKS=true`` relaxes the network rules for local
development only (e.g. a model server on 127.0.0.1); it is refused in production.
Residual risk: DNS rebinding between this check and the connection is not pinned.
"""

import ipaddress
import socket
from urllib.parse import urlsplit

from app.core.config import get_settings

BLOCKED_NAMES = frozenset({"localhost", "metadata", "metadata.google.internal"})
BLOCKED_SUFFIXES = (".localhost", ".local", ".internal", ".localdomain", ".home.arpa")
CGNAT = ipaddress.ip_network("100.64.0.0/10")


class OutboundUrlRejected(ValueError):
    """The destination is not allowed for server-side requests."""


def resolve_host(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return [info[4][0] for info in infos]


def is_public_address(value: str) -> bool:
    address = ipaddress.ip_address(value.split("%", 1)[0])
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
        or (isinstance(address, ipaddress.IPv4Address) and address in CGNAT)
    )


def validate_outbound_url(url: str) -> str:
    parts = urlsplit(str(url).strip())
    if parts.scheme not in {"http", "https"}:
        raise OutboundUrlRejected("Somente endereços http ou https são permitidos.")
    if parts.username or parts.password:
        raise OutboundUrlRejected("O endereço não pode conter credenciais.")
    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise OutboundUrlRejected("Endereço sem servidor de destino.")
    try:
        port = parts.port or (443 if parts.scheme == "https" else 80)
    except ValueError as error:
        raise OutboundUrlRejected("Porta inválida no endereço.") from error

    if get_settings().outbound_allow_private_networks:
        return str(url)

    if host in BLOCKED_NAMES or host.endswith(BLOCKED_SUFFIXES):
        raise OutboundUrlRejected("Destino interno não permitido.")
    try:
        addresses = [str(ipaddress.ip_address(host))]
    except ValueError:
        try:
            addresses = resolve_host(host, port)
        except (OSError, UnicodeError) as error:
            raise OutboundUrlRejected("Não foi possível validar o destino.") from error
    if not addresses or not all(is_public_address(item) for item in addresses):
        raise OutboundUrlRejected("Destino interno não permitido.")
    return str(url)
