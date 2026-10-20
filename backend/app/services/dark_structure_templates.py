"""Modelos prontos de estrutura para Canais Dark.

Cada modelo é um pacote no mesmo formato aceito pela importação
(``mediamind.dark-structure/v1``). Para oferecer um novo modelo basta
acrescentar um ``DarkStructureTemplate`` em ``TEMPLATES``; as rotas leem este
registro e não precisam ser alteradas.
"""

from copy import deepcopy
from dataclasses import dataclass, field

STRUCTURE_SCHEMA = "mediamind.dark-structure/v1"
DEFAULT_TEMPLATE_ID = "padrao"


@dataclass(frozen=True)
class DarkStructureTemplate:
    id: str
    name: str
    description: str
    languages: tuple[dict, ...]
    niches: tuple[dict, ...]
    decisions: tuple[dict, ...] = field(default_factory=tuple)
    channels: tuple[dict, ...] = field(default_factory=tuple)

    def package(self) -> dict:
        return {
            "schema": STRUCTURE_SCHEMA,
            "template_id": self.id,
            "name": self.name,
            "languages": deepcopy(list(self.languages)),
            "niches": deepcopy(list(self.niches)),
            "decisions": deepcopy(list(self.decisions)),
            "channels": deepcopy(list(self.channels)),
        }

    def summary(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "languages_count": len(self.languages),
            "niches_count": len(self.niches),
            "decisions_count": len(self.decisions),
            "channels_count": len(self.channels),
        }


def _language(code: str, name: str, regional_frame: str = "", notes: str = "") -> dict:
    return {
        "code": code,
        "name": name,
        "regional_frame": regional_frame,
        "notes": notes,
        "launch_wave": None,
        "enabled": True,
    }


def _decision(
    decision_id: str,
    title: str,
    question: str,
    options: list[str],
    recommendation: str = "",
    scope: str = "geral",
    ref: str = "",
) -> dict:
    return {
        "id": decision_id,
        "title": title,
        "question": question,
        "options": options,
        "recommendation": recommendation,
        "scope": scope,
        "ref": ref,
        "status": "pendente",
        "answer": "",
        "notes": "",
        "decided_at": None,
    }


# Decisões que qualquer empresa precisa tomar antes de lançar canais dark.
_GENERIC_DECISIONS = (
    _decision(
        "marca-guarda-chuva",
        "Marca guarda-chuva",
        "Os canais devem exibir uma marca comum visível ao público?",
        ["Não mostrar marca comum", "Marca comum discreta", "Marca comum forte"],
        "Não mostrar marca comum: cada canal cresce com identidade própria.",
    ),
    _decision(
        "plataformas-iniciais",
        "Plataformas iniciais",
        "Em quais plataformas os canais começam a publicar?",
        ["YouTube", "YouTube + TikTok", "Todas"],
        "Começar pelo YouTube e expandir depois de validar o formato.",
    ),
    _decision(
        "fornecedor-voz",
        "Fornecedor de voz",
        "Qual serviço gera a narração dos vídeos?",
        ["ElevenLabs", "Fish Audio", "Google Cloud TTS", "Outro"],
    ),
    _decision(
        "fornecedor-visual",
        "Fornecedor visual",
        "Como as imagens e cenas dos vídeos serão produzidas?",
        ["Imagem IA + movimento", "Vídeo IA (Runway/Kling)", "Banco de vídeo licenciado"],
    ),
    _decision(
        "armazenamento-midia",
        "Armazenamento de mídia",
        "Onde ficam guardados os arquivos de produção e os vídeos finais?",
        ["Local", "Google Drive", "Storage do MediaMind"],
    ),
    _decision(
        "cadencia-inicial",
        "Cadência inicial",
        "Com que frequência cada canal publica no início?",
        ["3/semana", "5/semana", "1/dia"],
    ),
    _decision(
        "revisao-humana",
        "Revisão humana",
        "Quanto dos vídeos passa por revisão humana antes de publicar?",
        ["Todo vídeo", "Amostragem", "Só no lançamento"],
        "Todo vídeo no início, até o processo ficar estável.",
    ),
    _decision(
        "declaracao-ia",
        "Declaração de uso de IA",
        "Como declarar o uso de conteúdo gerado por IA nas plataformas?",
        ["Sempre declarar quando aplicável"],
        "Sempre declarar quando aplicável, conforme as regras de cada plataforma.",
    ),
)


def _niche(code: str, name: str, subniches: list[str], priority: int, notes: str = "") -> dict:
    return {
        "code": code,
        "name": name,
        "subniches": subniches,
        "status": "",
        "priority": priority,
        "notes": notes,
    }


_PADRAO = DarkStructureTemplate(
    id=DEFAULT_TEMPLATE_ID,
    name="Estrutura padrão MediaMind",
    description=(
        "Nichos e idiomas mais comuns para canais dark. Ponto de partida genérico, "
        "sem canais cadastrados."
    ),
    languages=(
        _language("pt-BR", "Português (Brasil)"),
        _language("en-US", "Inglês (EUA)"),
        _language("es-419", "Espanhol (América Latina)"),
        _language("fr-FR", "Francês"),
        _language("de-DE", "Alemão"),
        _language("it-IT", "Italiano"),
        _language("ja-JP", "Japonês"),
        _language("ko-KR", "Coreano"),
        _language("hi-IN", "Hindi"),
        _language("id-ID", "Indonésio"),
        _language("ar", "Árabe"),
    ),
    niches=(
        _niche(
            "REL",
            "Religioso / Espiritualidade",
            ["versículos", "histórias bíblicas", "orações", "reflexões"],
            1,
        ),
        _niche(
            "CUR",
            "Curiosidades e Ciência",
            ["fatos curiosos", "espaço", "natureza", "corpo humano"],
            2,
        ),
        _niche(
            "MOT",
            "Motivacional e Filosofia",
            ["frases", "estoicismo", "disciplina", "mentalidade"],
            3,
        ),
        _niche(
            "HIS",
            "Histórias",
            ["história antiga", "biografias", "lendas", "guerras"],
            4,
        ),
        _niche(
            "MIS",
            "Mistério e Terror",
            ["casos reais", "lendas urbanas", "sobrenatural", "enigmas"],
            5,
        ),
        _niche(
            "EDU",
            "Educação e Tutoriais",
            ["idiomas", "passo a passo", "explicações", "estudos"],
            6,
        ),
        _niche(
            "ESP",
            "Esportes",
            ["futebol", "lances históricos", "atletas", "curiosidades esportivas"],
            7,
        ),
        _niche(
            "HUM",
            "Humor e Entretenimento",
            ["compilações", "reações", "cultura pop", "desafios"],
            8,
        ),
        _niche(
            "DIY",
            "DIY e Satisfatórios",
            ["artesanato", "restauração", "limpeza", "satisfatórios"],
            9,
        ),
        _niche(
            "FIN",
            "Finanças e Negócios",
            ["educação financeira", "investimentos", "empreendedorismo", "economia"],
            10,
        ),
        _niche(
            "SAU",
            "Saúde e Bem-estar",
            ["sono", "meditação", "alimentação", "exercícios"],
            11,
        ),
        _niche(
            "TEC",
            "Tecnologia e IA",
            ["inteligência artificial", "gadgets", "aplicativos", "futuro"],
            12,
        ),
    ),
    decisions=_GENERIC_DECISIONS,
)

_RELIGIOSO_MULTILINGUE = DarkStructureTemplate(
    id="religioso-multilingue",
    name="Religioso multilíngue",
    description=(
        "Nicho religioso/bíblico com quatro subnichos e doze idiomas, com enquadramento "
        "regional por idioma. Sem canais cadastrados."
    ),
    languages=(
        _language("pt-BR", "Português (Brasil)", "aberto"),
        _language("en-US", "Inglês (EUA)", "aberto"),
        _language("es-419", "Espanhol (América Latina)", "aberto"),
        _language("fr-FR", "Francês", "aberto"),
        _language("fil", "Filipino", "aberto"),
        _language("ko-KR", "Coreano", "aberto"),
        _language("sw", "Suaíli", "aberto"),
        _language("de-DE", "Alemão", "aberto"),
        _language("it-IT", "Italiano", "aberto"),
        _language("ru-RU", "Russo", "aberto"),
        _language(
            "id-ID",
            "Indonésio",
            "sabedoria_compartilhada",
            "Priorizar sabedoria e valores compartilhados entre tradições.",
        ),
        _language(
            "ar",
            "Árabe",
            "aberto_curado",
            "Conteúdo aberto com curadoria cuidadosa de temas e linguagem.",
        ),
    ),
    niches=(
        _niche(
            "REL",
            "Religioso / Bíblico",
            ["versos", "historias", "jesus", "sabedoria"],
            1,
        ),
    ),
    decisions=(
        *_GENERIC_DECISIONS,
        _decision(
            "fonte-biblica-por-idioma",
            "Fonte bíblica por idioma",
            "Qual tradução da Bíblia cada idioma usa nas citações?",
            [
                "Tradução de domínio público em cada idioma",
                "Tradução licenciada (com autorização)",
                "Paráfrase própria sem citar tradução protegida",
            ],
            "Tradução de domínio público em cada idioma, evitando versões protegidas "
            "por direitos autorais.",
            scope="idioma",
        ),
        _decision(
            "enquadramento-regional",
            "Enquadramento regional",
            "Como adaptar a abordagem religiosa a cada região/idioma?",
            ["aberto", "aberto_curado", "sabedoria_compartilhada"],
            "Usar o enquadramento sugerido em cada idioma e revisar com público local.",
            scope="idioma",
        ),
    ),
)

TEMPLATES: dict[str, DarkStructureTemplate] = {
    template.id: template for template in (_PADRAO, _RELIGIOSO_MULTILINGUE)
}


def list_templates() -> list[dict]:
    return [template.summary() for template in TEMPLATES.values()]


def get_template_package(template_id: str) -> dict | None:
    template = TEMPLATES.get(template_id)
    return template.package() if template else None
