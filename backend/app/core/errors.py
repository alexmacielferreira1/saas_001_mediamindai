from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse


def error_response(
    request: Request,
    status: int,
    code: str,
    message: str,
    *,
    retryable: bool = False,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    request.state.public_reference = str(uuid4())
    return JSONResponse(
        status_code=status,
        headers=headers,
        content={
            "error_code": code,
            "message": message,
            "public_reference": request.state.public_reference,
            "correlation_id": getattr(request.state, "correlation_id", str(uuid4())),
            "retryable": retryable,
        },
    )
