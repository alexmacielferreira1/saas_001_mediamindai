// Catálogo de ferramentas de um clique do MMPhoto para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre o estado do documento (camadas, camada ativa, seleção, cores) e devolve:
//   - edição de camadas: { ok, summary, label, layers, activeLayer? }       → o app grava com commit (desfazer)
//   - pixels: { ok, summary, label, pixels(data, w, h) }                      → o app aplica na camada ativa, limitada à seleção
//   - documento: { ok, summary, document: { kind: "rotate"|"resize"|"crop", ... } } → recorte/tamanho/rotação reais do app
// Condições não atendidas viram { ok: false, summary } com a explicação; nada é simulado.
import {
  Archive,
  MousePointerClick,
  PaintbrushVertical,
  UserRound,
  Ban,
  Copy,
  Crosshair,
  Smartphone,
  Scale,
  SunSnow,
  Thermometer,
  WandSparkles,
  Blend,
  CircleOff,
  Cloud,
  Contrast,
  Crop,
  Droplet,
  Droplets,
  Eraser,
  Eye,
  Focus,
  Grip,
  Grid3x3,
  Layers,
  Maximize2,
  PaintBucket,
  Palette,
  RotateCw,
  Sparkles,
  Sun,
  SunDim,
  Triangle,
  Waves,
} from "lucide-react";
import {
  ADJUSTMENT_PRESETS,
  BLEND_MODES,
  addNoise,
  boxBlur,
  clampRect,
  hexToRgb,
  layerType,
  pixelate,
  renderClouds,
  selectionBounds,
  sharpen,
} from "./PhotoCraftWorkspace";

export const MMPHOTO_TABS = [
  { id: "auto", label: "Automático" },
  { id: "fundo", label: "Fundo" },
  { id: "ajustes", label: "Ajustes" },
  { id: "filtros", label: "Filtros" },
  { id: "camadas", label: "Camadas" },
  { id: "selecao", label: "Seleção" },
  { id: "documento", label: "Documento" },
];

class ToolError extends Error {}

const intensity = { key: "intensity", label: "Intensidade", type: "range", min: 10, max: 100, step: 5, default: 100, unit: "%", help: "Vira a opacidade da camada de ajuste (pode ser mudada depois no painel Camadas)." };

// ---------- auxiliares de estado ----------
function activeOf(state) {
  const layer = state.layers.find((item) => item.id === state.activeLayer);
  if (!layer) throw new ToolError("Nenhuma camada ativa: clique numa camada no painel Camadas.");
  return layer;
}

function pixelLayer(state) {
  const layer = activeOf(state);
  if (layerType(layer) === "adjustment") throw new ToolError("Camadas de ajuste não têm pixels. Selecione uma camada de imagem.");
  if (!layer.visible) throw new ToolError("A camada está oculta. Mostre a camada para editá-la.");
  return layer;
}

function styledLayer(state) {
  const layer = activeOf(state);
  if (layerType(layer) === "adjustment") throw new ToolError("Selecione uma camada de imagem ou texto (camadas de ajuste não recebem estilo).");
  return layer;
}

function areaText(state) {
  const bounds = selectionBounds(state.selection);
  if (!bounds) return "camada inteira";
  return `seleção ${Math.round(bounds.w)} × ${Math.round(bounds.h)} px`;
}

const patchLayer = (layers, id, patch) => layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer));

// ---------- ajustes (camadas de ajuste não destrutivas) ----------
function adjustmentTool(preset) {
  return (state, params, env) => {
    const ops = ADJUSTMENT_PRESETS[preset];
    const count = state.layers.filter((layer) => layer.adjustment?.name === preset).length + 1;
    const layer = {
      id: env.newId(),
      name: `${preset} ${count}`,
      kind: "◐",
      type: "adjustment",
      visible: true,
      locked: false,
      opacity: params.intensity,
      blendMode: "normal",
      mask: false,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      adjustment: { name: preset, ops },
    };
    const index = Math.max(0, state.layers.findIndex((item) => item.id === state.activeLayer));
    return {
      ok: true,
      count: 1,
      label: `Camada de ajuste ${preset}`,
      summary: `Camada de ajuste "${layer.name}" (${params.intensity}%) criada: afeta todas as camadas abaixo`,
      layers: [...state.layers.slice(0, index), layer, ...state.layers.slice(index)],
      activeLayer: layer.id,
    };
  };
}

function clearAdjustments(state) {
  const removed = state.layers.filter((layer) => layerType(layer) === "adjustment");
  if (!removed.length) return { ok: false, summary: "O documento não tem camadas de ajuste para remover." };
  const layers = state.layers.filter((layer) => layerType(layer) !== "adjustment");
  const keep = layers.some((layer) => layer.id === state.activeLayer);
  return {
    ok: true,
    count: removed.length,
    label: "Remover ajustes",
    summary: `${removed.length} camada(s) de ajuste removida(s)`,
    details: removed.map((layer) => layer.name),
    layers,
    ...(keep ? {} : { activeLayer: layers[0]?.id || "" }),
  };
}

// ---------- filtros de pixels ----------
function pixelTool(label, describe, operation) {
  return (state, params) => {
    const layer = pixelLayer(state);
    return {
      ok: true,
      count: 1,
      label,
      summary: `${label} (${describe(params)}) em "${layer.name}" · ${areaText(state)}`,
      pixels: (data, width, height) => operation(data, width, height, params, state),
    };
  };
}

function fillSelection(state, params) {
  if (!state.selection) throw new ToolError("Faça uma seleção (Letreiro, Laço ou Seleção rápida) antes de preencher.");
  const color = params.color === "bg" ? state.colors.bg : state.colors.fg;
  const rgb = hexToRgb(color);
  const alpha = Math.round((255 * params.opacity) / 100);
  return pixelTool("Preencher", () => `${color} · ${params.opacity}%`, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = alpha;
    }
  })(state, params);
}

function clearSelection(state, params) {
  if (!state.selection) throw new ToolError("Faça uma seleção para limpar os pixels.");
  return pixelTool("Limpar seleção", () => "deixa transparente", (data) => {
    for (let i = 3; i < data.length; i += 4) data[i] = 0;
  })(state, params);
}

// ---------- ajustes automáticos (calculados a partir dos pixels reais) ----------
const visiblePixels = (data) => {
  const list = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) list.push(i);
  return list;
};

/** Valores nos percentis `clip` e 1-`clip` de um canal (ou da luminância), ignorando pixels transparentes. */
function percentiles(indices, read, clip) {
  const histogram = new Uint32Array(256);
  for (const i of indices) histogram[read(i)] += 1;
  const cut = Math.floor(indices.length * clip);
  let low = 0;
  for (let seen = 0; low < 255 && seen + histogram[low] <= cut; low += 1) seen += histogram[low];
  let high = 255;
  for (let seen = 0; high > 0 && seen + histogram[high] <= cut; high -= 1) seen += histogram[high];
  return [low, high];
}

const stretch = (value, low, high) => Math.max(0, Math.min(255, Math.round(((value - low) * 255) / (high - low))));
const stretchable = (low, high) => high - low >= 2 && !(low === 0 && high === 255);

/** Auto contraste: estica a luminância (mesma curva nos três canais, sem mudar as cores). Devolve se alterou. */
export function autoContrast(data, clip = 0.005) {
  const indices = visiblePixels(data);
  if (!indices.length) return false;
  const [low, high] = percentiles(indices, (i) => Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]), clip);
  if (!stretchable(low, high)) return false;
  for (const i of indices) for (let c = 0; c < 3; c += 1) data[i + c] = stretch(data[i + c], low, high);
  return true;
}

/** Auto nível: estica cada canal separadamente (também corrige dominantes de cor). Devolve se alterou. */
export function autoLevels(data, clip = 0.005) {
  const indices = visiblePixels(data);
  let changed = false;
  for (let c = 0; c < 3 && indices.length; c += 1) {
    const [low, high] = percentiles(indices, (i) => data[i + c], clip);
    if (!stretchable(low, high)) continue;
    for (const i of indices) data[i + c] = stretch(data[i + c], low, high);
    changed = true;
  }
  return changed;
}

/** Balanço de branco "mundo cinza": iguala as médias dos canais. Devolve se alterou. */
export function grayWorld(data, strength = 1) {
  const indices = visiblePixels(data);
  const sums = [0, 0, 0];
  for (const i of indices) for (let c = 0; c < 3; c += 1) sums[c] += data[i + c];
  if (sums.some((sum) => sum === 0)) return false;
  const gray = (sums[0] + sums[1] + sums[2]) / 3;
  const gains = sums.map((sum) => 1 + (gray / sum - 1) * strength);
  if (gains.every((gain) => Math.abs(gain - 1) < 0.005)) return false;
  for (const i of indices) for (let c = 0; c < 3; c += 1) data[i + c] = Math.max(0, Math.min(255, Math.round(data[i + c] * gains[c])));
  return true;
}

// O cálculo usa os pixels da camada no momento de aplicar; se nada mudar, o app recebe o aviso como falha.
function autoTool(label, describe, operation) {
  return pixelTool(label, describe, (data, _w, _h, params) => {
    if (!operation(data, params)) throw new Error(`${label}: a imagem já está no ponto (nada a corrigir).`);
  });
}

// ---------- remover fundo ----------
/**
 * Fundo liso: parte de todos os pixels da borda parecidos com a cor dominante da borda e apaga
 * (alfa 0) a região conectada dentro da tolerância; uma faixa de transição suaviza o contorno.
 * Devolve quantos pixels ficaram transparentes.
 */
export function removeFlatBackground(data, width, height, tolerance = 40, soft = 0.5) {
  const total = width * height;
  const border = new Set();
  for (let x = 0; x < width; x += 1) border.add(x).add((height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) border.add(y * width).add(y * width + width - 1);
  const visible = [...border].filter((p) => data[p * 4 + 3] > 0);
  if (!visible.length) return 0;
  const median = (c) => visible.map((p) => data[p * 4 + c]).sort((a, b) => a - b)[visible.length >> 1];
  const ref = [median(0), median(1), median(2)];
  const distance = (p) => Math.hypot(data[p * 4] - ref[0], data[p * 4 + 1] - ref[1], data[p * 4 + 2] - ref[2]);
  const edge = tolerance * (1 + soft);
  const seen = new Uint8Array(total);
  const stack = visible.filter((p) => distance(p) <= tolerance);
  stack.forEach((p) => (seen[p] = 1));
  let removed = 0;
  while (stack.length) {
    const p = stack.pop();
    const d = distance(p);
    if (d <= tolerance) {
      data[p * 4 + 3] = 0;
      removed += 1;
    } else {
      // Contorno: transparência proporcional à proximidade da cor do fundo; não se espalha a partir daqui.
      data[p * 4 + 3] = Math.round(data[p * 4 + 3] * ((d - tolerance) / (edge - tolerance)));
      continue;
    }
    const x = p % width;
    for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
      if (q < 0 || q >= total || seen[q] || data[q * 4 + 3] === 0 || distance(q) > edge) continue;
      seen[q] = 1;
      stack.push(q);
    }
  }
  return removed;
}

/** Aplica uma máscara de probabilidade (de outro tamanho) ao alfa dos pixels, por vizinho mais próximo. */
export function applyMaskResampled(data, width, height, mask) {
  for (let y = 0; y < height; y += 1) {
    const my = Math.min(mask.height - 1, Math.floor((y * mask.height) / height));
    for (let x = 0; x < width; x += 1) {
      const mx = Math.min(mask.width - 1, Math.floor((x * mask.width) / width));
      const weight = Math.max(0, Math.min(1, (mask.values[my * mask.width + mx] - 0.12) / 0.76));
      const i = (y * width + x) * 4 + 3;
      data[i] = Math.round(data[i] * weight);
    }
  }
  return data;
}

function flatBackground(state, params) {
  return pixelTool("Remover fundo liso", (p) => `tolerância ${p.tolerance}`, (data, w, h, p) => {
    const removed = removeFlatBackground(data, w, h, p.tolerance, p.soft / 100);
    if (removed < w * h * 0.005) throw new Error("não achei um fundo de cor única encostado nas bordas. Aumente a tolerância ou use o modo Pessoa.");
    if (removed > w * h * 0.98) throw new Error("a imagem inteira parece ser fundo. Diminua a tolerância.");
  })(state, params);
}

// A máscara vem do modelo (assíncrono): o app segmenta a camada e aplica com applyMaskResampled.
function personBackground(state) {
  const layer = pixelLayer(state);
  return { ok: true, count: 1, label: "Remover fundo", summary: `Remover fundo (pessoa, IA local) em "${layer.name}" · ${areaText(state)}`, segmentPerson: true };
}

/** Recorte de objeto por ponto: o ponto vem do centro da seleção ou dos controles (em % do documento). */
function objectBackground(state, params) {
  const layer = pixelLayer(state);
  const bounds = params.useSelection ? selectionBounds(state.selection) : null;
  const point = bounds
    ? { x: (bounds.x + bounds.w / 2) / state.docSize.w, y: (bounds.y + bounds.h / 2) / state.docSize.h }
    : { x: params.x / 100, y: params.y / 100 };
  const clamp = (value) => Math.min(0.999, Math.max(0, value));
  const where = bounds ? "centro da seleção" : `ponto ${params.x}% × ${params.y}%`;
  const keepObject = params.keep !== "background";
  return {
    ok: true,
    count: 1,
    label: keepObject ? "Recortar objeto" : "Apagar objeto",
    summary: `${keepObject ? "Recortar objeto (fundo transparente)" : "Apagar objeto"} em "${layer.name}" · IA local · ${where}`,
    segmentObject: { x: clamp(point.x), y: clamp(point.y), keepObject },
  };
}

// ---------- camadas ----------
function shadow(state, params) {
  const layer = styledLayer(state);
  const enabled = params.mode === "on";
  if (Boolean(layer.fx?.shadow) === enabled)
    return { ok: false, summary: enabled ? `"${layer.name}" já tem sombra projetada.` : `"${layer.name}" não tem sombra projetada.` };
  return {
    ok: true,
    count: 1,
    label: enabled ? "Estilo: sombra projetada" : "Remover estilo",
    summary: enabled ? `Sombra projetada aplicada em "${layer.name}"` : `Sombra projetada removida de "${layer.name}"`,
    layers: patchLayer(state.layers, layer.id, { fx: { ...layer.fx, shadow: enabled } }),
  };
}

function opacity(state, params) {
  const layer = activeOf(state);
  return {
    ok: true,
    count: 1,
    label: "Opacidade da camada",
    summary: `Opacidade de "${layer.name}": ${layer.opacity ?? 100}% → ${params.opacity}%`,
    layers: patchLayer(state.layers, layer.id, { opacity: params.opacity }),
  };
}

function blend(state, params) {
  const layer = activeOf(state);
  const name = BLEND_MODES.find(([value]) => value === params.mode)?.[1] ?? params.mode;
  return {
    ok: true,
    count: 1,
    label: "Modo de mesclagem",
    summary: `Mesclagem de "${layer.name}": ${name}`,
    layers: patchLayer(state.layers, layer.id, { blendMode: params.mode }),
  };
}

function duplicate(state, _params, env) {
  const layer = activeOf(state);
  if (layer.id === "background" && !layer.bitmap)
    return { ok: true, count: 1, label: "Duplicar camada", summary: `"${layer.name}" duplicado (a foto vira uma camada editável)`, duplicateBackground: true };
  const copy = { ...layer, id: env.newId(), name: `${layer.name} cópia`, transform: { ...layer.transform }, locked: false, ...(layer.id === "background" ? { type: "raster" } : {}) };
  const index = state.layers.findIndex((item) => item.id === layer.id);
  return {
    ok: true,
    count: 1,
    label: "Duplicar camada",
    summary: `"${layer.name}" duplicado`,
    layers: [...state.layers.slice(0, index), copy, ...state.layers.slice(index)],
    activeLayer: copy.id,
  };
}

const IDENTITY = { x: 0, y: 0, scale: 100, rotation: 0 };
function centerLayer(state, params) {
  const layer = styledLayer(state);
  const transform = { ...IDENTITY, ...layer.transform };
  const reset = params.mode === "reset";
  const next = reset ? IDENTITY : { ...transform, x: 0, y: 0 };
  if (["x", "y", "scale", "rotation"].every((key) => next[key] === transform[key]))
    return { ok: false, summary: `"${layer.name}" já está ${reset ? "sem transformação" : "centralizada"}.` };
  return {
    ok: true,
    count: 1,
    label: reset ? "Redefinir transformação" : "Centralizar camada",
    summary: reset ? `Transformação de "${layer.name}" redefinida` : `"${layer.name}" centralizada no documento`,
    layers: patchLayer(state.layers, layer.id, { transform: next }),
  };
}

function showAll(state) {
  const hidden = state.layers.filter((layer) => !layer.visible);
  if (!hidden.length) return { ok: false, summary: "Todas as camadas já estão visíveis." };
  return {
    ok: true,
    count: hidden.length,
    label: "Mostrar todas as camadas",
    summary: `${hidden.length} camada(s) voltaram a aparecer`,
    details: hidden.map((layer) => layer.name),
    layers: state.layers.map((layer) => ({ ...layer, visible: true })),
  };
}

// ---------- documento ----------
function rotate(state, params) {
  const angle = Number(params.angle);
  const { w, h } = state.docSize;
  const next = angle === 180 ? { w, h } : { w: h, h: w };
  return { ok: true, count: 1, summary: `Rotação da imagem ${angle}°: ${w} × ${h} → ${next.w} × ${next.h} px`, document: { kind: "rotate", angle } };
}

function resize(state, params) {
  const { w, h } = state.docSize;
  const width = Math.round((w * params.percent) / 100);
  if (width < 1 || width > 16000) throw new ToolError("O novo tamanho fica fora do limite (1 a 16000 px de largura).");
  const height = Math.max(1, Math.round(h * (width / w)));
  if (params.percent === 100) return { ok: false, summary: "100% mantém o tamanho atual: escolha outra porcentagem." };
  return { ok: true, count: 1, summary: `Tamanho da imagem ${params.percent}%: ${w} × ${h} → ${width} × ${height} px`, document: { kind: "resize", width } };
}

const SOCIAL = {
  "1:1": [1, 1, "Quadrado 1:1 (feed)"],
  "4:5": [4, 5, "Retrato 4:5 (feed)"],
  "9:16": [9, 16, "Vertical 9:16 (Stories, Reels, Shorts)"],
  "16:9": [16, 9, "Paisagem 16:9 (YouTube, capa)"],
  "3:1": [3, 1, "Banner 3:1 (capa de perfil)"],
};

function socialCrop(state, params) {
  const [rw, rh, label] = SOCIAL[params.format];
  const { w, h } = state.docSize;
  const width = Math.min(w, Math.floor((h * rw) / rh));
  const height = Math.min(h, Math.floor((width * rh) / rw));
  if (width === w && height === h) return { ok: false, summary: `O documento já está no formato ${params.format}.` };
  const anchor = { start: 0, center: 0.5, end: 1 }[params.anchor];
  const rect = { x: Math.round((w - width) * anchor), y: Math.round((h - height) * anchor), w: width, h: height };
  return { ok: true, count: 1, summary: `${label}: ${w} × ${h} → ${width} × ${height} px`, document: { kind: "crop", rect } };
}

// ---------- exportar variações (zip) ----------
const VARIANTS = [
  ["original", "Original (tamanho do documento)"],
  ...Object.entries(SOCIAL).map(([key, [, , label]]) => [key, label]),
];

/** Plano de cada arquivo do zip: recorte no documento achatado e tamanho final (só reduz, nunca amplia). */
export function planVariants(docSize, params) {
  const ext = params.format === "jpg" ? "jpg" : "png";
  const anchor = { start: 0, center: 0.5, end: 1 }[params.anchor || "center"];
  return params.variants.map((key) => {
    let rect = { x: 0, y: 0, w: docSize.w, h: docSize.h };
    if (key !== "original") {
      const [rw, rh] = SOCIAL[key];
      const w = Math.min(docSize.w, Math.floor((docSize.h * rw) / rh));
      const h = Math.min(docSize.h, Math.floor((w * rh) / rw));
      rect = { x: Math.round((docSize.w - w) * anchor), y: Math.round((docSize.h - h) * anchor), w, h };
    }
    const scale = Math.min(1, params.maxWidth / rect.w);
    const width = Math.max(1, Math.round(rect.w * scale));
    const height = Math.max(1, Math.round(rect.h * scale));
    return { name: `${key === "original" ? "original" : key.replace(":", "x")}-${width}x${height}.${ext}`, rect, width, height };
  });
}

function exportVariants(state, params) {
  if (!params.variants?.length) throw new ToolError("Escolha ao menos uma variação para exportar.");
  const files = planVariants(state.docSize, params);
  return {
    ok: true,
    count: files.length,
    summary: `${files.length} variação(ões) em ${params.format.toUpperCase()} num arquivo .zip`,
    details: files.map((file) => file.name),
    exportZip: { files, format: params.format },
  };
}

function cropToSelection(state) {
  const bounds = selectionBounds(state.selection);
  if (!bounds) throw new ToolError("Faça uma seleção para recortar o documento nela.");
  const rect = clampRect(bounds, state.docSize.w, state.docSize.h);
  if (rect.w < 2 || rect.h < 2) throw new ToolError("A seleção está fora do documento ou é pequena demais para recortar.");
  return { ok: true, count: 1, summary: `Recortar na seleção: ${state.docSize.w} × ${state.docSize.h} → ${rect.w} × ${rect.h} px`, document: { kind: "crop", rect } };
}

// ---------- catálogo ----------
const ADJUSTMENTS = [
  ["adjust.bw", "P&B", "Preto e branco", Contrast, "Converte tudo o que está abaixo para tons de cinza."],
  ["adjust.vintage", "Mapa grad.", "Vintage", Palette, "Tons de cinza com sépia, como foto antiga."],
  ["adjust.vibrance", "Vibratilidade", "Vibrante", Sparkles, "Aumenta a saturação para cores mais vivas."],
  ["adjust.bright", "Brilho", "Mais brilho", Sun, "Clareia a imagem com um leve ganho de contraste."],
  ["adjust.exposure", "Exposição", "Exposição", SunDim, "Clareia bastante: bom para fotos escuras."],
  ["adjust.curves", "Curvas", "Contraste", Triangle, "Mais contraste com leve ganho de brilho (curva em S)."],
  ["adjust.hue", "Matiz/Sat.", "Matiz", Droplets, "Gira as cores 30° no círculo cromático e satura um pouco."],
  ["adjust.invert", "Inverter", "Inverter", CircleOff, "Negativo: inverte as cores."],
];

/** Catálogo com as opções do momento. */
export function mmphotoCatalogue() {
  const tools = [
    {
      id: "auto.contrast",
      tab: "auto",
      label: "Auto contraste",
      icon: WandSparkles,
      description: "Estica os tons da camada ativa até o preto e o branco, sem mudar as cores.",
      how: "Lê o histograma de luminância dos pixels visíveis, ignora 0,5% dos extremos e aplica a mesma curva nos três canais.",
      params: [],
      run: autoTool("Auto contraste", () => "pelo histograma", (data) => autoContrast(data)),
    },
    {
      id: "auto.levels",
      tab: "auto",
      label: "Auto nível",
      icon: Scale,
      description: "Ajusta preto e branco de cada canal: corrige fotos lavadas e dominantes de cor.",
      how: "Mesmo cálculo do Auto contraste, separado por canal (vermelho, verde e azul).",
      params: [],
      run: autoTool("Auto nível", () => "por canal", (data) => autoLevels(data)),
    },
    {
      id: "auto.white",
      tab: "auto",
      label: "Balanço de branco",
      icon: Thermometer,
      description: "Neutraliza o tom amarelado ou azulado da foto (luz quente ou fria).",
      how: "Método mundo cinza: iguala as médias dos canais nos pixels visíveis; a intensidade dosa a correção.",
      params: [{ key: "strength", label: "Intensidade", type: "range", min: 10, max: 100, step: 10, default: 100, unit: "%" }],
      run: autoTool("Balanço de branco", (p) => `${p.strength}%`, (data, p) => grayWorld(data, p.strength / 100)),
    },
    {
      id: "auto.fix",
      tab: "auto",
      label: "Correção rápida",
      icon: SunSnow,
      description: "Balanço de branco e depois auto contraste, num clique só.",
      params: [],
      run: autoTool("Correção rápida", () => "branco + contraste", (data) => [grayWorld(data), autoContrast(data)].some(Boolean)),
    },
    {
      id: "bg.person",
      tab: "fundo",
      label: "Remover fundo (pessoa)",
      icon: UserRound,
      description: "Recorta a pessoa da camada ativa e deixa o fundo transparente, com IA que roda no próprio navegador.",
      how: "Usa o modelo MediaPipe Selfie Segmenter (Apache-2.0), servido pelo próprio MediaMind: a foto não sai do computador. Funciona com pessoas; para objetos em fundo de cor única use Remover fundo liso.",
      params: [],
      applyLabel: "Remover fundo",
      run: personBackground,
    },
    {
      id: "bg.object",
      tab: "fundo",
      label: "Recortar objeto",
      icon: MousePointerClick,
      description: "Recorta qualquer objeto (produto, carro, bicho, logo) a partir de um ponto sobre ele, com IA local. Também pode apagar só o objeto.",
      how: "Usa o MediaPipe Interactive Segmenter (modelo magic_touch, Apache-2.0) servido pelo próprio MediaMind: a foto não sai do navegador. O ponto é o centro da seleção (se houver) ou o definido nos controles.",
      params: [
        { key: "useSelection", label: "Usar o centro da seleção (se houver)", type: "toggle", default: true },
        { key: "x", label: "Ponto horizontal", type: "range", min: 0, max: 100, step: 1, default: 50, unit: "%" },
        { key: "y", label: "Ponto vertical", type: "range", min: 0, max: 100, step: 1, default: 50, unit: "%" },
        {
          key: "keep",
          label: "Manter",
          type: "select",
          default: "object",
          options: [
            ["object", "O objeto (apaga o fundo)"],
            ["background", "O fundo (apaga o objeto)"],
          ],
        },
      ],
      applyLabel: "Recortar",
      run: objectBackground,
    },
    {
      id: "bg.flat",
      tab: "fundo",
      label: "Remover fundo liso",
      icon: PaintbrushVertical,
      description: "Apaga um fundo de cor única (branco, verde, estúdio) a partir das bordas da camada ativa.",
      how: "Pega a cor dominante da borda e apaga a região conectada parecida com ela; a suavização cria uma transição no contorno. Respeita a seleção, se houver.",
      params: [
        { key: "tolerance", label: "Tolerância", type: "range", min: 5, max: 150, step: 5, default: 40, help: "Mais alta = apaga tons mais diferentes da cor do fundo." },
        { key: "soft", label: "Suavizar contorno", type: "range", min: 0, max: 100, step: 10, default: 50, unit: "%" },
      ],
      applyLabel: "Remover fundo",
      run: flatBackground,
    },
    ...ADJUSTMENTS.map(([id, preset, label, icon, description]) => ({
      id,
      tab: "ajustes",
      label,
      icon,
      description,
      how: "Cria uma camada de ajuste acima da camada ativa (não destrutiva): afeta todas as camadas abaixo e pode ser ocultada, excluída ou dosada pela opacidade.",
      params: [intensity],
      applyLabel: "Criar ajuste",
      run: adjustmentTool(preset),
    })),
    {
      id: "adjust.clear",
      tab: "ajustes",
      label: "Remover ajustes",
      icon: Ban,
      description: "Remove todas as camadas de ajuste do documento (as camadas de imagem ficam).",
      params: [],
      run: clearAdjustments,
    },
    {
      id: "filter.blur",
      tab: "filtros",
      label: "Desfoque",
      icon: Waves,
      description: "Desfoca os pixels da camada ativa (ou só da seleção).",
      how: "Desfoque de caixa em duas passadas (horizontal e vertical) sobre os pixels reais da camada; textos e formas são rasterizados antes.",
      params: [{ key: "radius", label: "Raio", type: "range", min: 1, max: 20, step: 1, default: 4, unit: "px" }],
      run: pixelTool("Desfoque", (p) => `raio ${p.radius} px`, (data, w, h, p) => boxBlur(data, w, h, p.radius)),
    },
    {
      id: "filter.sharpen",
      tab: "filtros",
      label: "Nitidez",
      icon: Focus,
      description: "Realça bordas e detalhes da camada ativa (ou da seleção).",
      params: [{ key: "amount", label: "Quantidade", type: "range", min: 0.1, max: 2, step: 0.1, default: 0.6 }],
      run: pixelTool("Nitidez", (p) => `quantidade ${String(p.amount).replace(".", ",")}`, (data, w, h, p) => sharpen(data, w, h, p.amount)),
    },
    {
      id: "filter.noise",
      tab: "filtros",
      label: "Ruído",
      icon: Grip,
      description: "Adiciona granulação (ruído) aos pixels, como filme.",
      params: [{ key: "amount", label: "Quantidade", type: "range", min: 5, max: 80, step: 5, default: 25 }],
      run: pixelTool("Ruído", (p) => `quantidade ${p.amount}`, (data, _w, _h, p) => addNoise(data, p.amount)),
    },
    {
      id: "filter.pixelate",
      tab: "filtros",
      label: "Pixelizar",
      icon: Grid3x3,
      description: "Transforma a área em blocos (mosaico): bom para esconder rostos e placas.",
      params: [{ key: "size", label: "Tamanho do bloco", type: "range", min: 2, max: 60, step: 1, default: 12, unit: "px" }],
      run: pixelTool("Pixelização", (p) => `blocos de ${p.size} px`, (data, w, h, p) => pixelate(data, w, h, p.size)),
    },
    {
      id: "filter.clouds",
      tab: "filtros",
      label: "Nuvens",
      icon: Cloud,
      description: "Desenha nuvens entre a cor de primeiro plano e a de fundo (substitui os pixels da área).",
      params: [{ key: "info", label: "Usa as cores de primeiro plano e fundo da barra de ferramentas.", type: "info" }],
      run: pixelTool("Render nuvens", () => "primeiro plano e fundo", (data, w, h, _p, state) => renderClouds(data, w, h, state.colors.fg, state.colors.bg)),
    },
    {
      id: "layer.shadow",
      tab: "camadas",
      label: "Sombra",
      icon: Layers,
      description: "Liga ou desliga a sombra projetada da camada ativa (estilo fx).",
      params: [
        {
          key: "mode",
          label: "Sombra",
          type: "select",
          default: "on",
          options: [
            ["on", "Aplicar"],
            ["off", "Remover"],
          ],
        },
      ],
      run: shadow,
    },
    {
      id: "layer.opacity",
      tab: "camadas",
      label: "Opacidade",
      icon: Droplet,
      description: "Define a opacidade da camada ativa.",
      params: [{ key: "opacity", label: "Opacidade", type: "range", min: 0, max: 100, step: 5, default: 50, unit: "%" }],
      run: opacity,
    },
    {
      id: "layer.blend",
      tab: "camadas",
      label: "Mesclagem",
      icon: Blend,
      description: "Muda o modo de mesclagem da camada ativa com as de baixo.",
      params: [{ key: "mode", label: "Modo", type: "select", default: "multiply", options: BLEND_MODES }],
      run: blend,
    },
    { id: "layer.duplicate", tab: "camadas", label: "Duplicar", icon: Copy, description: "Duplica a camada ativa logo acima dela (a foto de fundo vira camada editável).", params: [], run: duplicate },
    {
      id: "layer.center",
      tab: "camadas",
      label: "Centralizar",
      icon: Crosshair,
      description: "Centraliza a camada ativa no documento ou zera toda a transformação.",
      params: [
        {
          key: "mode",
          label: "Ação",
          type: "select",
          default: "center",
          options: [
            ["center", "Só centralizar"],
            ["reset", "Redefinir (centro, 100%, sem rotação)"],
          ],
        },
      ],
      run: centerLayer,
    },
    {
      id: "layer.showall",
      tab: "camadas",
      label: "Mostrar todas",
      icon: Eye,
      description: "Torna visíveis todas as camadas ocultas.",
      params: [],
      run: showAll,
    },
    {
      id: "selection.fill",
      tab: "selecao",
      label: "Preencher",
      icon: PaintBucket,
      description: "Preenche a seleção da camada ativa com a cor de primeiro plano ou de fundo.",
      params: [
        {
          key: "color",
          label: "Cor",
          type: "select",
          default: "fg",
          options: [
            ["fg", "Primeiro plano"],
            ["bg", "Fundo"],
          ],
        },
        { key: "opacity", label: "Opacidade", type: "range", min: 5, max: 100, step: 5, default: 100, unit: "%" },
      ],
      run: fillSelection,
    },
    {
      id: "selection.clear",
      tab: "selecao",
      label: "Limpar seleção",
      icon: Eraser,
      description: "Apaga os pixels dentro da seleção (ficam transparentes).",
      params: [],
      run: clearSelection,
    },
    {
      id: "doc.rotate",
      tab: "documento",
      label: "Girar",
      icon: RotateCw,
      description: "Gira o documento inteiro (todas as camadas).",
      params: [
        {
          key: "angle",
          label: "Ângulo",
          type: "select",
          default: "90",
          options: [
            ["90", "90° horário"],
            ["-90", "90° anti-horário"],
            ["180", "180°"],
          ],
        },
      ],
      run: rotate,
    },
    {
      id: "doc.resize",
      tab: "documento",
      label: "Tamanho",
      icon: Maximize2,
      description: "Redimensiona o documento inteiro mantendo a proporção.",
      params: [{ key: "percent", label: "Escala", type: "range", min: 10, max: 400, step: 5, default: 50, unit: "%" }],
      run: resize,
    },
    {
      id: "doc.social",
      tab: "documento",
      label: "Formato redes",
      icon: Smartphone,
      description: "Recorta o documento no formato de cada rede social, o maior possível.",
      params: [
        { key: "format", label: "Formato", type: "select", default: "1:1", options: Object.entries(SOCIAL).map(([key, [, , label]]) => [key, label]) },
        {
          key: "anchor",
          label: "Manter",
          type: "select",
          default: "center",
          options: [
            ["center", "Centro"],
            ["start", "Início (esquerda/topo)"],
            ["end", "Fim (direita/base)"],
          ],
        },
      ],
      run: socialCrop,
    },
    {
      id: "doc.export",
      tab: "documento",
      label: "Exportar variações",
      icon: Archive,
      description: "Baixa um .zip com o documento em vários formatos de uma vez (original e redes sociais).",
      how: "Achata todas as camadas visíveis, recorta cada formato (o maior possível) e reduz até a largura máxima. Não altera o documento.",
      params: [
        { key: "variants", label: "Variações", type: "multi", default: ["original", "1:1", "9:16", "16:9"], options: VARIANTS },
        {
          key: "format",
          label: "Formato do arquivo",
          type: "select",
          default: "jpg",
          options: [
            ["jpg", "JPG (menor, fundo branco)"],
            ["png", "PNG (com transparência)"],
          ],
        },
        { key: "maxWidth", label: "Largura máxima", type: "range", min: 320, max: 4000, step: 40, default: 1080, unit: "px" },
        {
          key: "anchor",
          label: "Manter no recorte",
          type: "select",
          default: "center",
          options: [
            ["center", "Centro"],
            ["start", "Início (esquerda/topo)"],
            ["end", "Fim (direita/base)"],
          ],
        },
      ],
      applyLabel: "Exportar .zip",
      run: exportVariants,
    },
    {
      id: "doc.crop",
      tab: "documento",
      label: "Recortar",
      icon: Crop,
      description: "Recorta o documento no retângulo que contém a seleção.",
      params: [],
      run: cropToSelection,
    },
  ];
  return { tabs: MMPHOTO_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/**
 * Executa (planeja) uma ferramenta sobre o estado. Erros de condição viram `ok: false` com a explicação;
 * erros inesperados sobem para quem chamou.
 */
export function runMMPhotoTool(toolId, state, params, env = { newId: () => crypto.randomUUID() }) {
  const tool = mmphotoCatalogue().tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run(state, { ...defaultsOf(tool), ...(params || {}) }, env);
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
