"""HTTP hardening: CSRF origin verification and baseline security headers.

CSRF policy (cookie SameSite=None in production):
- Safe methods (GET, HEAD, OPTIONS, TRACE) are never checked.
- Machine-to-machine routes authenticated by bearer token (``/api/hub/``) are exempt.
- Any unsafe request whose ``Origin`` (or, when absent, ``Referer``) is not trusted is
  rejected, even without a session cookie (blocks login CSRF from foreign sites).
- An unsafe request that carries the session cookie but neither ``Origin`` nor
  ``Referer`` is rejected: browsers always send ``Origin`` on cross-site and on
  same-origin ``fetch`` mutations, so a missing header with ambient credentials is
  treated as suspicious. Requests without cookie and without these headers come from
  non-browser clients (scripts, smoke tests) and carry no ambient authority.
- Trusted origins: the origin of ``FRONTEND_URL``, ``CSRF_TRUSTED_ORIGINS`` and the
  API's own origin (same-origin is not cross-site). Outside production the localhost /
  127.0.0.1 aliases of the configured frontend are also accepted.
"""

from urllib.parse import urlsplit

from starlette.requests import Request
from starlette.responses import Response

from app.core.config import Settings

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})
EXEMPT_PREFIXES = ("/api/hub/",)
SESSION_COOKIE = "mediamind_session"
LOOPBACK_ALIASES = ("127.0.0.1", "localhost")


def normalize_origin(value: str | None) -> str | None:
    if not value:
        return None
    parts = urlsplit(value.strip())
    if parts.scheme not in {"http", "https"} or not parts.hostname:
        return None
    default_port = 443 if parts.scheme == "https" else 80
    try:
        port = parts.port
    except ValueError:
        return None
    suffix = f":{port}" if port and port != default_port else ""
    return f"{parts.scheme}://{parts.hostname.lower()}{suffix}"


def trusted_origins(settings: Settings) -> frozenset[str]:
    candidates = [settings.frontend_url, *settings.csrf_trusted_origins.split(",")]
    origins = {origin for origin in map(normalize_origin, candidates) if origin}
    if settings.environment != "production":
        frontend = urlsplit(settings.frontend_url)
        if frontend.hostname in LOOPBACK_ALIASES:
            port = f":{frontend.port}" if frontend.port else ""
            origins.update(
                normalize_origin(f"{frontend.scheme}://{alias}{port}") for alias in LOOPBACK_ALIASES
            )
    return frozenset(origins)


def own_origin(request: Request) -> str | None:
    host = request.headers.get("host")
    if not host:
        return None
    return normalize_origin(f"{request.url.scheme}://{host}")


def csrf_violation(request: Request, settings: Settings) -> bool:
    if request.method.upper() in SAFE_METHODS:
        return False
    if request.url.path.startswith(EXEMPT_PREFIXES):
        return False
    raw_origin = request.headers.get("origin")
    raw_referer = request.headers.get("referer")
    if raw_origin is None and raw_referer is None:
        return SESSION_COOKIE in request.cookies
    # "Origin: null" (sandboxed/opaque contexts) normalizes to None and is rejected.
    origin = normalize_origin(raw_origin if raw_origin is not None else raw_referer)
    if origin is None:
        return True
    allowed = trusted_origins(settings) | {own_origin(request)}
    return origin not in allowed


def apply_security_headers(response: Response, settings: Settings) -> None:
    ancestors = " ".join(["'self'", *sorted(trusted_origins(settings))])
    headers = response.headers
    headers.setdefault("X-Content-Type-Options", "nosniff")
    headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    # Legacy fallback; modern browsers apply the CSP frame-ancestors list below.
    headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    headers.setdefault("Content-Security-Policy", f"frame-ancestors {ancestors}")
    headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    )
