"""Regra de etapas do fluxo de produção (``ProducaoProjeto``) validada no servidor.

Espelha ``frontend/src/mediamind/lib/productionWorkflow.js`` e os movimentos que as
telas fazem hoje (``producaoStore.js``, ``edicaoWorkflow.js``, Rascunhos, Gravações,
Edição e Aprovações). Mantenha os dois lados sincronizados.
"""

from collections.abc import Mapping
from typing import Any

from app.core.errors import PublicError

STAGE_ORDER = (
    "rascunho",
    "agendamentos",
    "gravacoes",
    "para_editar",
    "em_edicao",
    "em_aprovacao",
    "finalizado",
    "redes_sociais",
    "para_publicar",
    "publicado",
    "analytics",
)
# "aguardando_aprovacao" (fila "Alteração") fica fora da ordem linear, como no frontend.
STAGES = frozenset(STAGE_ORDER) | {"aguardando_aprovacao"}
LEGACY_ALIASES = {"aguardando": "aguardando_aprovacao", "publicacoes": "publicado"}
# Edição e revisão: as filas Para editar / Em edição / Alteração / Em revisão trocam
# projetos entre si (arrasto de fila, "Enviar para revisão", "Solicitar alteração").
EDITING_STAGES = frozenset({"para_editar", "em_edicao", "aguardando_aprovacao", "em_aprovacao"})

# Etapas em que as telas criam um projeto (``addProjeto``): Rascunhos (padrão
# "rascunho"), Agendamentos ("agendamentos"), Gravações ("gravacao", legado que resolve
# para agendamentos/gravações) e Edição ("para_editar"). Criar direto numa etapa
# posterior pularia a aprovação.
CREATION_STAGES = frozenset({"rascunho", "agendamentos", "gravacoes", "para_editar"})

ALLOWED_TRANSITIONS = frozenset(
    {pair for a, b in zip(STAGE_ORDER, STAGE_ORDER[1:], strict=False) for pair in ((a, b), (b, a))}
    | {(a, b) for a in EDITING_STAGES for b in EDITING_STAGES if a != b}
    # Ajuste/regravação pedido pela edição volta para Gravações.
    | {(stage, "gravacoes") for stage in EDITING_STAGES}
    # "Registrar gravação" direto do Rascunho.
    | {("rascunho", "gravacoes")}
)


def _resolve(stage: Any, data: Mapping[str, Any]) -> str | None:
    if stage == "gravacao":
        recorded = bool(data.get("gravada")) or data.get("grav_status") == "gravada"
        return "gravacoes" if recorded else "agendamentos"
    if not isinstance(stage, str):
        return None
    stage = LEGACY_ALIASES.get(stage, stage)
    return stage if stage in STAGES else None


def check_stage_transition(
    current: Mapping[str, Any], patch: Mapping[str, Any]
) -> tuple[Any, str] | None:
    """Valida a mudança de ``etapa``; devolve ``(de, para)`` ou ``None`` sem mudança."""
    if "etapa" not in patch:
        return None
    previous = current.get("etapa")
    target = patch["etapa"]
    if target == previous:
        return None
    resolved_target = _resolve(target, {**current, **patch})
    if resolved_target is None:
        raise PublicError(422, "PRODUCTION_STAGE_INVALID", "Etapa de produção desconhecida.")
    # Sem etapa gravada o frontend exibe o projeto como rascunho.
    resolved_previous = _resolve(previous, current) if previous else "rascunho"
    if resolved_previous is None:
        # Etapa legada sem classificação: permite reclassificar para uma etapa válida.
        return previous, target
    if resolved_previous != resolved_target and (
        (resolved_previous, resolved_target) not in ALLOWED_TRANSITIONS
    ):
        raise PublicError(
            409,
            "PRODUCTION_STAGE_TRANSITION_INVALID",
            "Mudança de etapa fora da ordem do fluxo de produção.",
        )
    return previous, target


def check_creation_stage(data: Mapping[str, Any], *, imported: bool = False) -> None:
    """Valida a ``etapa`` de um projeto novo.

    Etapa desconhecida é sempre recusada (senão a reclassificação de legado permitiria
    pular etapas depois). Na criação unitária só valem as etapas iniciais; ``imported``
    (semeadura inicial do ``producaoStore``: lote numa empresa ainda sem projetos, decidido
    pela rota) aceita qualquer etapa conhecida.
    """
    stage = data.get("etapa")
    if stage is None or stage == "":
        return
    resolved = _resolve(stage, data)
    if resolved is None:
        raise PublicError(422, "PRODUCTION_STAGE_INVALID", "Etapa de produção desconhecida.")
    if not imported and resolved not in CREATION_STAGES:
        raise PublicError(
            409,
            "PRODUCTION_STAGE_CREATE_INVALID",
            "Um projeto novo começa em Rascunho, Agendamentos, Gravações ou Para editar.",
        )
