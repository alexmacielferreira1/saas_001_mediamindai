PERMISSION_CATALOG = {
    "assets.write": "Criar e alterar ativos, direitos, transcrições e arquivos",
    "clips.write": "Criar e alterar cortes e versões",
    "production.write": "Criar e alterar produções, agenda, briefings e pendências",
    "publishing.write": "Programar, publicar e acompanhar distribuição",
    "review.write": "Comentar, revisar e aprovar conteúdo",
    "permissions.manage": "Gerenciar grupos e atribuições de permissões",
    "users.manage": "Gerenciar vínculos e cargos de usuários",
    "users.manage_admin": "Conceder cargos administrativos",
}

RECORD_WRITE_PERMISSIONS = {
    "AgendaEvento": "production.write",
    "AprovacaoItem": "review.write",
    "AprovacaoVersao": "review.write",
    "Asset": "assets.write",
    "BriefingProducao": "production.write",
    "Clip": "clips.write",
    "ClipAnalysis": "clips.write",
    "ClipCandidate": "clips.write",
    "ClipCaption": "clips.write",
    "ClipTranscript": "clips.write",
    "ClipVersion": "clips.write",
    "Clipping": "publishing.write",
    "ComentarioRevisao": "review.write",
    "CreativeDocument": "production.write",
    "CreativeExport": "production.write",
    "DireitoAsset": "assets.write",
    "Jornalista": "publishing.write",
    "Mencao": "publishing.write",
    "PendenciaCorp": "production.write",
    "ProcessamentoJob": "assets.write",
    "ProducaoProjeto": "production.write",
    "Person": "production.write",
    "Publicacao": "publishing.write",
    "Release": "publishing.write",
    "Script": "production.write",
    "ScriptTemplate": "production.write",
    "TranscricaoSegmento": "assets.write",
}

CONTENT_WRITE_PERMISSIONS = (
    "assets.write",
    "clips.write",
    "production.write",
    "publishing.write",
    "review.write",
)

# Campos que só o servidor grava (caminhos de arquivo, integridade e tamanho reais).
# A API genérica ``/records`` recusa criá-los ou alterá-los: as rotas especializadas
# (upload de mídia, exportação criativa) confiam nesses valores para abrir arquivos.
# Auditoria 2026-10-23, achados #1/#2 e refatoração A.
# ``Asset.file_size`` fica de fora: o cadastro legado de pacotes (IngestNewPackage) o envia
# só como metadado de exibição. ``mime_type`` vira o Content-Type do stream.
# ``CreativeDocument.approved_revision`` só é gravado pela rota de aprovação, e o vínculo da
# exportação (documento, revisão e estado) só pela rota de exportação (revisão geral
# 2026-10-24, achado 3).
SERVER_OWNED_FIELDS: dict[str, frozenset[str]] = {
    "Asset": frozenset({"storage_key", "sha256", "mime_type"}),
    "CreativeDocument": frozenset({"approved_revision"}),
    "CreativeExport": frozenset(
        {"relative_path", "sha256", "size", "status", "document_id", "revision"}
    ),
}

# Estados que não são decisão de revisão: pela API genérica, mudar ``status`` para qualquer
# outro valor exige ``review.write`` (antes bastava ``production.write`` para aprovar).
# ``draft`` é o estado gravado pelas telas de criação.
REVIEW_FREE_STATUSES: dict[str, frozenset[str]] = {
    "CreativeDocument": frozenset({"draft"}),
}


def server_owned_fields(entity_type: str) -> frozenset[str]:
    return SERVER_OWNED_FIELDS.get(entity_type, frozenset())


def requires_review_permission(entity_type: str, data: dict, current: dict | None = None) -> bool:
    """``True`` quando a alteração muda o estado de revisão para uma decisão."""
    free = REVIEW_FREE_STATUSES.get(entity_type)
    if free is None or "status" not in data:
        return False
    if current is not None and current.get("status") == data["status"]:
        return False
    return data["status"] not in free
