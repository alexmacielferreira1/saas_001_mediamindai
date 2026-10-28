import re
from contextlib import asynccontextmanager
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException

from app.api.v1 import router as api_v1_router
from app.api.v1.hub_admin import router as hub_admin_router
from app.core.config import get_settings
from app.core.errors import PublicError, error_response
from app.db.session import database_available, engine
from app.observability.context import correlation_id_var
from app.observability.logging import configure_logging
from app.security.http import apply_security_headers, csrf_violation

SAFE_CORRELATION_ID = re.compile(r"[A-Za-z0-9._-]{1,128}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    logger = configure_logging()

    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # A tela mostra onde a exportação foi salva (Acervo e pasta de destino).
        expose_headers=["Content-Disposition", "X-MediaMind-Asset-Id", "X-MediaMind-Export-Path"],
    )

    app.include_router(api_v1_router)
    app.include_router(hub_admin_router)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        received = request.headers.get("X-Correlation-ID", "")
        request.state.correlation_id = (
            received if SAFE_CORRELATION_ID.fullmatch(received) else str(uuid4())
        )
        request.state.request_id = str(uuid4())
        # Audit rows read the correlation id without receiving the Request (MM-008).
        correlation_token = correlation_id_var.set(request.state.correlation_id)
        start = perf_counter()
        context = {
            "correlation_id": request.state.correlation_id,
            "request_id": request.state.request_id,
        }
        try:
            if csrf_violation(request, settings):
                response = error_response(
                    request,
                    403,
                    "CSRF_ORIGIN_REJECTED",
                    "Origem da requisição não autorizada.",
                )
            else:
                response = await call_next(request)
        except Exception as exc:
            response = error_response(
                request, 500, "INTERNAL_ERROR", "Ocorreu um erro interno.", retryable=False
            )
            # Never log exception messages, input bodies, query strings or credentials.
            logger.error(
                "request_failed",
                extra={
                    **context,
                    "exception_type": type(exc).__name__,
                    "public_reference": request.state.public_reference,
                },
            )
        finally:
            correlation_id_var.reset(correlation_token)
        response.headers["X-Correlation-ID"] = request.state.correlation_id
        response.headers["X-Request-ID"] = request.state.request_id
        apply_security_headers(response, settings)
        route = request.scope.get("route")
        logger.info(
            "request_completed",
            extra={
                **context,
                "method": request.method,
                "route": getattr(route, "path", "unmatched"),
                "status_code": response.status_code,
                "public_reference": getattr(request.state, "public_reference", None),
                "duration_ms": round((perf_counter() - start) * 1000, 2),
            },
        )
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return error_response(
            request,
            exc.status_code,
            f"HTTP_{exc.status_code}",
            "Requisição não permitida ou recurso indisponível.",
            headers=exc.headers,
        )

    @app.exception_handler(PublicError)
    async def public_error(request: Request, exc: PublicError):
        return error_response(
            request,
            exc.status,
            exc.code,
            exc.message,
            retryable=exc.retryable,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return error_response(request, 422, "VALIDATION_ERROR", "Verifique os dados enviados.")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": settings.app_name}

    @app.get("/version")
    def version():
        return {"service": settings.app_name, "version": settings.version, "api_version": "v1"}

    @app.get("/ready")
    def ready(request: Request):
        if not database_available():
            return error_response(
                request, 503, "DATABASE_UNAVAILABLE", "Banco de dados indisponível.", retryable=True
            )
        return {"status": "ready", "service": settings.app_name, "database": "ok"}

    if settings.frontend_dist is not None:
        serve_frontend(app, settings.frontend_dist)
    return app


def serve_frontend(app: FastAPI, dist: Path) -> None:
    """Serve a tela compilada (Vite build) na mesma origem da API.

    Arquivo existente em ``dist`` é entregue como está (``assets/`` com cache longo, pois o
    nome muda a cada build); qualquer outra rota da tela recebe ``index.html`` (rotas do React
    Router). Caminhos de API desconhecidos continuam respondendo 404 em JSON.
    """
    root = dist.resolve()
    index = root / "index.html"
    if not index.is_file():
        raise RuntimeError(f"FRONTEND_DIST não tem index.html: {root} (rode npm run build)")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path == "api" or path.startswith("api/"):
            raise PublicError(404, "NOT_FOUND", "Recurso não encontrado.")
        candidate = (root / path).resolve()
        if path and root in candidate.parents and candidate.is_file():
            cache = (
                "public, max-age=31536000, immutable" if path.startswith("assets/") else "no-cache"
            )
            return FileResponse(candidate, headers={"Cache-Control": cache})
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


app = create_app()
