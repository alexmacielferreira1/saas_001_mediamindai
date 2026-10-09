const AI_EDITA_SOURCE = 'AI Edita Legendas Pro v2';

const preset = (id, name, category, options = {}) => ({
  id: `ai-edita-legendas-pro-v2-${id}`,
  name,
  category,
  source: AI_EDITA_SOURCE,
  fontFamily: 'Creato Display, Inter, sans-serif',
  fontSize: 48,
  fontWeight: 800,
  color: '#ffffff',
  outlineColor: '#050706',
  outlineWidth: 1.4,
  shadowColor: '#000000',
  shadowBlur: 3,
  backgroundColor: 'transparent',
  backgroundRadius: 8,
  animation: 'pulse',
  activeScale: 1.12,
  preview: name.toUpperCase(),
  ...options,
});

const AI_EDITA_PRESETS = [
  preset('foco-lima', 'Foco Lima', 'Palavra ativa', { activeColor: '#b9f443', fontSize: 53 }),
  preset('foco-amarelo', 'Foco Amarelo', 'Palavra ativa', { activeColor: '#ffe600' }),
  preset('foco-ciano', 'Foco Ciano', 'Palavra ativa', { activeColor: '#28e7ff' }),
  preset('foco-rosa', 'Foco Rosa', 'Palavra ativa', { activeColor: '#ff4fd8' }),
  preset('foco-vermelho', 'Foco Vermelho', 'Palavra ativa', { activeColor: '#ff3b30', animation: 'shake' }),
  preset('foco-laranja', 'Foco Laranja', 'Palavra ativa', { activeColor: '#ff8a00', animation: 'flash' }),
  preset('dupla-invertida', 'Dupla Invertida', 'Palavra ativa', { color: '#111111', activeColor: '#111111', inactiveColor: '#8b8b8b', outlineWidth: 0, backgroundColor: '#ffffff' }),
  preset('dupla-neon', 'Dupla Neon', 'Palavra ativa', { color: '#777777', activeColor: '#00f0ff', inactiveColor: '#737373', outlineColor: '#102a2f', shadowColor: '#00eaff', shadowBlur: 8 }),
  preset('trio-lima', 'Trio Progressivo', 'Palavra ativa', { activeColor: '#b9f443', fontSize: 44 }),
  preset('trio-colorido', 'Trio Colorido', 'Palavra ativa', { activeColor: '#ffe600', fontSize: 44 }),
  preset('karaoke-caixa', 'Karaokê em Caixa', 'Palavra ativa', { activeColor: '#b9f443', backgroundColor: '#101712', fontSize: 42 }),
  preset('karaoke-clean', 'Karaokê Clean', 'Palavra ativa', { activeColor: '#28e7ff', animation: 'reveal', fontSize: 42 }),
  preset('uma-impacto', 'Uma Palavra · Impacto', 'Uma palavra', { fontSize: 65, outlineWidth: 2.4, animation: 'impact' }),
  preset('uma-lima', 'Uma Palavra · Lima', 'Uma palavra', { fontSize: 65, color: '#b9f443', activeColor: '#b9f443', outlineWidth: 2, animation: 'impact' }),
  preset('uma-amarela', 'Uma Palavra · Amarela', 'Uma palavra', { fontSize: 60, color: '#ffe600', activeColor: '#ffe600', outlineWidth: 2.2, animation: 'impact' }),
  preset('uma-rosa', 'Uma Palavra · Rosa', 'Uma palavra', { fontSize: 65, color: '#ff4fd8', activeColor: '#ff4fd8', outlineWidth: 2, animation: 'impact' }),
  preset('uma-vermelha', 'Uma Palavra · Alerta', 'Uma palavra', { fontSize: 70, color: '#ff3b30', activeColor: '#ff3b30', outlineWidth: 2.4, animation: 'shake' }),
  preset('uma-ciano', 'Uma Palavra · Ciano', 'Uma palavra', { fontSize: 65, color: '#28e7ff', activeColor: '#28e7ff', outlineWidth: 2, animation: 'impact' }),
  preset('uma-caixa', 'Uma Palavra · Etiqueta', 'Uma palavra', { fontSize: 55, color: '#111111', activeColor: '#111111', outlineWidth: 0, backgroundColor: '#ffe600', animation: 'impact' }),
  preset('uma-sticker', 'Uma Palavra · Sticker', 'Uma palavra', { fontSize: 70, outlineColor: '#6c35ff', outlineWidth: 3.2, shadowColor: '#151515', animation: 'tilt' }),
  preset('caixa-carbono', 'Caixa Carbono', 'Caixas', { fontSize: 44, outlineWidth: 0, backgroundColor: '#111715', animation: 'slide' }),
  preset('caixa-amarela', 'Caixa Amarela', 'Caixas', { fontSize: 44, color: '#101010', activeColor: '#101010', outlineWidth: 0, backgroundColor: '#ffe600', animation: 'slide' }),
  preset('caixa-lima', 'Caixa Lima', 'Caixas', { fontSize: 46, color: '#0c1408', activeColor: '#0c1408', outlineWidth: 0, backgroundColor: '#b9f443', animation: 'slide' }),
  preset('caixa-rosa', 'Caixa Rosa', 'Caixas', { fontSize: 44, outlineWidth: 0, backgroundColor: '#d92c91', shadowColor: '#6d164f', animation: 'slide' }),
  preset('tarja-branca', 'Tarja Branca', 'Caixas', { fontSize: 42, color: '#111111', activeColor: '#111111', outlineWidth: 0, backgroundColor: '#ffffff', backgroundRadius: 2, animation: 'reveal' }),
  preset('tarja-vermelha', 'Tarja de Alerta', 'Caixas', { fontSize: 46, outlineWidth: 0, backgroundColor: '#d51d1d', backgroundRadius: 2, shadowColor: '#450000', animation: 'flash' }),
  preset('neon-ciano', 'Neon Ciano', 'Neon & impacto', { fontSize: 50, color: '#c9fbff', activeColor: '#00eaff', outlineColor: '#007985', outlineWidth: 1.5, shadowColor: '#00eaff', shadowBlur: 10 }),
  preset('neon-magenta', 'Neon Magenta', 'Neon & impacto', { fontSize: 50, color: '#ffe5fb', activeColor: '#ff38cf', outlineColor: '#7a005e', outlineWidth: 1.5, shadowColor: '#ff38cf', shadowBlur: 10 }),
  preset('contorno-branco', 'Contorno Pesado', 'Neon & impacto', { fontSize: 60, outlineColor: '#000000', outlineWidth: 3.5, shadowBlur: 5, animation: 'impact' }),
  preset('vermelho-3d', 'Vermelho 3D', 'Neon & impacto', { fontSize: 58, color: '#ff4a42', activeColor: '#ff4a42', outlineColor: '#5b0000', outlineWidth: 2.4, shadowColor: '#5b0000', shadowBlur: 8, animation: 'tilt' }),
  preset('editorial-serif', 'Editorial Serif', 'Editorial', { fontFamily: 'Georgia, serif', fontSize: 42, outlineWidth: 0, animation: 'fade' }),
  preset('editorial-clean', 'Editorial Clean', 'Editorial', { fontSize: 44, outlineWidth: 0.8, animation: 'fade' }),
];

const MEDIAMIND_PRESETS = [
  { id: 'mediamind-noticia', name: 'MediaMind Notícia', category: 'MediaMind', source: 'MediaMind AI', fontFamily: 'Inter, sans-serif', fontSize: 44, fontWeight: 800, color: '#ffffff', activeColor: '#38bdf8', outlineColor: '#07111f', outlineWidth: 2, shadowColor: '#000000', shadowBlur: 4, backgroundColor: '#07111fcc', backgroundRadius: 10, animation: 'slide', activeScale: 1.06, preview: 'NOTÍCIA AGORA' },
  { id: 'mediamind-documental', name: 'MediaMind Documental', category: 'MediaMind', source: 'MediaMind AI', fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 700, color: '#f8fafc', activeColor: '#fbbf24', outlineColor: '#020617', outlineWidth: 1, shadowColor: '#000000', shadowBlur: 6, backgroundColor: 'transparent', backgroundRadius: 8, animation: 'fade', activeScale: 1.04, preview: 'UMA HISTÓRIA REAL' },
  { id: 'mediamind-social', name: 'MediaMind Social', category: 'MediaMind', source: 'MediaMind AI', fontFamily: 'Inter, sans-serif', fontSize: 52, fontWeight: 900, color: '#ffffff', activeColor: '#c084fc', outlineColor: '#240046', outlineWidth: 3, shadowColor: '#a855f7', shadowBlur: 9, backgroundColor: 'transparent', backgroundRadius: 8, animation: 'impact', activeScale: 1.14, preview: 'PARE E ASSISTA' },
  { id: 'mediamind-acessivel', name: 'MediaMind Acessível', category: 'MediaMind', source: 'MediaMind AI', fontFamily: 'Arial, sans-serif', fontSize: 46, fontWeight: 800, color: '#ffffff', activeColor: '#ffffff', outlineColor: '#000000', outlineWidth: 2.5, shadowColor: '#000000', shadowBlur: 3, backgroundColor: '#000000e6', backgroundRadius: 6, animation: 'none', activeScale: 1, preview: 'LEGENDA LEGÍVEL' },
];

export const CAPTION_PRESETS = [...AI_EDITA_PRESETS, ...MEDIAMIND_PRESETS];

export function getCaptionPreset(id) {
  return CAPTION_PRESETS.find((item) => item.id === id) || CAPTION_PRESETS[0];
}

export function captionPresetToProperties(selectedPreset, text) {
  const selected = selectedPreset || CAPTION_PRESETS[0];
  return {
    text: String(text || '').trim(),
    caption: true,
    captionPresetId: selected.id,
    fontFamily: selected.fontFamily,
    fontSize: selected.fontSize,
    fontWeight: selected.fontWeight,
    color: selected.color,
    activeColor: selected.activeColor || selected.color,
    outlineColor: selected.outlineColor,
    outlineWidth: selected.outlineWidth,
    shadowColor: selected.shadowColor,
    shadowBlur: selected.shadowBlur,
    backgroundColor: selected.backgroundColor,
    backgroundRadius: selected.backgroundRadius,
    animation: selected.animation,
    activeScale: selected.activeScale,
    y: 34,
  };
}
