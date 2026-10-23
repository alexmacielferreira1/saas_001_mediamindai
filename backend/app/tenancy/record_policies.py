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
SERVER_OWNED_FIELDS: dict[str, frozenset[str]] = {
    "CreativeExport": frozenset({"relative_path", "sha256", "size"}),
}


def server_owned_fields(entity_type: str) -> frozenset[str]:
    return SERVER_OWNED_FIELDS.get(entity_type, frozenset())
