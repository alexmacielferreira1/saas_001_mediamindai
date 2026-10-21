"""Request-scoped values available to code that does not receive the ``Request``."""

from contextvars import ContextVar

correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)


def current_correlation_id() -> str | None:
    return correlation_id_var.get()
