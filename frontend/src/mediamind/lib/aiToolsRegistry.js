export const AI_TOOLS = [
  {
    id: "image-generator",
    label: "Gerador de Imagem",
    description: "Crie imagens a partir de texto e referências.",
    status: "available",
  },
  {
    id: "video-generator",
    label: "Gerador de Vídeo",
    description: "Crie vídeos com quadros de referência e controles de duração.",
    status: "available",
  },
  {
    id: "object-generator",
    label: "Objeto 3D",
    description: "Converta texto ou imagem em objetos tridimensionais.",
    status: "available",
  },
  {
    id: "world-generator",
    label: "Mundo 3D",
    description: "Descreva e prepare ambientes tridimensionais navegáveis.",
    status: "available",
  },
  {
    id: "thumbnails",
    label: "Thumbnails IA",
    description: "Crie três ideias de capa, recorte sua foto localmente e exporte para publicação.",
    status: "available",
    href: "/ferramentas-ia?tool=thumbnails",
  },
  {
    id: "carousel",
    label: "Carrossel IA",
    description: "Transforme pautas em slides editáveis e exportáveis.",
    status: "available",
  },
  {
    id: "frames",
    label: "Bordas/Molduras",
    description:
      "Prepare molduras, confira vídeos do lote e exporte quadros de prévia.",
    status: "workspace",
  },
  {
    id: "auto-clips",
    label: "Cortes Automáticos",
    description: "Encontre e revise trechos relevantes da transcrição.",
    status: "integrated",
  },
  {
    id: "video-studio",
    label: "Vídeo Studio",
    description: "Monte cenas do roteiro na Timeline.",
    status: "integrated",
  },
  {
    id: "speech-montage",
    label: "Montagem por Falas",
    description: "Selecione falas e crie uma sequência editorial.",
    status: "integrated",
  },
  {
    id: "sales-videos",
    label: "Vídeos de Vendas",
    description: "Produza chamadas promocionais com revisão factual.",
    status: "available",
  },
  {
    id: "affiliate-videos",
    label: "Vídeos Afiliados",
    description: "Crie variações verticais a partir de briefing.",
    status: "available",
  },
  {
    id: "trend-radar",
    label: "Radar de Tendências",
    description: "Organize referências com fontes e datas.",
    status: "workspace",
  },
  {
    id: "animated-videos",
    label: "Vídeos Animados",
    description: "Mapeie falas para cenas e animações.",
    status: "available",
  },
  {
    id: "voice-studio",
    label: "Estúdio de Narração",
    description: "Revise o texto e escute vozes do navegador.",
    status: "available",
  },
  {
    id: "channel-studio",
    label: "Vídeos para Canais",
    description: "Organize briefing, roteiro e storyboard.",
    status: "available",
  },
  {
    id: "ai-dubbing",
    label: "Dublagem IA",
    description:
      "Revise falas e traduções, ouça prévias e exporte legendas SRT.",
    status: "workspace",
  },
];

export function getAITool(id) {
  return AI_TOOLS.find((tool) => tool.id === id) || AI_TOOLS[0];
}
