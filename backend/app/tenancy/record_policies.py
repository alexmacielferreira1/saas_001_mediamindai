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
    "ClipCandidate": "clips.write",
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
