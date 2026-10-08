from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.core.errors import PublicError
from app.tenancy.context import CurrentSession, get_current_session, require_membership

router = APIRouter(prefix="/ai", tags=["ai"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]

LEGACY_AI_FUNCTIONS = {
    "analisar_clipes_ia",
    "assistente_ia",
    "configurar_acesso_ia",
    "gerar_roteiro_ia",
    "resolve_pendencias",
    "transcrever_asset",
}


@router.post("/functions/{function_name}")
def invoke_ai_function(
    function_name: str,
    payload: dict[str, Any],
    current: Authenticated,
):
    require_membership(current)
    if function_name not in LEGACY_AI_FUNCTIONS:
        raise PublicError(404, "AI_FUNCTION_NOT_FOUND", "Função de IA não reconhecida.")

    # The payload is intentionally accepted but never logged. Provider selection,
    # secrets, quotas, audit and per-function schemas are still pending.
    del payload
    raise PublicError(
        503,
        "AI_PROVIDER_NOT_CONFIGURED",
        "IA ainda não configurada neste ambiente.",
        retryable=False,
    )
