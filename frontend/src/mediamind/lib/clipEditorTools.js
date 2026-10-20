// Ferramentas de edição do editor de cortes do ClipsFree (atalhos, quadros,
// zoom da timeline, ímã, forma de onda e histórico de legendas).
// Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md
// Referências: apps/web/src/actions/definitions.ts (atalhos padrão),
// timeline/snapping/resolve.ts (ímã) e media/waveform-summary.ts (picos de áudio).

// A taxa de quadros real da mídia não é exposta pelo <video>; 30 fps é a mesma
// referência usada na exportação FCPXML do ClipsFree.
export const DEFAULT_FPS = 30;

export function frameMs(fps = DEFAULT_FPS) {
  const rate = Number(fps) > 0 ? Number(fps) : DEFAULT_FPS;
  return 1000 / rate;
}

// Avança/volta N quadros alinhando o resultado à grade de quadros.
export function stepFrames(timeMs, frames, { fps = DEFAULT_FPS, maxMs = Infinity } = {}) {
  const size = frameMs(fps);
  const current = Math.round((Number(timeMs) || 0) / size);
  const next = (current + frames) * size;
  return Math.max(0, Math.min(Number.isFinite(maxMs) && maxMs > 0 ? maxMs : Infinity, next));
}

export const EDITOR_SHORTCUTS = [
  { action: 'toggle-play', keys: ['Espaço', 'K'], label: 'Reproduzir / pausar' },
  { action: 'seek-backward', keys: ['J'], label: 'Voltar 1 segundo' },
  { action: 'seek-forward', keys: ['L'], label: 'Avançar 1 segundo' },
  { action: 'frame-step-backward', keys: ['←'], label: `Voltar 1 quadro (${DEFAULT_FPS} fps)` },
  { action: 'frame-step-forward', keys: ['→'], label: `Avançar 1 quadro (${DEFAULT_FPS} fps)` },
  { action: 'jump-backward', keys: ['Shift + ←'], label: 'Voltar 5 segundos' },
  { action: 'jump-forward', keys: ['Shift + →'], label: 'Avançar 5 segundos' },
  { action: 'goto-in', keys: ['Home'], label: 'Ir para o IN' },
  { action: 'goto-out', keys: ['End'], label: 'Ir para o OUT' },
  { action: 'mark-in', keys: ['I'], label: 'Marcar IN no cursor' },
  { action: 'mark-out', keys: ['O'], label: 'Marcar OUT no cursor' },
  { action: 'split', keys: ['S'], label: 'Dividir a legenda no cursor' },
  { action: 'delete', keys: ['Delete', 'Backspace'], label: 'Remover a legenda no cursor (só o texto)' },
  { action: 'undo', keys: ['Ctrl + Z'], label: 'Desfazer edição de legendas' },
  { action: 'redo', keys: ['Ctrl + Shift + Z', 'Ctrl + Y'], label: 'Refazer edição de legendas' },
];

export function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tag = String(target.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target.isContentEditable);
}

// Converte um evento de teclado na ação do player (sem modificadores, exceto Shift nas setas).
export function resolvePlayerKey(event) {
  if (!event || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isEditableTarget(event.target)) return null;
  const key = String(event.key || '');
  const tag = String(event.target?.tagName || '').toUpperCase();
  if (key === ' ' || key === 'Spacebar') return tag === 'BUTTON' ? null : 'toggle-play';
  if (key === 'ArrowLeft') return event.shiftKey ? 'jump-backward' : 'frame-step-backward';
  if (key === 'ArrowRight') return event.shiftKey ? 'jump-forward' : 'frame-step-forward';
  if (event.shiftKey) return null;
  const map = { k: 'toggle-play', j: 'seek-backward', l: 'seek-forward', i: 'mark-in', o: 'mark-out', s: 'split', home: 'goto-in', end: 'goto-out', delete: 'delete', backspace: 'delete' };
  return map[key.toLowerCase()] || null;
}

export function resolveHistoryKey(event) {
  if (!event || event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey) return null;
  if (isEditableTarget(event.target)) return null;
  const key = String(event.key || '').toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
  return null;
}

// Ímã: retorna o ponto mais próximo dentro da distância máxima.
export function resolveSnap(targetMs, points = [], maxDistanceMs = 0) {
  let snapped = targetMs;
  let closest = Infinity;
  for (const point of points) {
    const value = Number(point);
    if (!Number.isFinite(value)) continue;
    const distance = Math.abs(targetMs - value);
    if (distance <= maxDistanceMs && distance < closest) { closest = distance; snapped = value; }
  }
  return { time: snapped, snapped: closest !== Infinity };
}

// Converte um limite em pixels (como no OpenCut) para milissegundos da janela visível.
export function snapThresholdMs(spanMs, widthPx, thresholdPx = 10) {
  return (Math.max(0, spanMs) / Math.max(1, widthPx)) * thresholdPx;
}

// Encaixa início/fim de cada legenda no limite de palavra mais próximo.
export function snapCaptionsToWords(captions = [], words = [], maxDistanceMs = 400) {
  const starts = words.map((word) => word.start_ms);
  const ends = words.map((word) => word.end_ms);
  let changed = 0;
  const result = captions.map((caption) => {
    const ownStarts = (caption.palavras || []).map((word) => word.start_ms);
    const ownEnds = (caption.palavras || []).map((word) => word.end_ms);
    const start = resolveSnap(caption.start_ms, [...starts, ...ownStarts], maxDistanceMs).time;
    const end = resolveSnap(caption.end_ms, [...ends, ...ownEnds], maxDistanceMs).time;
    if (end <= start || (start === caption.start_ms && end === caption.end_ms)) return caption;
    changed += 1;
    return { ...caption, start_ms: start, end_ms: end };
  });
  return { captions: result, changed };
}

// Zoom da timeline: janela visível [start, end] dentro de [0, total].
export const MIN_VIEW_SPAN_MS = 500;

export function clampView(view, totalMs) {
  const total = Math.max(1, Number(totalMs) || 1);
  const span = Math.min(total, Math.max(Math.min(MIN_VIEW_SPAN_MS, total), (view?.end ?? total) - (view?.start ?? 0)));
  const start = Math.max(0, Math.min(total - span, view?.start ?? 0));
  return { start, end: start + span };
}

export function zoomView(view, factor, totalMs, centerMs) {
  const current = clampView(view, totalMs);
  const span = (current.end - current.start) / factor;
  const center = Number.isFinite(centerMs) ? centerMs : (current.start + current.end) / 2;
  return clampView({ start: center - span / 2, end: center + span / 2 }, totalMs);
}

export function fitView(inMs, outMs, totalMs) {
  if (!(outMs > inMs)) return clampView(null, totalMs);
  const pad = (outMs - inMs) * 0.05;
  return clampView({ start: inMs - pad, end: outMs + pad }, totalMs);
}

export function isFullView(view, totalMs) {
  const current = clampView(view, totalMs);
  return current.start <= 0 && current.end >= Math.max(1, Number(totalMs) || 1);
}

// Picos por bloco a partir dos canais decodificados (valores 0..1).
export function computePeaks(channels = [], bucketCount = 1000) {
  const length = Math.max(0, ...channels.map((data) => data?.length || 0));
  const count = Math.max(1, Math.min(Math.floor(bucketCount), length || 1));
  const size = Math.max(1, Math.ceil(length / count));
  const peaks = new Array(count).fill(0);
  for (let bucket = 0; bucket < count; bucket += 1) {
    const from = bucket * size;
    const to = Math.min(length, from + size);
    let peak = 0;
    for (const data of channels) {
      for (let index = from; index < to; index += 1) {
        const value = Math.abs(data[index] ?? 0);
        if (value > peak) peak = value;
      }
    }
    peaks[bucket] = Math.min(1, peak);
  }
  return peaks;
}

// Fatia de picos correspondente à janela visível.
export function peaksInView(peaks = [], durationMs = 0, view = null) {
  if (!peaks.length || !(durationMs > 0)) return [];
  const start = Math.max(0, Math.floor(((view?.start ?? 0) / durationMs) * peaks.length));
  const end = Math.min(peaks.length, Math.ceil(((view?.end ?? durationMs) / durationMs) * peaks.length));
  return peaks.slice(start, Math.max(start + 1, end));
}

// Histórico de desfazer/refazer (imutável).
export const HISTORY_LIMIT = 100;

export function emptyHistory() {
  return { past: [], future: [], lastAt: 0 };
}

// Registra o estado anterior; mudanças muito próximas (digitação) viram um só passo.
export function recordHistory(history, previous, { now = Date.now(), coalesceMs = 700 } = {}) {
  const base = history || emptyHistory();
  if (base.past.length && now - base.lastAt < coalesceMs) return { ...base, future: [], lastAt: now };
  // Comandos (coalesceMs 0) não agrupam com a próxima digitação.
  return { past: [...base.past, previous].slice(-HISTORY_LIMIT), future: [], lastAt: coalesceMs > 0 ? now : 0 };
}

export function undoHistory(history, current) {
  if (!history?.past.length) return null;
  const value = history.past[history.past.length - 1];
  return { value, history: { past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, HISTORY_LIMIT), lastAt: 0 } };
}

export function redoHistory(history, current) {
  if (!history?.future.length) return null;
  const [value, ...future] = history.future;
  return { value, history: { past: [...history.past, current].slice(-HISTORY_LIMIT), future, lastAt: 0 } };
}

export function captionAt(captions = [], timeMs = 0) {
  return captions.find((caption) => timeMs >= caption.start_ms && timeMs < caption.end_ms) || null;
}
