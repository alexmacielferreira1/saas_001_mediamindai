import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { zipSync } from "fflate";
import { registerMCPActions } from "../../lib/mcpActions";
import { applyMaskResampled, runMMPhotoTool, mmphotoCatalogue } from "./mmphotoMcpTools";
import { segmentPersonCanvas } from "../../lib/personSegmentation";
import { segmentObjectCanvas } from "../../lib/objectSegmentation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import NumericField from "./NumericField";
import ToolRail from "./ToolRail";
import { useTextPrompt } from "./FilmCraftTextPrompt";
import {
  Brush,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Crop,
  Eye,
  EyeOff,
  Eraser,
  FolderPlus,
  Hand,
  Image as ImageIcon,
  Lasso,
  MousePointer2,
  PenTool,
  Save,
  Trash2,
  Undo2,
  Stamp,
  Type,
  Upload,
  WandSparkles,
  ZoomIn,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Motor de imagem do MMPhoto (funções puras + composição em canvas 2D).
// Comportamento das ferramentas inspirado no PhotoCraft (Apache-2.0), reimplementado em JS.
// ---------------------------------------------------------------------------

export const DOC_DEFAULT = { w: 1200, h: 800 };
const HISTORY_LIMIT = 30;

export const ADJUSTMENT_PRESETS = {
  Brilho: [["brightness", 1.15], ["contrast", 1.05]],
  Níveis: [["contrast", 1.19]],
  Curvas: [["contrast", 1.12], ["brightness", 1.03]],
  Exposição: [["brightness", 1.3]],
  Vibratilidade: [["saturate", 1.35]],
  "Matiz/Sat.": [["hue-rotate", 30], ["saturate", 1.2]],
  Equilíbrio: [["sepia", 0.2], ["saturate", 1.1]],
  "P&B": [["grayscale", 1]],
  "Mapa grad.": [["grayscale", 1], ["sepia", 0.8]],
  Seletiva: [["saturate", 1.5], ["hue-rotate", -10]],
  Lookup: [["sepia", 0.3], ["contrast", 1.1], ["saturate", 1.2]],
  Inverter: [["invert", 1]],
};

export function filterOpsToCss(ops = []) {
  return ops.map(([fn, value]) => (fn === "hue-rotate" ? `hue-rotate(${value}deg)` : `${fn}(${value})`)).join(" ");
}

export function layerType(layer) {
  if (!layer) return "none";
  if (layer.type) return layer.type;
  if (layer.id === "background") return "background";
  if (layer.adjustment || layer.id === "adjust") return "adjustment";
  if (layer.kind === "T") return "text";
  if (layer.bitmap) return "raster";
  return "procedural";
}

/** Camadas visíveis da base para o topo (a lista de camadas é do topo para a base). */
export function flattenOrder(layers) {
  return layers.filter((layer) => layer.visible).slice().reverse();
}

const clamp255 = (value) => (value < 0 ? 0 : value > 255 ? 255 : value);

function colorMatrix(fn, a) {
  if (fn === "saturate") {
    return [0.213 + 0.787 * a, 0.715 - 0.715 * a, 0.072 - 0.072 * a, 0.213 - 0.213 * a, 0.715 + 0.285 * a, 0.072 - 0.072 * a, 0.213 - 0.213 * a, 0.715 - 0.715 * a, 0.072 + 0.928 * a];
  }
  if (fn === "grayscale") {
    const k = 1 - Math.min(1, a);
    return [0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k, 0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k, 0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k];
  }
  if (fn === "sepia") {
    const k = 1 - Math.min(1, a);
    return [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k, 0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k, 0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k];
  }
  if (fn === "hue-rotate") {
    const r = (a * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
  }
  return null;
}

/** Aplica funções de filtro CSS (especificação W3C Filter Effects) a pixels RGBA. */
export function applyFilterOps(data, ops = []) {
  for (const [fn, value] of ops) {
    const matrix = colorMatrix(fn, value);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (matrix) {
        data[i] = clamp255(matrix[0] * r + matrix[1] * g + matrix[2] * b);
        data[i + 1] = clamp255(matrix[3] * r + matrix[4] * g + matrix[5] * b);
        data[i + 2] = clamp255(matrix[6] * r + matrix[7] * g + matrix[8] * b);
      } else if (fn === "brightness") {
        data[i] = clamp255(r * value);
        data[i + 1] = clamp255(g * value);
        data[i + 2] = clamp255(b * value);
      } else if (fn === "contrast") {
        data[i] = clamp255((r - 127.5) * value + 127.5);
        data[i + 1] = clamp255((g - 127.5) * value + 127.5);
        data[i + 2] = clamp255((b - 127.5) * value + 127.5);
      } else if (fn === "invert") {
        const a = Math.min(1, value);
        data[i] = clamp255(255 * a + r * (1 - 2 * a));
        data[i + 1] = clamp255(255 * a + g * (1 - 2 * a));
        data[i + 2] = clamp255(255 * a + b * (1 - 2 * a));
      }
    }
  }
  return data;
}

/** Curva tonal para realces, sombras e temperatura (mesma matemática da prévia em SVG). */
export function toneLut(adjust = {}) {
  const highlights = (adjust.highlights || 0) / 100;
  const shadows = (adjust.shadows || 0) / 100;
  const temperature = (adjust.temperature || 0) / 100;
  const make = (shift) => Array.from({ length: 256 }, (_, index) => {
    let v = index / 255;
    v += 0.3 * shadows * (1 - v) * (1 - v);
    v += 0.3 * highlights * v * v;
    v += shift;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  });
  return { r: make(0.1 * temperature), g: make(0), b: make(-0.1 * temperature) };
}

export function hasTone(adjust = {}) {
  return Boolean(adjust.highlights || adjust.shadows || adjust.temperature);
}

export function applyLut(data, lut) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut.r[data[i]];
    data[i + 1] = lut.g[data[i + 1]];
    data[i + 2] = lut.b[data[i + 2]];
  }
  return data;
}

/** Desfoque de caixa separável (3 passadas ≈ gaussiano). */
export function boxBlur(data, width, height, radius) {
  const r = Math.max(0, Math.round(radius));
  if (!r) return data;
  const temp = new Float32Array(data.length);
  const pass = (src, dst, horizontal) => {
    const outer = horizontal ? height : width;
    const inner = horizontal ? width : height;
    for (let o = 0; o < outer; o += 1) {
      for (let c = 0; c < 4; c += 1) {
        let sum = 0;
        const at = (k) => {
          const clamped = Math.min(inner - 1, Math.max(0, k));
          return ((horizontal ? o * width + clamped : clamped * width + o) * 4) + c;
        };
        for (let k = -r; k <= r; k += 1) sum += src[at(k)];
        for (let k = 0; k < inner; k += 1) {
          dst[at(k)] = sum / (2 * r + 1);
          sum += src[at(k + r + 1)] - src[at(k - r)];
        }
      }
    }
  };
  for (let i = 0; i < 3; i += 1) {
    pass(data, temp, true);
    pass(temp, data, false);
  }
  return data;
}

export function sharpen(data, width, height, amount = 1) {
  const copy = Uint8ClampedArray.from(data);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const px = (dx, dy) => copy[((Math.min(height - 1, Math.max(0, y + dy)) * width) + Math.min(width - 1, Math.max(0, x + dx))) * 4 + c];
        data[index + c] = clamp255(copy[index + c] * (1 + 4 * amount) - amount * (px(-1, 0) + px(1, 0) + px(0, -1) + px(0, 1)));
      }
    }
  }
  return data;
}

export function pixelate(data, width, height, size = 10) {
  for (let by = 0; by < height; by += size) {
    for (let bx = 0; bx < width; bx += size) {
      const sums = [0, 0, 0, 0];
      let count = 0;
      for (let y = by; y < Math.min(height, by + size); y += 1) {
        for (let x = bx; x < Math.min(width, bx + size); x += 1) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 4; c += 1) sums[c] += data[i + c];
          count += 1;
        }
      }
      for (let y = by; y < Math.min(height, by + size); y += 1) {
        for (let x = bx; x < Math.min(width, bx + size); x += 1) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 4; c += 1) data[i + c] = Math.round(sums[c] / count);
        }
      }
    }
  }
  return data;
}

export function addNoise(data, amount = 25, random = Math.random) {
  for (let i = 0; i < data.length; i += 4) {
    const delta = (random() - 0.5) * 2 * amount;
    data[i] = clamp255(data[i] + delta);
    data[i + 1] = clamp255(data[i + 1] + delta);
    data[i + 2] = clamp255(data[i + 2] + delta);
  }
  return data;
}

export function hexToRgb(hex = "#000000") {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] || "000000";
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}

export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

/** Filtro Render › Nuvens: ruído de valor em oitavas interpolando primeiro plano e fundo. */
export function renderClouds(data, width, height, fg, bg, random = Math.random) {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  const octaves = [64, 32, 16, 8].map((cell) => {
    const cols = Math.ceil(width / cell) + 2;
    const rows = Math.ceil(height / cell) + 2;
    return { cell, cols, grid: Array.from({ length: cols * rows }, () => random()) };
  });
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      let weight = 0.5;
      let total = 0;
      for (const { cell, cols, grid } of octaves) {
        const gx = x / cell;
        const gy = y / cell;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const tx = smooth(gx - x0);
        const ty = smooth(gy - y0);
        const g = (ix, iy) => grid[iy * cols + ix];
        const top = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx;
        const bottom = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
        value += (top + (bottom - top) * ty) * weight;
        total += weight;
        weight /= 2;
      }
      const t = value / total;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) data[i + c] = Math.round(a[c] + (b[c] - a[c]) * t);
      data[i + 3] = 255;
    }
  }
  return data;
}

export function normalizeRect(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

export function clampRect(rect, width, height) {
  const x = Math.max(0, Math.min(width, Math.round(rect.x)));
  const y = Math.max(0, Math.min(height, Math.round(rect.y)));
  const right = Math.max(0, Math.min(width, Math.round(rect.x + rect.w)));
  const bottom = Math.max(0, Math.min(height, Math.round(rect.y + rect.h)));
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

export function pointInPolygon(point, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Cobertura (0 ou 255 por pixel) de uma seleção retangular, poligonal ou por máscara (spans). */
export function selectionCoverage(selection, width, height) {
  const coverage = new Uint8Array(width * height);
  if (!selection) return coverage.fill(255);
  if (selection.type === "rect") {
    const r = clampRect(selection.rect, width, height);
    for (let y = r.y; y < r.y + r.h; y += 1) coverage.fill(255, y * width + r.x, y * width + r.x + r.w);
  } else if (selection.type === "polygon" && selection.points?.length > 2) {
    const pts = selection.points;
    for (let y = 0; y < height; y += 1) {
      const cy = y + 0.5;
      const xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
        const a = pts[i];
        const b = pts[j];
        if ((a.y > cy) !== (b.y > cy)) xs.push(a.x + ((cy - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const start = Math.max(0, Math.ceil(xs[k] - 0.5));
        const end = Math.min(width, Math.ceil(xs[k + 1] - 0.5));
        if (end > start) coverage.fill(255, y * width + start, y * width + end);
      }
    }
  } else if (selection.type === "mask") {
    for (const [y, x0, x1] of selection.spans || []) {
      if (y < 0 || y >= height) continue;
      const start = Math.max(0, x0);
      const end = Math.min(width, x1);
      if (end > start) coverage.fill(255, y * width + start, y * width + end);
    }
  }
  return coverage;
}

export function selectionBounds(selection) {
  if (!selection) return null;
  if (selection.type === "rect") return selection.rect;
  if (selection.type === "polygon") {
    const xs = selection.points.map((p) => p.x);
    const ys = selection.points.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return selection.bounds || null;
}

/** Combina pixels processados com os originais apenas onde a seleção cobre. */
export function mixByCoverage(target, processed, coverage) {
  for (let p = 0; p < coverage.length; p += 1) {
    if (!coverage[p]) continue;
    const k = coverage[p] / 255;
    const i = p * 4;
    for (let c = 0; c < 4; c += 1) target[i + c] = Math.round(target[i + c] + (processed[i + c] - target[i + c]) * k);
  }
  return target;
}

/** Varinha/Seleção rápida: preenchimento contíguo por tolerância por canal (como `magic_wand`). */
export function floodSelect(data, width, height, sx, sy, tolerance = 32) {
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return null;
  const seed = (y0 * width + x0) * 4;
  const target = [data[seed], data[seed + 1], data[seed + 2], data[seed + 3]];
  const close = (p) => {
    const i = p * 4;
    return Math.abs(data[i] - target[0]) <= tolerance && Math.abs(data[i + 1] - target[1]) <= tolerance && Math.abs(data[i + 2] - target[2]) <= tolerance && Math.abs(data[i + 3] - target[3]) <= tolerance;
  };
  const visited = new Uint8Array(width * height);
  const stack = [y0 * width + x0];
  visited[y0 * width + x0] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % width;
    const y = (p - x) / width;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const q = ny * width + nx;
      if (!visited[q] && close(q)) {
        visited[q] = 1;
        stack.push(q);
      }
    }
  }
  return spansFromCoverage(visited, width, height);
}

export function spansFromCoverage(coverage, width, height) {
  const spans = [];
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      if (!coverage[y * width + x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < width && coverage[y * width + x]) x += 1;
      spans.push([y, start, x]);
      minX = Math.min(minX, start);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + 1);
    }
  }
  if (!spans.length) return null;
  return { type: "mask", spans, bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}

/** Converte um ponto do documento para o espaço de pixels da camada (inverso de translate·scale·rotate). */
export function toLayerPoint(point, transform, width, height, scale = 1) {
  const t = transform || { x: 0, y: 0, scale: 100, rotation: 0 };
  const s = (t.scale || 100) / 100;
  const angle = (-(t.rotation || 0) * Math.PI) / 180;
  const dx = point.x - width / 2 - (t.x || 0) / scale;
  const dy = point.y - height / 2 - (t.y || 0) / scale;
  return {
    x: width / 2 + (dx * Math.cos(angle) - dy * Math.sin(angle)) / s,
    y: height / 2 + (dx * Math.sin(angle) + dy * Math.cos(angle)) / s,
  };
}

export function isIdentity(transform) {
  return !transform || (!transform.x && !transform.y && (transform.scale ?? 100) === 100 && !transform.rotation);
}

export function pushHistory(entries, entry) {
  return [...entries, entry].slice(-HISTORY_LIMIT);
}

// --------------------------- composição em canvas ---------------------------

export function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function context2d(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível neste navegador.");
  return ctx;
}

function applyLayerTransform(ctx, transform, width, height, scale) {
  const t = transform || {};
  ctx.translate(width / 2 + (t.x || 0) / scale, height / 2 + (t.y || 0) / scale);
  ctx.scale((t.scale ?? 100) / 100, (t.scale ?? 100) / 100);
  ctx.rotate(((t.rotation || 0) * Math.PI) / 180);
}

/** Desenha a forma de uma seleção no contexto (coordenadas do documento). */
export function traceSelection(ctx, selection) {
  ctx.beginPath();
  if (selection.type === "rect") ctx.rect(selection.rect.x, selection.rect.y, selection.rect.w, selection.rect.h);
  else if (selection.type === "polygon") selection.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  else for (const [y, x0, x1] of selection.spans || []) ctx.rect(x0, y, x1 - x0, 1);
  ctx.closePath();
}

function drawProcedural(ctx, layer, scale) {
  const type = layerType(layer);
  if (type === "text") {
    const size = layer.fontSize || 30 / scale;
    ctx.fillStyle = layer.color || "#ffffff";
    ctx.font = `bold ${size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(layer.text ?? "Texto", 0, 0);
    return;
  }
  if (layer.id === "subject" || layer.name?.includes("Pessoa")) {
    const w = 176 / scale;
    const h = 224 / scale;
    const gradient = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    gradient.addColorStop(0, "#fde68a");
    gradient.addColorStop(0.5, "#fdba74");
    gradient.addColorStop(1, "#a21caf");
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 50 / scale;
    ctx.shadowOffsetY = 25 / scale;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    const top = { x: w * 0.45, y: h * 0.45 };
    const bottom = { x: w * 0.38, y: h * 0.38 };
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, [top, top, bottom, bottom]);
    else ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const w = 256 / scale;
  const h = 144 / scale;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(-w / 2, -h / 2, w, h);
}

function drawPlaceholderBackground(ctx, width, height) {
  const linear = ctx.createLinearGradient(0, 0, width, height);
  linear.addColorStop(0, "#164e63");
  linear.addColorStop(1, "#581c87");
  ctx.fillStyle = linear;
  ctx.fillRect(0, 0, width, height);
  const cx = width * 0.35;
  const cy = height * 0.35;
  const radius = Math.hypot(width - cx, height - cy) * 0.22;
  const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  radial.addColorStop(0, "#fbbf24");
  radial.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Pixels de uma camada no espaço do documento (transformação aplicada; sem opacidade, mesclagem,
 * máscara ou estilo). `getSurface(key)` devolve o canvas de pixels carregado da camada/máscara.
 */
export function bakeLayer(layer, { docSize, scale = 1, getSurface, sourceImage }) {
  const { w, h } = docSize;
  const canvas = createCanvas(w, h);
  const ctx = context2d(canvas);
  const type = layerType(layer);
  if (type === "adjustment") return canvas;
  if (type === "background" && !layer.bitmap) {
    if (sourceImage) ctx.drawImage(sourceImage, 0, 0, w, h);
    else drawPlaceholderBackground(ctx, w, h);
    return canvas;
  }
  ctx.save();
  applyLayerTransform(ctx, layer.transform, w, h, scale);
  if (type === "raster" || (type === "background" && layer.bitmap)) {
    const surface = getSurface(layer.id);
    if (surface) ctx.drawImage(surface, -surface.width / 2, -surface.height / 2);
  } else {
    drawProcedural(ctx, layer, scale);
  }
  ctx.restore();
  return canvas;
}

function applyImageAdjustToCanvas(canvas, adjust, scale) {
  if (!adjust) return;
  const ctx = context2d(canvas);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyFilterOps(image.data, [["brightness", 1 + (adjust.exposure || 0) / 100], ["contrast", 1 + (adjust.contrast || 0) / 100], ["saturate", 1 + (adjust.saturation || 0) / 100]]);
  if (adjust.blur) boxBlur(image.data, canvas.width, canvas.height, adjust.blur / scale);
  if (hasTone(adjust)) applyLut(image.data, toneLut(adjust));
  ctx.putImageData(image, 0, 0);
}

/** Achata as camadas visíveis respeitando ordem, opacidade, mesclagem, máscaras, ajustes e estilos. */
export function renderDocument({ layers, docSize, adjust, scale = 1, getSurface, sourceImage, background }) {
  const { w, h } = docSize;
  const canvas = createCanvas(w, h);
  const ctx = context2d(canvas);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  for (const layer of flattenOrder(layers)) {
    const type = layerType(layer);
    const alpha = (layer.opacity ?? 100) / 100;
    if (type === "adjustment") {
      const ops = layer.adjustment?.ops;
      if (ops?.length) {
        const copy = createCanvas(w, h);
        const copyCtx = context2d(copy);
        copyCtx.drawImage(canvas, 0, 0);
        const image = copyCtx.getImageData(0, 0, w, h);
        applyFilterOps(image.data, ops);
        copyCtx.putImageData(image, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.drawImage(copy, 0, 0);
        ctx.globalAlpha = 1;
      }
      if (layer.id === "adjust") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(34,211,238,0.1)";
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      continue;
    }
    const baked = bakeLayer(layer, { docSize, scale, getSurface, sourceImage });
    if (type === "background") applyImageAdjustToCanvas(baked, adjust, scale);
    const mask = layer.maskBitmap && getSurface(`${layer.id}:mask`);
    if (mask) {
      const maskCtx = context2d(baked);
      maskCtx.globalCompositeOperation = "destination-in";
      maskCtx.save();
      applyLayerTransform(maskCtx, layer.transform, w, h, scale);
      maskCtx.drawImage(mask, -mask.width / 2, -mask.height / 2);
      maskCtx.restore();
      maskCtx.globalCompositeOperation = "source-over";
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = layer.blendMode && layer.blendMode !== "normal" ? layer.blendMode : "source-over";
    if (layer.fx?.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 12 / scale;
      ctx.shadowOffsetY = 8 / scale;
    }
    ctx.drawImage(baked, 0, 0);
    ctx.restore();
  }
  return canvas;
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("O navegador não gerou o arquivo de imagem."))), type, quality);
    } catch (error) {
      reject(error);
    }
  });
}

const TOOLS = [
  ["V", "Mover", MousePointer2],
  ["M", "Letreiro", CircleDashed],
  ["L", "Laço", Lasso],
  ["W", "Seleção rápida", WandSparkles],
  ["C", "Recorte", Crop],
  ["B", "Pincel", Brush],
  ["S", "Clone", Stamp],
  ["E", "Borracha", Eraser],
  ["P", "Caneta", PenTool],
  ["T", "Texto", Type],
  ["H", "Mão", Hand],
  ["Z", "Zoom", ZoomIn],
];

// Slots da barra como no Photoshop: ferramentas parecidas dividem um slot com flyout.
// O slot mostra a ferramenta ativa do grupo (ou a última usada nele).
const TOOL_SLOTS = [
  { tools: ["Mover"] },
  { label: "Ferramentas de seleção", tools: ["Letreiro", "Laço", "Seleção rápida"] },
  { tools: ["Recorte"] },
  { label: "Ferramentas de pintura", tools: ["Pincel", "Clone", "Borracha"] },
  { tools: ["Caneta"] },
  { tools: ["Texto"] },
  { tools: ["Mão"] },
  { tools: ["Zoom"] },
];
const TOOL_BY_NAME = Object.fromEntries(TOOLS.map(([shortcut, name, Icon]) => [name, { shortcut, name, Icon }]));
const RAIL_SLOTS = TOOL_SLOTS.map((slot) => ({ ...slot, tools: slot.tools.map((name) => TOOL_BY_NAME[name]) }));

// Foca um editor recém-criado no próximo quadro, depois do mousedown padrão do navegador
// (que, no mesmo gesto, tiraria o foco dele). Devolve a limpeza do agendamento.
function focusNextFrame(run) {
  if (typeof window.requestAnimationFrame === "function") {
    const frame = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame?.(frame);
  }
  const timer = setTimeout(run, 0);
  return () => clearTimeout(timer);
}

const PAINT_TOOLS = ["Pincel", "Borracha", "Clone"];
const DEFAULT_TRANSFORM = { x: 0, y: 0, scale: 100, rotation: 0 };
export const BLEND_MODES = [
  ["normal", "Normal"],
  ["multiply", "Multiplicar"],
  ["screen", "Tela"],
  ["overlay", "Sobrepor"],
  ["soft-light", "Luz suave"],
  ["color-dodge", "Subexposição de cores"],
];

const PHOTO_MENUS = {
  Arquivo: ["Abrir imagem", "Salvar documento", "Exportar PNG", "Exportar JPG"],
  Editar: ["Desfazer", "Refazer", "Duplicar camada", "Transformação livre"],
  Imagem: ["Ajustes", "Tamanho da imagem", "Rotação da imagem"],
  Camada: ["Nova camada", "Nova camada de texto", "Duplicar camada", "Adicionar máscara", "Excluir camada"],
  Texto: ["Nova camada de texto"],
  Selecionar: ["Selecionar tudo", "Desmarcar", "Selecionar assunto"],
  Filtro: ["Desfoque", "Nitidez", "Camera Raw"],
  "3D": ["Nova camada 3D"],
  Exibir: ["Ajustar à tela", "100%"],
  Janela: ["Propriedades", "Ajustes", "Camadas", "Histórico"],
  Ajuda: ["Atalhos do MMPhoto", "Sobre o MMPhoto"],
};

const SHORTCUTS_TEXT = "Atalhos: V Mover · M Letreiro · L Laço · W Seleção rápida · C Recorte · B Pincel (Alt+clique: conta-gotas) · S Clone (Alt+clique: origem) · E Borracha · P Caneta (Enter fecha, Ctrl+Enter vira seleção) · T Texto · H Mão · Z Zoom (Alt: reduzir) · [ ] tamanho do pincel · 1–0 opacidade · Shift+1–0 fluxo · X trocar cores · D cores padrão · Ctrl+Z desfazer · Ctrl+Shift+Z/Ctrl+Y refazer · Ctrl+A selecionar tudo · Ctrl+D desmarcar · Delete limpar seleção · Alt+Backspace preencher com primeiro plano · Ctrl+Backspace preencher com fundo · Ctrl+T transformação livre";

const CHANNEL_ROWS = { RGB: null, Vermelho: 0, Verde: 1, Azul: 2 };

function makeLayer(layer) {
  return { opacity: 100, blendMode: "normal", mask: false, transform: { ...DEFAULT_TRANSFORM }, ...layer };
}

function isEditableTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

export default function PhotoCraftWorkspace({
  active = true,
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const [workspace, setWorkspace] = useGraphicDraftState("PhotoCraftWorkspace.jsx:workspace", "Essenciais");
  const [tool, setTool] = useGraphicDraftState("PhotoCraftWorkspace.jsx:tool", "Mover");
  const [openMenu, setOpenMenu] = useState(null);
  const [rightPanel, setRightPanel] = useGraphicDraftState("PhotoCraftWorkspace.jsx:rightPanel", "Propriedades");
  const [bottomPanel, setBottomPanel] = useGraphicDraftState("PhotoCraftWorkspace.jsx:bottomPanel", "Histórico");
  const [zoom, setZoom] = useGraphicDraftState("PhotoCraftWorkspace.jsx:zoom", 66.7);
  const [viewportOffset, setViewportOffset] = useGraphicDraftState("PhotoCraftWorkspace.jsx:viewportOffset", { x: 0, y: 0 });
  const [storedSelection, setSelection] = useGraphicDraftState("PhotoCraftWorkspace.jsx:selection", null);
  const selection = storedSelection?.type ? storedSelection : null;
  const [docSize, setDocSize] = useGraphicDraftState("PhotoCraftWorkspace.jsx:docSize", DOC_DEFAULT);
  const [brush, setBrush] = useGraphicDraftState("PhotoCraftWorkspace.jsx:brush", { size: 20, opacity: 100, flow: 100 });
  const [colors, setColors] = useGraphicDraftState("PhotoCraftWorkspace.jsx:colors", { fg: "#000000", bg: "#ffffff" });
  const [paths, setPaths] = useGraphicDraftState("PhotoCraftWorkspace.jsx:paths", []);
  const [workPath, setWorkPath] = useState([]);
  const [cropRect, setCropRect] = useState(null);
  const [cloneSource, setCloneSource] = useState(null);
  const [editingText, setEditingText] = useState(null);
  // O texto nasce no pointerdown do documento; o mousedown padrão que vem em seguida tira o foco
  // do span editável. O blur só fecha a edição depois que o span recebeu foco ou digitação.
  const textEditArmed = useRef(false);
  const [askText, textPromptDialog] = useTextPrompt();
  const [message, setMessage] = useState("");
  const [future, setFuture] = useState([]);
  const [leftTab, setLeftTab] = useState("Arquivos");
  const [layersTab, setLayersTab] = useState("Camadas");
  const [channel, setChannel] = useState("RGB");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [stageScale, setStageScale] = useState(1);
  const pointerGesture = useRef(null);
  const [layers, setLayers] = useGraphicDraftState("PhotoCraftWorkspace.jsx:layers", [
    makeLayer({ id: "adjust", name: "Curvas 1", kind: "◐", visible: true, locked: false }),
    makeLayer({
      id: "subject",
      name: "Pessoa recortada",
      kind: "▧",
      visible: true,
      locked: false,
    }),
    makeLayer({
      id: "photo",
      name: "Foto original",
      kind: "▦",
      visible: true,
      locked: false,
    }),
    makeLayer({
      id: "background",
      name: "Plano de fundo",
      kind: "■",
      visible: true,
      locked: true,
    }),
  ]);
  const [activeLayer, setActiveLayer] = useGraphicDraftState("PhotoCraftWorkspace.jsx:activeLayer", "subject");
  const [history, setHistory] = useGraphicDraftState("PhotoCraftWorkspace.jsx:history", []);
  const [adjust, setAdjust] = useGraphicDraftState("PhotoCraftWorkspace.jsx:adjust", {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
    temperature: 0,
    blur: 0,
  });
  const filterId = `mmphoto-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const imageStyle = useMemo(
    () => ({
      filter: `brightness(${100 + adjust.exposure}%) contrast(${100 + adjust.contrast}%) saturate(${100 + adjust.saturation}%) blur(${adjust.blur}px)${hasTone(adjust) ? ` url(#${filterId}-tone)` : ""}`,
    }),
    [adjust, filterId],
  );
  const tone = useMemo(() => toneLut(adjust), [adjust]);
  const source =
    selected || assets.find((asset) => asset.type.startsWith("image"));
  const selectedLayer = layers.find((layer) => layer.id === activeLayer) || layers[0];
  const backgroundLayer = layers.find((layer) => layer.id === "background");

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const sourceImgRef = useRef(null);
  const surfaces = useRef(new Map());
  const loading = useRef(new Map());
  const displays = useRef(new Map());
  const textRefs = useRef(new Map());
  const scaleInputRef = useRef(null);
  const cloneOffset = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = { layers, activeLayer, docSize, selection, stageScale, colors };
  const previousSource = useRef(source?.id);

  const lastNotice = useRef("");
  function notify(text) {
    lastNotice.current = text;
    setMessage(text);
  }

  function commit(label, update, nextDoc) {
    const current = stateRef.current;
    const next = typeof update === "function" ? update(current.layers) : update;
    stateRef.current = { ...current, layers: next, ...(nextDoc ? { docSize: nextDoc } : {}) };
    setHistory((entries) => pushHistory(entries, { label, layers: current.layers, activeLayer: current.activeLayer, docSize: current.docSize }));
    setFuture([]);
    setLayers(next);
    if (nextDoc) setDocSize(nextDoc);
  }

  function updateLayer(id, patch, label = "Editar camada") {
    commit(label, (current) => current.map((layer) => layer.id === id ? { ...layer, ...patch } : layer));
  }

  function updateTransform(key, value) {
    if (!selectedLayer || !Number.isFinite(value)) return;
    updateLayer(selectedLayer.id, { transform: { ...selectedLayer.transform, [key]: value } }, "Transformação livre");
  }

  function toggle(id) {
    commit("Alternar visibilidade", (old) =>
      old.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    );
  }

  function insertAboveActive(layer, label) {
    commit(label, (old) => {
      const index = Math.max(0, old.findIndex((item) => item.id === stateRef.current.activeLayer));
      return [...old.slice(0, index), layer, ...old.slice(index)];
    });
    setActiveLayer(layer.id);
  }

  function addLayer(name, point) {
    const id = crypto.randomUUID();
    const isText = name.startsWith("Texto");
    const scale = stateRef.current.stageScale;
    const doc = stateRef.current.docSize;
    const layer = makeLayer({
      id,
      name,
      kind: isText ? "T" : "▧",
      type: isText ? "text" : "raster",
      visible: true,
      locked: false,
      ...(isText ? { text: "Texto", color: colors.fg, fontSize: 30 / scale } : { bitmap: null }),
      ...(isText && point ? { transform: { ...DEFAULT_TRANSFORM, x: (point.x - doc.w / 2) * scale, y: (point.y - doc.h / 2) * scale } } : {}),
    });
    commit(`Criar ${name.toLowerCase()}`, (old) => [layer, ...old]);
    setActiveLayer(id);
    if (isText) setEditingText(id);
  }

  function addAdjustment(name) {
    const count = layers.filter((layer) => layer.adjustment?.name === name).length + 1;
    insertAboveActive(makeLayer({ id: crypto.randomUUID(), name: `${name} ${count}`, kind: "◐", type: "adjustment", visible: true, locked: false, adjustment: { name, ops: ADJUSTMENT_PRESETS[name] } }), `Camada de ajuste ${name}`);
    notify(`Camada de ajuste "${name}" criada: afeta todas as camadas abaixo. Use a opacidade para dosar.`);
  }

  function duplicateLayer() {
    if (!selectedLayer) return false;
    const copy = { ...selectedLayer, id: crypto.randomUUID(), name: `${selectedLayer.name} cópia`, transform: { ...selectedLayer.transform }, locked: false, ...(selectedLayer.id === "background" ? { type: "raster", bitmap: selectedLayer.bitmap || null } : {}) };
    if (selectedLayer.id === "background" && !selectedLayer.bitmap) {
      const canvas = rasterizeCanvas(selectedLayer);
      if (!canvas) return false;
      const src = canvas.toDataURL("image/png");
      surfaces.current.set(copy.id, { src, canvas });
      copy.bitmap = src;
    }
    commit("Duplicar camada", (current) => {
      const index = current.findIndex((layer) => layer.id === selectedLayer.id);
      return [...current.slice(0, index), copy, ...current.slice(index)];
    });
    setActiveLayer(copy.id);
    return true;
  }

  function removeLayer() {
    if (!selectedLayer || selectedLayer.locked) return;
    commit("Excluir camada", (current) => current.filter((layer) => layer.id !== selectedLayer.id));
    const index = layers.findIndex((layer) => layer.id === selectedLayer.id);
    setActiveLayer(layers[index + 1]?.id || layers[index - 1]?.id || "");
  }

  function moveLayer(direction) {
    const index = layers.findIndex((layer) => layer.id === activeLayer);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return;
    commit("Reordenar camada", (current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function restore(entry) {
    setLayers(entry.layers);
    setActiveLayer(entry.activeLayer);
    if (entry.docSize) setDocSize(entry.docSize);
    stateRef.current = { ...stateRef.current, layers: entry.layers, activeLayer: entry.activeLayer, docSize: entry.docSize || stateRef.current.docSize };
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((entries) => [...entries, { label: previous.label, layers, activeLayer, docSize }]);
    restore(previous);
    setHistory((entries) => entries.slice(0, -1));
  }

  function redo() {
    const next = future.at(-1);
    if (!next) return;
    setHistory((entries) => pushHistory(entries, { label: next.label, layers, activeLayer, docSize }));
    restore(next);
    setFuture((entries) => entries.slice(0, -1));
  }

  useEffect(() => {
    const layouts = {
      Essenciais: ["Propriedades", "Histórico", "Mover"],
      Fotografia: ["Ajustes", "Histórico", "Zoom"],
      Pintura: ["Propriedades", "Histórico", "Pincel"],
      "Gráfico e Web": ["Propriedades", "Caminhos", "Texto"],
      Movimento: ["Propriedades", "Histórico", "Mover"],
      "3D": ["Propriedades", "Canais", "Mover"],
    };
    const [panel, bottom, activeTool] = layouts[workspace];
    setRightPanel(panel);
    setBottomPanel(bottom);
    setTool(activeTool);
  }, [workspace]);

  // ------------------------------ superfícies de pixels ------------------------------

  function getSurface(key) {
    const entry = surfaces.current.get(key);
    return entry?.canvas || null;
  }

  function present(id) {
    const display = displays.current.get(id);
    const surface = getSurface(id);
    if (!display) return;
    const ctx = display.getContext?.("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, display.width, display.height);
    if (surface) ctx.drawImage(surface, (display.width - surface.width) / 2, (display.height - surface.height) / 2);
  }

  function loadSurface(key, src, layerId) {
    if (loading.current.get(key)?.src === src) return loading.current.get(key).promise;
    const promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const current = stateRef.current.layers.find((layer) => layer.id === layerId);
        const wanted = key.endsWith(":mask") ? current?.maskBitmap : current?.bitmap;
        if (wanted === src) {
          try {
            const canvas = createCanvas(image.naturalWidth || stateRef.current.docSize.w, image.naturalHeight || stateRef.current.docSize.h);
            context2d(canvas).drawImage(image, 0, 0);
            surfaces.current.set(key, { src, canvas });
            present(layerId);
          } catch {
            notify("Não foi possível carregar os pixels de uma camada neste navegador.");
          }
        }
        loading.current.delete(key);
        resolve();
      };
      image.onerror = () => {
        loading.current.delete(key);
        notify("Não foi possível carregar os pixels de uma camada.");
        resolve();
      };
      image.src = src;
    });
    loading.current.set(key, { src, promise });
    return promise;
  }

  function pendingSurfaces() {
    const pending = [];
    for (const layer of stateRef.current.layers) {
      for (const [key, src] of [[layer.id, layer.bitmap], [`${layer.id}:mask`, layer.maskBitmap]]) {
        if (src && surfaces.current.get(key)?.src !== src) pending.push(loadSurface(key, src, layer.id));
      }
    }
    return pending;
  }

  useEffect(() => {
    pendingSurfaces();
    for (const layer of layers) present(layer.id);
  }, [layers, docSize]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setStageScale(width / stateRef.current.docSize.w);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [docSize.w]);

  useEffect(() => {
    if (previousSource.current === source?.id) return;
    previousSource.current = source?.id;
    if (backgroundLayer?.bitmap) {
      commit("Abrir imagem", (current) => current.map((layer) => layer.id === "background" ? { ...layer, bitmap: null } : layer));
    }
  }, [source?.id]);

  useEffect(() => {
    if (!editingText) return undefined;
    textEditArmed.current = false;
    return focusNextFrame(() => {
      const node = textRefs.current.get(editingText);
      if (!node) return;
      node.focus?.();
      const range = document.createRange?.();
      if (range && window.getSelection) {
        range.selectNodeContents(node);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
    });
  }, [editingText]);

  function sourceReady() {
    const image = sourceImgRef.current;
    return image && image.complete && image.naturalWidth ? image : null;
  }

  function renderOptions() {
    return { docSize: stateRef.current.docSize, scale: stateRef.current.stageScale, getSurface, sourceImage: sourceReady() };
  }

  function rasterizeCanvas(layer) {
    try {
      if (layer.id === "background" && source?.type?.startsWith("image") && !sourceReady()) {
        notify("A imagem ainda está carregando. Tente novamente em instantes.");
        return null;
      }
      return bakeLayer(layer, renderOptions());
    } catch (error) {
      notify(error.message);
      return null;
    }
  }

  /** Garante que a camada tenha pixels editáveis; rasteriza conteúdo vetorial/texto quando preciso. */
  function ensureRaster(layer) {
    if (!layer) return null;
    const type = layerType(layer);
    if (type === "adjustment") {
      notify("Camadas de ajuste não têm pixels. Selecione uma camada de imagem.");
      return null;
    }
    if (!layer.visible) {
      notify("A camada está oculta. Mostre a camada para editá-la.");
      return null;
    }
    if (type === "raster" || (type === "background" && layer.bitmap)) {
      if (layer.bitmap && surfaces.current.get(layer.id)?.src !== layer.bitmap) {
        pendingSurfaces();
        notify("Carregando os pixels da camada. Tente novamente em instantes.");
        return null;
      }
      if (!getSurface(layer.id)) {
        try {
          surfaces.current.set(layer.id, { src: layer.bitmap || null, canvas: createCanvas(docSize.w, docSize.h) });
        } catch (error) {
          notify(error.message);
          return null;
        }
      }
      return getSurface(layer.id);
    }
    const canvas = rasterizeCanvas(layer);
    if (!canvas) return null;
    const src = canvas.toDataURL("image/png");
    surfaces.current.set(layer.id, { src, canvas });
    const patch = { bitmap: src, transform: { ...DEFAULT_TRANSFORM }, ...(type === "background" ? {} : { type: "raster" }) };
    commit(type === "text" ? "Rasterizar texto" : "Rasterizar camada", (current) => current.map((item) => item.id === layer.id ? { ...item, ...patch } : item));
    if (type === "text") notify("O texto foi rasterizado para edição de pixels.");
    return canvas;
  }

  function finishPixels(layerId, label) {
    const surface = getSurface(layerId);
    if (!surface) return;
    const src = surface.toDataURL("image/png");
    surfaces.current.set(layerId, { src, canvas: surface });
    commit(label, (current) => current.map((layer) => layer.id === layerId ? { ...layer, bitmap: src } : layer));
    present(layerId);
  }

  function currentLayer() {
    const state = stateRef.current;
    return state.layers.find((layer) => layer.id === state.activeLayer) || state.layers[0];
  }

  /** Máscara (canvas) da seleção no espaço de pixels da camada; null = sem seleção. */
  function selectionMaskFor(layer, surface) {
    const sel = stateRef.current.selection;
    if (!sel) return null;
    const mask = createCanvas(surface.width, surface.height);
    const ctx = context2d(mask);
    const { w, h } = stateRef.current.docSize;
    const t = layer.transform || DEFAULT_TRANSFORM;
    const scale = stateRef.current.stageScale;
    ctx.translate(surface.width / 2, surface.height / 2);
    ctx.rotate((-(t.rotation || 0) * Math.PI) / 180);
    ctx.scale(100 / (t.scale || 100), 100 / (t.scale || 100));
    ctx.translate(-w / 2 - (t.x || 0) / scale, -h / 2 - (t.y || 0) / scale);
    ctx.fillStyle = "#fff";
    traceSelection(ctx, sel);
    ctx.fill();
    return mask;
  }

  /** Aplica uma operação de pixels à camada ativa, limitada pela seleção. */
  function applyPixelOperation(label, operation) {
    const layer = currentLayer();
    const surface = ensureRaster(layer);
    if (!surface) return false;
    try {
      const ctx = context2d(surface);
      const { width, height } = surface;
      const image = ctx.getImageData(0, 0, width, height);
      const processed = Uint8ClampedArray.from(image.data);
      operation(processed, width, height);
      const mask = selectionMaskFor(layer, surface);
      const coverage = mask ? Uint8Array.from(context2d(mask).getImageData(0, 0, width, height).data.filter((_, index) => index % 4 === 3)) : new Uint8Array(width * height).fill(255);
      mixByCoverage(image.data, processed, coverage);
      ctx.putImageData(image, 0, 0);
      finishPixels(layer.id, label);
      notify(`${label} aplicado em "${layer.name}".`);
      return true;
    } catch (error) {
      notify(`Não foi possível aplicar ${label.toLowerCase()}: ${error.message}`);
      return false;
    }
  }

  function fillSelection(color) {
    const rgb = hexToRgb(color);
    applyPixelOperation("Preencher", (data) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = Math.round(255 * (brush.opacity / 100));
      }
    });
  }

  function clearSelectionPixels() {
    if (!stateRef.current.selection) return notify("Faça uma seleção para limpar os pixels.");
    applyPixelOperation("Limpar seleção", (data) => {
      for (let i = 3; i < data.length; i += 4) data[i] = 0;
    });
  }

  function runFilter(name) {
    if (name === "Desfoque") applyPixelOperation("Desfoque", (data, w, h) => boxBlur(data, w, h, 4));
    else if (name === "Nitidez") applyPixelOperation("Nitidez", (data, w, h) => sharpen(data, w, h, 0.6));
    else if (name === "Ruído") applyPixelOperation("Ruído", (data) => addNoise(data, 25));
    else if (name === "Pixelização") applyPixelOperation("Pixelização", (data, w, h) => pixelate(data, w, h, 12));
    else if (name === "Render") applyPixelOperation("Render nuvens", (data, w, h) => renderClouds(data, w, h, colors.fg, colors.bg));
    else if (name === "Camera Raw") {
      setRightPanel("Propriedades");
      setDetailsOpen(true);
      notify("Camera Raw: use os controles de Ajustes da imagem (exposição, contraste, realces, sombras, saturação, temperatura). Arquivos RAW de câmera não são decodificados no navegador.");
    } else if (name === "Liquify") notify("Liquify (deformação interativa) ainda não está disponível no MMPhoto.");
    else if (name === "Neural") notify("Filtros neurais exigem modelos de IA e não estão disponíveis no MMPhoto.");
  }

  function toggleFx() {
    if (!selectedLayer || layerType(selectedLayer) === "adjustment") return notify("Selecione uma camada de imagem ou texto para aplicar estilo.");
    const enabled = !selectedLayer.fx?.shadow;
    updateLayer(selectedLayer.id, { fx: { ...selectedLayer.fx, shadow: enabled } }, enabled ? "Estilo: sombra projetada" : "Remover estilo");
    notify(enabled ? `Sombra projetada aplicada em "${selectedLayer.name}". Clique em fx de novo para remover.` : `Estilo removido de "${selectedLayer.name}".`);
  }

  function addMask() {
    if (!selectedLayer) return;
    const sel = stateRef.current.selection;
    if (!sel) {
      updateLayer(selectedLayer.id, { mask: true }, "Adicionar máscara");
      return;
    }
    const surface = ensureRaster(selectedLayer);
    if (!surface) return;
    const layer = currentLayer();
    try {
      const mask = selectionMaskFor(layer, surface);
      const src = mask.toDataURL("image/png");
      surfaces.current.set(`${layer.id}:mask`, { src, canvas: mask });
      updateLayer(layer.id, { mask: true, maskBitmap: src }, "Adicionar máscara");
      notify("Máscara criada a partir da seleção: a área fora da seleção ficou oculta.");
    } catch (error) {
      notify(error.message);
    }
  }

  // ------------------------------ documento inteiro ------------------------------

  /** Recorte, tamanho e rotação: rasteriza camadas de pixels e reposiciona textos. */
  function transformDocument(label, nextDoc, draw, mapPoint, textPatch = () => ({})) {
    if (pendingSurfaces().length) {
      notify("Carregando os pixels das camadas. Tente novamente em instantes.");
      return false;
    }
    const { docSize: doc, stageScale: scale, layers: current } = stateRef.current;
    try {
      const next = current.map((layer) => {
        const type = layerType(layer);
        if (type === "adjustment") return layer;
        if (type === "text") {
          const pos = mapPoint({ x: doc.w / 2 + (layer.transform.x || 0) / scale, y: doc.h / 2 + (layer.transform.y || 0) / scale });
          return { ...layer, ...textPatch(layer), transform: { ...layer.transform, x: (pos.x - nextDoc.w / 2) * scale, y: (pos.y - nextDoc.h / 2) * scale } };
        }
        if (layer.id === "background" && source?.type?.startsWith("image") && !layer.bitmap && !sourceReady()) throw new Error("A imagem ainda está carregando.");
        const mapCanvas = (baked) => {
          const out = createCanvas(nextDoc.w, nextDoc.h);
          const ctx = context2d(out);
          draw(ctx, baked);
          return out;
        };
        const canvas = mapCanvas(bakeLayer(layer, renderOptions()));
        const src = canvas.toDataURL("image/png");
        surfaces.current.set(layer.id, { src, canvas });
        let maskPatch = {};
        if (layer.maskBitmap && getSurface(`${layer.id}:mask`)) {
          const bakedMask = createCanvas(doc.w, doc.h);
          const maskSurface = getSurface(`${layer.id}:mask`);
          const mctx = context2d(bakedMask);
          mctx.save();
          mctx.translate(doc.w / 2 + (layer.transform.x || 0) / scale, doc.h / 2 + (layer.transform.y || 0) / scale);
          mctx.scale((layer.transform.scale ?? 100) / 100, (layer.transform.scale ?? 100) / 100);
          mctx.rotate(((layer.transform.rotation || 0) * Math.PI) / 180);
          mctx.drawImage(maskSurface, -maskSurface.width / 2, -maskSurface.height / 2);
          mctx.restore();
          const mask = mapCanvas(bakedMask);
          const maskSrc = mask.toDataURL("image/png");
          surfaces.current.set(`${layer.id}:mask`, { src: maskSrc, canvas: mask });
          maskPatch = { maskBitmap: maskSrc };
        }
        return { ...layer, ...(type === "background" ? {} : { type: "raster" }), bitmap: src, transform: { ...DEFAULT_TRANSFORM }, ...maskPatch };
      });
      commit(label, next, nextDoc);
      setSelection(null);
      notify(`${label}: documento com ${nextDoc.w} × ${nextDoc.h} px.`);
      return true;
    } catch (error) {
      notify(`${label} não aplicado: ${error.message}`);
      return false;
    }
  }

  function cropDocument(rect) {
    const { docSize } = stateRef.current;
    const r = clampRect(rect, docSize.w, docSize.h);
    if (r.w < 2 || r.h < 2) return false;
    return transformDocument("Recortar", { w: r.w, h: r.h }, (ctx, baked) => ctx.drawImage(baked, -r.x, -r.y), (p) => ({ x: p.x - r.x, y: p.y - r.y }));
  }

  async function resizeImage() {
    const answer = await askText(`Tamanho da imagem — nova largura em pixels (atual: ${docSize.w} × ${docSize.h}; altura proporcional):`, String(docSize.w));
    if (answer == null) return;
    const width = Math.round(Number(answer));
    if (!Number.isFinite(width) || width < 1 || width > 16000) return notify("Largura inválida. Informe um número entre 1 e 16000.");
    resizeDocument(width);
  }

  function resizeDocument(width) {
    const { docSize, stageScale } = stateRef.current;
    const k = width / docSize.w;
    const next = { w: width, h: Math.max(1, Math.round(docSize.h * k)) };
    return transformDocument("Tamanho da imagem", next, (ctx, baked) => {
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(baked, 0, 0, next.w, next.h);
    }, (p) => ({ x: p.x * k, y: p.y * k }), (layer) => ({ fontSize: (layer.fontSize || 30 / stageScale) * k }));
  }

  async function rotateImage() {
    const answer = await askText("Rotação da imagem — ângulo (90, -90 ou 180):", "90");
    if (answer == null) return;
    const angle = Number(answer);
    if (![90, -90, 180].includes(angle)) return notify("Ângulo inválido. Use 90, -90 ou 180.");
    rotateDocument(angle);
  }

  function rotateDocument(angle) {
    const { docSize } = stateRef.current;
    const next = angle === 180 ? { ...docSize } : { w: docSize.h, h: docSize.w };
    const rad = (angle * Math.PI) / 180;
    return transformDocument("Rotação da imagem", next, (ctx, baked) => {
      ctx.translate(next.w / 2, next.h / 2);
      ctx.rotate(rad);
      ctx.drawImage(baked, -docSize.w / 2, -docSize.h / 2);
    }, (p) => {
      const dx = p.x - docSize.w / 2;
      const dy = p.y - docSize.h / 2;
      return { x: next.w / 2 + dx * Math.cos(rad) - dy * Math.sin(rad), y: next.h / 2 + dx * Math.sin(rad) + dy * Math.cos(rad) };
    }, (layer) => ({ transform: { ...layer.transform, rotation: (layer.transform.rotation || 0) + angle } }));
  }

  function flatten(background) {
    return renderDocument({ layers: stateRef.current.layers, adjust, background, ...renderOptions() });
  }

  async function exportImage(format) {
    try {
      await Promise.all(pendingSurfaces());
      if (source?.type?.startsWith("image") && !backgroundLayer?.bitmap && !sourceReady()) throw new Error("a imagem ainda está carregando");
      const jpg = format === "jpg";
      const canvas = flatten(jpg ? "#ffffff" : undefined);
      const blob = await canvasToBlob(canvas, jpg ? "image/jpeg" : "image/png", jpg ? 0.92 : undefined);
      const base = (source?.name || "mmphoto-documento").replace(/\.[^.]+$/, "");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${base}.${jpg ? "jpg" : "png"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notify(`Exportado ${link.download} (${canvas.width} × ${canvas.height} px).`);
    } catch (error) {
      const blocked = error?.name === "SecurityError";
      notify(blocked ? "O navegador bloqueou a exportação porque a imagem vem de outra origem." : `Falha ao exportar: ${error?.message || error}`);
    }
  }

  /** Remove o fundo da camada ativa com a máscara de pessoa do modelo local (MediaPipe). */
  async function removePersonBackgroundFromLayer() {
    const layer = currentLayer();
    const surface = ensureRaster(layer);
    if (!surface) return false;
    let mask;
    try {
      mask = await segmentPersonCanvas(surface);
    } catch (error) {
      notify(error.message);
      return false;
    }
    const person = mask.values.reduce((count, value) => count + (value > 0.5 ? 1 : 0), 0);
    if (person < mask.values.length * 0.005) {
      notify("Nenhuma pessoa identificada na camada: nada foi alterado. Para objetos em fundo de cor única, use Remover fundo liso.");
      return false;
    }
    return applyPixelOperation("Remover fundo", (data, width, height) => applyMaskResampled(data, width, height, mask));
  }

  /** Recorta (ou apaga) o objeto sob o ponto, com o modelo local de recorte interativo (MediaPipe). */
  async function removeObjectFromLayer({ x, y, keepObject }) {
    const layer = currentLayer();
    const surface = ensureRaster(layer);
    if (!surface) return false;
    let mask;
    try {
      mask = await segmentObjectCanvas(surface, { x, y });
    } catch (error) {
      notify(error.message);
      return false;
    }
    const inside = mask.values.reduce((count, value) => count + (value > 0.5 ? 1 : 0), 0);
    if (inside < mask.values.length * 0.002) {
      notify("A IA não encontrou um objeto nesse ponto: nada foi alterado. Mova o ponto para cima do objeto ou faça uma seleção sobre ele.");
      return false;
    }
    const values = keepObject ? mask.values : mask.values.map((value) => 1 - value);
    return applyPixelOperation(keepObject ? "Recortar objeto" : "Apagar objeto", (data, width, height) => applyMaskResampled(data, width, height, { ...mask, values }));
  }

  /** Exporta várias versões do documento achatado num .zip (não altera o documento). */
  async function exportVariantsZip({ files, format }) {
    try {
      await Promise.all(pendingSurfaces());
      if (source?.type?.startsWith("image") && !backgroundLayer?.bitmap && !sourceReady()) throw new Error("a imagem ainda está carregando");
      const jpg = format === "jpg";
      const flat = flatten(jpg ? "#ffffff" : undefined);
      const entries = {};
      for (const file of files) {
        const canvas = createCanvas(file.width, file.height);
        const ctx = context2d(canvas);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(flat, file.rect.x, file.rect.y, file.rect.w, file.rect.h, 0, 0, file.width, file.height);
        const blob = await canvasToBlob(canvas, jpg ? "image/jpeg" : "image/png", jpg ? 0.9 : undefined);
        entries[file.name] = new Uint8Array(await blob.arrayBuffer());
      }
      const zip = new Blob([zipSync(entries, { level: 0 })], { type: "application/zip" });
      const base = (source?.name || "mmphoto-documento").replace(/\.[^.]+$/, "");
      const url = URL.createObjectURL(zip);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${base}-variacoes.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notify(`Exportado ${link.download} com ${files.length} arquivo(s).`);
      return true;
    } catch (error) {
      notify(error?.name === "SecurityError" ? "O navegador bloqueou a exportação porque a imagem vem de outra origem." : `Falha ao exportar variações: ${error?.message || error}`);
      return false;
    }
  }

  async function exportAs() {
    const answer = await askText("Exportar como — formato (png ou jpg):", "png");
    if (answer == null) return;
    const format = answer.trim().toLowerCase().replace(".", "");
    if (format === "png") exportImage("png");
    else if (format === "jpg" || format === "jpeg") exportImage("jpg");
    else notify("Formato não suportado. Use png ou jpg.");
  }

  function saveDocument() {
    const content = JSON.stringify({ schema: "mmphoto-document/v1", docSize, layers, adjust, paths }, null, 2);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    link.download = "mmphoto-documento.json";
    link.click();
    URL.revokeObjectURL(link.href);
    notify("Documento salvo em JSON do MMPhoto (camadas e pixels). A gravação em formato PSD ainda não está disponível.");
  }

  function selectSubject() {
    const layer = currentLayer();
    if (!layer || layerType(layer) === "adjustment") return notify("Selecione uma camada de imagem.");
    try {
      const canvas = bakeLayer(layer, renderOptions());
      const { width, height } = canvas;
      const data = context2d(canvas).getImageData(0, 0, width, height).data;
      const coverage = new Uint8Array(width * height);
      for (let p = 0; p < coverage.length; p += 1) coverage[p] = data[p * 4 + 3] > 127 ? 1 : 0;
      const sel = spansFromCoverage(coverage, width, height);
      if (!sel) return notify("A camada não tem pixels visíveis para selecionar.");
      setSelection({ ...sel, tool: "Selecionar assunto" });
      notify(`Seleção criada pelos pixels de "${layer.name}" (sem detecção por IA).`);
    } catch (error) {
      notify(error.message);
    }
  }

  function freeTransform() {
    setTool("Mover");
    setRightPanel("Propriedades");
    notify("Transformação livre: arraste para mover e ajuste escala e rotação nos campos de Transformar.");
    setTimeout(() => scaleInputRef.current?.querySelector("input")?.focus(), 0);
  }

  function runMenuCommand(command) {
    setOpenMenu(null);
    if (command === "Abrir imagem") document.getElementById("mmphoto-open")?.click();
    else if (command === "Salvar documento") saveDocument();
    else if (command === "Exportar PNG") exportImage("png");
    else if (command === "Exportar JPG") exportImage("jpg");
    else if (command === "Desfazer") undo();
    else if (command === "Refazer") redo();
    else if (command === "Duplicar camada") duplicateLayer();
    else if (command === "Transformação livre") freeTransform();
    else if (command === "Nova camada") addLayer("Camada");
    else if (command === "Nova camada de texto") addLayer(`Texto ${layers.length + 1}`);
    else if (command === "Adicionar máscara") addMask();
    else if (command === "Excluir camada") removeLayer();
    else if (command === "Ajustes") setRightPanel("Ajustes");
    else if (command === "Propriedades") setRightPanel("Propriedades");
    else if (command === "Camadas") setLayersTab("Camadas");
    else if (command === "Histórico") setBottomPanel("Histórico");
    else if (command === "Tamanho da imagem") resizeImage();
    else if (command === "Rotação da imagem") rotateImage();
    else if (command === "Selecionar tudo") setSelection({ type: "rect", tool: "Selecionar tudo", rect: { x: 0, y: 0, w: docSize.w, h: docSize.h } });
    else if (command === "Selecionar assunto") selectSubject();
    else if (command === "Desmarcar") setSelection(null);
    else if (command === "Ajustar à tela") {
      setZoom(66.7);
      setViewportOffset({ x: 0, y: 0 });
    } else if (command === "100%") setZoom(100);
    else if (["Desfoque", "Nitidez", "Camera Raw"].includes(command)) runFilter(command);
    else if (command === "Nova camada 3D") notify("Camadas 3D não estão disponíveis no MMPhoto. Use o MM3D para cenas 3D.");
    else if (command === "Atalhos do MMPhoto") notify(SHORTCUTS_TEXT);
    else if (command === "Sobre o MMPhoto") notify("MMPhoto — editor de imagens em camadas do MediaMind, executado no navegador (canvas 2D). Comportamento das ferramentas inspirado no PhotoCraft (Apache-2.0).");
  }

  // Ferramentas de um clique do MCP (grade de ícones no Copiloto): planejam sobre o estado atual
  // e aplicam pelos mesmos caminhos do app (commit, pixels da camada ativa, documento), com desfazer.
  const toolActions = useRef(null);
  toolActions.current = { commit, applyPixelOperation, duplicateLayer, exportVariantsZip, removePersonBackgroundFromLayer, removeObjectFromLayer, rotateDocument, resizeDocument, cropDocument, undo, setActiveLayer, notify, canUndo: history.length > 0 };
  useEffect(() => {
    if (!active) return undefined;
    const strip = ({ layers: _layers, activeLayer: _active, pixels: _pixels, document: _document, label: _label, duplicateBackground: _duplicate, exportZip: _zip, segmentPerson: _segment, segmentObject: _object, ...result }) => result;
    const plan = (toolId, params) => runMMPhotoTool(toolId, stateRef.current, params);
    return registerMCPActions({
      source: "mmphoto",
      label: "MMPhoto",
      catalogue: mmphotoCatalogue,
      analyze: async (toolId, params) => {
        const result = plan(toolId, params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const result = plan(toolId, params);
        if (!result.ok) return strip(result);
        const actions = toolActions.current;
        if (result.exportZip) {
          // Exportar não altera o documento: não entra no desfazer.
          if (!(await actions.exportVariantsZip(result.exportZip))) return { ok: false, summary: lastNotice.current };
          return strip(result);
        }
        let done = true;
        if (result.layers) {
          actions.commit(result.label, result.layers);
          if (result.activeLayer !== undefined) {
            stateRef.current = { ...stateRef.current, activeLayer: result.activeLayer };
            actions.setActiveLayer(result.activeLayer);
          }
        } else if (result.duplicateBackground) done = actions.duplicateLayer();
        else if (result.segmentPerson) done = await actions.removePersonBackgroundFromLayer();
        else if (result.segmentObject) done = await actions.removeObjectFromLayer(result.segmentObject);
        else if (result.pixels) done = actions.applyPixelOperation(result.label, result.pixels);
        else if (result.document.kind === "rotate") done = actions.rotateDocument(result.document.angle);
        else if (result.document.kind === "resize") done = actions.resizeDocument(result.document.width);
        else done = actions.cropDocument(result.document.rect);
        if (!done) return { ok: false, summary: lastNotice.current };
        actions.canUndo = true;
        actions.notify(`MCP · ${result.summary}`);
        return strip(result);
      },
      undo: () => {
        if (!toolActions.current.canUndo) return false;
        toolActions.current.undo();
        return true;
      },
      canUndo: () => toolActions.current.canUndo,
    });
  }, [active]);

  // ------------------------------ ferramentas no documento ------------------------------

  function docPoint(event) {
    const { w, h } = stateRef.current.docSize;
    const rect = stageRef.current?.getBoundingClientRect?.();
    if (!rect || !rect.width || !rect.height) return { x: w / 2, y: h / 2 };
    return { x: ((event.clientX - rect.left) / rect.width) * w, y: ((event.clientY - rect.top) / rect.height) * h };
  }

  function screenPerDoc() {
    const rect = stageRef.current?.getBoundingClientRect?.();
    return rect?.width ? rect.width / stateRef.current.docSize.w : (zoom / 66.7) * stageScale;
  }

  function pickColor(point) {
    try {
      const canvas = flatten();
      const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(point.x)));
      const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(point.y)));
      const [r, g, b] = context2d(canvas).getImageData(x, y, 1, 1).data;
      const hex = rgbToHex([r, g, b]);
      setColors((old) => ({ ...old, fg: hex }));
      notify(`Cor de primeiro plano: ${hex}`);
    } catch (error) {
      notify(error.message);
    }
  }

  function quickSelect(point) {
    try {
      const canvas = flatten();
      const data = context2d(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
      const sel = floodSelect(data, canvas.width, canvas.height, point.x, point.y, 32);
      if (!sel) return notify("Clique dentro do documento para selecionar.");
      setSelection({ ...sel, tool: "Seleção rápida" });
    } catch (error) {
      notify(error.message);
    }
  }

  function beginStroke(event, point) {
    const layer = currentLayer();
    const surface = ensureRaster(layer);
    if (!surface) return;
    const active = currentLayer();
    try {
      const snapshot = createCanvas(surface.width, surface.height);
      context2d(snapshot).drawImage(surface, 0, 0);
      const stroke = createCanvas(surface.width, surface.height);
      const local = toSurfacePoint(active, surface, point);
      if (tool === "Clone") {
        if (!cloneOffset.current) cloneOffset.current = { x: cloneSource.x - point.x, y: cloneSource.y - point.y };
      }
      pointerGesture.current = { tool, layerId: active.id, surface, snapshot, stroke, mask: selectionMaskFor(active, surface), last: local, scaleFactor: 100 / (active.transform?.scale || 100) };
      drawDab(local, local);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch (error) {
      notify(error.message);
    }
  }

  function toSurfacePoint(layer, surface, point) {
    const { w, h } = stateRef.current.docSize;
    const p = toLayerPoint(point, layer.transform, w, h, stateRef.current.stageScale);
    return { x: p.x + (surface.width - w) / 2, y: p.y + (surface.height - h) / 2 };
  }

  function drawDab(from, to) {
    const g = pointerGesture.current;
    const ctx = context2d(g.stroke);
    const size = brush.size * g.scaleFactor;
    ctx.globalAlpha = brush.flow / 100;
    if (g.tool === "Clone") {
      const offset = cloneOffset.current;
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, size / 4)));
      for (let i = 1; i <= steps; i += 1) {
        const x = from.x + ((to.x - from.x) * i) / steps;
        const y = from.y + ((to.y - from.y) * i) / steps;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(g.snapshot, -offset.x, -offset.y);
        ctx.restore();
      }
    } else {
      ctx.strokeStyle = colors.fg;
      ctx.fillStyle = colors.fg;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size;
      ctx.beginPath();
      if (from.x === to.x && from.y === to.y) {
        ctx.arc(to.x, to.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    composeStroke();
  }

  function composeStroke() {
    const g = pointerGesture.current;
    const ctx = context2d(g.surface);
    let stroke = g.stroke;
    if (g.mask) {
      stroke = createCanvas(g.stroke.width, g.stroke.height);
      const sctx = context2d(stroke);
      sctx.drawImage(g.stroke, 0, 0);
      sctx.globalCompositeOperation = "destination-in";
      sctx.drawImage(g.mask, 0, 0);
    }
    ctx.clearRect(0, 0, g.surface.width, g.surface.height);
    ctx.drawImage(g.snapshot, 0, 0);
    ctx.globalAlpha = brush.opacity / 100;
    ctx.globalCompositeOperation = g.tool === "Borracha" ? "destination-out" : "source-over";
    ctx.drawImage(stroke, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    present(g.layerId);
  }

  function handlePointerDown(event) {
    if (event.button && event.button !== 0) return;
    const point = docPoint(event);
    if (tool === "Texto") {
      const target = event.target.closest?.("[data-text-layer]");
      if (target) {
        setActiveLayer(target.dataset.textLayer);
        setEditingText(target.dataset.textLayer);
        return;
      }
      return addLayer(`Texto ${layers.length + 1}`, point);
    }
    if (tool === "Zoom") return setZoom((value) => event.altKey ? Math.max(12, Math.round((value - 25) * 10) / 10) : Math.min(200, value + 25));
    if (tool === "Seleção rápida") return quickSelect(point);
    if (tool === "Caneta") {
      const first = workPath[0];
      if (first && workPath.length > 2 && Math.hypot(first.x - point.x, first.y - point.y) * screenPerDoc() < 10) return closeWorkPath();
      return setWorkPath((old) => [...old, point]);
    }
    if (tool === "Pincel" && event.altKey) return pickColor(point);
    if (tool === "Clone" && event.altKey) {
      setCloneSource(point);
      cloneOffset.current = null;
      return notify("Origem do clone definida. Pinte para copiar a partir dela.");
    }
    if (tool === "Clone" && !cloneSource) return notify("Alt+clique para definir a origem do clone.");
    if (PAINT_TOOLS.includes(tool)) return beginStroke(event, point);
    if (tool === "Mover" && (!selectedLayer || selectedLayer.locked)) {
      notify("A camada está bloqueada para movimento.");
      return;
    }
    if (tool === "Mover") commit("Mover", (current) => current);
    pointerGesture.current = {
      tool,
      start: point,
      points: [point],
      startX: event.clientX,
      startY: event.clientY,
      transform: { ...selectedLayer.transform },
      offset: { ...viewportOffset },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const gesture = pointerGesture.current;
    if (!gesture) return;
    if (PAINT_TOOLS.includes(gesture.tool) && gesture.surface) {
      const layer = stateRef.current.layers.find((item) => item.id === gesture.layerId);
      const local = toSurfacePoint(layer, gesture.surface, docPoint(event));
      try {
        drawDab(gesture.last, local);
      } catch (error) {
        notify(error.message);
      }
      gesture.last = local;
      return;
    }
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (gesture.tool === "Mão") setViewportOffset({ x: gesture.offset.x + dx, y: gesture.offset.y + dy });
    if (gesture.tool === "Mover" && selectedLayer && !selectedLayer.locked) {
      const k = stageScale / screenPerDoc();
      setLayers((old) => old.map((layer) => layer.id === selectedLayer.id ? { ...layer, transform: { ...layer.transform, x: Math.round(gesture.transform.x + dx * k), y: Math.round(gesture.transform.y + dy * k) } } : layer));
    }
    const point = docPoint(event);
    if (gesture.tool === "Letreiro") setSelection({ type: "rect", tool: "Letreiro", rect: normalizeRect(gesture.start, point) });
    if (gesture.tool === "Recorte") setCropRect(normalizeRect(gesture.start, point));
    if (gesture.tool === "Laço") {
      gesture.points.push(point);
      setSelection({ type: "polygon", tool: "Laço", points: [...gesture.points] });
    }
  }

  function handlePointerUp(event) {
    const gesture = pointerGesture.current;
    pointerGesture.current = null;
    if (!gesture) return;
    if (PAINT_TOOLS.includes(gesture.tool) && gesture.surface) {
      finishPixels(gesture.layerId, gesture.tool);
      return;
    }
    const point = docPoint(event);
    if (gesture.tool === "Letreiro") {
      const rect = clampRect(normalizeRect(gesture.start, point), docSize.w, docSize.h);
      setSelection(rect.w > 1 && rect.h > 1 ? { type: "rect", tool: "Letreiro", rect } : null);
    }
    if (gesture.tool === "Laço") {
      setSelection(gesture.points.length > 2 ? { type: "polygon", tool: "Laço", points: gesture.points } : null);
    }
    if (gesture.tool === "Recorte") {
      setCropRect(null);
      cropDocument(normalizeRect(gesture.start, point));
    }
  }

  function closeWorkPath() {
    if (workPath.length < 2) return;
    const path = { id: crypto.randomUUID(), name: `Caminho ${paths.length + 1}`, points: workPath };
    setPaths((old) => [...old, path]);
    setWorkPath([]);
    notify(`${path.name} salvo em Caminhos. Ctrl+Enter ou clique no caminho para transformá-lo em seleção.`);
    return path;
  }

  function pathToSelection(path) {
    if (!path || path.points.length < 3) return notify("O caminho precisa de pelo menos 3 pontos para virar seleção.");
    setSelection({ type: "polygon", tool: "Caminho", points: path.points });
  }

  function commitText(layer, node) {
    setEditingText(null);
    const text = node.textContent || "";
    if (text !== (layer.text ?? "Texto")) updateLayer(layer.id, { text }, "Editar texto");
  }

  // ------------------------------ atalhos de teclado ------------------------------

  const keyHandler = useRef(null);
  keyHandler.current = (event) => {
    if (!rootRef.current || rootRef.current.closest("[hidden]") || isEditableTarget(event.target)) return;
    const key = event.key;
    const ctrl = event.ctrlKey || event.metaKey;
    const lower = key.toLowerCase();
    if (ctrl && lower === "z" && event.shiftKey) return event.preventDefault(), redo();
    if (ctrl && lower === "z") return event.preventDefault(), undo();
    if (ctrl && lower === "y") return event.preventDefault(), redo();
    if (ctrl && lower === "a") return event.preventDefault(), runMenuCommand("Selecionar tudo");
    if (ctrl && lower === "d") return event.preventDefault(), setSelection(null);
    if (ctrl && lower === "t") return event.preventDefault(), freeTransform();
    if (ctrl && key === "Enter") return pathToSelection(workPath.length ? closeWorkPath() : paths.at(-1));
    if (key === "Enter" && tool === "Caneta") return closeWorkPath();
    if (key === "Escape") {
      setWorkPath([]);
      setCropRect(null);
      return;
    }
    if (key === "Backspace" && event.altKey) return event.preventDefault(), fillSelection(colors.fg);
    if (key === "Backspace" && ctrl) return event.preventDefault(), fillSelection(colors.bg);
    if (key === "Delete" || key === "Backspace") return clearSelectionPixels();
    if (ctrl || event.altKey) return;
    if (key === "[") return setBrush((old) => ({ ...old, size: Math.max(1, Math.round(old.size / 1.2)) }));
    if (key === "]") return setBrush((old) => ({ ...old, size: Math.min(1000, Math.round(old.size * 1.2) + 1) }));
    const digit = /^Digit(\d)$/.exec(event.code || "")?.[1] ?? (/^\d$/.test(key) ? key : null);
    if (digit !== null) {
      const value = digit === "0" ? 100 : Number(digit) * 10;
      return setBrush((old) => (event.shiftKey ? { ...old, flow: value } : { ...old, opacity: value }));
    }
    if (lower === "x") return setColors((old) => ({ fg: old.bg, bg: old.fg }));
    if (lower === "d") return setColors({ fg: "#000000", bg: "#ffffff" });
    const match = TOOLS.find(([shortcut]) => shortcut.toLowerCase() === lower);
    if (match) setTool(match[1]);
  };
  useEffect(() => {
    const listener = (event) => keyHandler.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // ------------------------------ renderização ------------------------------

  const channelMatrix = CHANNEL_ROWS[channel];
  const historyItems = ["Abrir", ...history.map((entry) => entry.label)];
  const stageStyle = { gridArea: "1 / 1" };
  const layerStyle = (layer, index) => ({
    transform: `translate(${layer.transform.x}px, ${layer.transform.y}px) scale(${layer.transform.scale / 100}) rotate(${layer.transform.rotation}deg)`,
    mixBlendMode: layer.blendMode,
    opacity: layer.opacity / 100,
    zIndex: index + 2,
    ...(layer.fx?.shadow ? { filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.5))" } : {}),
    ...(layer.maskBitmap ? { maskImage: `url(${layer.maskBitmap})`, WebkitMaskImage: `url(${layer.maskBitmap})`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" } : {}),
  });
  const setDisplay = (id) => (node) => {
    if (node) {
      displays.current.set(id, node);
      present(id);
    } else displays.current.delete(id);
  };
  const showRaster = (layer) => layerType(layer) === "raster";

  const sampleTable = (values) => Array.from({ length: 17 }, (_, i) => (values[Math.min(255, i * 16)] / 255).toFixed(4)).join(" ");

  return (
    <section ref={rootRef} className="space-y-2 bg-[#171717] text-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold text-white">MMPhoto</h1>
          <p className="text-[10px] text-slate-500">
            Documento RGB/16 · perfil sRGB IEC61966-2.1
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={saveDocument} className="rounded border border-slate-700 px-3 py-2 text-xs">
            <Save size={14} className="mr-1 inline" />
            Salvar PSD
          </button>
          <label className="cursor-pointer rounded bg-blue-500 px-3 py-2 text-xs font-bold">
            <Upload size={14} className="mr-1 inline" />
            Abrir imagem
            <input
              id="mmphoto-open"
              hidden
              multiple
              type="file"
              accept="image/*,.psd"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
          <button onClick={exportAs} className="rounded bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950">
            Exportar como
          </button>
        </div>
      </header>
      <div className="flex items-center gap-1 border-b border-slate-800 pb-1 text-[11px]">
        {Object.entries(PHOTO_MENUS).map(([item, commands]) => (
          <div key={item} className="relative">
            <button aria-expanded={openMenu === item} onClick={()=>setOpenMenu(openMenu === item ? null : item)} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800">{item}</button>
            {openMenu === item && <div className="absolute left-0 top-full z-50 min-w-48 border border-[#555] bg-[#292929] py-1 shadow-xl">{commands.map((command)=><button key={command} onClick={()=>runMenuCommand(command)} className="block w-full whitespace-nowrap px-4 py-1.5 text-left hover:bg-blue-600">{command}</button>)}</div>}
          </div>
        ))}
        <button aria-label="Desfazer" title="Desfazer (Ctrl+Z)" onClick={undo} disabled={!history.length} className="ml-2 rounded p-1.5 text-slate-300 enabled:hover:bg-slate-700 disabled:opacity-30">
          <Undo2 size={15} />
        </button>
        <select
          aria-label="Área de trabalho do MMPhoto"
          value={workspace}
          onChange={(event) => setWorkspace(event.target.value)}
          className="ml-auto rounded border border-slate-700 bg-[#171717] px-3 py-1 text-[10px] text-slate-300"
        >
          {[
            "Essenciais",
            "Fotografia",
            "Pintura",
            "Gráfico e Web",
            "Movimento",
            "3D",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="grid min-h-[720px] grid-cols-[54px_230px_minmax(600px,1fr)_300px] gap-2">
        <aside aria-label="Ferramentas do MMPhoto" className="flex flex-col items-center gap-1 rounded border border-slate-800 bg-[#242424] p-1">
          <ToolRail slots={RAIL_SLOTS} activeTool={tool} onSelect={setTool} />
          <span className="my-1 h-px w-8 bg-slate-700" />
          <span className="relative h-9 w-9">
            <i className="absolute left-0 top-0 h-7 w-7 border-2 border-white bg-black" style={{ backgroundColor: colors.fg }}>
              <input type="color" aria-label="Cor de primeiro plano" title="Cor de primeiro plano (Alt+clique com o Pincel: conta-gotas)" value={colors.fg} onChange={(event) => setColors((old) => ({ ...old, fg: event.target.value }))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </i>
            <i className="absolute bottom-0 right-0 h-7 w-7 border-2 border-white bg-white" style={{ backgroundColor: colors.bg }}>
              <input type="color" aria-label="Cor de fundo" title="Cor de fundo (X troca, D padrão)" value={colors.bg} onChange={(event) => setColors((old) => ({ ...old, bg: event.target.value }))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </i>
          </span>
        </aside>
        <aside className="rounded border border-slate-800 bg-[#242424]">
          <div className="flex border-b border-slate-700">
            {["Arquivos", "Bibliotecas"].map((name) => (
              <button
                key={name}
                onClick={() => setLeftTab(name)}
                className={`flex-1 p-2 text-[10px] ${leftTab === name ? "border-b-2 border-blue-400 text-blue-300" : "text-slate-500"}`}
              >
                {name}
              </button>
            ))}
          </div>
          {leftTab === "Arquivos" ? (
            <>
              <label className="m-2 flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-slate-600 p-3 text-[10px]">
                <FolderPlus size={14} />
                Adicionar arquivos
                <input
                  hidden
                  multiple
                  type="file"
                  accept="image/*,.psd"
                  onChange={(e) => onOpenFiles(e.target.files)}
                />
              </label>
              <div className="grid grid-cols-2 gap-2 p-2">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onSelect(asset)}
                    className={`overflow-hidden rounded border bg-black ${selected?.id === asset.id ? "border-blue-400" : "border-slate-700"}`}
                  >
                    {asset.type.startsWith("image") ? (
                      <img
                        src={asset.url}
                        alt=""
                        className="h-20 w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-20 place-items-center">
                        <ImageIcon />
                      </div>
                    )}
                    <p className="truncate p-1 text-[9px]">{asset.name}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="p-3 text-[10px] text-slate-400">
              As bibliotecas compartilhadas ficam no MMLibs (aba MMLibs das Ferramentas Gráficas). Os arquivos abertos neste documento aparecem em Arquivos.
            </p>
          )}
          <div className="mt-3 border-t border-slate-700">
            <div className="flex">
              {["Histórico", "Canais", "Caminhos"].map((name) => (
                <button
                  key={name}
                  onClick={() => setBottomPanel(name)}
                  className={`flex-1 p-2 text-[10px] ${bottomPanel === name ? "border-b-2 border-blue-400 text-blue-300" : "text-slate-500"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="space-y-1 p-2 text-[10px] text-slate-400">
              {bottomPanel === "Histórico" ? (
                <>
                  {historyItems.map((item, i) => (
                    <p
                      key={`${item}-${i}`}
                      className={
                        i === historyItems.length - 1
                          ? "rounded bg-blue-500/15 p-1 text-blue-300"
                          : "p-1"
                      }
                    >
                      ▸ {item}
                    </p>
                  ))}
                  {future.slice().reverse().map((entry, i) => (
                    <p key={`future-${entry.label}-${i}`} className="p-1 text-slate-600">▸ {entry.label}</p>
                  ))}
                </>
              ) : bottomPanel === "Canais" ? (
                Object.keys(CHANNEL_ROWS).map((item) => (
                  <p key={item} role="button" tabIndex={0} aria-pressed={channel === item} onClick={() => setChannel(item)} onKeyDown={(event) => event.key === "Enter" && setChannel(item)} className={channel === item ? "cursor-pointer rounded bg-blue-500/15 p-1 text-blue-300" : "cursor-pointer p-1"}>
                    ◉ {item}
                  </p>
                ))
              ) : (
                paths.length ? paths.map((path) => (
                  <p key={path.id} role="button" tabIndex={0} title="Clique para transformar em seleção" onClick={() => pathToSelection(path)} onKeyDown={(event) => event.key === "Enter" && pathToSelection(path)} className="cursor-pointer p-1">
                    ✎ {path.name} ({path.points.length} pontos)
                  </p>
                )) : <p className="p-2">Nenhum caminho salvo</p>
              )}
            </div>
          </div>
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-800 bg-[#303030]">
          <div className="flex items-center gap-3 border-b border-slate-700 bg-[#242424] px-3 py-2 text-[10px]">
            <b>{PAINT_TOOLS.includes(tool) ? `${tool} · ${brush.size} px` : tool}</b>
            <span>Modo: Normal</span>
            <span>Opacidade: {brush.opacity}%</span>
            <span>Fluxo: {brush.flow}%</span>
            {message && <span role="status" title={message} className="min-w-0 truncate text-slate-300">{message}</span>}
            <span className="ml-auto">{source?.name || "Sem título-1"}</span>
          </div>
          <div aria-label="Documento do MMPhoto" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} className="relative flex flex-1 items-center justify-center overflow-auto p-10">
            <svg width="0" height="0" aria-hidden="true" className="absolute">
              <defs>
                <filter id={`${filterId}-tone`} colorInterpolationFilters="sRGB">
                  <feComponentTransfer>
                    <feFuncR type="table" tableValues={sampleTable(tone.r)} />
                    <feFuncG type="table" tableValues={sampleTable(tone.g)} />
                    <feFuncB type="table" tableValues={sampleTable(tone.b)} />
                  </feComponentTransfer>
                </filter>
                {channelMatrix !== null && (
                  <filter id={`${filterId}-channel`} colorInterpolationFilters="sRGB">
                    <feColorMatrix type="matrix" values={[0, 1, 2].map(() => [0, 1, 2].map((c) => (c === channelMatrix ? 1 : 0)).join(" ") + " 0 0").join(" ") + " 0 0 0 1 0"} />
                  </filter>
                )}
              </defs>
            </svg>
            <div style={{transform:`translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${zoom / 66.7})`, ...(channelMatrix !== null ? { filter: `url(#${filterId}-channel)` } : {})}} className="relative grid min-h-[520px] w-full max-w-3xl place-items-center overflow-hidden bg-white shadow-2xl">
              {backgroundLayer?.bitmap ? (
                backgroundLayer.visible && <canvas
                  ref={setDisplay("background")}
                  aria-label="Camada Plano de fundo no documento"
                  width={docSize.w}
                  height={docSize.h}
                  style={{ ...imageStyle, ...stageStyle, opacity: (backgroundLayer.opacity ?? 100) / 100, zIndex: 1 }}
                  className="h-auto max-h-[580px] max-w-full"
                />
              ) : source?.type.startsWith("image") ? (
                backgroundLayer?.visible !== false && <img
                  ref={sourceImgRef}
                  src={source.url}
                  alt=""
                  style={{ ...imageStyle, ...stageStyle }}
                  onLoad={(event) => {
                    const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
                    if (w && h && (w !== docSize.w || h !== docSize.h)) setDocSize({ w, h });
                  }}
                  className="max-h-[580px] max-w-full object-contain"
                />
              ) : (
                backgroundLayer?.visible !== false && <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,#fbbf24,transparent_22%),linear-gradient(135deg,#164e63,#581c87)]" />
              )}
              {layers.slice().reverse().map((layer, index) => {
                if (!layer.visible || layer.id === "background") return null;
                const type = layerType(layer);
                if (showRaster(layer)) {
                  return (
                    <canvas
                      key={layer.id}
                      ref={setDisplay(layer.id)}
                      aria-label={`Camada ${layer.name} no documento`}
                      width={docSize.w}
                      height={docSize.h}
                      onClick={() => tool === "Mover" && setActiveLayer(layer.id)}
                      style={{ ...stageStyle, ...layerStyle(layer, index) }}
                      className={`h-auto max-h-[580px] max-w-full ${activeLayer === layer.id ? "outline outline-2 outline-blue-400" : ""}`}
                    />
                  );
                }
                const ops = type === "adjustment" ? layer.adjustment?.ops : null;
                return (
                  <div
                    key={layer.id}
                    aria-label={`Camada ${layer.name} no documento`}
                    data-text-layer={type === "text" ? layer.id : undefined}
                    onClick={() => tool === "Mover" && setActiveLayer(layer.id)}
                    style={{ ...layerStyle(layer, index), ...(ops ? { backdropFilter: filterOpsToCss(ops), WebkitBackdropFilter: filterOpsToCss(ops) } : {}) }}
                    className={`absolute grid cursor-move place-items-center ${layer.id === "subject" || layer.name.includes("Pessoa") ? "h-56 w-44 rounded-[45%_45%_38%_38%] bg-gradient-to-b from-amber-200 via-orange-300 to-fuchsia-700 shadow-2xl" : layer.id === "adjust" ? "inset-0 bg-cyan-400/10" : type === "adjustment" ? "pointer-events-none inset-0" : "h-36 w-64 bg-white/20"} ${activeLayer === layer.id && type !== "adjustment" ? "outline outline-2 outline-blue-400" : ""}`}
                  >
                    {layer.kind === "T" && (
                      <span
                        ref={(node) => (node ? textRefs.current.set(layer.id, node) : textRefs.current.delete(layer.id))}
                        contentEditable={editingText === layer.id}
                        suppressContentEditableWarning
                        aria-label={`Texto de ${layer.name}`}
                        onFocus={() => {
                          if (editingText === layer.id) textEditArmed.current = true;
                        }}
                        onInput={() => {
                          if (editingText === layer.id) textEditArmed.current = true;
                        }}
                        onBlur={(event) => editingText === layer.id && textEditArmed.current && commitText(layer, event.currentTarget)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                        }}
                        style={layer.fontSize || layer.color ? { fontSize: `${(layer.fontSize || 30) * stageScale}px`, color: layer.color } : undefined}
                        className="text-3xl font-bold text-white outline-none"
                      >
                        {layer.text ?? "Texto"}
                      </span>
                    )}
                    {layer.mask && <span aria-label={`Máscara de ${layer.name}`} className="absolute bottom-2 right-2 h-8 w-8 rounded border-2 border-white bg-gradient-to-br from-white to-black" />}
                  </div>
                );
              })}
              <svg
                ref={stageRef}
                data-testid="mmphoto-stage"
                width={docSize.w}
                height={docSize.h}
                viewBox={`0 0 ${docSize.w} ${docSize.h}`}
                style={{ ...stageStyle, zIndex: 900, overflow: "visible" }}
                className="pointer-events-none h-auto max-h-[580px] max-w-full"
              >
                {selection && (
                  <g aria-label={`Seleção ${selection.tool || "ativa"}`}>
                    {selection.type === "rect" && <>
                      <rect x={selection.rect.x} y={selection.rect.y} width={selection.rect.w} height={selection.rect.h} fill="none" stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      <rect x={selection.rect.x} y={selection.rect.y} width={selection.rect.w} height={selection.rect.h} fill="none" stroke="#000" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                    </>}
                    {selection.type === "polygon" && <>
                      <polygon points={selection.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      <polygon points={selection.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#000" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                    </>}
                    {selection.type === "mask" && <path d={selection.spans.map(([y, x0, x1]) => `M${x0} ${y}h${x1 - x0}v1h${x0 - x1}z`).join("")} fill="rgba(59,130,246,0.3)" />}
                  </g>
                )}
                {cropRect && <rect aria-label="Área de recorte" x={cropRect.x} y={cropRect.y} width={cropRect.w} height={cropRect.h} fill="rgba(0,0,0,0.15)" stroke="#fff" strokeWidth="1" strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />}
                {workPath.length > 0 && (
                  <g aria-label="Caminho de trabalho">
                    <polyline points={workPath.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#d946ef" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    {workPath.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4 / Math.max(0.05, stageScale)} fill="#fff" stroke="#d946ef" vectorEffect="non-scaling-stroke" />)}
                  </g>
                )}
                {cloneSource && tool === "Clone" && <g aria-label="Origem do clone" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke"><line x1={cloneSource.x - 10 / stageScale} y1={cloneSource.y} x2={cloneSource.x + 10 / stageScale} y2={cloneSource.y} /><line x1={cloneSource.x} y1={cloneSource.y - 10 / stageScale} x2={cloneSource.x} y2={cloneSource.y + 10 / stageScale} /></g>}
              </svg>
              <span className="pointer-events-none absolute inset-[8%] border border-dashed border-blue-400/60" />
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-700 bg-[#242424] p-2 text-[10px]">
            <span>Doc: {docSize.w} × {docSize.h} px</span>
            <span>RGB/16</span>
            <input
              type="range"
              min="12"
              max="200"
              value={zoom}
              aria-label="Zoom do documento"
              onChange={(e) => setZoom(+e.target.value)}
              className="ml-auto accent-blue-400"
            />
            <span>{zoom}%</span>
          </div>
        </main>
        <aside className="overflow-auto rounded border border-slate-800 bg-[#242424]">
          <div className="flex border-b border-slate-700">
            {["Propriedades", "Ajustes"].map((name) => (
              <button
                key={name}
                onClick={() => setRightPanel(name)}
                className={`flex-1 p-2 text-[10px] ${rightPanel === name ? "border-b-2 border-blue-400 text-blue-300" : "text-slate-500"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="p-3">
            <h3 className="mb-3 text-xs font-bold">
              {rightPanel === "Ajustes"
                ? "Ajustes não destrutivos"
                : "Transformação e aparência"}
            </h3>
            {rightPanel === "Ajustes" ? (
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(ADJUSTMENT_PRESETS).map((item) => (
                  <button
                    key={item}
                    title={item}
                    onClick={() => addAdjustment(item)}
                    className="grid aspect-square place-items-center rounded border border-slate-700 text-[8px] hover:border-blue-400"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <section className="border-b border-slate-700 pb-3">
                  <h4 className="mb-2 text-[10px] font-bold uppercase text-slate-400">Transformar</h4>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <label>X <NumericField aria-label="Posição X da camada" value={selectedLayer?.transform.x ?? 0} onChange={(value) => updateTransform("x", value)} className="w-full rounded border border-slate-700 bg-[#171717] p-1" /></label>
                    <label>Y <NumericField aria-label="Posição Y da camada" value={selectedLayer?.transform.y ?? 0} onChange={(value) => updateTransform("y", value)} className="w-full rounded border border-slate-700 bg-[#171717] p-1" /></label>
                    <label ref={scaleInputRef}>Escala <NumericField aria-label="Escala da camada" value={selectedLayer?.transform.scale ?? 100} onChange={(value) => updateTransform("scale", value)} className="w-full rounded border border-slate-700 bg-[#171717] p-1" /></label>
                    <label>Rotação <NumericField aria-label="Rotação da camada" value={selectedLayer?.transform.rotation ?? 0} onChange={(value) => updateTransform("rotation", value)} className="w-full rounded border border-slate-700 bg-[#171717] p-1" /></label>
                  </div>
                </section>
                <label className="block text-[10px] text-slate-400">Modo
                  <select aria-label="Modo de mesclagem da camada" value={selectedLayer?.blendMode || "normal"} onChange={(event) => updateLayer(selectedLayer.id, { blendMode: event.target.value }, "Modo de mesclagem")} className="mt-1 w-full rounded border border-slate-700 bg-[#171717] p-1.5">
                    {BLEND_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] text-slate-400">Opacidade <input aria-label="Opacidade da camada" type="range" min="0" max="100" value={selectedLayer?.opacity ?? 100} onChange={(event) => updateLayer(selectedLayer.id, { opacity: Number(event.target.value) }, "Opacidade")} className="w-full accent-blue-400" /></label>
                <details open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
                  <summary className="cursor-pointer text-[10px] font-bold text-slate-400">Ajustes da imagem</summary>
                  {Object.entries(adjust).map(([key, value]) => (
                  <label
                    key={key}
                    className="block text-[10px] capitalize text-slate-500"
                  >
                    <span className="flex justify-between">
                      <span>{key}</span>
                      <span>{value}</span>
                    </span>
                    <input
                      type="range"
                      min={key === "blur" ? 0 : -100}
                      max={key === "blur" ? 20 : 100}
                      value={value}
                      aria-label={`Ajuste ${key}`}
                      onChange={(e) =>
                        setAdjust((old) => ({ ...old, [key]: +e.target.value }))
                      }
                      className="w-full accent-blue-400"
                    />
                  </label>
                  ))}
                </details>
              </div>
            )}
          </div>
          <div className="border-t border-slate-700">
            <div className="flex">
              {["Camadas", "Canais", "Caminhos"].map((name) => (
                <button
                  key={name}
                  onClick={() => setLayersTab(name)}
                  className={`flex-1 p-2 text-[10px] ${layersTab === name ? "border-b-2 border-blue-400 text-blue-300" : "text-slate-500"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            {layersTab === "Camadas" ? (
            <>
            <div data-testid="photo-layer-list">
            {layers.map((layer) => (
              <button
                key={layer.id}
                aria-label={layer.name}
                onClick={() => setActiveLayer(layer.id)}
                className={`flex w-full items-center gap-2 border-t border-slate-800 p-2 text-left text-[10px] ${activeLayer === layer.id ? "bg-blue-500/10 text-blue-200" : ""}`}
              >
                <span role="button" tabIndex={0} aria-label={`${layer.visible ? "Ocultar" : "Mostrar"} ${layer.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(layer.id);
                  }}
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </span>
                <span className="grid h-8 w-8 place-items-center rounded border border-slate-600 bg-slate-800">
                  {layer.kind}
                </span>
                <span className="truncate">{layer.name}</span>
                {layer.mask && <span aria-label={`Máscara de ${layer.name}`} className="ml-auto h-6 w-6 border border-white bg-gradient-to-br from-white to-black" />}
                {layer.locked && <span className="ml-auto">🔒</span>}
              </button>
            ))}
            </div>
            <div className="grid grid-cols-7 gap-1 p-2">
              <button
                onClick={() => addLayer("Camada")}
                className="rounded border border-slate-700 p-2 text-[10px]"
              >
                +
              </button>
              <button
                onClick={() => addLayer("Texto")}
                className="rounded border border-slate-700 p-2 text-[10px]"
              >
                T
              </button>
              <button
                aria-label="Adicionar máscara de camada"
                onClick={addMask}
                className="rounded border border-slate-700 p-2 text-[10px]"
              >
                ◉
              </button>
              <button aria-label="Estilo de camada (fx)" aria-pressed={Boolean(selectedLayer?.fx?.shadow)} onClick={toggleFx} className="rounded border border-slate-700 p-2 text-[10px]">
                fx
              </button>
              <button aria-label="Mover camada para cima" onClick={() => moveLayer(-1)} className="rounded border border-slate-700 p-2"><ChevronUp size={13} /></button>
              <button aria-label="Mover camada para baixo" onClick={() => moveLayer(1)} className="rounded border border-slate-700 p-2"><ChevronDown size={13} /></button>
              <button aria-label="Excluir camada" onClick={removeLayer} className="rounded border border-slate-700 p-2"><Trash2 size={13} /></button>
            </div>
            <button aria-label="Duplicar camada" onClick={duplicateLayer} className="mx-2 mb-2 w-[calc(100%-1rem)] rounded border border-slate-700 p-2 text-[10px]">Duplicar camada</button>
            </>
            ) : layersTab === "Canais" ? (
              <div className="p-2 text-[10px] text-slate-400">
                {Object.keys(CHANNEL_ROWS).map((item) => (
                  <button key={item} aria-pressed={channel === item} onClick={() => setChannel(item)} className={`flex w-full items-center gap-2 border-t border-slate-800 p-2 text-left ${channel === item ? "bg-blue-500/10 text-blue-200" : ""}`}>
                    ◉ {item}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-2 text-[10px] text-slate-400">
                {paths.length ? paths.map((path) => (
                  <button key={path.id} onClick={() => pathToSelection(path)} title="Transformar em seleção" className="flex w-full items-center gap-2 border-t border-slate-800 p-2 text-left">
                    ✎ {path.name} ({path.points.length} pontos)
                  </button>
                )) : <p className="p-2">Nenhum caminho salvo. Use a Caneta (P) e pressione Enter para salvar.</p>}
              </div>
            )}
          </div>
          <div className="border-t border-slate-700 p-3">
            <h3 className="mb-2 text-xs font-bold">Filtros</h3>
            <div className="grid grid-cols-2 gap-1">
              {[
                "Camera Raw",
                "Liquify",
                "Desfoque",
                "Nitidez",
                "Ruído",
                "Pixelização",
                "Render",
                "Neural",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => runFilter(item)}
                  className="rounded border border-slate-700 p-2 text-[9px]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
      {textPromptDialog}
    </section>
  );
}
