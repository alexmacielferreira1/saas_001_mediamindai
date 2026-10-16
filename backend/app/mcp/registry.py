from typing import Any

MODULES = [
    {
        "id": "system",
        "label": "Sistema",
        "description": "Descoberta, saúde e permissões do MCP.",
        "status": "connected",
    },
    {
        "id": "mmfilm",
        "label": "MMFilm",
        "description": "Timeline, clipes, legendas e exportação.",
        "status": "connected",
    },
    {
        "id": "mmeffects",
        "label": "MMEffects",
        "description": "Composições, camadas, efeitos e renderização.",
        "status": "planned",
    },
    {
        "id": "vetor",
        "label": "MMVector",
        "description": "Pranchetas, camadas vetoriais e exportações.",
        "status": "planned",
    },
    {
        "id": "mmphoto",
        "label": "MMPhoto",
        "description": "Imagens, máscaras, ajustes e versões.",
        "status": "planned",
    },
    {
        "id": "mmsom",
        "label": "MMSom",
        "description": "Faixas, voz, mixagem e masterização.",
        "status": "planned",
    },
    {
        "id": "word",
        "label": "Word",
        "description": "Documentos, texto e revisão.",
        "status": "planned",
    },
    {
        "id": "excel",
        "label": "Excel",
        "description": "Planilhas, fórmulas e dados.",
        "status": "planned",
    },
    {
        "id": "powerpoint",
        "label": "PowerPoint",
        "description": "Apresentações, slides e layouts.",
        "status": "planned",
    },
    {
        "id": "ai-tools",
        "label": "Ferramentas IA",
        "description": "Provedores, geração e automações autorizadas.",
        "status": "connected",
    },
]

READ_OPERATIONS = {
    "mmfilm": [
        (
            "inspect",
            "Inspecionar projeto",
            "Lê sequência, trilhas, clipes, marcadores e pontos IN/OUT.",
        ),
        ("timeline", "Ler timeline", "Resume faixas e itens da timeline ativa."),
        (
            "export_profiles",
            "Consultar perfis de exportação",
            "Lista formatos e destinos permitidos.",
        ),
    ],
    "mmeffects": [
        ("inspect", "Inspecionar composição", "Lê composição, camadas, keyframes e efeitos."),
        ("render_queue", "Consultar fila de render", "Lê jobs e estados da fila de renderização."),
        (
            "effect_catalog",
            "Consultar catálogo de efeitos",
            "Lista efeitos e parâmetros disponíveis.",
        ),
    ],
    "vetor": [
        (
            "inspect",
            "Inspecionar documento vetorial",
            "Lê pranchetas, camadas, formas e exportações.",
        ),
        ("artboards", "Consultar pranchetas", "Resume tamanhos, ordem e conteúdo das pranchetas."),
        ("export_profiles", "Consultar perfis SVG/PDF", "Lista perfis vetoriais permitidos."),
    ],
    "mmphoto": [
        ("inspect", "Inspecionar imagem", "Lê dimensões, camadas, máscaras, ajustes e versões."),
        ("layers", "Consultar camadas", "Resume a pilha de camadas e visibilidade."),
        ("adjustments", "Consultar ajustes", "Lista ajustes não destrutivos aplicados."),
    ],
    "mmsom": [
        ("inspect", "Inspecionar sessão de áudio", "Lê faixas, duração, mixagem e marcadores."),
        ("loudness", "Consultar loudness", "Lê métricas de loudness e picos da sessão."),
        ("transcript", "Consultar transcrição", "Lê disponibilidade e segmentos de transcrição."),
    ],
    "word": [
        ("inspect", "Inspecionar documento", "Lê estrutura, texto e estado de salvamento."),
        ("outline", "Consultar estrutura", "Resume páginas, títulos e seções."),
        ("export_profiles", "Consultar formatos de saída", "Lista DOCX e PDF autorizados."),
    ],
    "excel": [
        ("inspect", "Inspecionar planilha", "Lê abas, células e estado de salvamento."),
        ("outline", "Consultar estrutura", "Resume abas, intervalos e tabelas."),
        ("export_profiles", "Consultar formatos de saída", "Lista XLSX e CSV autorizados."),
    ],
    "powerpoint": [
        ("inspect", "Inspecionar apresentação", "Lê slides, layouts e estado de salvamento."),
        ("outline", "Consultar estrutura", "Resume slides e seções."),
        ("export_profiles", "Consultar formatos de saída", "Lista PPTX e PDF autorizados."),
    ],
    "ai-tools": [
        (
            "inspect",
            "Inspecionar ferramenta IA",
            "Lê provedores, modelos e disponibilidade da empresa.",
        ),
        (
            "providers",
            "Consultar provedores",
            "Lista provedores e conexões configuradas sem expor segredos.",
        ),
        ("presets", "Consultar presets", "Lista modelos e automações disponíveis para a sessão."),
    ],
}

WRITE_OPERATIONS = {
    "mmfilm": ["Montar sequência", "Aplicar corte", "Gerar legendas", "Exportar versão"],
    "mmeffects": ["Criar composição", "Aplicar efeito", "Enfileirar renderização"],
    "vetor": ["Criar prancheta", "Alterar vetor", "Exportar arte"],
    "mmphoto": ["Aplicar ajuste", "Remover fundo", "Exportar imagem"],
    "mmsom": ["Limpar áudio", "Normalizar loudness", "Exportar master"],
    "word": ["Criar documento", "Alterar conteúdo", "Exportar arquivo"],
    "excel": ["Criar planilha", "Alterar dados", "Exportar arquivo"],
    "powerpoint": ["Criar apresentação", "Alterar slides", "Exportar arquivo"],
    "ai-tools": ["Gerar mídia", "Executar automação", "Aplicar sugestão"],
}

TOOLS = [
    {
        "name": "system.capabilities",
        "module": "system",
        "title": "Descobrir capacidades",
        "description": "Lista módulos e operações disponíveis para a sessão atual.",
        "effect": "read",
        "available": True,
        "requires_confirmation": False,
    },
]
TOOLS.append(
    {
        "name": "ai-tools.prompt",
        "module": "ai-tools",
        "title": "Executar prompt com IA cadastrada",
        "description": "Usa a conexão Assistente da empresa e retorna a resposta real do provedor.",
        "effect": "generate",
        "available": True,
        "requires_confirmation": False,
    }
)
TOOLS.append(
    {
        "name": "ai-tools.video_studio",
        "module": "ai-tools",
        "title": "Gerar etapa do Video Studio",
        "description": "Usa a conexão Video Studio da empresa para gerar roteiro, cenas e prompts.",
        "effect": "generate",
        "available": True,
        "requires_confirmation": False,
    }
)
for module, operations in READ_OPERATIONS.items():
    for operation, title, description in operations:
        TOOLS.append(
            {
                "name": f"{module}.{operation}",
                "module": module,
                "title": title,
                "description": description,
                "effect": "read",
                "available": module == "mmfilm" and operation in {"inspect", "timeline"},
                "requires_confirmation": False,
            }
        )
    for title in WRITE_OPERATIONS[module]:
        TOOLS.append(
            {
                "name": f"{module}.planned.{title.lower().replace(' ', '_')}",
                "module": module,
                "title": title,
                "description": (
                    "Ação planejada: exige ponte local instalada e confirmação humana "
                    "antes de alterar o projeto."
                ),
                "effect": "write",
                "available": False,
                "requires_confirmation": True,
            }
        )


def tool_by_name(name: str) -> dict[str, Any] | None:
    return next((tool for tool in TOOLS if tool["name"] == name), None)


def capability_result() -> dict[str, Any]:
    return {
        "mode": "read_and_generate",
        "connected_modules": [
            module["id"] for module in MODULES if module["status"] == "connected"
        ],
        "available_tools": [tool["name"] for tool in TOOLS if tool["available"]],
        "next_gate": "Renderização de vídeo requer um adaptador próprio do provedor",
    }


def inspection_result(tool: dict[str, Any], arguments: dict[str, Any]) -> dict[str, Any]:
    return {
        "adapter": f"mediamind-{tool['module']}-read-only",
        "operation": tool["name"],
        "mode": "read_only",
        "project_id": arguments.get("project_id"),
        "asset_id": arguments.get("asset_id"),
        "capabilities": [item[0] for item in READ_OPERATIONS.get(tool["module"], [])],
        "write_actions": WRITE_OPERATIONS.get(tool["module"], []),
        "write_gate": "Ponte local e confirmação humana obrigatórias.",
    }
