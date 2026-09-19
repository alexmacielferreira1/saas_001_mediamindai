import re
from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException

from app.core.config import get_settings
from app.core.errors import error_response
from app.db.session import database_available, engine
from app.observability.logging import configure_logging

SAFE_CORRELATION_ID = re.compile(r"[A-Za-z0-9._-]{1,128}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    logger = configure_logging()
    app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        received = request.headers.get("X-Correlation-ID", "")
        request.state.correlation_id = (
            received if SAFE_CORRELATION_ID.fullmatch(received) else str(uuid4())
        )
        request.state.request_id = str(uuid4())
        start = perf_counter()
        context = {
            "correlation_id": request.state.correlation_id,
            "request_id": request.state.request_id,
        }
        try:
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
        response.headers["X-Correlation-ID"] = request.state.correlation_id
        response.headers["X-Request-ID"] = request.state.request_id
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

    return app


app = create_app()
