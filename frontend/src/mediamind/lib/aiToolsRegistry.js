export const AI_TOOLS = [
  { id: 'thumbnails', label: 'Thumbnails IA', description: 'Crie capas em formatos horizontal e vertical.', status: 'available', href: '/ferramentas-ia?tool=thumbnails' },
  { id: 'thumbnail-variants', label: 'Thumbs · 3 variações', description: 'Crie três direções visuais alternativas.', status: 'available', href: '/ferramentas-ia?tool=thumbnail-variants' },
  { id: 'carousel', label: 'Carrossel IA', description: 'Transforme pautas em slides editáveis e exportáveis.', status: 'available' },
  { id: 'frames', label: 'Bordas/Molduras', description: 'Aplique identidade visual em lotes de vídeos.', status: 'planned' },
  { id: 'auto-clips', label: 'Cortes Automáticos', description: 'Encontre e revise trechos relevantes da transcrição.', status: 'integrated' },
  { id: 'video-studio', label: 'Vídeo Studio', description: 'Monte cenas do roteiro na Timeline.', status: 'integrated' },
  { id: 'speech-montage', label: 'Montagem por Falas', description: 'Selecione falas e crie uma sequência editorial.', status: 'integrated' },
  { id: 'sales-videos', label: 'Vídeos de Vendas', description: 'Produza chamadas promocionais com revisão factual.', status: 'available' },
  { id: 'affiliate-videos', label: 'Vídeos Afiliados', description: 'Crie variações verticais a partir de briefing.', status: 'available' },
  { id: 'trend-radar', label: 'Radar de Tendências', description: 'Organize referências com fontes e datas.', status: 'planned' },
  { id: 'animated-videos', label: 'Vídeos Animados', description: 'Mapeie falas para cenas e animações.', status: 'available' },
  { id: 'voice-studio', label: 'Estúdio de Narração', description: 'Revise o texto e escute vozes do navegador.', status: 'available' },
  { id: 'channel-studio', label: 'Vídeos para Canais', description: 'Organize briefing, roteiro e storyboard.', status: 'available' },
  { id: 'ai-dubbing', label: 'Dublagem IA', description: 'Traduza, revise e gere faixas de voz.', status: 'planned' },
];

export function getAITool(id) {
  return AI_TOOLS.find((tool) => tool.id === id) || AI_TOOLS[0];
}

