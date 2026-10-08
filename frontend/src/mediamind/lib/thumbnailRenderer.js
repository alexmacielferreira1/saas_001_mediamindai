import { DEFAULT_STYLE, PROGRAM_LOGOS, formatEpisode } from './thumbnailStudio';
import { resolveMediaUrl } from '@/api/media';

const imageCache = new Map();
let fontsPromise;
export function loadThumbnailFonts() {
  if (!document.fonts || typeof FontFace === 'undefined') return Promise.resolve();
  fontsPromise ||= Promise.all([['Anton', 'Anton.ttf'], ['Montserrat', 'Montserrat.ttf'], ['Archivo Black', 'ArchivoBlack.ttf']].map(async ([name, file]) => {
    const font = await new FontFace(name, `url(/fonts/${file})`, { weight: name === 'Montserrat' ? '600' : '400' }).load();
    document.fonts.add(font);
  }));
  return fontsPromise;
}

export function loadThumbnailImage(url) {
  if (!url) return Promise.resolve(null);
  const resolved = resolveMediaUrl(url);
  if (!imageCache.has(resolved)) imageCache.set(resolved, (async () => {
    // Load authenticated media through fetch then a local blob, preventing a tainted canvas.
    const response = await fetch(resolved, { credentials: new URL(resolved, location.href).origin === new URL(import.meta.env.VITE_API_URL || location.origin, location.href).origin ? 'include' : 'omit' });
    if (!response.ok) throw new Error('Não foi possível carregar uma imagem da composição.');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Imagem inválida ou indisponível.')); image.src = objectUrl;
      });
    } finally { URL.revokeObjectURL(objectUrl); }
  })().catch((error) => { imageCache.delete(resolved); throw error; }));
  return imageCache.get(resolved);
}

export function thumbnailLayers(draft, format) {
  const vertical = format === 'vertical';
  const people = (draft.people || []).filter((p) => p.visible && p.photo);
  const defaults = [
    { id: 'channel', label: 'Logo do canal', x: 5, y: 5, w: vertical ? 30 : 18, h: vertical ? 7 : 14, type: 'image', url: draft.channelLogo || '/brand/canal-simers-white.png' },
    { id: 'program', label: 'Logo do programa', x: vertical ? 28 : 38, y: vertical ? 12 : 5, w: vertical ? 48 : 29, h: vertical ? 9 : 18, type: 'image', url: draft.programLogo || PROGRAM_LOGOS[draft.program] || '' },
    { id: 'headline', label: 'Chamada', x: vertical ? 7 : 5, y: vertical ? 25 : 39, w: vertical ? 86 : 58, h: vertical ? 25 : 31, type: 'text' },
    { id: 'names', label: 'Entrevistados', x: vertical ? 7 : 5, y: vertical ? 50 : 71, w: vertical ? 86 : 58, h: vertical ? 8 : 12, type: 'text' },
    { id: 'meta', label: 'Programa e episódio', x: vertical ? 7 : 5, y: vertical ? 59 : 85, w: vertical ? 86 : 58, h: vertical ? 5 : 7, type: 'text' },
  ];
  const n = people.length;
  const left = vertical ? 2 : n > 1 ? 44 : 61;
  const span = vertical ? 96 : n > 1 ? 56 : 39;
  people.forEach((p, i) => defaults.push({ id: `person:${p.id}`, label: p.name || 'Pessoa', type: 'portrait', person: p, url: p.photo,
    x: left + (n > 1 ? i * span / n * 0.85 : 0), y: vertical ? 65 : n > 1 ? 36 : 21,
    w: n > 1 ? span / n * 1.3 : span, h: vertical ? 35 : n > 1 ? 64 : 79,
  }));
  return defaults.map((layer, index) => ({ ...layer, order: layer.type === 'portrait' ? index - 20 : index, rotation: 0, opacity: 1, hidden: false, locked: false, ...(draft.layouts?.[format]?.[layer.id] || {}) }));
}

export function wrapText(ctx, text, width, spacing = 0) {
  const result = [];
  for (const paragraph of String(text || '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width + candidate.length * spacing > width) { result.push(line); line = word; }
      else line = candidate;
    }
    result.push(line);
  }
  return result;
}

function drawText(ctx, layer, text, { font, size, color, accentColor, weight = '', align = 'left', lineHeight = 1.08, spacing = 0 }) {
  const { w, h } = layer;
  let lines;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    ctx.font = `${weight} ${size}px "${font}"`.trim();
    lines = wrapText(ctx, text, w, spacing);
    if (lines.length * size * lineHeight <= h && lines.every((line) => ctx.measureText(line).width + line.length * spacing <= w)) break;
    size *= 0.96;
  }
  ctx.fillStyle = color; ctx.textBaseline = 'top'; ctx.textAlign = align;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  let accent = false;
  lines.forEach((line, i) => {
    const y = i * size * lineHeight;
    if (!accentColor) { ctx.fillText(line, align === 'center' ? w / 2 : align === 'right' ? w : 0, y); return; }
    const colon = line.indexOf(':');
    const offset = align === 'center' ? (w - ctx.measureText(line).width) / 2 : align === 'right' ? w - ctx.measureText(line).width : 0;
    ctx.textAlign = 'left';
    if (colon >= 0 && !accent) {
      const first = line.slice(0, colon + 1); ctx.fillStyle = color; ctx.fillText(first, offset, y);
      ctx.fillStyle = accentColor; ctx.fillText(line.slice(colon + 1), offset + ctx.measureText(first).width, y); accent = true;
    } else { ctx.fillStyle = accent ? accentColor : color; ctx.fillText(line, offset, y); }
  });
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function drawImage(ctx, image, box, person) {
  let source = image;
  if (person?.framing !== 'full') {
    const tall = image.height / image.width > 1.15;
    const height = Math.min(image.height, image.width * 1.35, tall ? image.height * 0.58 : image.height);
    const y = Math.max(0, Math.min(image.height - height, (person?.cropY || 0) * image.height));
    const cropped = document.createElement('canvas'); cropped.width = image.width; cropped.height = height;
    cropped.getContext('2d').drawImage(image, 0, y, image.width, height, 0, 0, image.width, height); source = cropped;
  }
  const scale = Math.min(box.w / source.width, box.h / source.height) * (person?.zoom || 1);
  const w = source.width * scale; const h = source.height * scale;
  const x = (box.w - w) / 2 + (person?.offsetX || 0) * box.w / 100;
  const y = person ? box.h - h + (person?.offsetY || 0) * box.h / 100 : (box.h - h) / 2;
  if (person?.flip) { ctx.translate(box.w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, x, y, w, h);
}

function recolorLogo(image, color) {
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height); return canvas;
}

export async function renderThumbnail(canvas, draft, format, { simers = true, referenceUrl = '', cancelled = () => false } = {}) {
  await loadThumbnailFonts();
  const width = format === 'vertical' ? 1080 : 1920; const height = format === 'vertical' ? 1920 : 1080;
  const layers = thumbnailLayers(draft, format);
  const urls = [...new Set([...layers.filter((l) => !l.hidden).map((l) => l.url), !simers && referenceUrl].filter(Boolean))];
  const images = new Map(await Promise.all(urls.map(async (url) => [url, await loadThumbnailImage(url)])));
  if (cancelled()) return;
  // Render offscreen and commit atomically; a failed asset never leaves a half-painted preview.
  const buffer = document.createElement('canvas'); buffer.width = width; buffer.height = height;
  const ctx = buffer.getContext('2d'); const style = { ...DEFAULT_STYLE, ...draft.style };
  ctx.fillStyle = draft.colors.background; ctx.fillRect(0, 0, width, height);
  if (!simers && referenceUrl) ctx.drawImage(images.get(referenceUrl), 0, 0, width, height);
  if (simers) {
    ctx.save(); ctx.globalAlpha = style.waveOpacity; ctx.strokeStyle = draft.colors.text; ctx.lineWidth = 2;
    for (let i = 0; i < 16; i += 1) {
      ctx.beginPath(); ctx.moveTo(-0.08 * width, (0.44 + i * 0.016) * height);
      ctx.bezierCurveTo(width * 0.15, height * (0.12 + i * 0.012), width * 0.3, height * (0.9 - i * 0.01), width * 0.52, height * (0.48 + i * 0.012));
      ctx.bezierCurveTo(width * 0.74, height * (0.1 + i * 0.012), width * 0.85, height * (0.12 + i * 0.012), width * 1.08, height * (0.55 + i * 0.012)); ctx.stroke();
    } ctx.restore();
  }
  for (const layer of [...layers].sort((a, b) => a.order - b.order)) {
    if (layer.hidden) continue;
    const box = { x: layer.x * width / 100, y: layer.y * height / 100, w: layer.w * width / 100, h: layer.h * height / 100 };
    ctx.save(); ctx.globalAlpha = layer.opacity;
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2); ctx.rotate(layer.rotation * Math.PI / 180); ctx.translate(-box.w / 2, -box.h / 2);
    if (layer.type === 'portrait') {
      const p = layer.person;
      const filters = [];
      if (style.grayscale) filters.push('grayscale(1)');
      const outline = p.useOriginal ? 0 : style.outline;
      const outlineColor = draft.program === 'Ética na Mesa' && style.outlineColor === '#FFFFFF' ? '#C8E65B' : style.outlineColor;
      if (outline) for (const [x, y] of [[1,0],[-1,0],[0,1],[0,-1]]) filters.push(`drop-shadow(${x * outline}px ${y * outline}px 0 ${outlineColor})`);
      if (style.shadow) filters.push(`drop-shadow(${style.shadowX}px ${style.shadowY}px ${style.shadow}px rgba(0,0,0,${style.shadowOpacity}))`);
      ctx.filter = filters.join(' ') || 'none'; drawImage(ctx, images.get(layer.url), box, p);
    } else if (layer.type === 'image') {
      if (layer.url) {
        let image = images.get(layer.url);
        if (layer.id === 'channel') image = recolorLogo(image, draft.colors.text);
        if (layer.id === 'program' && !['Solidariza+', 'No Front'].includes(draft.program)) image = recolorLogo(image, draft.colors.text);
        drawImage(ctx, image, box);
      }
    } else {
      const vertical = format === 'vertical';
      const names = (draft.people || []).filter((p) => p.showName).map((p) => p.name).join(' • ');
      const text = layer.id === 'headline' ? (draft.highlight ?? draft.title ?? 'SUA CHAMADA PRINCIPAL').toUpperCase() : layer.id === 'names' ? names : [draft.program?.toUpperCase(), formatEpisode(draft.episode)].filter(Boolean).join(' • ');
      const size = layer.fontSize || width * (layer.id === 'headline' ? vertical ? 0.12 : 0.066 : layer.id === 'names' ? vertical ? 0.044 : 0.026 : vertical ? 0.028 : 0.018) * (layer.id === 'headline' ? style.fontScale : 1);
      drawText(ctx, box, text, { font: layer.font || (layer.id === 'headline' ? style.headlineFont : style.bodyFont), size, color: layer.color || draft.colors.text, accentColor: layer.id === 'headline' && !layer.color ? (['Prontuário Jurídico', 'Sala de Prescrição'].includes(draft.program) ? '#FFFFFF' : draft.colors.accent) : null, weight: layer.id === 'headline' ? '' : '600', align: layer.align || 'left', lineHeight: layer.id === 'headline' ? style.lineHeight : 1.15, spacing: style.letterSpacing });
    } ctx.restore();
  }
  if (!cancelled()) { canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(buffer, 0, 0); }
  return layers;
}
