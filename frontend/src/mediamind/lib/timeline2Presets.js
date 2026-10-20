/** Text style presets for the Elements panel (applied as real text clip properties). */
export const TIMELINE2_TEXT_PRESETS = [
  { id: 'title', label: 'Título', text: 'Título principal', properties: { fontSize: 72, fontWeight: 800, color: '#ffffff', shadowBlur: 12, shadowColor: '#000000', y: -40 } },
  { id: 'subtitle', label: 'Subtítulo', text: 'Subtítulo', properties: { fontSize: 40, fontWeight: 600, color: '#e2e8f0', y: 40 } },
  { id: 'lower-third', label: 'Tarja (lower third)', text: 'Nome · Cargo', properties: { fontSize: 32, fontWeight: 700, color: '#ffffff', backgroundColor: '#0369a1', backgroundRadius: 6, x: -160, y: 150 } },
  { id: 'highlight', label: 'Destaque', text: 'AO VIVO', properties: { fontSize: 44, fontWeight: 900, color: '#0f172a', backgroundColor: '#facc15', backgroundRadius: 8, y: -150, x: 220 } },
  { id: 'outline', label: 'Contorno', text: 'IMPACTO', properties: { fontSize: 80, fontWeight: 900, color: '#ffffff', outlineWidth: 3, outlineColor: '#0f172a' } },
];

/** Stickers are emoji text elements: real, editable and visible in the preview. */
export const TIMELINE2_STICKERS = ['⭐', '🔥', '❤️', '👍', '😂', '🎉', '⚠️', '✅', '❌', '📍', '🎬', '🎵', '💡', '👉', '📢', '🏆'];

export const TIMELINE2_FILTER_PRESETS = [
  { id: 'none', label: 'Sem filtro', properties: { brightness: 100, contrast: 100, saturation: 100, blur: 0 } },
  { id: 'mono', label: 'Preto e branco', properties: { saturation: 0 } },
  { id: 'vivid', label: 'Cores vivas', properties: { saturation: 150, contrast: 110 } },
  { id: 'contrast', label: 'Contraste alto', properties: { contrast: 140 } },
  { id: 'bright', label: 'Mais claro', properties: { brightness: 125 } },
  { id: 'dark', label: 'Noturno', properties: { brightness: 75, saturation: 80 } },
  { id: 'blur', label: 'Desfoque', properties: { blur: 6 } },
];

/** Picture-in-picture corners: scale 35% and offset relative to the preview size. */
export function getPipPlacement(corner, previewWidth, previewHeight, scale = 35) {
  const width = Math.max(1, Number(previewWidth) || 0);
  const height = Math.max(1, Number(previewHeight) || 0);
  const factor = scale / 100;
  const margin = 16;
  const x = Math.round((width / 2) - ((width * factor) / 2) - margin);
  const y = Math.round((height / 2) - ((height * factor) / 2) - margin);
  const signs = { 'top-left': [-1, -1], 'top-right': [1, -1], 'bottom-left': [-1, 1], 'bottom-right': [1, 1] }[corner] || [1, 1];
  return { scale, x: signs[0] * x, y: signs[1] * y };
}
