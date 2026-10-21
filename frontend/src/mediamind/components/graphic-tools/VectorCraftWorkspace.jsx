import { useGraphicDraftState, useWorkScope } from "../../lib/graphicDrafts";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerMCPActions } from "../../lib/mcpActions";
import { mmvectorCatalogue, runMMVectorTool } from "./mmvectorMcpTools";
import {
  Circle,
  Crosshair,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Blend,
  Brush,
  ChevronDown,
  ChevronRight,
  Hexagon,
  Hand,
  Layers3,
  Lasso,
  Lock,
  MousePointer2,
  MoveDiagonal2,
  MoreHorizontal,
  PenTool,
  Pipette,
  Plus,
  Save,
  ScanSearch,
  Square,
  Trash2,
  Type,
  Upload,
  RotateCcw,
  RotateCw,
  Scissors,
  Sparkles,
  Spline,
  TextCursorInput,
  WandSparkles,
  ZoomIn,
} from "lucide-react";

// VectorCraft 0.7.0: barra Basic, na mesma ordem e com os mesmos atalhos
// de crates/ui-egui/src/toolbar.rs. Cada entrada representa o primeiro item
// visível de um slot; as alternativas pertencem ao menu expansível do slot.
const TOOL_GROUPS = [
  {
    label: "Seleção",
    slots: [
      [["V", "Seleção", MousePointer2]],
      [["A", "Seleção direta", MousePointer2], [null, "Seleção de grupo", MousePointer2]],
      [["Q", "Laço", Lasso], ["Y", "Varinha mágica", WandSparkles]],
    ],
  },
  {
    label: "Formas",
    slots: [
      [
        ["M", "Retângulo", Square], [null, "Retângulo arredondado", Square],
        [null, "Estrela", Sparkles], ["\\", "Segmento de linha", Spline],
        [null, "Arco", Spline], [null, "Espiral", RotateCw],
        [null, "Grade retangular", Crosshair], [null, "Grade polar", Crosshair],
        [null, "Clarão", Sparkles],
      ],
      [["L", "Elipse", Circle]],
      [[null, "Polígono", Hexagon]],
      [["Shift+N", "Modelador", Sparkles]],
    ],
  },
  {
    label: "Desenhar",
    slots: [
      [["N", "Lápis", PenTool], [null, "Suavizar", Spline], [null, "Borracha de caminho", Eraser], [null, "Unir", Spline]],
      [
        ["Shift+E", "Borracha", Eraser], ["C", "Tesoura", Scissors], [null, "Faca", Scissors],
        [null, "Corte espelhado", Scissors], [null, "Corte em linha", Scissors], [null, "Corte retangular", Scissors],
      ],
      [["B", "Pincel", Brush], ["Shift+B", "Pincel de manchas", Brush]],
      [["P", "Caneta", PenTool], ["+", "Adicionar ponto de ancoragem", PenTool], ["-", "Excluir ponto de ancoragem", PenTool], ["Shift+C", "Ponto de ancoragem", PenTool]],
      [["Shift+~", "Curvatura", Spline]],
    ],
  },
  {
    label: "Modificar",
    slots: [
      [
        ["Shift+W", "Largura", MoveDiagonal2], ["Shift+R", "Deformar", Spline], [null, "Redemoinho", RotateCw],
        [null, "Contrair", MoveDiagonal2], [null, "Inflar", MoveDiagonal2], [null, "Recortar", Spline],
        [null, "Cristalizar", Sparkles], [null, "Enrugar", Spline],
      ],
      [
        ["R", "Girar", RotateCw], ["O", "Refletir", RotateCcw], ["S", "Escala", MoveDiagonal2],
        [null, "Inclinar", MoveDiagonal2], [null, "Remodelar", Spline], ["E", "Transformação livre", MoveDiagonal2],
        [null, "Distorção de marionete", MoveDiagonal2],
      ],
      [
        ["Shift+M", "Construtor de formas", Blend], ["K", "Balde de pintura ao vivo", Brush],
        ["Shift+L", "Seleção de pintura ao vivo", MousePointer2], ["W", "Mesclagem", Blend],
      ],
    ],
  },
  {
    label: "Texto",
    slots: [
      [[null, "Texto em área", TextCursorInput], [null, "Texto em um caminho", Type], [null, "Texto vertical em área", TextCursorInput], [null, "Texto vertical em um caminho", Type]],
      [["T", "Texto", Type], [null, "Texto vertical", Type], ["Shift+T", "Texto de toque", Type]],
    ],
  },
  {
    label: "Navegar",
    slots: [
      [["Z", "Zoom", ZoomIn]],
      [["H", "Mão", Hand], [null, "Divisão de impressão", Crosshair]],
      [["Shift+H", "Girar visualização", RotateCcw]],
    ],
  },
  {
    label: "Cor",
    slots: [
      [["G", "Gradiente", Crosshair], ["U", "Malha", Crosshair]],
      [["I", "Conta-gotas", Pipette], [null, "Medida", MoveDiagonal2]],
    ],
  },
];

function toolTitle(shortcut, name) {
  return shortcut ? `${name} (${shortcut})` : name;
}

const ICON_ROOT = "/vectorcraft-icons";

// Mesma ordem, agrupamento e iconografia da coluna de painéis do VectorCraft desktop.
const RIGHT_PANEL_TOOLS = [
  ["Cor", "palette"], ["Guia de cores", "dc-color-guide", true],
  ["Amostras", "swatch-book"], ["Pincéis", "paintbrush"], ["Símbolos", "spray-can"], ["Opções de padrão", "grid-3x3", true],
  ["Traçado", "dc-stroke"], ["Gradiente", "dc-gradient"], ["Transparência", "dc-transparency", true],
  ["Aparência", "dc-appearance"], ["Estilos gráficos", "dc-graphic-styles", true],
  ["Pranchetas", "dc-artboards", true],
  ["Transformar", "dc-transform-panel"], ["Alinhar", "dc-align"], ["Pathfinder", "dc-pathfinder", true],
  ["Texto", "type"], ["Parágrafo", "pilcrow", true],
  ["Histórico", "history"], ["Ações", "dc-actions"], ["Informações", "info"], ["Navegador", "map"],
];

function ReferenceIcon({ name, size = 20, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: size,
        mask: `url(${ICON_ROOT}/${name}.svg) center / contain no-repeat`,
        WebkitMask: `url(${ICON_ROOT}/${name}.svg) center / contain no-repeat`,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Geometria vetorial (reimplementação própria em JS; comportamento inspirado no
// VectorCraft, Apache-2.0). Coordenadas de prancheta em px, 820 × 620.
// ---------------------------------------------------------------------------
export const ARTBOARD_W = 820;
export const ARTBOARD_H = 620;
const BRUSH_RADIUS = 40;
const ZOOM_STEPS = [25, 33, 50, 66, 72, 100, 125, 150];
const SELECT_TOOLS = ["Seleção", "Seleção direta", "Laço", "Seleção de grupo", "Transformação livre", "Seleção de pintura ao vivo"];
const WARP_TOOLS = ["Deformar", "Redemoinho", "Contrair", "Inflar", "Recortar", "Cristalizar", "Enrugar"];
const PRESET_PATHS = {
  Caneta: "M4 92 L34 18 L58 72 L96 8",
  Lápis: "M2 70 L14 38 L25 76 L38 28 L51 67 L65 34 L79 73 L98 24",
  Pincel: "M2 76 C20 8 43 96 62 34 S85 82 98 18",
  Curvatura: "M2 82 C18 12 42 12 50 55 C59 96 82 92 98 18",
};
const DEFAULT_WAVE = "M0 67 C19 0 38 100 57 30 S83 80 100 13";
const UNIT_INFO = {
  Pixels: [1, "px"],
  Pontos: [0.75, "pt"],
  Milímetros: [25.4 / 96, "mm"],
  Centímetros: [2.54 / 96, "cm"],
  Polegadas: [1 / 96, "pol"],
};
const UNSUPPORTED_TOOLS = {
  Malha: "Malha de degradê ainda não está disponível no MMVector web. Use a ferramenta Gradiente (G).",
  "Divisão de impressão": "Divisão de impressão não está disponível no navegador. Use Exportar para gerar SVG ou PNG.",
  "Girar visualização": "Girar visualização ainda não está disponível. Gire o objeto com a ferramenta Girar (R).",
  "Corte espelhado": "Corte espelhado ainda não está disponível. Use Faca ou Corte em linha.",
  "Corte retangular": "Corte retangular ainda não está disponível. Use Faca ou Corte em linha.",
  Remodelar: "Remodelar ainda não está disponível. Use Adicionar/Excluir ponto de ancoragem ou Suavizar.",
  "Distorção de marionete": "Distorção de marionete ainda não está disponível. Use Deformar.",
  "Texto de toque": "Texto de toque ainda não está disponível. Use a ferramenta Texto (T).",
  "Texto vertical em um caminho": "Texto vertical em um caminho ainda não está disponível. Use Texto em um caminho.",
};
const TOOL_HINTS = {
  Mão: "Arraste para mover a visualização.",
  Caneta: "Clique para pontos de canto, clique e arraste para curvas; Enter conclui; clique no primeiro ponto fecha.",
  Curvatura: "Clique para adicionar pontos suaves; Enter conclui; clique no primeiro ponto fecha.",
  Lápis: "Arraste para desenhar à mão livre.",
  Pincel: "Arraste para pintar um traço à mão livre.",
  Borracha: "Arraste para apagar a área; clique num objeto para excluí-lo.",
  Laço: "Arraste numa área vazia (ou com Alt sobre objetos) para selecionar à mão livre.",
  Zoom: "Clique para aproximar; Alt+clique para afastar.",
  Estrela: "Arraste para desenhar uma estrela.",
  Arco: "Arraste para desenhar um arco.",
  Espiral: "Arraste para desenhar uma espiral.",
  "Grade retangular": "Arraste para desenhar uma grade retangular.",
  "Grade polar": "Arraste para desenhar uma grade polar.",
  Clarão: "Arraste para desenhar um clarão.",
  "Segmento de linha": "Arraste para desenhar uma linha.",
  Tesoura: "Clique sobre um caminho para dividi-lo nesse ponto.",
  Faca: "Arraste atravessando formas para cortá-las.",
  "Corte em linha": "Arraste atravessando formas para cortá-las em linha reta.",
  Girar: "Arraste sobre um objeto para girá-lo (Shift: passos de 45°).",
  Refletir: "Clique num objeto para refleti-lo na horizontal; Alt+clique reflete na vertical.",
  Escala: "Arraste sobre um objeto para redimensioná-lo a partir do centro.",
  Inclinar: "Arraste na horizontal sobre um objeto para incliná-lo.",
  Gradiente: "Clique ou arraste sobre um objeto para aplicar gradiente linear (preenchimento → traçado).",
  "Conta-gotas": "Clique num objeto para copiar preenchimento e traçado para a seleção.",
  "Construtor de formas": "Selecione formas com Shift+clique e clique numa delas para uni-las; Alt+clique subtrai.",
  Largura: "Arraste para cima/baixo sobre um caminho para alterar a largura do traçado (uniforme).",
  "Balde de pintura ao vivo": "Clique num objeto para aplicar o preenchimento atual.",
  Mesclagem: "Clique em dois objetos para criar etapas intermediárias.",
  Medida: "Arraste para medir distância e ângulo.",
  "Varinha mágica": "Clique num objeto para selecionar todos com o mesmo preenchimento.",
  "Adicionar ponto de ancoragem": "Clique sobre um caminho para adicionar um ponto.",
  "Excluir ponto de ancoragem": "Clique perto de um ponto para excluí-lo.",
  "Ponto de ancoragem": "Clique num caminho para alternar entre pontos de canto e suaves.",
  "Borracha de caminho": "Arraste sobre o caminho selecionado para apagar trechos.",
  Suavizar: "Arraste sobre o caminho selecionado para suavizá-lo.",
  Unir: "Com um caminho aberto selecionado, clique em outro caminho aberto para uni-los.",
  "Texto em um caminho": "Clique num caminho para escrever texto ao longo dele.",
  "Texto vertical": "Clique ou arraste para criar texto vertical.",
  "Texto vertical em área": "Clique ou arraste para criar texto vertical.",
  "Retângulo arredondado": "Arraste para desenhar um retângulo arredondado.",
  "Pincel de manchas": "Arraste para pintar uma mancha larga na cor de preenchimento.",
};
for (const name of WARP_TOOLS) TOOL_HINTS[name] = `Arraste sobre as formas para aplicar ${name.toLowerCase()} (pincel de ${BRUSH_RADIUS} px).`;
const TOOL_SHORTCUTS = {};
const TOOL_SLOTS = {};
TOOL_GROUPS.forEach((group) => group.slots.forEach((slot, index) => slot.forEach(([shortcut, name]) => {
  TOOL_SLOTS[name] = `${group.label}-${index}`;
  if (shortcut) TOOL_SHORTCUTS[shortcut] = name;
})));

const round2 = (value) => Math.round(value * 100) / 100;
const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function polygonD(points, closed = true) {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${round2(x)} ${round2(y)}`).join(" ") + (closed ? " Z" : "");
}
function circlePoints(cx, cy, r, count = 48) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}
function starD(points = 5, ratio = 0.5) {
  return polygonD(Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 ? 50 * ratio : 50;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  }));
}
function arcD() {
  return polygonD(Array.from({ length: 25 }, (_, index) => {
    const angle = (index / 24) * (Math.PI / 2);
    return [100 * Math.sin(angle), 100 - 100 * Math.cos(angle)];
  }), false);
}
function spiralD(segments = 10, decay = 0.8) {
  const points = [];
  const end = segments * (Math.PI / 2);
  for (let t = 0; t <= end + 1e-9; t += Math.PI / 24) {
    const radius = 50 * decay ** (t / (Math.PI / 2));
    points.push([50 + radius * Math.cos(t), 50 + radius * Math.sin(t)]);
  }
  return polygonD(points, false);
}
function rectGridD(columns = 5, rows = 5) {
  const parts = ["M0 0 L100 0 L100 100 L0 100 Z"];
  for (let index = 1; index < rows; index += 1) parts.push(`M0 ${round2((100 / rows) * index)} L100 ${round2((100 / rows) * index)}`);
  for (let index = 1; index < columns; index += 1) parts.push(`M${round2((100 / columns) * index)} 0 L${round2((100 / columns) * index)} 100`);
  return parts.join(" ");
}
function polarGridD(rings = 5, dividers = 6) {
  const parts = [];
  for (let ring = 1; ring <= rings; ring += 1) parts.push(polygonD(circlePoints(50, 50, (50 / rings) * ring, 40)));
  for (let index = 0; index < dividers; index += 1) {
    const angle = (index / dividers) * Math.PI * 2;
    parts.push(`M50 50 L${round2(50 + 50 * Math.cos(angle))} ${round2(50 + 50 * Math.sin(angle))}`);
  }
  return parts.join(" ");
}
function flareD(rays = 12) {
  const parts = [polygonD(circlePoints(50, 50, 12, 32))];
  for (let index = 0; index < rays; index += 1) {
    const angle = (index / rays) * Math.PI * 2;
    parts.push(`M${round2(50 + 16 * Math.cos(angle))} ${round2(50 + 16 * Math.sin(angle))} L${round2(50 + 48 * Math.cos(angle))} ${round2(50 + 48 * Math.sin(angle))}`);
  }
  return parts.join(" ");
}

/** Converte um atributo `d` em subcaminhos poligonais (curvas amostradas). */
function parsePath(d, steps = 16) {
  const tokens = String(d || "").match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const subpaths = [];
  let current = null;
  let index = 0;
  let command = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let lastCubic = null;
  let lastQuad = null;
  const take = (count) => {
    if (index + count > tokens.length) return null;
    const values = tokens.slice(index, index + count).map(Number);
    if (values.some((value) => !Number.isFinite(value))) return null;
    index += count;
    return values;
  };
  const ensure = () => {
    if (!current) {
      current = { points: [[x, y]], closed: false };
      subpaths.push(current);
    }
  };
  while (index < tokens.length) {
    if (/^[a-z]$/i.test(tokens[index])) command = tokens[index++];
    else if (!command) break;
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    if (upper === "Z") {
      if (current) current.closed = true;
      x = startX;
      y = startY;
      current = null;
      command = null;
      continue;
    }
    const sizes = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
    const values = take(sizes[upper] ?? 2);
    if (!values) break;
    if (upper === "M") {
      x = ox + values[0];
      y = oy + values[1];
      startX = x;
      startY = y;
      current = { points: [[x, y]], closed: false };
      subpaths.push(current);
      command = relative ? "l" : "L";
      lastCubic = lastQuad = null;
      continue;
    }
    ensure();
    if (upper === "L" || upper === "T" || upper === "A") {
      const nx = upper === "A" ? ox + values[5] : ox + values[0];
      const ny = upper === "A" ? oy + values[6] : oy + values[1];
      if (upper === "T") {
        const control = lastQuad ? [2 * x - lastQuad[0], 2 * y - lastQuad[1]] : [x, y];
        for (let step = 1; step <= steps; step += 1) {
          const t = step / steps;
          current.points.push([(1 - t) ** 2 * x + 2 * (1 - t) * t * control[0] + t * t * nx, (1 - t) ** 2 * y + 2 * (1 - t) * t * control[1] + t * t * ny]);
        }
        lastQuad = control;
      } else {
        current.points.push([nx, ny]);
        lastQuad = null;
      }
      x = nx;
      y = ny;
      lastCubic = null;
    } else if (upper === "H" || upper === "V") {
      if (upper === "H") x = ox + values[0];
      else y = oy + values[0];
      current.points.push([x, y]);
      lastCubic = lastQuad = null;
    } else if (upper === "C" || upper === "S") {
      const c1 = upper === "C" ? [ox + values[0], oy + values[1]] : lastCubic ? [2 * x - lastCubic[0], 2 * y - lastCubic[1]] : [x, y];
      const c2 = upper === "C" ? [ox + values[2], oy + values[3]] : [ox + values[0], oy + values[1]];
      const end = upper === "C" ? [ox + values[4], oy + values[5]] : [ox + values[2], oy + values[3]];
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        const u = 1 - t;
        current.points.push([
          u ** 3 * x + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * end[0],
          u ** 3 * y + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * end[1],
        ]);
      }
      lastCubic = c2;
      lastQuad = null;
      [x, y] = end;
    } else if (upper === "Q") {
      const control = [ox + values[0], oy + values[1]];
      const end = [ox + values[2], oy + values[3]];
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        current.points.push([(1 - t) ** 2 * x + 2 * (1 - t) * t * control[0] + t * t * end[0], (1 - t) ** 2 * y + 2 * (1 - t) * t * control[1] + t * t * end[1]]);
      }
      lastQuad = control;
      lastCubic = null;
      [x, y] = end;
    }
  }
  return subpaths;
}
function subpathsToD(subpaths) {
  return subpaths.filter((subpath) => subpath.points.length).map((subpath) => polygonD(subpath.points, subpath.closed)).join(" ");
}
function smoothD(d) {
  return parsePath(d, 1).map(({ points, closed }) => {
    const count = points.length;
    if (count < 3) return polygonD(points, closed);
    const at = (index) => (closed ? points[(index + count) % count] : points[clampValue(index, 0, count - 1)]);
    let path = `M${round2(points[0][0])} ${round2(points[0][1])}`;
    const segments = closed ? count : count - 1;
    for (let index = 0; index < segments; index += 1) {
      const p0 = at(index - 1);
      const p1 = at(index);
      const p2 = at(index + 1);
      const p3 = at(index + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      path += ` C${round2(c1[0])} ${round2(c1[1])} ${round2(c2[0])} ${round2(c2[1])} ${round2(p2[0])} ${round2(p2[1])}`;
    }
    return path + (closed ? " Z" : "");
  }).join(" ");
}
function boundsOf(subpaths) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { points } of subpaths) for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}
function signedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}
function scaleSubpaths(subpaths, sx, sy) {
  return subpaths.map((subpath) => ({ ...subpath, points: subpath.points.map(([x, y]) => [x * sx, y * sy]) }));
}
function presetPath(drawingTool) {
  return PRESET_PATHS[drawingTool] || DEFAULT_WAVE;
}
function isPathObject(object) {
  return Boolean(object?.d || object?.parts);
}
/** Subcaminhos do objeto no espaço local (0..w, 0..h). */
function localSubpaths(object, steps = 16) {
  const { w, h } = object;
  if (object.parts) return object.parts.flatMap((part) => scaleSubpaths(parsePath(part.d, steps), w / (object.vbW || w), h / (object.vbH || h)));
  if (object.d) return scaleSubpaths(parsePath(object.d, steps), w / (object.vbW || 100), h / (object.vbH || 100));
  if (object.kind === "Traçado") return scaleSubpaths(parsePath(presetPath(object.drawingTool), steps), w / 100, h / 100);
  if (object.kind === "Texto") return [];
  if (object.kind === "Elipse") return [{ points: circlePoints(w / 2, h / 2, 1, 48).map(([x, y]) => [w / 2 + (x - w / 2) * (w / 2), h / 2 + (y - h / 2) * (h / 2)]), closed: true }];
  if (object.kind === "Forma") return [{ points: [[w / 2, 0], [w, h], [0, h]], closed: true }];
  const radius = Math.min(object.cornerRadius ?? 0, w / 2, h / 2);
  if (!radius) return [{ points: [[0, 0], [w, 0], [w, h], [0, h]], closed: true }];
  const points = [];
  const corners = [[w - radius, radius, -Math.PI / 2], [w - radius, h - radius, 0], [radius, h - radius, Math.PI / 2], [radius, radius, Math.PI]];
  for (const [cx, cy, start] of corners) for (let step = 0; step <= 6; step += 1) {
    const angle = start + (step / 6) * (Math.PI / 2);
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return [{ points, closed: true }];
}
/** Aplica giro, reflexo e inclinação (mesma ordem do CSS da prancheta). */
function toCanvas(object) {
  const cx = object.w / 2;
  const cy = object.h / 2;
  const angle = ((object.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const fx = object.flipX ? -1 : 1;
  const fy = object.flipY ? -1 : 1;
  const skew = Math.tan(((object.skewX ?? 0) * Math.PI) / 180);
  return ([px, py]) => {
    let dx = px - cx;
    let dy = py - cy;
    dx += skew * dy;
    dx *= fx;
    dy *= fy;
    return [object.x + cx + dx * cos - dy * sin, object.y + cy + dx * sin + dy * cos];
  };
}
function canvasSubpaths(object, steps = 16) {
  const map = toCanvas(object);
  return localSubpaths(object, steps).map((subpath) => ({ ...subpath, points: subpath.points.map(map) }));
}
function pathPatchFromCanvas(subpaths) {
  const bounds = boundsOf(subpaths);
  const w = Math.max(1, bounds.maxX - bounds.minX);
  const h = Math.max(1, bounds.maxY - bounds.minY);
  const local = subpaths.map((subpath) => ({ ...subpath, points: subpath.points.map(([x, y]) => [x - bounds.minX, y - bounds.minY]) }));
  return { x: round2(bounds.minX), y: round2(bounds.minY), w: round2(w), h: round2(h), vbW: round2(w), vbH: round2(h), d: subpathsToD(local), rotation: 0, flipX: false, flipY: false, skewX: 0 };
}
function pathStyle(object) {
  if (isPathObject(object)) return {};
  if (object.kind === "Traçado") return { filled: false };
  return { kind: "Traçado", filled: !object.noFill, cornerRadius: undefined };
}
function resample(subpaths, maxSegment) {
  return subpaths.map((subpath) => {
    const points = [];
    const count = subpath.points.length;
    const edges = subpath.closed ? count : count - 1;
    if (count) points.push(subpath.points[0]);
    for (let index = 0; index < edges; index += 1) {
      const a = subpath.points[index];
      const b = subpath.points[(index + 1) % count];
      const pieces = Math.max(1, Math.ceil(distance(a, b) / maxSegment));
      for (let step = 1; step <= pieces; step += 1) {
        if (subpath.closed && index === edges - 1 && step === pieces) break;
        points.push([a[0] + ((b[0] - a[0]) * step) / pieces, a[1] + ((b[1] - a[1]) * step) / pieces]);
      }
    }
    return { ...subpath, points };
  });
}
function simplifyPoints(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = 0;
    let found = -1;
    for (let index = first + 1; index < last; index += 1) {
      const value = segmentDistance(points[index], points[first], points[last]).distance;
      if (value > maxDistance) {
        maxDistance = value;
        found = index;
      }
    }
    if (found >= 0 && maxDistance > tolerance) {
      keep[found] = true;
      stack.push([first, found], [found, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}
function segmentDistance(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length ? clampValue(((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length, 0, 1) : 0;
  const projected = [a[0] + dx * t, a[1] + dy * t];
  return { distance: distance(point, projected), t, point: projected };
}
function offsetSubpath(subpath, amount) {
  const { points, closed } = subpath;
  const count = points.length;
  if (count < 2) return subpath;
  const edgeNormal = (a, b) => {
    const length = distance(a, b) || 1;
    return [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
  };
  const build = (sign) => points.map((point, index) => {
    const previous = closed ? points[(index - 1 + count) % count] : points[Math.max(0, index - 1)];
    const next = closed ? points[(index + 1) % count] : points[Math.min(count - 1, index + 1)];
    const n1 = index === 0 && !closed ? edgeNormal(point, next) : edgeNormal(previous, point);
    const n2 = index === count - 1 && !closed ? edgeNormal(previous, point) : edgeNormal(point, next);
    let nx = n1[0] + n2[0];
    let ny = n1[1] + n2[1];
    const length = Math.hypot(nx, ny) || 1;
    nx /= length;
    ny /= length;
    const miter = 1 / Math.max(0.35, nx * n1[0] + ny * n1[1]);
    return [point[0] + nx * amount * sign * miter, point[1] + ny * amount * sign * miter];
  });
  let result = build(1);
  if (closed && amount > 0 && Math.abs(signedArea(result)) < Math.abs(signedArea(points))) result = build(-1);
  return { ...subpath, points: result };
}
function splitPolygonByLine(points, a, b) {
  const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const left = [];
  const right = [];
  points.forEach((p, index) => {
    const q = points[(index + 1) % points.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) left.push(p);
    if (sp <= 0) right.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq);
      const cut = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      left.push(cut);
      right.push(cut);
    }
  });
  return left.length >= 3 && right.length >= 3 ? [left, right] : null;
}
function segmentsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index];
    const [xj, yj] = polygon[previous];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}
function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
function warpSubpaths(subpaths, toolName, center, delta, step) {
  return subpaths.map((subpath) => ({
    ...subpath,
    points: subpath.points.map((point, index) => {
      const dx = point[0] - center[0];
      const dy = point[1] - center[1];
      const length = Math.hypot(dx, dy);
      if (length >= BRUSH_RADIUS) return point;
      const falloff = (1 - length / BRUSH_RADIUS) ** 2;
      if (toolName === "Deformar") return [point[0] + delta[0] * falloff, point[1] + delta[1] * falloff];
      if (toolName === "Redemoinho") {
        const angle = 0.35 * falloff;
        return [center[0] + dx * Math.cos(angle) - dy * Math.sin(angle), center[1] + dx * Math.sin(angle) + dy * Math.cos(angle)];
      }
      if (toolName === "Contrair") return [point[0] - dx * 0.25 * falloff, point[1] - dy * 0.25 * falloff];
      if (toolName === "Inflar") return [point[0] + dx * 0.25 * falloff, point[1] + dy * 0.25 * falloff];
      if (toolName === "Recortar") {
        const amount = 0.3 * falloff * (0.5 + 0.5 * Math.sin(index * 1.7));
        return [point[0] - dx * amount, point[1] - dy * amount];
      }
      if (toolName === "Cristalizar") {
        const amount = 0.35 * falloff * (index % 3 === 0 ? 1 : 0.1);
        return [point[0] + dx * amount, point[1] + dy * amount];
      }
      return [point[0] + (pseudoRandom(index * 31 + step * 17) - 0.5) * 6 * falloff, point[1] + (pseudoRandom(index * 7 + step * 13) - 0.5) * 6 * falloff];
    }),
  }));
}
function hexToRgb(color) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color || ""));
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split("").map((c) => c + c).join("") : match[1];
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function rgbToHex(rgb) {
  return `#${rgb.map((value) => clampValue(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}
function mixColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  return rgbToHex(ca.map((value, index) => value + (cb[index] - value) * t));
}
export function rotateHue(color, degrees) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const [r, g, b] = rgb.map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (!delta) return color;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + degrees + 360) % 360;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const [r1, g1, b1] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return rgbToHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]);
}
function formatLength(px, units) {
  const [factor, suffix] = UNIT_INFO[units] || UNIT_INFO.Pixels;
  return `${String(round2((px || 0) * factor)).replace(".", ",")} ${suffix}`;
}
function parseLength(text) {
  const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*(px|pt|mm|cm|pol|in)?\s*$/i.exec(String(text || ""));
  if (!match) return 1;
  const value = Number(match[1].replace(",", "."));
  const unit = (match[2] || "px").toLowerCase();
  const toPx = { px: 1, pt: 1 / 0.75, mm: 96 / 25.4, cm: 96 / 2.54, pol: 96, in: 96 }[unit];
  return value > 0 ? value * toPx : 1;
}
function cssTransform(object) {
  let transform = `rotate(${object.rotation ?? 0}deg)`;
  if (object.flipX || object.flipY) transform += ` scale(${object.flipX ? -1 : 1}, ${object.flipY ? -1 : 1})`;
  if (object.skewX) transform += ` skewX(${object.skewX}deg)`;
  return transform;
}
function cssFilter(object) {
  const filters = [];
  if (object.shadow) filters.push("drop-shadow(6px 6px 6px rgba(0,0,0,0.45))");
  if (object.blur) filters.push(`blur(${object.blur}px)`);
  return filters.length ? filters.join(" ") : undefined;
}
function boxPaint(object) {
  if (object.noFill) return "transparent";
  if (object.gradient) return `linear-gradient(${object.gradient.angle ?? 90}deg, ${object.gradient.from}, ${object.gradient.to})`;
  return object.color;
}
function svgId(id) {
  return `vc-${String(id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

// Árvore de nós SVG neutra: renderizada como JSX na prancheta e como texto na exportação.
const node = (tag, attrs = {}, children = []) => ({ tag, attrs, children });
function gradientNode(object, idp) {
  const angle = ((object.gradient.angle ?? 90) * Math.PI) / 180;
  const dx = Math.sin(angle) / 2;
  const dy = -Math.cos(angle) / 2;
  return node("linearGradient", { id: `${idp}-grad`, x1: round2(0.5 - dx), y1: round2(0.5 - dy), x2: round2(0.5 + dx), y2: round2(0.5 + dy) }, [
    node("stop", { offset: "0", stopColor: object.gradient.from }),
    node("stop", { offset: "1", stopColor: object.gradient.to }),
  ]);
}
function paintFor(object, idp) {
  if (object.noFill) return "none";
  if (object.gradient) return `url(#${idp}-grad)`;
  return object.color;
}
/** Nós do conteúdo de objetos de caminho, no espaço do viewBox (vbW × vbH). */
function pathGraphicNodes(object, idp) {
  const nodes = [];
  const defs = [];
  if (object.gradient) defs.push(gradientNode(object, idp));
  const strokeWidth = object.strokeWidth ?? 0;
  const strokeAttrs = {
    stroke: strokeWidth ? object.stroke || object.color : "none",
    strokeWidth: strokeWidth || undefined,
    strokeLinecap: object.linecap || "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke",
  };
  const paint = paintFor(object, idp);
  if (!object.parts) {
    nodes.push(node("path", { id: `${idp}-path`, d: object.smooth ? smoothD(object.d) : object.d, fill: object.filled ? paint : "none", fillRule: object.fillRule || "nonzero", ...strokeAttrs }));
    if (object.onPath) {
      nodes.push(node("text", { fill: object.stroke || object.color, fontSize: 22, fontWeight: 800, fontFamily: "Inter, Arial, sans-serif" }, [
        node("textPath", { href: `#${idp}-path` }, [object.text || "Texto no caminho"]),
      ]));
    }
  } else {
    const parts = object.parts;
    const all = parts.map((part) => part.d).join(" ");
    const full = node("rect", { x: 0, y: 0, width: object.vbW, height: object.vbH, fill: "white" });
    const op = object.op;
    if (op === "unite" || op === "exclude") {
      nodes.push(node("path", { d: all, fill: paint, fillRule: op === "exclude" ? "evenodd" : "nonzero", ...strokeAttrs }));
    } else if (op === "minusFront" || op === "minusBack") {
      const keep = op === "minusFront" ? parts[0] : parts[parts.length - 1];
      const removed = op === "minusFront" ? parts.slice(1) : parts.slice(0, -1);
      defs.push(node("mask", { id: `${idp}-mask` }, [full, ...removed.map((part) => node("path", { d: part.d, fill: "black" }))]));
      nodes.push(node("path", { d: keep.d, fill: paint, mask: `url(#${idp}-mask)` }));
    } else if (op === "intersect") {
      let inner = node("path", { d: parts[0].d, fill: paint });
      parts.slice(1).forEach((part, index) => {
        defs.push(node("clipPath", { id: `${idp}-clip${index}` }, [node("path", { d: part.d })]));
        inner = node("g", { clipPath: `url(#${idp}-clip${index})` }, [inner]);
      });
      nodes.push(inner);
    } else if (op === "crop") {
      const top = parts[parts.length - 1];
      defs.push(node("clipPath", { id: `${idp}-clip` }, [node("path", { d: top.d })]));
      nodes.push(node("g", { clipPath: `url(#${idp}-clip)` }, parts.slice(0, -1).map((part) => node("path", { d: part.d, fill: part.color }))));
    } else if (op === "trim") {
      parts.forEach((part, index) => {
        const front = parts.slice(index + 1);
        if (front.length) defs.push(node("mask", { id: `${idp}-mask${index}` }, [full, ...front.map((item) => node("path", { d: item.d, fill: "black" }))]));
        nodes.push(node("path", { d: part.d, fill: part.color, mask: front.length ? `url(#${idp}-mask${index})` : undefined }));
      });
    } else if (op === "outline") {
      parts.forEach((part) => nodes.push(node("path", { d: part.d, fill: "none", stroke: part.color, strokeWidth: 1, vectorEffect: "non-scaling-stroke" })));
    }
  }
  if (object.erase?.length) {
    const vbW = object.vbW || 100;
    const vbH = object.vbH || 100;
    const area = { x: -vbW, y: -vbH, width: vbW * 3, height: vbH * 3 };
    defs.push(node("mask", { id: `${idp}-erase`, maskUnits: "userSpaceOnUse", ...area }, [
      node("rect", { ...area, fill: "white" }),
      ...object.erase.map((stroke) => node("path", { d: stroke.d, fill: "none", stroke: "black", strokeWidth: stroke.width, strokeLinecap: "round", strokeLinejoin: "round" })),
    ]));
    const masked = [node("g", { mask: `url(#${idp}-erase)` }, nodes)];
    return [node("defs", {}, defs), ...masked];
  }
  return defs.length ? [node("defs", {}, defs), ...nodes] : nodes;
}
/** Caminho da Caneta: âncoras com alças (Bézier cúbica) em coordenadas de prancheta. */
function penD(anchors, closed, ox = 0, oy = 0) {
  if (!anchors.length) return "";
  const fmt = ([x, y]) => `${round2(x - ox)} ${round2(y - oy)}`;
  let d = `M${fmt(anchors[0].p)}`;
  const segment = (a, b) => (a.hout || b.hin ? ` C${fmt(a.hout || a.p)} ${fmt(b.hin || b.p)} ${fmt(b.p)}` : ` L${fmt(b.p)}`);
  for (let index = 1; index < anchors.length; index += 1) d += segment(anchors[index - 1], anchors[index]);
  if (closed && anchors.length > 1) d += `${segment(anchors[anchors.length - 1], anchors[0])} Z`;
  return d;
}
function penPatch(anchors, closed) {
  const bounds = boundsOf(parsePath(penD(anchors, closed), 16));
  const w = Math.max(1, bounds.maxX - bounds.minX);
  const h = Math.max(1, bounds.maxY - bounds.minY);
  return { x: round2(bounds.minX), y: round2(bounds.minY), w: round2(w), h: round2(h), vbW: round2(w), vbH: round2(h), d: penD(anchors, closed, bounds.minX, bounds.minY), rotation: 0, flipX: false, flipY: false, skewX: 0 };
}
function renderNodes(nodes) {
  return nodes.map((item, index) => {
    if (typeof item === "string") return item;
    const props = { key: `${item.tag}-${index}` };
    for (const [key, value] of Object.entries(item.attrs)) if (value !== undefined && value !== null && value !== false) props[key] = value;
    return createElement(item.tag, props, ...renderNodes(item.children));
  });
}
const CAMEL_SVG_ATTRS = new Set(["viewBox", "preserveAspectRatio", "maskUnits", "maskContentUnits", "gradientUnits", "clipPathUnits", "startOffset", "stdDeviation", "dx", "dy"]);
function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function nodeToMarkup(item) {
  if (typeof item === "string") return escapeXml(item);
  const attrs = Object.entries(item.attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => `${CAMEL_SVG_ATTRS.has(key) ? key : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${escapeXml(value)}"`)
    .join(" ");
  return `<${item.tag}${attrs ? ` ${attrs}` : ""}>${item.children.map(nodeToMarkup).join("")}</${item.tag}>`;
}
function objectExportNode(object) {
  const idp = svgId(object.id);
  const { w, h } = object;
  let transform = `translate(${round2(object.x + w / 2)} ${round2(object.y + h / 2)}) rotate(${object.rotation ?? 0})`;
  if (object.flipX || object.flipY) transform += ` scale(${object.flipX ? -1 : 1} ${object.flipY ? -1 : 1})`;
  if (object.skewX) transform += ` skewX(${object.skewX})`;
  transform += ` translate(${round2(-w / 2)} ${round2(-h / 2)})`;
  const children = [];
  const defs = [];
  if (object.shadow || object.blur) {
    defs.push(node("filter", { id: `${idp}-fx`, x: "-50%", y: "-50%", width: "200%", height: "200%" }, [
      object.shadow ? node("feDropShadow", { dx: 6, dy: 6, stdDeviation: 3, floodOpacity: 0.45 }) : null,
      object.blur ? node("feGaussianBlur", { stdDeviation: object.blur }) : null,
    ].filter(Boolean)));
  }
  const strokeWidth = object.strokeWidth ?? 0;
  if (isPathObject(object)) {
    children.push(node("g", { transform: `scale(${round2(w / (object.vbW || 100))} ${round2(h / (object.vbH || 100))})` }, pathGraphicNodes(object, idp)));
  } else if (object.kind === "Traçado") {
    children.push(node("path", { d: presetPath(object.drawingTool), transform: `scale(${round2(w / 100)} ${round2(h / 100)})`, fill: "none", stroke: object.stroke || object.color, strokeWidth: object.drawingTool === "Pincel" ? 12 : strokeWidth || 6, strokeLinecap: object.drawingTool === "Pincel" ? "round" : "butt", strokeLinejoin: "round", vectorEffect: "non-scaling-stroke" }));
  } else if (object.kind === "Texto") {
    const lines = String(object.text || object.name).split("\n");
    children.push(node("text", { fill: object.color, fontFamily: "Inter, Arial, sans-serif", fontSize: 48, fontWeight: 900, writingMode: object.vertical ? "vertical-rl" : undefined }, lines.map((line, index) => node("tspan", { x: 0, y: 40 + index * 48 }, [line]))));
  } else {
    if (object.gradient) defs.push(gradientNode(object, idp));
    const paint = paintFor(object, idp);
    const inset = strokeWidth / 2;
    const stroke = strokeWidth ? { stroke: object.stroke || "#0f172a", strokeWidth } : {};
    if (object.kind === "Elipse") children.push(node("ellipse", { cx: w / 2, cy: h / 2, rx: Math.max(0, w / 2 - inset), ry: Math.max(0, h / 2 - inset), fill: paint, ...stroke }));
    else if (object.kind === "Forma") children.push(node("polygon", { points: `${w / 2},0 ${w},${h} 0,${h}`, fill: paint, ...stroke }));
    else children.push(node("rect", { x: inset, y: inset, width: Math.max(0, w - strokeWidth), height: Math.max(0, h - strokeWidth), rx: object.cornerRadius || undefined, fill: paint, ...stroke }));
  }
  return node("g", { transform, opacity: (object.opacity ?? 100) < 100 ? (object.opacity ?? 100) / 100 : undefined, filter: defs.some((item) => item.tag === "filter") ? `url(#${idp}-fx)` : undefined }, [
    ...(defs.length ? [node("defs", {}, defs)] : []),
    ...children,
  ]);
}
function buildSvgDocument(objects) {
  const visible = [...objects].reverse().filter((object) => object.visible && !object.panelOnly);
  const ordered = [...visible.filter((object) => object.id === "background"), ...visible.filter((object) => object.id !== "background")];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${ARTBOARD_W}" height="${ARTBOARD_H}" viewBox="0 0 ${ARTBOARD_W} ${ARTBOARD_H}">${ordered.map((object) => nodeToMarkup(objectExportNode(object))).join("")}</svg>`;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function svgToPngBlob(svg) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = ARTBOARD_W;
        canvas.height = ARTBOARD_H;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas indisponível");
        context.drawImage(image, 0, 0, ARTBOARD_W, ARTBOARD_H);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG vazio"))), "image/png");
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG não pôde ser rasterizado"));
    };
    image.src = url;
  });
}
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$/;
function sanitizeObject(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || typeof raw.kind !== "string") return null;
  const number = (value, min, max, fallback) => (Number.isFinite(Number(value)) ? clampValue(Number(value), min, max) : fallback);
  const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : undefined);
  const color = (value) => (typeof value === "string" && COLOR_RE.test(value) ? value : undefined);
  const path = (value) => (typeof value === "string" && value.length <= 200000 && PATH_RE.test(value) ? value : undefined);
  const object = {
    id: raw.id.slice(0, 120),
    name: text(raw.name, 200) || raw.kind.slice(0, 40),
    kind: raw.kind.slice(0, 40),
    text: text(raw.text, 5000),
    color: color(raw.color) || "#000000",
    stroke: color(raw.stroke),
    strokeWidth: number(raw.strokeWidth, 0, 500, 0),
    drawingTool: text(raw.drawingTool, 40),
    x: number(raw.x, -100000, 100000, 0),
    y: number(raw.y, -100000, 100000, 0),
    w: number(raw.w, 0.01, 100000, 1),
    h: number(raw.h, 0.01, 100000, 1),
    rotation: number(raw.rotation, -36000, 36000, 0),
    skewX: number(raw.skewX, -89, 89, 0),
    opacity: number(raw.opacity, 0, 100, 100),
    cornerRadius: raw.cornerRadius === undefined ? undefined : number(raw.cornerRadius, 0, 100000, 0),
    blur: raw.blur ? number(raw.blur, 0, 50, 0) : undefined,
    d: path(raw.d),
    vbW: raw.vbW === undefined ? undefined : number(raw.vbW, 0.01, 100000, 100),
    vbH: raw.vbH === undefined ? undefined : number(raw.vbH, 0.01, 100000, 100),
    fillRule: raw.fillRule === "evenodd" ? "evenodd" : undefined,
    linecap: ["round", "butt", "square"].includes(raw.linecap) ? raw.linecap : undefined,
    op: ["unite", "minusFront", "minusBack", "intersect", "exclude", "crop", "trim", "outline"].includes(raw.op) ? raw.op : undefined,
  };
  for (const key of ["visible", "locked", "panelOnly", "filled", "smooth", "flipX", "flipY", "vertical", "noFill", "onPath", "shadow"]) object[key] = key === "visible" ? raw[key] !== false : raw[key] === true;
  if (raw.gradient && color(raw.gradient.from) && color(raw.gradient.to)) object.gradient = { from: raw.gradient.from, to: raw.gradient.to, angle: number(raw.gradient.angle, -360, 360, 90) };
  if (Array.isArray(raw.erase)) {
    const erase = raw.erase.slice(0, 500).map((stroke) => ({ d: path(stroke?.d), width: number(stroke?.width, 0.1, 10000, 20) })).filter((stroke) => stroke.d);
    if (erase.length) object.erase = erase;
  }
  if (Array.isArray(raw.parts) && object.op) {
    object.parts = raw.parts.slice(0, 100).map((part) => ({ d: path(part?.d) || "", color: color(part?.color) || object.color }));
  }
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files);
    input.click();
  });
}

export default function VectorCraftWorkspace({
  active: appActive = true,
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const [tool, setTool] = useGraphicDraftState("VectorCraftWorkspace.jsx:tool", "Seleção");
  const [slotTools, setSlotTools] = useGraphicDraftState("VectorCraftWorkspace.jsx:slotTools", {});
  const [openToolGroup, setOpenToolGroup] = useGraphicDraftState("VectorCraftWorkspace.jsx:openToolGroup", null);
  const [workspace, setWorkspace] = useGraphicDraftState("VectorCraftWorkspace.jsx:workspace", "Essenciais clássicos");
  const [rightPanel, setRightPanel] = useGraphicDraftState("VectorCraftWorkspace.jsx:rightPanel", "Propriedades");
  const [appearanceOpen, setAppearanceOpen] = useGraphicDraftState("VectorCraftWorkspace.jsx:appearanceOpen", false);
  const [zoom, setZoom] = useGraphicDraftState("VectorCraftWorkspace.jsx:zoom", 72);
  const [selectedObject, setSelectedRaw] = useGraphicDraftState("VectorCraftWorkspace.jsx:selectedObject", "title");
  const [objects, setObjectsRaw] = useGraphicDraftState("VectorCraftWorkspace.jsx:objects", [
    {
      id: "title",
      name: "Título principal",
      kind: "Texto",
      text: "DESIGN\nVETORIAL",
      color: "#082f49",
      visible: true,
      locked: false,
      x: 112,
      y: 150,
      w: 390,
      h: 120,
    },
    {
      id: "circle",
      name: "Forma circular",
      kind: "Elipse",
      color: "#22d3ee",
      visible: true,
      locked: false,
      x: 530,
      y: 170,
      w: 185,
      h: 185,
    },
    {
      id: "wave",
      name: "Onda vetorial",
      kind: "Traçado",
      color: "#6366f1",
      visible: true,
      locked: false,
      x: 95,
      y: 390,
      w: 630,
      h: 150,
    },
    {
      id: "path-cyan",
      name: "<Traçado ciano>",
      kind: "Traçado",
      color: "#22d3ee",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 240, h: 80,
    },
    {
      id: "path-magenta",
      name: "<Traçado magenta>",
      kind: "Traçado",
      color: "#ec4899",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 240, h: 80,
    },
    {
      id: "radial-repeat",
      name: "<Repetição radial>",
      kind: "Repetição",
      color: "#f59e0b",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 180, h: 180,
    },
    {
      id: "gradient-mesh",
      name: "Malha de degradê",
      kind: "Malha",
      color: "#06b6d4",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 180, h: 180,
    },
    {
      id: "mesh-pink",
      name: "<Malha rosa>",
      kind: "Malha",
      color: "#f472b6",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 120, h: 120,
    },
    {
      id: "mesh-violet",
      name: "<Malha violeta>",
      kind: "Malha",
      color: "#8b5cf6",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 120, h: 120,
    },
    {
      id: "background",
      name: "Fundo",
      kind: "Retângulo",
      color: "#f8fafc",
      visible: true,
      locked: true,
      x: 0,
      y: 0,
      w: 820,
      h: 620,
    },
  ]);
  const [fill, setFill] = useGraphicDraftState("VectorCraftWorkspace.jsx:fill", "#22d3ee");
  const [stroke, setStroke] = useGraphicDraftState("VectorCraftWorkspace.jsx:stroke", "#0f172a");
  const [units, setUnits] = useGraphicDraftState("VectorCraftWorkspace.jsx:units", "Pixels");
  const [snapPoint, setSnapPoint] = useGraphicDraftState("VectorCraftWorkspace.jsx:snapPoint", true);
  const [snapGrid, setSnapGrid] = useGraphicDraftState("VectorCraftWorkspace.jsx:snapGrid", false);
  const [scaleEffects, setScaleEffects] = useGraphicDraftState("VectorCraftWorkspace.jsx:scaleEffects", true);
  const [keyIncrement, setKeyIncrement] = useGraphicDraftState("VectorCraftWorkspace.jsx:keyIncrement", "1 px");
  const [extraIds, setExtraIds] = useState([]);
  const [notice, setNotice] = useState("");
  const [guide, setGuide] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const draftScope = useWorkScope();
  const transformRef = useRef(null);
  const drawingRef = useRef(null);
  const artboardRef = useRef(null);
  const scrollRef = useRef(null);
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const historyRef = useRef({ undo: [], redo: [] });
  const gestureRef = useRef(null);
  const clipboardRef = useRef([]);
  const suppressClickRef = useRef(false);
  const blendRef = useRef(null);
  const penRef = useRef(null);
  const keyHandlerRef = useRef(null);
  const sectionRef = useRef(null);
  const active = objects.find((object) => object.id === selectedObject);
  const ordered = useMemo(() => [...objects].reverse(), [objects]);
  const selectedIds = useMemo(() => {
    const ids = [selectedObject, ...extraIds].filter(Boolean);
    return [...new Set(ids)].filter((id) => objects.some((object) => object.id === id));
  }, [selectedObject, extraIds, objects]);

  // Histórico: cada ação (ou arraste completo) gera um passo de desfazer.
  function setObjects(change) {
    const gesture = gestureRef.current;
    if (!gesture || !gesture.recorded) {
      const history = historyRef.current;
      if (history.undo[history.undo.length - 1] !== objectsRef.current) {
        history.undo.push(objectsRef.current);
        if (history.undo.length > 100) history.undo.shift();
      }
      history.redo = [];
      if (gesture) gesture.recorded = true;
    }
    setObjectsRaw(change);
  }
  function beginGesture() {
    gestureRef.current = { recorded: false };
  }
  function endGesture() {
    gestureRef.current = null;
  }
  function restoreSelection(next) {
    if (selectedObject && !next.some((object) => object.id === selectedObject)) setSelectedObject(null);
  }
  function undo() {
    penRef.current = null;
    const history = historyRef.current;
    if (!history.undo.length) return setNotice("Nada para desfazer.");
    const previous = history.undo.pop();
    history.redo.push(objectsRef.current);
    setObjectsRaw(previous);
    restoreSelection(previous);
    setNotice("Desfeito.");
  }
  function redo() {
    const history = historyRef.current;
    if (!history.redo.length) return setNotice("Nada para refazer.");
    const next = history.redo.pop();
    history.undo.push(objectsRef.current);
    setObjectsRaw(next);
    restoreSelection(next);
    setNotice("Refeito.");
  }
  function setSelectedObject(id) {
    setSelectedRaw(id);
    setExtraIds([]);
  }
  function selectMany(ids) {
    setSelectedRaw(ids[0] ?? null);
    setExtraIds(ids.slice(1));
  }
  function toggleInSelection(id) {
    if (selectedIds.includes(id)) selectMany(selectedIds.filter((item) => item !== id));
    else selectMany([...selectedIds, id]);
  }
  function chooseTool(name) {
    penRef.current = null;
    setTool(name);
    blendRef.current = null;
    setNotice(UNSUPPORTED_TOOLS[name] || TOOL_HINTS[name] || "");
  }
  function editableSelection() {
    return selectedIds.map((id) => objectsRef.current.find((object) => object.id === id)).filter((object) => object && !object.locked);
  }

  function addObject(kind) {
    const id = crypto.randomUUID();
    setObjects((old) => [
      {
        id,
        name: `${kind} ${old.length}`,
        kind,
        color: fill,
        visible: true,
        locked: false,
        x: 220,
        y: 220,
        w: 180,
        h: kind === "Texto" ? 60 : 140,
      },
      ...old,
    ]);
    setSelectedObject(id);
  }
  function insertObject(kind, x, y, w, h, drawingTool = null, extra = {}) {
    const id = crypto.randomUUID();
    const next = {
      id,
      name: `${kind} ${objectsRef.current.length}`,
      kind,
      color: fill,
      stroke,
      strokeWidth: kind === "Traçado" ? 6 : 0,
      drawingTool,
      text: kind === "Texto" ? "TEXTO" : undefined,
      visible: true,
      locked: false,
      x,
      y,
      w,
      h,
      ...extra,
    };
    setObjects((old) => [next, ...old]);
    setSelectedObject(id);
    return id;
  }
  function canvasPoint(event) {
    const rect = artboardRef.current?.getBoundingClientRect();
    const scale = zoom / 100;
    if (!rect) return [0, 0];
    return [(event.clientX - rect.left) / scale, (event.clientY - rect.top) / scale];
  }
  function snapValue(value) {
    return snapGrid ? Math.round(value / 10) * 10 : value;
  }
  function trackDrag(onMove, onUp) {
    const move = (moveEvent) => onMove(moveEvent);
    const up = (upEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onUp?.(upEvent);
      endGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startDrawing(event) {
    const definitionByTool = {
      Retângulo: { kind: "Retângulo" },
      "Retângulo arredondado": { kind: "Retângulo", extra: { cornerRadius: 18 } },
      Elipse: { kind: "Elipse" },
      Polígono: { kind: "Forma" },
      Estrela: { kind: "Estrela", extra: { d: starD(), vbW: 100, vbH: 100, filled: true } },
      Arco: { kind: "Arco", extra: { d: arcD(), vbW: 100, vbH: 100, filled: false, strokeWidth: 3 } },
      Espiral: { kind: "Espiral", extra: { d: spiralD(), vbW: 100, vbH: 100, filled: false, strokeWidth: 3 } },
      "Grade retangular": { kind: "Grade", extra: { d: rectGridD(), vbW: 100, vbH: 100, filled: false, strokeWidth: 1 } },
      "Grade polar": { kind: "Grade", extra: { d: polarGridD(), vbW: 100, vbH: 100, filled: false, strokeWidth: 1 } },
      Clarão: { kind: "Clarão", extra: { d: flareD(), vbW: 100, vbH: 100, filled: true, strokeWidth: 2 } },
      "Segmento de linha": { kind: "Linha", line: true, extra: { filled: false, strokeWidth: 3 } },
      Modelador: { kind: "Traçado", drawingTool: "Modelador" },
      Texto: { kind: "Texto" },
      "Texto em área": { kind: "Texto" },
      "Texto vertical": { kind: "Texto", extra: { vertical: true } },
      "Texto vertical em área": { kind: "Texto", extra: { vertical: true } },
    };
    const definition = definitionByTool[tool];
    if (!definition) return false;
    const { kind, drawingTool, extra = {}, line } = definition;
    event.preventDefault();
    event.stopPropagation();
    beginGesture();
    const artboard = event.currentTarget.getBoundingClientRect();
    const scale = zoom / 100;
    const startX = snapValue(Math.max(0, Math.min(820, (event.clientX - artboard.left) / scale)));
    const startY = snapValue(Math.max(0, Math.min(620, (event.clientY - artboard.top) / scale)));
    const id = insertObject(
      kind,
      Math.round(startX),
      Math.round(startY),
      1,
      1,
      drawingTool,
      line ? { ...extra, d: "M0 0 L1 1", vbW: 1, vbH: 1 } : extra,
    );
    drawingRef.current = { id, kind, startX, startY, moved: false };
    const onMove = (moveEvent) => {
      const drawing = drawingRef.current;
      if (!drawing) return;
      const currentX = snapValue(Math.max(0, Math.min(820, (moveEvent.clientX - artboard.left) / scale)));
      const currentY = snapValue(Math.max(0, Math.min(620, (moveEvent.clientY - artboard.top) / scale)));
      const width = Math.abs(currentX - drawing.startX);
      const height = Math.abs(currentY - drawing.startY);
      drawing.moved = width > 4 || height > 4;
      if (line) {
        patchObjectValues(drawing.id, pathPatchFromCanvas([{ points: [[drawing.startX, drawing.startY], [currentX, currentY]], closed: false }]));
        return;
      }
      patchObjectValues(drawing.id, {
        x: Math.round(Math.min(drawing.startX, currentX)),
        y: Math.round(Math.min(drawing.startY, currentY)),
        w: Math.max(4, Math.round(width)),
        h: Math.max(4, Math.round(height)),
      });
    };
    const onUp = () => {
      const drawing = drawingRef.current;
      if (drawing && !drawing.moved) {
        if (line) {
          patchObjectValues(drawing.id, pathPatchFromCanvas([{ points: [[drawing.startX, drawing.startY], [drawing.startX + 140, drawing.startY]], closed: false }]));
        } else {
          patchObjectValues(drawing.id, {
            w: drawing.kind === "Traçado" ? 180 : drawing.kind === "Texto" ? 220 : 140,
            h: drawing.kind === "Traçado" ? 90 : drawing.kind === "Texto" ? 64 : 140,
          });
        }
      }
      drawingRef.current = null;
    };
    trackDrag(onMove, onUp);
    return true;
  }
  function toggle(id, key) {
    setObjects((old) =>
      old.map((object) =>
        object.id === id ? { ...object, [key]: !object[key] } : object,
      ),
    );
  }
  function patchObject(key, value) {
    setObjects((old) =>
      old.map((object) =>
        object.id === selectedObject ? { ...object, [key]: value } : object,
      ),
    );
  }
  function patchObjectValues(id, values) {
    setObjects((old) =>
      old.map((object) => (object.id === id ? { ...object, ...values } : object)),
    );
  }
  function patchMany(patches) {
    setObjects((old) => old.map((object) => (patches.has(object.id) ? { ...object, ...patches.get(object.id) } : object)));
  }
  function snapMove(source, nx, ny, ignore) {
    const x = snapValue(nx);
    const y = snapValue(ny);
    if (!snapPoint) return [x, y];
    // Encaixar no ponto: um canto do objeto arrastado encaixa num canto próximo (até 4 px).
    const corners = [[0, 0], [ARTBOARD_W, 0], [0, ARTBOARD_H], [ARTBOARD_W, ARTBOARD_H]];
    for (const other of objectsRef.current) {
      if (ignore.has(other.id) || !other.visible || other.panelOnly || other.id === "background") continue;
      corners.push([other.x, other.y], [other.x + other.w, other.y], [other.x, other.y + other.h], [other.x + other.w, other.y + other.h]);
    }
    for (const [ox, oy] of [[0, 0], [source.w, 0], [0, source.h], [source.w, source.h]]) {
      for (const [cx, cy] of corners) {
        if (Math.abs(x + ox - cx) <= 4 && Math.abs(y + oy - cy) <= 4) return [cx - ox, cy - oy];
      }
    }
    return [x, y];
  }
  function startTransform(event, object, mode) {
    if (object.locked) return;
    event.preventDefault();
    event.stopPropagation();
    beginGesture();
    const group = mode === "move" && selectedIds.length > 1 && selectedIds.includes(object.id)
      ? editableSelection()
      : [object];
    if (group.length === 1) setSelectedObject(object.id);
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    const centerX = bounds ? bounds.left + bounds.width / 2 : event.clientX;
    const centerY = bounds ? bounds.top + bounds.height / 2 : event.clientY;
    transformRef.current = {
      id: object.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      object: { ...object },
      group: group.map((item) => ({ ...item })),
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
    };
    const onMove = (moveEvent) => {
      const transform = transformRef.current;
      if (!transform) return;
      const scale = zoom / 100;
      const dx = (moveEvent.clientX - transform.startX) / scale;
      const dy = (moveEvent.clientY - transform.startY) / scale;
      const source = transform.object;
      if (transform.mode === "move") {
        const ignore = new Set(transform.group.map((item) => item.id));
        const [snappedX, snappedY] = snapMove(source, source.x + dx, source.y + dy, ignore);
        const offsetX = Math.round(snappedX) - source.x;
        const offsetY = Math.round(snappedY) - source.y;
        patchMany(new Map(transform.group.map((item) => [item.id, { x: Math.round(item.x + offsetX), y: Math.round(item.y + offsetY) }])));
        return;
      }
      if (transform.mode === "rotate") {
        const angle = Math.atan2(
          moveEvent.clientY - transform.centerY,
          moveEvent.clientX - transform.centerX,
        );
        patchObjectValues(transform.id, {
          rotation: Math.round((source.rotation ?? 0) + ((angle - transform.startAngle) * 180) / Math.PI),
        });
        return;
      }
      const direction = transform.mode.replace("resize-", "");
      const next = { x: source.x, y: source.y, w: source.w, h: source.h };
      if (direction.includes("e")) next.w = Math.max(24, Math.round(source.w + dx));
      if (direction.includes("s")) next.h = Math.max(24, Math.round(source.h + dy));
      if (direction.includes("w")) {
        next.w = Math.max(24, Math.round(source.w - dx));
        next.x = Math.round(source.x + source.w - next.w);
      }
      if (direction.includes("n")) {
        next.h = Math.max(24, Math.round(source.h - dy));
        next.y = Math.round(source.y + source.h - next.h);
      }
      if (scaleEffects && source.strokeWidth) {
        next.strokeWidth = round2(source.strokeWidth * Math.sqrt((next.w / source.w) * (next.h / source.h)));
      }
      patchObjectValues(transform.id, next);
    };
    trackDrag(onMove, () => {
      transformRef.current = null;
    });
  }
  function removeSelectedObject() {
    if (!selectedObject) return;
    const removing = new Set(selectedIds.length ? selectedIds : [selectedObject]);
    setObjects((current) => {
      const remaining = current.filter((object) => !removing.has(object.id));
      setSelectedObject(remaining[0]?.id ?? null);
      return remaining;
    });
  }

  // ---- Ferramentas que atuam sobre a prancheta inteira ----
  function startMarquee(event, lasso) {
    const start = canvasPoint(event);
    const points = [start];
    let moved = false;
    trackDrag((moveEvent) => {
      const point = canvasPoint(moveEvent);
      points.push(point);
      moved = moved || distance(point, start) > 4;
      if (moved) setGuide(lasso ? { kind: "lasso", points: [...points] } : { kind: "rect", a: start, b: point });
    }, () => {
      setGuide(null);
      if (!moved) return;
      suppressClickRef.current = true;
      const end = points[points.length - 1];
      const rect = { x1: Math.min(start[0], end[0]), y1: Math.min(start[1], end[1]), x2: Math.max(start[0], end[0]), y2: Math.max(start[1], end[1]) };
      const hits = objectsRef.current.filter((object) => {
        if (!object.visible || object.locked || object.panelOnly) return false;
        if (lasso) return pointInPolygon([object.x + object.w / 2, object.y + object.h / 2], points);
        return object.x < rect.x2 && object.x + object.w > rect.x1 && object.y < rect.y2 && object.y + object.h > rect.y1;
      }).map((object) => object.id);
      selectMany(hits);
      setNotice(hits.length ? `${hits.length} objeto(s) selecionado(s).` : "Nenhum objeto desbloqueado na área.");
    });
  }
  function startPan(event) {
    event.preventDefault();
    event.stopPropagation();
    const container = scrollRef.current;
    if (!container) return;
    const origin = { x: event.clientX, y: event.clientY, left: container.scrollLeft, top: container.scrollTop };
    trackDrag((moveEvent) => {
      container.scrollLeft = origin.left - (moveEvent.clientX - origin.x);
      container.scrollTop = origin.top - (moveEvent.clientY - origin.y);
    });
  }
  function zoomStep(direction) {
    setZoom((current) => {
      const next = direction > 0 ? ZOOM_STEPS.find((step) => step > current) ?? 150 : [...ZOOM_STEPS].reverse().find((step) => step < current) ?? 25;
      setNotice(`Zoom ${next}%`);
      return next;
    });
  }
  function startMeasure(event) {
    event.preventDefault();
    event.stopPropagation();
    const start = canvasPoint(event);
    trackDrag((moveEvent) => {
      const point = canvasPoint(moveEvent);
      setGuide({ kind: "line", a: start, b: point });
      const angle = round2((Math.atan2(start[1] - point[1], point[0] - start[0]) * 180) / Math.PI);
      setNotice(`Medida: ${formatLength(distance(start, point), units)} · ângulo ${String(angle).replace(".", ",")}° · L ${formatLength(Math.abs(point[0] - start[0]), units)} · A ${formatLength(Math.abs(point[1] - start[1]), units)}`);
    }, () => setGuide(null));
  }
  function convertible(object) {
    return object && object.visible && !object.locked && !object.panelOnly && object.kind !== "Texto" && !object.parts;
  }
  function startKnife(event) {
    event.preventDefault();
    event.stopPropagation();
    beginGesture();
    const start = canvasPoint(event);
    let end = start;
    trackDrag((moveEvent) => {
      end = canvasPoint(moveEvent);
      setGuide({ kind: "line", a: start, b: end });
    }, () => {
      setGuide(null);
      if (distance(start, end) < 4) return setNotice("Arraste atravessando a forma para cortar.");
      const additions = [];
      const patches = new Map();
      for (const object of objectsRef.current) {
        if (!convertible(object) || object.id === "background") continue;
        const subpaths = canvasSubpaths(object);
        const crossed = subpaths.some((subpath) => subpath.closed && subpath.points.some((point, index) => segmentsCross(start, end, point, subpath.points[(index + 1) % subpath.points.length])));
        if (!crossed) continue;
        const left = [];
        const right = [];
        for (const subpath of subpaths) {
          const pieces = subpath.closed ? splitPolygonByLine(subpath.points, start, end) : null;
          if (pieces) {
            left.push({ points: pieces[0], closed: true });
            right.push({ points: pieces[1], closed: true });
          } else {
            const side = (end[0] - start[0]) * (subpath.points[0][1] - start[1]) - (end[1] - start[1]) * (subpath.points[0][0] - start[0]);
            (side >= 0 ? left : right).push(subpath);
          }
        }
        if (!left.length || !right.length) continue;
        patches.set(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(left) });
        additions.push({ after: object.id, object: { ...object, ...pathStyle(object), ...pathPatchFromCanvas(right), id: crypto.randomUUID(), name: `${object.name} (parte)` } });
      }
      if (!patches.size) return setNotice("A linha não atravessou nenhuma forma fechada desbloqueada.");
      setObjects((old) => {
        const next = [];
        for (const object of old) {
          next.push(patches.has(object.id) ? { ...object, ...patches.get(object.id) } : object);
          for (const addition of additions) if (addition.after === object.id) next.push(addition.object);
        }
        return next;
      });
      setNotice(`${patches.size} forma(s) cortada(s) em duas partes.`);
    });
  }
  function startWarp(event) {
    event.preventDefault();
    event.stopPropagation();
    beginGesture();
    const cache = new Map();
    let last = canvasPoint(event);
    let step = 0;
    const apply = (point, delta) => {
      step += 1;
      const patches = new Map();
      for (const object of objectsRef.current) {
        if (!convertible(object) || object.id === "background") continue;
        let subpaths = cache.get(object.id);
        if (!subpaths) {
          const box = { x1: object.x - BRUSH_RADIUS, y1: object.y - BRUSH_RADIUS, x2: object.x + object.w + BRUSH_RADIUS, y2: object.y + object.h + BRUSH_RADIUS };
          if (point[0] < box.x1 || point[0] > box.x2 || point[1] < box.y1 || point[1] > box.y2) continue;
          subpaths = resample(canvasSubpaths(object, 12), 6);
        }
        const warped = warpSubpaths(subpaths, tool, point, delta, step);
        cache.set(object.id, warped);
        patches.set(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(warped) });
      }
      if (patches.size) patchMany(patches);
    };
    if (tool !== "Deformar") apply(last, [0, 0]);
    trackDrag((moveEvent) => {
      const point = canvasPoint(moveEvent);
      apply(point, [point[0] - last[0], point[1] - last[1]]);
      last = point;
    }, () => setNotice(cache.size ? `${tool}: ${cache.size} forma(s) alterada(s).` : `${tool}: passe o pincel sobre uma forma desbloqueada.`));
  }
  function startPathBrush(event) {
    event.preventDefault();
    event.stopPropagation();
    const targets = editableSelection().filter(convertible);
    if (!targets.length) return setNotice(`${tool}: selecione um caminho desbloqueado primeiro.`);
    beginGesture();
    const cache = new Map(targets.map((object) => [object.id, resample(canvasSubpaths(object, 12), 4)]));
    const apply = (point) => {
      const patches = new Map();
      for (const object of targets) {
        let subpaths = cache.get(object.id);
        if (tool === "Borracha de caminho") {
          const next = [];
          for (const subpath of subpaths) {
            let current = [];
            const points = subpath.closed ? [...subpath.points, subpath.points[0]] : subpath.points;
            const anyErased = points.some((item) => distance(item, point) <= 10);
            if (!anyErased) {
              next.push(subpath);
              continue;
            }
            for (const item of points) {
              if (distance(item, point) <= 10) {
                if (current.length > 1) next.push({ points: current, closed: false });
                current = [];
              } else current.push(item);
            }
            if (current.length > 1) next.push({ points: current, closed: false });
          }
          subpaths = next;
        } else {
          subpaths = subpaths.map((subpath) => ({
            ...subpath,
            points: subpath.points.map((item, index, all) => {
              if (distance(item, point) > 20) return item;
              const previous = all[index - 1] ?? (subpath.closed ? all[all.length - 1] : item);
              const following = all[index + 1] ?? (subpath.closed ? all[0] : item);
              return [(previous[0] + item[0] * 2 + following[0]) / 4, (previous[1] + item[1] * 2 + following[1]) / 4];
            }),
          }));
        }
        cache.set(object.id, subpaths);
        if (!subpaths.length) patches.set(object.id, { visible: false });
        else patches.set(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(subpaths), filled: tool === "Borracha de caminho" ? false : pathStyle(object).filled ?? object.filled, strokeWidth: object.strokeWidth || 2 });
      }
      patchMany(patches);
    };
    apply(canvasPoint(event));
    trackDrag((moveEvent) => apply(canvasPoint(moveEvent)));
  }

  function clampedPoint(event) {
    const [x, y] = canvasPoint(event);
    return [snapValue(clampValue(x, 0, ARTBOARD_W)), snapValue(clampValue(y, 0, ARTBOARD_H))];
  }
  // Caneta (clique = canto, clique e arraste = alças Bézier) e Curvatura (pontos suaves).
  function penClick(event) {
    event.preventDefault();
    event.stopPropagation();
    beginGesture();
    const point = clampedPoint(event);
    const curvature = tool === "Curvatura";
    let pen = penRef.current;
    if (pen && !objectsRef.current.some((object) => object.id === pen.id)) pen = penRef.current = null;
    if (pen && pen.anchors.length >= 2 && distance(point, pen.anchors[0].p) <= 8) {
      const patch = curvature
        ? pathPatchFromCanvas([{ points: pen.anchors.map((anchor) => anchor.p), closed: true }])
        : penPatch(pen.anchors, true);
      patchObjectValues(pen.id, { ...patch, filled: true });
      penRef.current = null;
      endGesture();
      return setNotice("Caminho fechado.");
    }
    const anchor = { p: point, hin: null, hout: null };
    const update = () => {
      const current = penRef.current;
      if (!current) return;
      patchObjectValues(current.id, curvature
        ? pathPatchFromCanvas([{ points: current.anchors.map((item) => item.p), closed: false }])
        : penPatch(current.anchors, false));
    };
    if (!pen) {
      const id = insertObject("Traçado", round2(point[0]), round2(point[1]), 1, 1, tool, { d: "M0 0", vbW: 1, vbH: 1, filled: false, strokeWidth: 2, smooth: curvature });
      penRef.current = { id, anchors: [anchor] };
      setNotice(curvature ? "Curvatura: clique para adicionar pontos suaves; Enter conclui; clique no primeiro ponto fecha." : "Caneta: clique para cantos, arraste para curvas; Enter conclui; clique no primeiro ponto fecha.");
    } else {
      pen.anchors.push(anchor);
      update();
    }
    trackDrag((moveEvent) => {
      if (curvature) return;
      const current = clampedPoint(moveEvent);
      if (distance(current, anchor.p) < 3) return;
      anchor.hout = current;
      anchor.hin = [2 * anchor.p[0] - current[0], 2 * anchor.p[1] - current[1]];
      update();
    });
  }
  function finishPen() {
    if (!penRef.current) return false;
    penRef.current = null;
    setNotice("Caminho concluído.");
    return true;
  }
  // Lápis / Pincel / Pincel de manchas: captura à mão livre com simplificação ao soltar.
  function startFreehand(event) {
    event.preventDefault();
    event.stopPropagation();
    beginGesture();
    const options = {
      Lápis: { drawingTool: "Lápis", tolerance: 1.5, extra: {} },
      Pincel: { drawingTool: "Pincel", tolerance: 1, extra: { strokeWidth: 12, linecap: "round" } },
      "Pincel de manchas": { drawingTool: "Pincel de manchas", tolerance: 1, extra: { strokeWidth: 24, linecap: "round", stroke: fill } },
    }[tool];
    const points = [clampedPoint(event)];
    let id = null;
    trackDrag((moveEvent) => {
      const point = clampedPoint(moveEvent);
      if (distance(point, points[points.length - 1]) < 1.5) return;
      points.push(point);
      const patch = pathPatchFromCanvas([{ points, closed: false }]);
      if (!id) id = insertObject("Traçado", patch.x, patch.y, patch.w, patch.h, options.drawingTool, { ...options.extra, ...patch, filled: false });
      else patchObjectValues(id, patch);
    }, () => {
      if (!id) return setNotice(`${tool}: arraste para desenhar.`);
      if (points.length > 2) patchObjectValues(id, pathPatchFromCanvas([{ points: simplifyPoints(points, options.tolerance), closed: false }]));
    });
  }
  // Borracha: apaga só a área arrastada. Caminhos abertos/sem preenchimento são cortados
  // geometricamente; formas preenchidas recebem uma máscara de apagamento (exportada no SVG).
  // Um clique sem arrastar sobre um objeto o exclui (comportamento rápido existente).
  function startEraser(event, clicked) {
    event.preventDefault();
    event.stopPropagation();
    beginGesture();
    const radius = 10;
    const snapshot = objectsRef.current;
    const deleting = clicked && !clicked.locked ? clicked : null;
    if (deleting) {
      setObjects((current) => current.filter((item) => item.id !== deleting.id));
      setSelectedObject(null);
    }
    let last = canvasPoint(event);
    let moved = false;
    const geometry = new Map();
    const masks = new Map();
    const apply = (a, b, list) => {
      const near = (point) => segmentDistance(point, a, b).distance <= radius;
      const patches = new Map();
      const removed = new Set();
      for (const object of list) {
        if (!object.visible || object.locked || object.panelOnly || object.kind === "Texto" || object.id === "background") continue;
        if (!geometry.has(object.id) && !masks.has(object.id)) {
          const box = { x1: Math.min(a[0], b[0]) - radius, y1: Math.min(a[1], b[1]) - radius, x2: Math.max(a[0], b[0]) + radius, y2: Math.max(a[1], b[1]) + radius };
          if (object.x > box.x2 || object.x + object.w < box.x1 || object.y > box.y2 || object.y + object.h < box.y1) continue;
        }
        const filled = object.parts || (isPathObject(object) ? object.filled : object.kind !== "Traçado" && !object.noFill);
        if (!filled) {
          let subpaths = geometry.get(object.id) ?? resample(canvasSubpaths(object, 12), 3);
          if (!subpaths.some((subpath) => subpath.points.some(near))) continue;
          const next = [];
          for (const subpath of subpaths) {
            const points = subpath.closed ? [...subpath.points, subpath.points[0]] : subpath.points;
            if (!points.some(near)) {
              next.push(subpath);
              continue;
            }
            let run = [];
            for (const point of points) {
              if (near(point)) {
                if (run.length > 1) next.push({ points: run, closed: false });
                run = [];
              } else run.push(point);
            }
            if (run.length > 1) next.push({ points: run, closed: false });
          }
          subpaths = next;
          geometry.set(object.id, subpaths);
          if (!subpaths.length) removed.add(object.id);
          else patches.set(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(subpaths), filled: false, strokeWidth: object.strokeWidth || (object.drawingTool === "Pincel" ? 12 : 6) });
          continue;
        }
        let entry = masks.get(object.id);
        if (!entry) {
          const transformed = object.rotation || object.flipX || object.flipY || object.skewX;
          if (object.parts && transformed) continue;
          const base = isPathObject(object) && !transformed ? object : { ...object, ...pathStyle(object), ...pathPatchFromCanvas(canvasSubpaths(object, 16)) };
          entry = { base, points: [] };
          masks.set(object.id, entry);
        }
        if (!entry.points.length) entry.points.push(a);
        entry.points.push(b);
        const { base } = entry;
        const sx = (base.vbW || 100) / base.w;
        const sy = (base.vbH || 100) / base.h;
        const local = entry.points.map(([x, y]) => [(x - base.x) * sx, (y - base.y) * sy]);
        const stroke = { d: polygonD(local, false), width: round2(radius * 2 * Math.max(sx, sy)) };
        patches.set(object.id, { ...base, erase: [...(base.erase || []), stroke] });
      }
      if (patches.size || removed.size) setObjects((old) => old.filter((item) => !removed.has(item.id)).map((item) => (patches.has(item.id) ? { ...item, ...patches.get(item.id) } : item)));
    };
    if (!deleting) apply(last, last, snapshot);
    trackDrag((moveEvent) => {
      const point = canvasPoint(moveEvent);
      if (!moved) {
        if (distance(point, last) < 3) return;
        moved = true;
        if (deleting) {
          setObjects(snapshot);
          apply(last, point, snapshot);
          last = point;
          return;
        }
      }
      apply(last, point, objectsRef.current);
      last = point;
    }, () => {
      if (moved || !deleting) setNotice(geometry.size || masks.size ? `Borracha: ${geometry.size + masks.size} objeto(s) apagado(s) na área arrastada.` : "Borracha: nada a apagar nessa área.");
    });
  }

  function handleArtboardPointerDown(event) {
    if (event.button) return;
    const targetId = event.target.closest?.("[data-object-id]")?.getAttribute("data-object-id");
    const target = objectsRef.current.find((object) => object.id === targetId);
    if (UNSUPPORTED_TOOLS[tool]) {
      event.preventDefault();
      event.stopPropagation();
      setNotice(UNSUPPORTED_TOOLS[tool]);
      return;
    }
    if (tool === "Caneta" || tool === "Curvatura") return penClick(event);
    if (tool === "Lápis" || tool === "Pincel" || tool === "Pincel de manchas") return startFreehand(event);
    if (tool === "Borracha" && (!target || target.locked)) return startEraser(event, null);
    if (startDrawing(event)) return;
    if (tool === "Mão") return startPan(event);
    if (tool === "Zoom") {
      event.preventDefault();
      event.stopPropagation();
      return zoomStep(event.altKey ? -1 : 1);
    }
    if (tool === "Medida") return startMeasure(event);
    if (tool === "Faca" || tool === "Corte em linha") return startKnife(event);
    if (WARP_TOOLS.includes(tool)) return startWarp(event);
    if (tool === "Borracha de caminho" || tool === "Suavizar") return startPathBrush(event);
    if (SELECT_TOOLS.includes(tool) && tool !== "Laço" && (!target || target.locked) && !event.target.closest?.("[role='button']")) startMarquee(event, false);
    if (tool === "Laço" && (!target || target.locked || event.altKey)) {
      if (event.altKey) {
        event.preventDefault();
        event.stopPropagation();
      }
      startMarquee(event, true);
    }
  }

  // ---- Ferramentas que atuam sobre o objeto clicado ----
  function startObjectDrag(event, object, mode) {
    event.preventDefault();
    event.stopPropagation();
    beginGesture();
    suppressClickRef.current = true;
    const start = canvasPoint(event);
    const center = [object.x + object.w / 2, object.y + object.h / 2];
    const source = { ...object };
    const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
    const startDistance = Math.max(1, distance(start, center));
    if (mode === "gradient") {
      patchObjectValues(object.id, { gradient: { from: source.gradient?.from || source.color, to: stroke === source.color ? "#000000" : stroke, angle: source.gradient?.angle ?? 90 }, noFill: false });
      setNotice("Gradiente linear aplicado. Arraste para definir a direção.");
    }
    trackDrag((moveEvent) => {
      const point = canvasPoint(moveEvent);
      if (mode === "rotate") {
        let rotation = (source.rotation ?? 0) + ((Math.atan2(point[1] - center[1], point[0] - center[0]) - startAngle) * 180) / Math.PI;
        if (moveEvent.shiftKey) rotation = Math.round(rotation / 45) * 45;
        patchObjectValues(object.id, { rotation: Math.round(rotation) });
      } else if (mode === "scale") {
        const factor = Math.max(0.05, distance(point, center) / startDistance);
        const w = Math.max(1, round2(source.w * factor));
        const h = Math.max(1, round2(source.h * factor));
        patchObjectValues(object.id, { w, h, x: round2(center[0] - w / 2), y: round2(center[1] - h / 2), ...(scaleEffects && source.strokeWidth ? { strokeWidth: round2(source.strokeWidth * factor) } : {}) });
      } else if (mode === "shear") {
        const skew = clampValue(Math.round((source.skewX ?? 0) + (Math.atan2(point[0] - start[0], Math.max(1, source.h)) * 180) / Math.PI), -75, 75);
        patchObjectValues(object.id, { skewX: skew });
      } else if (mode === "gradient") {
        if (distance(point, start) < 4) return;
        const angle = Math.round(90 + (Math.atan2(point[1] - start[1], point[0] - start[0]) * 180) / Math.PI);
        patchObjectValues(object.id, { gradient: { from: source.gradient?.from || source.color, to: stroke === source.color ? "#000000" : stroke, angle } });
      } else if (mode === "width") {
        patchObjectValues(object.id, { strokeWidth: clampValue(round2((source.strokeWidth || 1) - (point[1] - start[1]) / 4), 0.25, 200) });
      }
    }, () => {
      if (mode === "width") setNotice("Largura do traçado ajustada (perfil uniforme; perfis variáveis ainda não estão disponíveis).");
    });
  }
  function nearestOnObject(object, point) {
    const subpaths = canvasSubpaths(object, 16);
    let best = null;
    subpaths.forEach((subpath, subIndex) => {
      const count = subpath.points.length;
      const edges = subpath.closed ? count : count - 1;
      for (let index = 0; index < edges; index += 1) {
        const hit = segmentDistance(point, subpath.points[index], subpath.points[(index + 1) % count]);
        if (!best || hit.distance < best.distance) best = { ...hit, subIndex, index };
      }
    });
    return { best, subpaths };
  }
  function scissors(object, point) {
    const { best, subpaths } = nearestOnObject(object, point);
    if (!best || best.distance > 14) return setNotice("Clique exatamente sobre o contorno do caminho para dividi-lo.");
    const subpath = subpaths[best.subIndex];
    const others = subpaths.filter((_, index) => index !== best.subIndex);
    const before = subpath.points.slice(0, best.index + 1);
    const after = subpath.points.slice(best.index + 1);
    const style = { ...pathStyle(object), strokeWidth: object.strokeWidth || 2 };
    if (subpath.closed) {
      const opened = { points: [best.point, ...after, ...before, best.point], closed: false };
      patchObjectValues(object.id, { ...style, ...pathPatchFromCanvas([opened, ...others]) });
      return setNotice("Caminho fechado aberto no ponto clicado.");
    }
    const first = { points: [...before, best.point], closed: false };
    const second = { points: [best.point, ...after], closed: false };
    const newObject = { ...object, ...style, ...pathPatchFromCanvas([second]), id: crypto.randomUUID(), name: `${object.name} (parte)` };
    setObjects((old) => old.flatMap((item) => (item.id === object.id ? [{ ...item, ...style, ...pathPatchFromCanvas([first, ...others]) }, newObject] : [item])));
    setNotice("Caminho dividido em dois.");
  }
  function editAnchor(object, point, mode) {
    if (mode === "toggle") {
      if (!isPathObject(object) && object.kind !== "Traçado") patchObjectValues(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(canvasSubpaths(object, 6)), smooth: true });
      else patchObjectValues(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(canvasSubpaths(object, 6)), smooth: !object.smooth });
      return setNotice(object.smooth ? "Pontos convertidos em cantos." : "Pontos convertidos em suaves.");
    }
    const subpaths = canvasSubpaths(object, isPathObject(object) ? 1 : 8);
    if (mode === "add") {
      const { best } = nearestOnObject({ ...object, ...pathPatchFromCanvas(subpaths), ...pathStyle(object) }, point);
      if (!best || best.distance > 14) return setNotice("Clique sobre o contorno para adicionar um ponto.");
      subpaths[best.subIndex].points.splice(best.index + 1, 0, best.point);
      patchObjectValues(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(subpaths) });
      return setNotice("Ponto de ancoragem adicionado.");
    }
    let found = null;
    subpaths.forEach((subpath, subIndex) => subpath.points.forEach((item, index) => {
      const gap = distance(item, point);
      if (gap <= 14 && (!found || gap < found.gap)) found = { subIndex, index, gap };
    }));
    if (!found) return setNotice("Clique perto de um ponto de ancoragem para excluí-lo.");
    const target = subpaths[found.subIndex];
    if (target.points.length <= 2) return setNotice("O caminho precisa de ao menos dois pontos.");
    target.points.splice(found.index, 1);
    patchObjectValues(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(subpaths) });
    setNotice("Ponto de ancoragem excluído.");
  }
  function joinPaths(object) {
    const base = editableSelection().find((item) => item.id !== object.id);
    if (!base) return setNotice("Selecione primeiro um caminho aberto e depois clique no outro.");
    const a = canvasSubpaths(base, 16);
    const b = canvasSubpaths(object, 16);
    if (a.length !== 1 || b.length !== 1 || a[0].closed || b[0].closed || !convertible(base) || !convertible(object)) return setNotice("Unir funciona com dois caminhos abertos simples.");
    const first = a[0].points;
    const second = b[0].points;
    const options = [
      [first, second],
      [first, [...second].reverse()],
      [[...first].reverse(), second],
      [[...first].reverse(), [...second].reverse()],
    ];
    const [p, q] = options.reduce((bestPair, pair) => (distance(pair[0][pair[0].length - 1], pair[1][0]) < distance(bestPair[0][bestPair[0].length - 1], bestPair[1][0]) ? pair : bestPair));
    const joined = { points: [...p, ...q], closed: false };
    setObjects((old) => old.filter((item) => item.id !== object.id).map((item) => (item.id === base.id ? { ...item, ...pathStyle(item), ...pathPatchFromCanvas([joined]) } : item)));
    setSelectedObject(base.id);
    setNotice("Caminhos unidos.");
  }
  function blendWith(object) {
    const firstId = blendRef.current;
    const first = objectsRef.current.find((item) => item.id === firstId);
    if (!first || first.id === object.id) {
      blendRef.current = object.id;
      return setNotice("Mesclagem: agora clique no segundo objeto.");
    }
    blendRef.current = null;
    if (first.kind === "Texto" || object.kind === "Texto") return setNotice("Mesclagem não se aplica a texto.");
    const steps = Array.from({ length: 3 }, (_, index) => {
      const t = (index + 1) / 4;
      const mix = (key) => round2(first[key] + (object[key] - first[key]) * t);
      return { ...first, id: crypto.randomUUID(), name: `Mesclagem ${index + 1}`, x: mix("x"), y: mix("y"), w: mix("w"), h: mix("h"), color: mixColor(first.color, object.color, t), rotation: round2((first.rotation ?? 0) + ((object.rotation ?? 0) - (first.rotation ?? 0)) * t), locked: false };
    });
    setObjects((old) => {
      const index = Math.max(old.findIndex((item) => item.id === first.id), old.findIndex((item) => item.id === object.id));
      const next = [...old];
      next.splice(index, 0, ...steps);
      return next;
    });
    setNotice("Mesclagem criada com 3 etapas.");
  }
  function combine(ids, op, forcedFront = null) {
    const current = objectsRef.current;
    let list = ids.map((id) => current.find((object) => object.id === id)).filter((object) => object && object.visible && !object.locked && !object.panelOnly);
    if (list.length < 2) return setNotice("Selecione dois ou mais objetos desbloqueados (Shift+clique) para combinar.");
    if (list.some((object) => object.kind === "Texto" || object.parts)) return setNotice("Texto e formas compostas não podem ser combinados; expanda-os antes.");
    list.sort((a, b) => current.indexOf(b) - current.indexOf(a));
    if (forcedFront) list = [...list.filter((object) => object.id !== forcedFront), list.find((object) => object.id === forcedFront)];
    const canvasParts = list.map((object) => ({
      object,
      subpaths: canvasSubpaths(object).map((subpath) => {
        const closed = { ...subpath, closed: true };
        return signedArea(closed.points) < 0 ? { ...closed, points: [...closed.points].reverse() } : closed;
      }),
    }));
    const bounds = boundsOf(canvasParts.flatMap((part) => part.subpaths));
    const w = Math.max(1, bounds.maxX - bounds.minX);
    const h = Math.max(1, bounds.maxY - bounds.minY);
    const parts = canvasParts.map(({ object, subpaths }) => ({
      d: subpathsToD(subpaths.map((subpath) => ({ ...subpath, points: subpath.points.map(([x, y]) => [x - bounds.minX, y - bounds.minY]) }))),
      color: object.noFill ? object.stroke || object.color : object.color,
    }));
    const styleSource = op === "minusFront" ? list[0] : list[list.length - 1];
    const id = crypto.randomUUID();
    const compound = { id, name: `Forma composta ${current.length}`, kind: "Composto", op, parts, color: styleSource.color, gradient: styleSource.gradient, stroke: styleSource.stroke || stroke, strokeWidth: 0, opacity: styleSource.opacity, visible: true, locked: false, x: round2(bounds.minX), y: round2(bounds.minY), w: round2(w), h: round2(h), vbW: round2(w), vbH: round2(h) };
    const removing = new Set(list.map((object) => object.id));
    const frontIndex = Math.min(...list.map((object) => current.indexOf(object)));
    setObjects((old) => {
      const next = old.filter((object) => !removing.has(object.id));
      next.splice(Math.min(frontIndex, next.length), 0, compound);
      return next;
    });
    setSelectedObject(id);
    const labels = { unite: "Unir", minusFront: "Menos frente", minusBack: "Menos fundo", intersect: "Interseção", exclude: "Excluir sobreposição", crop: "Cortar", trim: "Aparar", outline: "Contorno" };
    setNotice(`${labels[op]} aplicado a ${list.length} objetos.`);
  }
  function expandObject(object) {
    if (!object) return setNotice("Selecione um objeto para expandir.");
    if (object.locked) return setNotice("Objeto bloqueado.");
    if (object.kind === "Texto") return setNotice("Converter texto em contornos ainda não está disponível (requer as curvas da fonte).");
    if (object.parts) {
      if (object.op !== "unite" && object.op !== "exclude") return setNotice("Esta forma composta usa máscara; ela é exportada corretamente em SVG/PNG, mas ainda não pode ser expandida em um único caminho.");
      patchObjectValues(object.id, { kind: "Traçado", d: object.parts.map((part) => part.d).join(" "), parts: undefined, op: undefined, filled: true, fillRule: object.op === "exclude" ? "evenodd" : "nonzero" });
      return setNotice("Forma composta expandida em caminho.");
    }
    if ((object.kind === "Traçado" || isPathObject(object)) && !object.filled) {
      const width = object.drawingTool === "Pincel" && !object.d ? 12 : object.strokeWidth || 6;
      const outlines = canvasSubpaths(object, 16).filter((subpath) => subpath.points.length > 1).map((subpath) => {
        const points = simplifyPoints(subpath.points, 0.3);
        const left = offsetSubpath({ points, closed: subpath.closed }, width / 2).points;
        const right = offsetSubpath({ points, closed: subpath.closed }, -width / 2).points;
        return { points: [...left, ...right.reverse()], closed: true };
      });
      if (!outlines.length) return setNotice("Não há traçado para expandir.");
      patchObjectValues(object.id, { ...pathPatchFromCanvas(outlines), kind: "Traçado", filled: true, color: object.stroke || object.color, strokeWidth: 0, smooth: false, fillRule: "nonzero" });
      return setNotice("Traçado expandido em forma preenchida.");
    }
    if (isPathObject(object)) return setNotice("O objeto já é um caminho.");
    patchObjectValues(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(canvasSubpaths(object, 16)) });
    setNotice("Forma expandida em caminho editável.");
  }
  function offsetObject(object, amount = 10) {
    if (!object) return setNotice("Selecione um objeto para deslocar o caminho.");
    if (object.kind === "Texto" || object.parts) return setNotice("Deslocar caminho funciona com formas e caminhos.");
    let copy;
    if (!isPathObject(object) && object.kind !== "Traçado") {
      copy = { ...object, x: object.x - amount, y: object.y - amount, w: object.w + amount * 2, h: object.h + amount * 2, ...(object.kind === "Retângulo" && object.cornerRadius ? { cornerRadius: object.cornerRadius + amount } : {}) };
    } else {
      copy = { ...object, ...pathStyle(object), ...pathPatchFromCanvas(canvasSubpaths(object, 16).map((subpath) => offsetSubpath({ ...subpath, points: simplifyPoints(subpath.points, 0.3) }, amount))) };
    }
    copy = { ...copy, id: crypto.randomUUID(), name: `${object.name} (deslocado)`, locked: false };
    setObjects((old) => old.flatMap((item) => (item.id === object.id ? [item, copy] : [item])));
    setNotice(`Caminho deslocado em ${formatLength(amount, units)}.`);
  }
  function simplifyObject(object) {
    if (!object) return setNotice("Selecione um caminho para simplificar.");
    if (!isPathObject(object) && object.kind !== "Traçado") return setNotice("Simplificar atua em caminhos; use Expandir antes.");
    if (object.parts || object.locked) return setNotice("Expanda ou desbloqueie o objeto antes de simplificar.");
    const subpaths = canvasSubpaths(object, 16);
    const before = subpaths.reduce((total, subpath) => total + subpath.points.length, 0);
    const simplified = subpaths.map((subpath) => ({ ...subpath, points: simplifyPoints(subpath.points, 1.5) }));
    const after = simplified.reduce((total, subpath) => total + subpath.points.length, 0);
    patchObjectValues(object.id, { ...pathStyle(object), ...pathPatchFromCanvas(simplified) });
    setNotice(`Caminho simplificado: ${before} → ${after} pontos.`);
  }
  function recolor(targets) {
    if (!targets.length) return setNotice("Selecione objetos para recolorir.");
    const patches = new Map(targets.map((object) => [object.id, {
      color: rotateHue(object.color, 60),
      ...(object.stroke ? { stroke: rotateHue(object.stroke, 60) } : {}),
      ...(object.gradient ? { gradient: { ...object.gradient, from: rotateHue(object.gradient.from, 60), to: rotateHue(object.gradient.to, 60) } } : {}),
      ...(object.parts ? { parts: object.parts.map((part) => ({ ...part, color: rotateHue(part.color, 60) })) } : {}),
    }]));
    patchMany(patches);
    setNotice("Cores giradas 60° no círculo cromático.");
  }
  function reorder(mode) {
    const ids = new Set(editableSelection().map((object) => object.id));
    if (!ids.size) return setNotice("Selecione objetos desbloqueados para organizar.");
    setObjects((old) => {
      const picked = old.filter((object) => ids.has(object.id));
      const rest = old.filter((object) => !ids.has(object.id));
      if (mode === "front") return [...picked, ...rest];
      if (mode === "back") {
        const backgroundIndex = rest.findIndex((object) => object.id === "background");
        if (backgroundIndex < 0) return [...rest, ...picked];
        return [...rest.slice(0, backgroundIndex), ...picked, ...rest.slice(backgroundIndex)];
      }
      const next = [...old];
      const indices = old.map((object, index) => (ids.has(object.id) ? index : -1)).filter((index) => index >= 0);
      const order = mode === "forward" ? indices : [...indices].reverse();
      for (const index of order) {
        const target = mode === "forward" ? index - 1 : index + 1;
        if (target < 0 || target >= next.length || ids.has(next[target].id) || next[target].id === "background") continue;
        [next[index], next[target]] = [next[target], next[index]];
      }
      return next;
    });
    setNotice({ front: "Trazido para frente.", back: "Enviado para trás.", forward: "Trazido adiante.", backward: "Enviado para trás um nível." }[mode]);
  }
  function flipSelection(axis) {
    const targets = editableSelection();
    if (!targets.length) return setNotice("Selecione um objeto desbloqueado para inverter.");
    const key = axis === "x" ? "flipX" : "flipY";
    patchMany(new Map(targets.map((object) => [object.id, { [key]: !object[key] }])));
  }
  function alignSelection(mode, target = "Alinhar à seleção") {
    const targets = editableSelection();
    if (!targets.length) return setNotice("Selecione objetos desbloqueados para alinhar.");
    const distribute = mode.startsWith("dist-");
    const key = mode.replace("dist-", "");
    const horizontal = ["left", "hcenter", "right"].includes(key);
    const edge = (object) => ({ left: object.x, hcenter: object.x + object.w / 2, right: object.x + object.w, top: object.y, vcenter: object.y + object.h / 2, bottom: object.y + object.h })[key];
    if (distribute) {
      if (targets.length < 3) return setNotice("Distribuir requer três ou mais objetos selecionados.");
      const sorted = [...targets].sort((a, b) => edge(a) - edge(b));
      const first = edge(sorted[0]);
      const gap = (edge(sorted[sorted.length - 1]) - first) / (sorted.length - 1);
      patchMany(new Map(sorted.map((object, index) => {
        const delta = first + gap * index - edge(object);
        return [object.id, horizontal ? { x: round2(object.x + delta) } : { y: round2(object.y + delta) }];
      })));
      return setNotice("Objetos distribuídos.");
    }
    const key0 = target === "Alinhar ao objeto-chave" ? objectsRef.current.find((object) => object.id === selectedObject) : null;
    const box = key0
      ? { x1: key0.x, y1: key0.y, x2: key0.x + key0.w, y2: key0.y + key0.h }
      : target === "Alinhar à prancheta" || targets.length === 1
        ? { x1: 0, y1: 0, x2: ARTBOARD_W, y2: ARTBOARD_H }
        : { x1: Math.min(...targets.map((o) => o.x)), y1: Math.min(...targets.map((o) => o.y)), x2: Math.max(...targets.map((o) => o.x + o.w)), y2: Math.max(...targets.map((o) => o.y + o.h)) };
    const goal = { left: box.x1, hcenter: (box.x1 + box.x2) / 2, right: box.x2, top: box.y1, vcenter: (box.y1 + box.y2) / 2, bottom: box.y2 }[key];
    patchMany(new Map(targets.filter((object) => !key0 || object.id !== key0.id).map((object) => {
      const delta = goal - edge(object);
      return [object.id, horizontal ? { x: round2(object.x + delta) } : { y: round2(object.y + delta) }];
    })));
    setNotice(targets.length === 1 || target === "Alinhar à prancheta" ? "Alinhado à prancheta." : "Seleção alinhada.");
  }
  // Ferramentas de um clique do MCP (grade de ícones no Copiloto): planejam sobre os objetos atuais
  // e gravam pelo setObjects (um passo de desfazer).
  const toolState = useRef(null);
  toolState.current = { objects, selectedIds };
  const toolActions = useRef(null);
  toolActions.current = { setObjects, undo, setNotice, canUndo: historyRef.current.undo.length > 0 };
  useEffect(() => {
    if (!appActive) return undefined;
    const strip = ({ objects: _objects, ...result }) => result;
    return registerMCPActions({
      source: "mmvector",
      label: "MMVector",
      catalogue: mmvectorCatalogue,
      analyze: async (toolId, params) => {
        const result = runMMVectorTool(toolId, toolState.current, params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const result = runMMVectorTool(toolId, toolState.current, params);
        if (result.ok) {
          const actions = toolActions.current;
          toolState.current = { ...toolState.current, objects: result.objects };
          actions.setObjects(result.objects);
          objectsRef.current = result.objects;
          actions.canUndo = true;
          actions.setNotice(`MCP · ${result.summary}`);
        }
        return strip(result);
      },
      undo: () => {
        if (!toolActions.current.canUndo) return false;
        toolActions.current.undo();
        return true;
      },
      canUndo: () => toolActions.current.canUndo,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appActive]);

  function runCommand(command, options = {}) {
    const object = objectsRef.current.find((item) => item.id === selectedObject);
    if (command.startsWith("align:")) return alignSelection(command.slice(6), options.target);
    if (command.startsWith("pf:")) {
      const op = command.slice(3);
      if (op === "expand") return expandObject(object);
      if (op === "divide" || op === "merge") return setNotice(`${op === "divide" ? "Dividir" : "Mesclar"} ainda não está disponível: requer cálculo geométrico de regiões. Use Aparar, que produz o mesmo resultado visual.`);
      return combine(selectedIds, op);
    }
    if (command === "flip:x") return flipSelection("x");
    if (command === "flip:y") return flipSelection("y");
    if (command === "Expandir forma" || command === "Expandir objeto") return expandObject(object);
    if (command === "Recolorir") return recolor(editableSelection());
    if (command === "Deslocar caminho") return offsetObject(object);
    if (command === "Simplificar") return simplifyObject(object);
    if (command === "Organizar: trazer para frente") return reorder("front");
    return undefined;
  }

  function handleObjectPointerDown(event, object) {
    if (event.button) return;
    if (tool === "Borracha") {
      if (!object.locked) startEraser(event, object);
      return;
    }
    if (SELECT_TOOLS.includes(tool)) {
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = true;
        if (!object.locked) toggleInSelection(object.id);
        return;
      }
      startTransform(event, object, "move");
      return;
    }
    if (tool === "Varinha mágica") {
      event.stopPropagation();
      suppressClickRef.current = true;
      const ids = objectsRef.current.filter((item) => item.visible && !item.locked && !item.panelOnly && String(item.color).toLowerCase() === String(object.color).toLowerCase()).map((item) => item.id);
      selectMany(ids);
      return setNotice(ids.length ? `${ids.length} objeto(s) com o mesmo preenchimento selecionado(s).` : "Objeto bloqueado.");
    }
    if (tool === "Conta-gotas") {
      event.stopPropagation();
      suppressClickRef.current = true;
      setFill(object.color);
      if (object.stroke) setStroke(object.stroke);
      const targets = editableSelection().filter((item) => item.id !== object.id);
      if (targets.length) {
        patchMany(new Map(targets.map((item) => [item.id, { color: object.color, stroke: object.stroke, strokeWidth: object.strokeWidth ?? item.strokeWidth, gradient: object.gradient, noFill: object.noFill, opacity: object.opacity }])));
        return setNotice(`Aparência de ${object.name} aplicada à seleção.`);
      }
      return setNotice(`Cores de ${object.name} copiadas para preenchimento e traçado.`);
    }
    const handlers = {
      Girar: "rotate",
      Escala: "scale",
      Inclinar: "shear",
      Gradiente: "gradient",
      Largura: "width",
    };
    const needsEdit = ["Girar", "Escala", "Inclinar", "Gradiente", "Largura", "Refletir", "Tesoura", "Adicionar ponto de ancoragem", "Excluir ponto de ancoragem", "Ponto de ancoragem", "Balde de pintura ao vivo", "Construtor de formas", "Mesclagem", "Unir", "Texto em um caminho"];
    if (!needsEdit.includes(tool)) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    if (object.locked) return setNotice(`${object.name} está bloqueado.`);
    if (handlers[tool]) {
      if (tool === "Gradiente" && object.kind === "Texto") return setNotice("Gradiente em texto ainda não está disponível.");
      if (!["Construtor de formas"].includes(tool)) setSelectedObject(object.id);
      return startObjectDrag(event, object, handlers[tool]);
    }
    const point = canvasPoint(event);
    if (tool === "Refletir") {
      const key = event.altKey ? "flipY" : "flipX";
      patchObjectValues(object.id, { [key]: !object[key] });
      setSelectedObject(object.id);
      return setNotice(event.altKey ? "Refletido na vertical." : "Refletido na horizontal.");
    }
    if (tool === "Balde de pintura ao vivo") {
      patchObjectValues(object.id, { color: fill, gradient: undefined, noFill: false });
      return setNotice("Preenchimento aplicado.");
    }
    if (tool === "Construtor de formas") {
      if (selectedIds.length < 2 || !selectedIds.includes(object.id)) return setNotice("Selecione duas ou mais formas com Shift+clique (ferramenta Seleção) e clique numa delas.");
      return event.altKey ? combine(selectedIds, "minusFront", object.id) : combine(selectedIds, "unite");
    }
    if (tool === "Mesclagem") return blendWith(object);
    if (object.kind === "Texto" || object.parts) return setNotice("Esta ferramenta atua em formas e caminhos (não em texto ou formas compostas).");
    if (tool === "Tesoura") return scissors(object, point);
    if (tool === "Adicionar ponto de ancoragem") return editAnchor(object, point, "add");
    if (tool === "Excluir ponto de ancoragem") return editAnchor(object, point, "delete");
    if (tool === "Ponto de ancoragem") return editAnchor(object, point, "toggle");
    if (tool === "Unir") return joinPaths(object);
    if (tool === "Texto em um caminho") {
      const patch = isPathObject(object) ? {} : { ...pathStyle(object), ...pathPatchFromCanvas(canvasSubpaths(object, 16)) };
      patchObjectValues(object.id, { ...patch, onPath: true, text: object.text || "Texto no caminho" });
      setSelectedObject(object.id);
      return setNotice("Texto aplicado ao caminho. Edite em Conteúdo do texto.");
    }
    return undefined;
  }

  // ---- Arquivo ----
  function saveDocument() {
    const payload = { schema: "mmvector/v1", savedAt: new Date().toISOString(), artboard: { width: ARTBOARD_W, height: ARTBOARD_H }, objects: objectsRef.current };
    try {
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "documento.mmvector.json");
      setNotice(draftScope ? "Documento salvo: rascunho neste navegador e arquivo documento.mmvector.json baixado." : "Arquivo documento.mmvector.json baixado (rascunho do navegador indisponível nesta tela).");
    } catch {
      setNotice("Falha ao salvar o documento.");
    }
  }
  async function openDocument() {
    const files = await pickFile("application/json,.json");
    const file = files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.schema !== "mmvector/v1" || !Array.isArray(parsed.objects)) throw new Error("schema");
      const loaded = parsed.objects.slice(0, 5000).map(sanitizeObject).filter(Boolean);
      if (!loaded.length) throw new Error("vazio");
      setObjects(loaded);
      setSelectedObject(null);
      setNotice(`Documento aberto: ${loaded.length} objeto(s).`);
    } catch {
      setNotice("Arquivo inválido: use um documento .mmvector.json salvo pelo MMVector.");
    }
  }
  function exportSvg() {
    try {
      downloadBlob(new Blob([buildSvgDocument(objectsRef.current)], { type: "image/svg+xml" }), "mmvector.svg");
      return true;
    } catch {
      setNotice("Falha ao exportar SVG.");
      return false;
    }
  }
  async function exportPng() {
    try {
      const blob = await svgToPngBlob(buildSvgDocument(objectsRef.current));
      downloadBlob(blob, "mmvector.png");
      return true;
    } catch {
      setNotice("Falha ao gerar PNG neste navegador. O SVG pode ser exportado normalmente.");
      return false;
    }
  }
  async function exportAll() {
    const svg = exportSvg();
    const png = await exportPng();
    if (svg && png) setNotice("Exportado: mmvector.svg e mmvector.png (820 × 620).");
    else if (svg) setNotice("Exportado mmvector.svg; o PNG não pôde ser gerado neste navegador.");
  }

  // ---- Editar ----
  function copySelection(cut = false) {
    const picked = selectedIds.map((id) => objectsRef.current.find((object) => object.id === id)).filter((object) => object && object.id !== "background");
    if (!picked.length) return setNotice("Nada selecionado para copiar.");
    clipboardRef.current = picked.map((object) => ({ ...object }));
    if (cut) {
      const removing = new Set(picked.filter((object) => !object.locked).map((object) => object.id));
      setObjects((old) => old.filter((object) => !removing.has(object.id)));
      setSelectedObject(null);
    }
    setNotice(`${picked.length} objeto(s) ${cut ? "recortado(s)" : "copiado(s)"}.`);
  }
  function pasteClipboard(source = clipboardRef.current) {
    if (!source.length) return setNotice("A área de transferência do MMVector está vazia.");
    const copies = source.map((object) => ({ ...object, id: crypto.randomUUID(), name: `${object.name} cópia`, x: round2(object.x + 10), y: round2(object.y + 10), locked: false }));
    clipboardRef.current = copies.map((object) => ({ ...object }));
    setObjects((old) => [...copies, ...old]);
    selectMany(copies.map((object) => object.id));
    setNotice(`${copies.length} objeto(s) colado(s).`);
  }
  function nudge(dx, dy) {
    const targets = editableSelection();
    if (!targets.length) return;
    patchMany(new Map(targets.map((object) => [object.id, { x: round2(object.x + dx), y: round2(object.y + dy) }])));
  }

  const APP_MENUS = {
    Arquivo: ["Novo documento", "Abrir…", "Colocar…", "Salvar", "Exportar SVG", "Exportar PNG"],
    Editar: ["Desfazer", "Refazer", "Recortar", "Copiar", "Colar", "Duplicar", "Excluir"],
    Objeto: ["Trazer para frente", "Trazer adiante", "Enviar para trás um nível", "Enviar para trás", "Inverter horizontalmente", "Inverter verticalmente", "Bloquear seleção", "Desbloquear tudo", "Ocultar seleção", "Mostrar tudo", "Expandir", "Simplificar"],
    Texto: ["Novo texto", "Texto vertical", "Maiúsculas", "Minúsculas"],
    Selecionar: ["Tudo", "Desmarcar", "Inverter seleção", "Mesmo preenchimento"],
    Efeito: ["Sombra projetada", "Desfoque gaussiano", "Deslocar caminho", "Limpar efeitos"],
    Exibir: ["Aumentar zoom", "Diminuir zoom", "Ajustar à janela", "Tamanho real (100%)"],
    Janela: ["Propriedades", "Camadas", "Bibliotecas", "Traçado", "Alinhar", "Pathfinder", "Transformar", "Gradiente", "Aparência flutuante"],
    Ajuda: ["Atalhos do teclado", "Sobre o MMVector"],
  };
  function runMenuCommand(command) {
    setOpenMenu(null);
    const object = objectsRef.current.find((item) => item.id === selectedObject);
    const selection = editableSelection();
    const textTargets = selection.filter((item) => item.kind === "Texto" || item.onPath);
    const allIds = () => objectsRef.current.filter((item) => item.visible && !item.locked && !item.panelOnly).map((item) => item.id);
    switch (command) {
      case "Novo documento":
        setObjects((old) => old.filter((item) => item.id === "background"));
        setSelectedObject(null);
        return setNotice("Novo documento (Ctrl+Z restaura o anterior).");
      case "Abrir…": return openDocument();
      case "Colocar…": return pickFile("image/*,.svg,.pdf").then((files) => files?.length && onOpenFiles(files));
      case "Salvar": return saveDocument();
      case "Exportar SVG": return exportSvg() && setNotice("Exportado mmvector.svg.");
      case "Exportar PNG": return exportPng().then((ok) => ok && setNotice("Exportado mmvector.png."));
      case "Desfazer": return undo();
      case "Refazer": return redo();
      case "Recortar": return copySelection(true);
      case "Copiar": return copySelection(false);
      case "Colar": return pasteClipboard();
      case "Duplicar": return pasteClipboard(selection.map((item) => ({ ...item })));
      case "Excluir": return removeSelectedObject();
      case "Trazer para frente": return reorder("front");
      case "Trazer adiante": return reorder("forward");
      case "Enviar para trás um nível": return reorder("backward");
      case "Enviar para trás": return reorder("back");
      case "Inverter horizontalmente": return flipSelection("x");
      case "Inverter verticalmente": return flipSelection("y");
      case "Bloquear seleção": return patchMany(new Map(selection.map((item) => [item.id, { locked: true }])));
      case "Desbloquear tudo": return patchMany(new Map(objectsRef.current.filter((item) => item.locked && item.id !== "background").map((item) => [item.id, { locked: false }])));
      case "Ocultar seleção": return patchMany(new Map(selection.map((item) => [item.id, { visible: false }])));
      case "Mostrar tudo": return patchMany(new Map(objectsRef.current.filter((item) => !item.visible).map((item) => [item.id, { visible: true }])));
      case "Expandir": return expandObject(object);
      case "Simplificar": return simplifyObject(object);
      case "Novo texto": return addObject("Texto");
      case "Texto vertical":
        if (!textTargets.length) return setNotice("Selecione um texto.");
        return patchMany(new Map(textTargets.map((item) => [item.id, { vertical: !item.vertical }])));
      case "Maiúsculas":
      case "Minúsculas":
        if (!textTargets.length) return setNotice("Selecione um texto.");
        return patchMany(new Map(textTargets.map((item) => [item.id, { text: command === "Maiúsculas" ? String(item.text || "").toLocaleUpperCase("pt-BR") : String(item.text || "").toLocaleLowerCase("pt-BR") }])));
      case "Tudo": return selectMany(allIds());
      case "Desmarcar": return setSelectedObject(null);
      case "Inverter seleção": return selectMany(allIds().filter((id) => !selectedIds.includes(id)));
      case "Mesmo preenchimento":
        if (!object) return setNotice("Selecione um objeto de referência.");
        return selectMany(allIds().filter((id) => objectsRef.current.find((item) => item.id === id)?.color === object.color));
      case "Sombra projetada": return selection.length ? patchMany(new Map(selection.map((item) => [item.id, { shadow: true }]))) : setNotice("Selecione um objeto.");
      case "Desfoque gaussiano": return selection.length ? patchMany(new Map(selection.map((item) => [item.id, { blur: 4 }]))) : setNotice("Selecione um objeto.");
      case "Deslocar caminho": return offsetObject(object);
      case "Limpar efeitos": return patchMany(new Map(selection.map((item) => [item.id, { shadow: false, blur: 0 }])));
      case "Aumentar zoom": return zoomStep(1);
      case "Diminuir zoom": return zoomStep(-1);
      case "Ajustar à janela": return setZoom(72);
      case "Tamanho real (100%)": return setZoom(100);
      case "Aparência flutuante": return setAppearanceOpen((value) => !value);
      case "Atalhos do teclado":
        return setNotice("Atalhos: V seleção · M retângulo · L elipse · P caneta · T texto · R girar · O refletir · S escala · H mão · Z zoom · G gradiente · I conta-gotas · Ctrl+Z/Ctrl+Shift+Z desfazer/refazer · Ctrl+C/X/V/D · Del excluir · setas movem pelo incremento.");
      case "Sobre o MMVector":
        return setNotice("MMVector: editor vetorial do MediaMind (comportamentos de referência: VectorCraft, Apache-2.0).");
      default:
        if (APP_MENUS.Janela.includes(command)) return setRightPanel(command);
        return undefined;
    }
  }

  keyHandlerRef.current = (event) => {
    const element = event.target;
    const section = sectionRef.current;
    // Abas visitadas continuam montadas (ocultas): só responder quando o MMVector está visível
    // e o foco está nele ou na página.
    if (!section || section.closest("[hidden]")) return;
    if (element instanceof Node && element !== document.body && element !== document.documentElement && element !== document && !section.contains(element)) return;
    if (element?.closest?.("input, textarea, select, [contenteditable='true']")) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;
    if (key === "Enter" && finishPen()) {
      event.preventDefault();
      return;
    }
    if (key === "Escape") {
      finishPen();
      setOpenMenu(null);
      setGuide(null);
      return;
    }
    if (mod) {
      const lower = key.toLowerCase();
      const actions = {
        z: () => (event.shiftKey ? redo() : undo()),
        y: redo,
        c: () => copySelection(false),
        x: () => copySelection(true),
        v: () => pasteClipboard(),
        d: () => pasteClipboard(editableSelection().map((item) => ({ ...item }))),
        a: () => selectMany(objectsRef.current.filter((item) => item.visible && !item.locked && !item.panelOnly).map((item) => item.id)),
        s: saveDocument,
      };
      if (actions[lower]) {
        event.preventDefault();
        actions[lower]();
      }
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      if (selectedObject) {
        event.preventDefault();
        removeSelectedObject();
      }
      return;
    }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[key]) {
      if (!selectedIds.length) return;
      event.preventDefault();
      const amount = parseLength(keyIncrement) * (event.shiftKey ? 10 : 1);
      return nudge(arrows[key][0] * amount, arrows[key][1] * amount);
    }
    if (event.altKey) return;
    const upper = key.length === 1 ? key.toUpperCase() : key;
    const combo = key === "~" ? "Shift+~" : /^[A-Z]$/.test(upper) && event.shiftKey ? `Shift+${upper}` : upper;
    const name = TOOL_SHORTCUTS[combo];
    if (name) {
      event.preventDefault();
      setSlotTools((current) => ({ ...current, [TOOL_SLOTS[name]]: name }));
      chooseTool(name);
    }
  };
  useEffect(() => {
    const listener = (event) => keyHandlerRef.current?.(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (!openMenu) return undefined;
    const close = (event) => {
      if (!event.target.closest?.("[data-vector-menu]")) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openMenu]);

  function applyToolbarFill(value) {
    setFill(value);
    const targets = editableSelection();
    if (targets.length) patchMany(new Map(targets.map((object) => [object.id, { color: value, noFill: false }])));
  }
  function applyFillMode(mode) {
    const targets = editableSelection();
    if (!targets.length) return setNotice("Selecione um objeto para alterar o preenchimento.");
    patchMany(new Map(targets.map((object) => [object.id, mode === "solid" ? { gradient: undefined, noFill: false } : mode === "gradient" ? { gradient: { from: object.color, to: stroke === object.color ? "#000000" : stroke, angle: 90 }, noFill: false } : { noFill: true, gradient: undefined }])));
    setNotice(mode === "solid" ? "Preenchimento sólido." : mode === "gradient" ? "Gradiente linear aplicado." : "Sem preenchimento.");
  }
  const [unitFactor, unitSuffix] = UNIT_INFO[units] || UNIT_INFO.Pixels;
  const showLength = (value) => `${String(round2((value || 0) * unitFactor)).replace(".", ",")} ${unitSuffix}`;

  return (
    <section ref={sectionRef} className="space-y-2 bg-[#151515] text-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold text-white">MMVector</h1>
          <p className="text-[10px] text-slate-500">
            Documento sem título · CMYK · 300 ppi
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={saveDocument} className="rounded border border-slate-700 px-3 py-2 text-xs">
            <Save size={14} className="mr-1 inline" />
            Salvar
          </button>
          <label className="cursor-pointer rounded border border-slate-700 px-3 py-2 text-xs">
            <Upload size={14} className="mr-1 inline" />
            Colocar
            <input
              hidden
              multiple
              type="file"
              accept="image/*,.svg,.pdf"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
          <button onClick={exportAll} className="rounded bg-orange-400 px-3 py-2 text-xs font-bold text-slate-950">
            <Download size={14} className="mr-1 inline" />
            Exportar
          </button>
        </div>
      </header>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 pb-1 text-[11px]">
        {[
          "Arquivo",
          "Editar",
          "Objeto",
          "Texto",
          "Selecionar",
          "Efeito",
          "Exibir",
          "Janela",
          "Ajuda",
        ].map((item) => (
          <button
            key={item}
            data-vector-menu
            aria-haspopup="menu"
            aria-expanded={openMenu?.name === item}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setOpenMenu((current) => (current?.name === item ? null : { name: item, left: rect.left, top: rect.bottom }));
            }}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800"
          >
            {item}
          </button>
        ))}
        {openMenu && typeof document !== "undefined" && createPortal(
          <div data-vector-menu role="menu" aria-label={`Menu ${openMenu.name}`} className="fixed z-50 min-w-52 border border-[#555] bg-[#292929] py-1 shadow-xl" style={{ left: openMenu.left, top: openMenu.top }}>
            {APP_MENUS[openMenu.name].map((command) => <button key={command} role="menuitem" onClick={() => runMenuCommand(command)} className="block w-full whitespace-nowrap px-4 py-1.5 text-left text-[11px] text-slate-200 hover:bg-[#2675df] hover:text-white">{command}</button>)}
          </div>,
          document.body,
        )}
        <span className="mx-auto" />
        <select
          aria-label="Área de trabalho do MMVector"
          value={workspace}
          onChange={(event) => setWorkspace(event.target.value)}
          className="rounded border border-slate-700 bg-[#202020] px-3 py-1 text-[10px] text-slate-300"
        >
          {[
            "Essenciais clássicos",
            "Essenciais",
            "Layout",
            "Pintura",
            "Tipografia",
            "Traçado",
            "Web",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="grid min-h-[720px] grid-cols-[56px_minmax(600px,1fr)_44px_330px] gap-px bg-[#111]">
        <aside className="flex max-h-[720px] flex-col items-center overflow-x-hidden overflow-y-auto rounded border border-slate-800 bg-[#303030] px-1 py-1">
          <button className="mb-1 w-full text-left text-lg text-slate-400" title="Recolher ferramentas">«</button>
          {TOOL_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 w-full">
              <p className="mb-1 w-full truncate text-center text-[9px] text-slate-300">{group.label}</p>
              <div className="grid grid-cols-1 gap-1">
                {group.slots.map((slot, slotIndex) => {
                  const slotKey = `${group.label}-${slotIndex}`;
                  const shown = slot.find(([, name]) => name === slotTools[slotKey]) ?? slot[0];
                  const [shortcut, name, Icon] = shown;
                  return (
                    <div key={slotKey} className="relative">
                      <button
                        aria-label={toolTitle(shortcut, name)}
                        title={toolTitle(shortcut, name)}
                        onClick={() => { chooseTool(name); setOpenToolGroup(null); }}
                        className={`grid h-8 w-full place-items-center rounded ${tool === name ? "bg-[#202020] text-white" : "text-slate-300 hover:bg-[#414141]"}`}
                      >
                        <Icon size={18} strokeWidth={1.7} />
                      </button>
                      {slot.length > 1 && (
                        <button
                          aria-label={`Abrir grupo de ${name}`}
                          title={`Outras ferramentas de ${name}`}
                          onClick={() => setOpenToolGroup((current) => current === slotKey ? null : slotKey)}
                          className="absolute bottom-0 right-0 z-10 h-3 w-3 border-b-[6px] border-l-[6px] border-b-slate-300 border-l-transparent"
                        />
                      )}
                      {openToolGroup === slotKey && (
                        <div className="mt-1 grid gap-1 border-y border-[#555] bg-[#242424] py-1" role="menu" aria-label={`Grupo de ${name}`}>
                          {slot.map(([optionShortcut, optionName, OptionIcon]) => (
                            <button
                              key={optionName}
                              aria-label={toolTitle(optionShortcut, optionName)}
                              title={toolTitle(optionShortcut, optionName)}
                              onClick={() => {
                                setSlotTools((current) => ({ ...current, [slotKey]: optionName }));
                                chooseTool(optionName);
                                setOpenToolGroup(null);
                              }}
                              className={`grid h-8 place-items-center rounded ${tool === optionName ? "bg-[#202020] text-white" : "text-slate-300 hover:bg-[#414141]"}`}
                            >
                              <OptionIcon size={17} strokeWidth={1.7} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <label title="Preenchimento e traçado" className="relative mb-3 h-10 w-10">
            <input
              type="color"
              value={fill}
              onChange={(e) => applyToolbarFill(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer"
            />
            <span
              className="pointer-events-none absolute -bottom-1 -right-1 h-7 w-7 border-2 border-white"
              style={{ background: stroke }}
            />
          </label>
          <div className="mb-2 flex gap-1">
            <button title="Cor sólida" onClick={() => applyFillMode("solid")} className="h-4 w-4 bg-white" />
            <button title="Gradiente" onClick={() => applyFillMode("gradient")} className="h-4 w-4 bg-gradient-to-r from-white to-black" />
            <button title="Sem cor" onClick={() => applyFillMode("none")} className="relative h-4 w-4 border border-white after:absolute after:left-1/2 after:top-[-2px] after:h-5 after:w-px after:-rotate-45 after:bg-red-500" />
          </div>
          <button title="Modos de desenho" className="mb-1 grid h-8 w-9 place-items-center rounded hover:bg-[#414141]">
            <ScanSearch size={18} />
          </button>
          <button title="Mais ferramentas" className="grid h-8 w-9 place-items-center rounded hover:bg-[#414141]">
            <MoreHorizontal size={20} />
          </button>
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-800 bg-[#2a2a2a]">
          <div className="flex items-center gap-3 border-b border-slate-700 px-3 py-2 text-[10px]">
            <b>{tool}</b>
            <span>X {showLength(active ? active.x : 0)}</span>
            <span>Y {showLength(active ? active.y : 0)}</span>
            <span>L {showLength(active ? active.w : ARTBOARD_W)}</span>
            <span>A {showLength(active ? active.h : ARTBOARD_H)}</span>
            {notice && <span role="status" aria-live="polite" className="min-w-0 truncate text-slate-400" title={notice}>{notice}</span>}
            <span className="ml-auto">Prancheta 1</span>
          </div>
          <div
            ref={scrollRef}
            className="relative flex-1 overflow-auto p-12"
            onClick={() => setSelectedObject(null)}
          >
            <div
              className="relative mx-auto overflow-hidden bg-white shadow-2xl"
              ref={artboardRef}
              aria-label="Prancheta vetorial"
              onPointerDownCapture={handleArtboardPointerDown}
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 820,
                height: 620,
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
            >
              {ordered.map(
                (object) =>
                  object.visible && !object.panelOnly && (
                    <button
                      key={object.id}
                      data-object-id={object.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (suppressClickRef.current) {
                          suppressClickRef.current = false;
                          return;
                        }
                        setSelectedObject(object.id);
                      }}
                      className={`absolute ${selectedIds.includes(object.id) ? "outline outline-2 outline-orange-400" : ""}`}
                      onPointerDown={(event) => handleObjectPointerDown(event, object)}
                      aria-label={`${object.name} na prancheta`}
                      style={{
                        left: object.x,
                        top: object.y,
                        width: object.w,
                        height: object.h,
                        opacity: (object.opacity ?? 100) / 100,
                        transform: cssTransform(object),
                        filter: cssFilter(object),
                        borderRadius:
                          object.kind === "Elipse"
                            ? "50%"
                            : object.cornerRadius ?? 0,
                        clipPath:
                          object.kind === "Forma"
                            ? "polygon(50% 0%, 100% 100%, 0% 100%)"
                            : undefined,
                        boxShadow:
                          object.kind !== "Traçado" && !isPathObject(object) && object.strokeWidth
                            ? `inset 0 0 0 ${object.strokeWidth}px ${object.stroke || stroke}`
                            : undefined,
                        background:
                          object.kind === "Traçado" || object.kind === "Texto" || isPathObject(object)
                            ? "transparent"
                            : boxPaint(object),
                        color: object.kind === "Texto" ? object.color : "white",
                        zIndex:
                          object.kind === "Retângulo" &&
                          object.id === "background"
                            ? 0
                            : 2,
                      }}
                    >
                      {object.kind === "Texto" && (
                        <span className="block whitespace-pre-line text-left text-5xl font-black leading-none" style={object.vertical ? { writingMode: "vertical-rl" } : undefined}>
                          {object.text || object.name}
                        </span>
                      )}
                      {isPathObject(object) && (
                        <svg viewBox={`0 0 ${object.vbW || 100} ${object.vbH || 100}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
                          {renderNodes(pathGraphicNodes(object, svgId(object.id)))}
                        </svg>
                      )}
                      {object.kind === "Traçado" && !isPathObject(object) && (
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                          <path
                            d={presetPath(object.drawingTool)}
                            fill="none"
                            stroke={object.stroke || object.color}
                            strokeWidth={object.drawingTool === "Pincel" ? Math.max(12, object.strokeWidth || 0) : object.strokeWidth || 6}
                            strokeLinecap={object.drawingTool === "Pincel" ? "round" : "butt"}
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                      )}
                      {selectedObject === object.id && (
                        <>
                          {[
                            ["nw", "-left-2 -top-2 cursor-nwse-resize"],
                            ["n", "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize"],
                            ["ne", "-right-2 -top-2 cursor-nesw-resize"],
                            ["e", "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize"],
                            ["se", "-bottom-2 -right-2 cursor-nwse-resize"],
                            ["s", "-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize"],
                            ["sw", "-bottom-2 -left-2 cursor-nesw-resize"],
                            ["w", "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize"],
                          ].map(([direction, position]) => (
                            <i
                              key={direction}
                              role="button"
                              tabIndex="0"
                              aria-label={`Redimensionar ${object.name} ${direction}`}
                              onPointerDown={(event) => startTransform(event, object, `resize-${direction}`)}
                              className={`absolute z-20 h-4 w-4 bg-white outline outline-2 outline-orange-400 ${position}`}
                            />
                          ))}
                          <span className="pointer-events-none absolute -top-9 left-1/2 h-7 w-px -translate-x-1/2 bg-orange-400" />
                          <i
                            role="button"
                            tabIndex="0"
                            aria-label={`Girar ${object.name}`}
                            onPointerDown={(event) => startTransform(event, object, "rotate")}
                            className="absolute -top-12 left-1/2 z-20 h-5 w-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-orange-400 bg-white"
                          />
                        </>
                      )}
                    </button>
                  ),
              )}
              {guide && (
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 30 }} viewBox={`0 0 ${ARTBOARD_W} ${ARTBOARD_H}`}>
                  {guide.kind === "rect" && <rect x={Math.min(guide.a[0], guide.b[0])} y={Math.min(guide.a[1], guide.b[1])} width={Math.abs(guide.b[0] - guide.a[0])} height={Math.abs(guide.b[1] - guide.a[1])} fill="none" stroke="#fb923c" strokeDasharray="4 3" />}
                  {guide.kind === "lasso" && <polyline points={guide.points.map((point) => point.join(",")).join(" ")} fill="none" stroke="#fb923c" strokeDasharray="4 3" />}
                  {guide.kind === "line" && <line x1={guide.a[0]} y1={guide.a[1]} x2={guide.b[0]} y2={guide.b[1]} stroke="#fb923c" strokeDasharray="4 3" />}
                </svg>
              )}
            </div>
            {appearanceOpen && active && (
              <section
                aria-label="Aparência flutuante"
                className="absolute right-5 top-5 w-72 rounded border border-[#4b4b4b] bg-[#333] shadow-2xl"
              >
                <header className="flex items-center border-b border-[#4b4b4b] px-3 py-2 text-xs font-bold">
                  <span>Aparência</span>
                  <button
                    onClick={() => setAppearanceOpen(false)}
                    className="ml-auto text-slate-400"
                  >
                    ×
                  </button>
                </header>
                <div className="p-3 text-[10px]">
                  <div className="flex items-center gap-3 border-b border-[#4b4b4b] py-2">
                    <span
                      className="h-8 w-8 border border-slate-500"
                      style={{ background: active.color }}
                    />
                    <strong>{active.kind}</strong>
                  </div>
                  <div className="flex items-center gap-2 border-b border-[#4b4b4b] py-2">
                    <Eye size={13} />
                    <span>Preenchimento</span>
                    <input
                      aria-label="Cor da aparência"
                      type="color"
                      value={active.color}
                      onChange={(event) =>
                        patchObject("color", event.target.value)
                      }
                      className="ml-auto h-7 w-9"
                    />
                  </div>
                  <div className="flex items-center gap-2 border-b border-[#4b4b4b] py-2">
                    <Eye size={13} />
                    <ChevronDown size={12} />
                    <span>Brilho externo</span>
                    <b className="ml-auto italic">fx</b>
                  </div>
                  <label className="mt-2 grid grid-cols-[1fr_90px] items-center gap-2">
                    Desfoque{" "}
                    <input
                      type="number"
                      defaultValue="22"
                      className="bg-[#252525] p-1 text-right"
                    />
                  </label>
                  <label className="mt-2 grid grid-cols-[1fr_90px] items-center gap-2">
                    Modo{" "}
                    <select className="bg-[#252525] p-1">
                      <option>Tela</option>
                      <option>Normal</option>
                      <option>Multiplicação</option>
                    </select>
                  </label>
                  <label className="mt-2 grid grid-cols-[1fr_90px] items-center gap-2">
                    Opacidade{" "}
                    <input
                      type="number"
                      defaultValue="95"
                      className="bg-[#252525] p-1 text-right"
                    />
                  </label>
                </div>
              </section>
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-slate-700 p-2 text-[10px]">
            <button
              onClick={() => setSelectedObject(null)}
              className="rounded border border-slate-700 px-2 py-1"
            >
              Prancheta 1
            </button>
            <button
              onClick={() => addObject("Prancheta")}
              className="rounded border border-slate-700 p-1"
            >
              <Plus size={13} />
            </button>
            <input
              type="range"
              min="25"
              max="150"
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
              className="ml-auto accent-orange-400"
            />
            <span>{zoom}%</span>
          </div>
        </main>
        <nav
          aria-label="Painéis do MMVector"
          className="flex flex-col items-center gap-1 border border-slate-800 bg-[#242424] py-2"
        >
          {RIGHT_PANEL_TOOLS.map(([name, icon, divider]) => (
            <div key={name} className={divider ? "mb-1 border-b border-[#3b3b3b] pb-1" : ""}>
              <button
                title={name}
                aria-label={name}
                onClick={() => setRightPanel(name)}
                className={`grid h-9 w-9 place-items-center rounded ${rightPanel === name ? "bg-[#151515] text-[#dedede]" : "text-[#b8b8b8] hover:bg-[#383838] hover:text-white"}`}
              >
                <ReferenceIcon name={icon} size={20} />
              </button>
            </div>
          ))}
        </nav>
        <aside className="overflow-auto border border-slate-800 bg-[#303030]">
          <div className="flex border-b border-[#4b4b4b] bg-[#353535]">
            {["Propriedades", "Camadas", "Bibliotecas"].map((name) => (
              <button
                key={name}
                onClick={() => setRightPanel(name)}
                className={`flex-1 px-2 py-3 text-xs font-semibold ${rightPanel === name ? "bg-[#414141] text-white" : "text-slate-400"}`}
              >
                {name}
              </button>
            ))}
          </div>
          {rightPanel === "Camadas" ? (
            <LayersPanel
              objects={objects}
              selectedObject={selectedObject}
              setSelectedObject={setSelectedObject}
              toggle={toggle}
              addObject={addObject}
              removeSelectedObject={removeSelectedObject}
            />
          ) : rightPanel === "Bibliotecas" ? (
            <LibrariesPanel
              assets={assets}
              selected={selected}
              onSelect={onSelect}
            />
          ) : rightPanel === "Traçado" ? (
            <StrokePanel active={active} patchObject={patchObject} />
          ) : !["Propriedades", "Camadas", "Bibliotecas"].includes(rightPanel) ? (
            <AuxiliaryPanel name={rightPanel} onCommand={runCommand} />
          ) : active ? (
            <ObjectProperties
              active={active}
              fill={fill}
              stroke={stroke}
              setFill={setFill}
              setStroke={setStroke}
              patchObject={patchObject}
              addObject={addObject}
              onCommand={runCommand}
            />
          ) : (
            <DocumentProperties
              {...{ units, setUnits, snapPoint, setSnapPoint, snapGrid, setSnapGrid, scaleEffects, setScaleEffects, keyIncrement, setKeyIncrement }}
            />
          )}
        </aside>
      </div>
    </section>
  );
}

function StrokePanel({ active, patchObject }) {
  const [dashed, setDashed] = useState(false);
  const [cap, setCap] = useState("butt");
  const [corner, setCorner] = useState("miter");
  const [alignment, setAlignment] = useState("centro");
  const [dashAlignment, setDashAlignment] = useState("corners");
  const [arrowLinked, setArrowLinked] = useState(true);
  const [arrowAlignment, setArrowAlignment] = useState("extend");
  return (
    <div className="p-3 text-[11px] text-[#d7d7d7]">
      <div className="mb-4 flex items-center border-b border-[#555] pb-3">
        <h3 className="text-sm font-semibold">Traçado</h3>
        <button className="ml-auto">☰</button><button className="ml-3">»</button>
      </div>
      <label className="mb-3 flex items-center gap-3">
        <span className="w-20 text-right">Peso:</span>
        <input type="number" min="0" step="0.25" value={active?.strokeWidth ?? 1} onChange={(event) => patchObject("strokeWidth", Number(event.target.value))} className="w-28 rounded border border-[#555] bg-[#383838] px-3 py-2" />
        <span>pt</span><ChevronDown size={14} />
      </label>
      <ControlChoices label="Extremidade:" value={cap} setValue={setCap} items={[["butt","dc-cap-butt","Extremidade reta"],["round","dc-cap-round","Extremidade redonda"],["square","dc-cap-square","Extremidade projetada"]]} />
      <div className="flex items-center gap-2">
        <ControlChoices label="Canto:" value={corner} setValue={setCorner} items={[["miter","dc-join-miter","Junção em esquadria"],["round","dc-join-round","Junção redonda"],["bevel","dc-join-bevel","Junção chanfrada"]]} />
        <label className="mb-3 flex items-center gap-1"><span>Limite:</span><input defaultValue="10" className="w-14 rounded border border-[#555] bg-[#383838] px-2 py-2" /><span>x</span></label>
      </div>
      <ControlChoices label="Alinhar traçado:" value={alignment} setValue={setAlignment} items={[["centro","dc-stroke-center","Alinhar traçado ao centro"],["dentro","dc-stroke-inside","Alinhar traçado para dentro"],["fora","dc-stroke-outside","Alinhar traçado para fora"]]} />
      <section className="mt-4 border-t border-[#555] pt-4">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={dashed} onChange={(event) => setDashed(event.target.checked)} /> Linha tracejada</label>
          <span className="ml-auto flex gap-1">
            {[['exact','dc-dash-exact','Comprimentos exatos'],['corners','dc-dash-align','Ajustar aos cantos e extremidades']].map(([key, icon, title]) => <button key={key} disabled={!dashed} title={title} onClick={() => setDashAlignment(key)} className={`grid h-7 w-7 place-items-center rounded disabled:opacity-25 ${dashAlignment === key ? 'bg-[#222] text-white' : 'text-[#aaa]'}`}><ReferenceIcon name={icon} size={18} /></button>)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1">
          {["Traço", "Lacuna", "Traço", "Lacuna", "Traço", "Lacuna"].map((label, index) => <label key={index} className="text-center text-[9px] text-slate-400"><input disabled={!dashed} defaultValue={index === 0 ? 12 : ""} className="mb-1 w-full rounded border border-[#555] bg-[#383838] p-2 disabled:opacity-30" />{label}</label>)}
        </div>
      </section>
      <section className="mt-4 border-t border-[#555] pt-4">
        <label className="mb-3 grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2"><span>Pontas de seta:</span><select className="bg-[#383838] p-2"><option>Nenhuma</option><option>Triângulo</option><option>Círculo</option><option>Losango</option></select><select className="bg-[#383838] p-2"><option>Nenhuma</option><option>Triângulo</option><option>Círculo</option><option>Losango</option></select><button title="Trocar pontas"><ReferenceIcon name="arrow-left-right" size={18} /></button></label>
        <label className="mb-3 grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2"><span>Escala:</span><input defaultValue="100%" className="min-w-0 bg-[#383838] p-2" /><input defaultValue="100%" className="min-w-0 bg-[#383838] p-2" /><button title="Vincular escalas" onClick={() => setArrowLinked(!arrowLinked)} className={arrowLinked ? 'text-white' : 'text-[#777]'}>↗</button></label>
        <ControlChoices label="Alinhar:" value={arrowAlignment} setValue={setArrowAlignment} items={[["extend","dc-arrow-extend","A ponta ultrapassa o ponto final"],["tip","dc-arrow-tip","Ponta sobre o ponto final"]]} />
        <label className="grid grid-cols-[90px_1fr_auto_auto] items-center gap-2"><span>Perfil:</span><select className="bg-[#383838] p-2"><option>Uniforme</option><option>Largura 1</option><option>Largura 2</option><option>Largura 3</option></select><button title="Inverter ao longo"><ReferenceIcon name="flip-horizontal-2" size={17} /></button><button title="Inverter transversalmente"><ReferenceIcon name="flip-vertical-2" size={17} /></button></label>
      </section>
    </div>
  );
}

function ControlChoices({ label, value, setValue, items }) {
  return <div className="mb-3 flex items-center gap-2"><span className="w-20 shrink-0 text-right">{label}</span>{items.map(([key, icon, title]) => <button key={key} onClick={() => setValue(key)} className={`grid h-8 w-8 place-items-center rounded ${value === key ? "bg-[#222] text-white" : "text-slate-400 hover:bg-[#444]"}`} title={title}><ReferenceIcon name={icon} size={20} /></button>)}</div>;
}

function AuxiliaryPanel({ name, onCommand = () => {} }) {
  const [alignTarget, setAlignTarget] = useState("Alinhar à seleção");
  const [mode, setMode] = useState("Normal");
  const [opacity, setOpacity] = useState(100);
  const [historyStep, setHistoryStep] = useState(3);
  const shell = (content) => <div className="p-3 text-[11px] text-[#d6d6d6]"><div className="mb-3 flex items-center border-b border-[#555] pb-3"><h3 className="text-sm font-semibold">{name}</h3><button className="ml-auto">☰</button><button className="ml-3">»</button></div>{content}</div>;
  const field = "rounded border border-[#555] bg-[#383838] px-2 py-2 outline-none";

  if (name === "Cor") return shell(<><div className="mb-3 h-28 rounded border border-[#555] bg-[linear-gradient(90deg,#fff0,#fff),linear-gradient(#f00,#000)]" /><div className="grid grid-cols-[1fr_70px] gap-2"><div className="space-y-2">{[["R",15],["G",47],["B",73]].map(([label, value]) => <label key={label} className="grid grid-cols-[18px_1fr_42px] items-center gap-2"><span>{label}</span><input type="range" defaultValue={value} className="accent-white"/><input defaultValue={value} className={field}/></label>)}</div><div className="rounded border border-[#666] bg-[#0f2f49]" /></div><label className="mt-3 flex items-center gap-2"><span className="w-8">#</span><input defaultValue="0F2F49" className={`${field} flex-1`} /></label></>);
  if (name === "Guia de cores") return shell(<><select className={`${field} mb-3 w-full`}><option>Regras de harmonia</option><option>Complementar</option><option>Análoga</option><option>Tríade</option></select><div className="grid grid-cols-5 gap-1">{["#082f49","#0e7490","#22d3ee","#f59e0b","#f97316"].map(color => <button key={color} title={color} className="h-12 border border-[#777]" style={{background:color}} />)}</div><button className="mt-3 w-full rounded border border-[#666] p-2">Salvar cores como amostras</button></>);
  if (name === "Amostras") return shell(<><input placeholder="Localizar" className={`${field} mb-3 w-full italic`} /><div className="grid grid-cols-7 gap-1">{["#000000","#ffffff","#ef4444","#f59e0b","#facc15","#22c55e","#06b6d4","#3b82f6","#6366f1","#a855f7","#ec4899","#78716c","#94a3b8","transparent"].map((color,index) => <button key={`${color}-${index}`} className="aspect-square border border-[#777]" style={{background:color === 'transparent' ? 'linear-gradient(135deg,#fff 45%,#e11d48 46%,#e11d48 54%,#fff 55%)' : color}} />)}</div><PanelFooter labels={["Bibliotecas","Grupo","Nova amostra","Excluir"]}/></>);
  if (name === "Pincéis" || name === "Símbolos" || name === "Estilos gráficos") return shell(<><div className="grid grid-cols-4 gap-2">{Array.from({length:12},(_,index)=><button key={index} className="grid aspect-square place-items-center rounded border border-[#5a5a5a] bg-[#414141] text-xl">{name === 'Pincéis' ? ['╱','〰','≈','⌁'][index%4] : name === 'Símbolos' ? ['◆','✦','●','✿'][index%4] : ['A','B','C','D'][index%4]}</button>)}</div><PanelFooter labels={["Biblioteca","Novo","Opções","Excluir"]}/></>);
  if (name === "Opções de padrão") return shell(<><label className="mb-3 grid gap-1">Nome<input defaultValue="Novo padrão" className={field}/></label><label className="mb-3 grid gap-1">Tipo de bloco<select className={field}><option>Grade</option><option>Tijolo por linha</option><option>Hexagonal</option></select></label><div className="grid grid-cols-2 gap-2"><label>Largura<input defaultValue="100 px" className={`${field} mt-1 w-full`}/></label><label>Altura<input defaultValue="100 px" className={`${field} mt-1 w-full`}/></label></div><label className="mt-3 flex gap-2"><input type="checkbox"/> Dimensionar bloco à arte</label><label className="mt-2 flex gap-2"><input type="checkbox" defaultChecked/> Mover bloco com arte</label></>);
  if (name === "Gradiente") return shell(<><div className="mb-3 flex gap-2"><button className="rounded bg-[#222] px-3 py-2">Linear</button><button className="rounded px-3 py-2 hover:bg-[#444]">Radial</button><button className="rounded px-3 py-2 hover:bg-[#444]">Forma livre</button></div><div className="h-9 rounded border border-[#666] bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500"/><div className="mt-1 flex justify-between"><button>▼</button><button>▼</button><button>▼</button></div><div className="mt-4 grid grid-cols-2 gap-2"><label>Ângulo<input defaultValue="0°" className={`${field} mt-1 w-full`}/></label><label>Proporção<input defaultValue="100%" className={`${field} mt-1 w-full`}/></label><label>Opacidade<input defaultValue="100%" className={`${field} mt-1 w-full`}/></label><label>Local<input defaultValue="0%" className={`${field} mt-1 w-full`}/></label></div></>);
  if (name === "Transparência") return shell(<><div className="grid grid-cols-[1fr_90px] gap-2"><select value={mode} onChange={event=>setMode(event.target.value)} className={field}>{["Normal","Multiplicação","Tela","Sobrepor","Luz suave","Diferença"].map(item=><option key={item}>{item}</option>)}</select><label className={`${field} flex items-center gap-1`}><input value={opacity} onChange={event=>setOpacity(event.target.value)} className="min-w-0 flex-1 bg-transparent"/>%</label></div><div className="my-4 grid grid-cols-2 gap-2"><div className="grid h-20 place-items-center border border-[#555]">Miniatura</div><div className="grid h-20 place-items-center border border-[#555]">Máscara</div></div><div className="grid grid-cols-2 gap-2"><button className="rounded border border-[#666] p-2">Criar máscara</button><button className="rounded border border-[#666] p-2">Liberar</button></div><label className="mt-3 flex gap-2"><input type="checkbox"/> Recortar</label><label className="mt-2 flex gap-2"><input type="checkbox"/> Inverter máscara</label></>);
  if (name === "Aparência") return shell(<><p className="mb-3 font-semibold">{`Texto`}</p>{[["Preenchimento","#082f49"],["Traçado","#0f172a"],["Opacidade","100%"]].map(([label,value])=><button key={label} className="flex w-full items-center gap-3 border-b border-[#555] py-3 text-left"><Eye size={14}/><span className="h-6 w-6 border border-[#777]" style={{background:value.startsWith('#')?value:'transparent'}}/><span>{label}</span><span className="ml-auto text-[#aaa]">{value}</span></button>)}<PanelFooter labels={["Novo preenchimento","Novo traçado","fx","Limpar"]}/></>);
  if (name === "Pranchetas") return shell(<><div className="space-y-1">{["Prancheta 1","Prancheta 2"].map((item,index)=><button key={item} className={`flex w-full items-center gap-2 border px-3 py-2 text-left ${index===0?'border-[#58a6ff] bg-[#43566b]':'border-[#555]'}`}><span>{index+1}</span><span>{item}</span><span className="ml-auto">☐</span></button>)}</div><PanelFooter labels={["Reorganizar","Nova","Excluir"]}/></>);
  if (name === "Transformar") return shell(<><div className="grid grid-cols-2 gap-2">{[["X","112 pt"],["Y","150 pt"],["L","390 pt"],["A","120 pt"],["Rotação","0°"],["Inclinação","0°"]].map(([label,value])=><label key={label} className="grid grid-cols-[auto_1fr] items-center gap-2"><span>{label}:</span><input defaultValue={value} className={field}/></label>)}</div><label className="mt-4 flex gap-2"><input type="checkbox" defaultChecked/> Transformar objetos</label><label className="mt-2 flex gap-2"><input type="checkbox" defaultChecked/> Transformar padrões</label><button className="mt-4 w-full rounded border border-[#666] p-2">Transformar cada...</button></>);
  if (name === "Alinhar") return shell(<><PanelIconGrid names={["dc-al-left","dc-al-hcenter","dc-al-right","dc-al-top","dc-al-vcenter","dc-al-bottom"]} onPick={(icon) => onCommand(`align:${icon.replace("dc-al-", "")}`, { target: alignTarget })}/><h4 className="mb-2 mt-5 font-semibold">Distribuir objetos</h4><PanelIconGrid names={["dc-dist-left","dc-dist-hcenter","dc-dist-right","dc-dist-top","dc-dist-vcenter","dc-dist-bottom"]} onPick={(icon) => onCommand(`align:${icon.replace("dc-", "")}`)}/><label className="mt-5 grid gap-1">Alinhar a:<select aria-label="Alinhar a" value={alignTarget} onChange={(event) => setAlignTarget(event.target.value)} className={field}><option>Alinhar à seleção</option><option>Alinhar à prancheta</option><option>Alinhar ao objeto-chave</option></select></label></>);
  if (name === "Pathfinder") return shell(<><h4 className="mb-2 font-semibold">Modos de forma</h4><PanelIconGrid names={["dc-pf-unite","dc-pf-minus-front","dc-pf-intersect","dc-pf-exclude"]} onPick={(icon) => onCommand(PATHFINDER_COMMANDS[icon])}/><button onClick={() => onCommand("pf:expand")} className="mt-3 rounded border border-[#666] px-3 py-2">Expandir</button><h4 className="mb-2 mt-5 font-semibold">Pathfinders</h4><PanelIconGrid names={["dc-pf-divide","dc-pf-trim","dc-pf-merge","dc-pf-crop","dc-pf-outline","dc-pf-minus-back"]} onPick={(icon) => onCommand(PATHFINDER_COMMANDS[icon])}/></>);
  if (name === "Texto") return shell(<><label className="grid gap-1">Família da fonte<select className={field}><option>Source Sans 3</option><option>Inter</option><option>Arial</option></select></label><label className="mt-2 grid gap-1">Estilo<select className={field}><option>Regular</option><option>Semibold</option><option>Bold</option></select></label><div className="mt-3 grid grid-cols-2 gap-2">{[["Tamanho","132 pt"],["Entrelinha","158,4 pt"],["Kerning","Automático"],["Tracking","60"],["Escala H","100%"],["Escala V","100%"]].map(([label,value])=><label key={label}>{label}<input defaultValue={value} className={`${field} mt-1 w-full`}/></label>)}</div></>);
  if (name === "Parágrafo") return shell(<><div className="mb-4 flex justify-between">{["≡","≣","≡","☷","☰","☷"].map((icon,index)=><button key={index} className="grid h-8 w-8 place-items-center rounded hover:bg-[#444]">{icon}</button>)}</div>{["Recuo esquerdo","Recuo direito","Primeira linha","Espaço antes","Espaço depois"].map(label=><label key={label} className="mb-2 grid grid-cols-[1fr_90px] items-center gap-2"><span>{label}</span><input defaultValue="0 pt" className={field}/></label>)}<label className="mt-3 flex gap-2"><input type="checkbox" defaultChecked/> Hifenizar</label></>);
  if (name === "Histórico") return shell(<><div className="space-y-1">{["Abrir documento","Selecionar objeto","Mover","Alterar preenchimento","Aplicar traçado","Editar gradiente"].map((item,index)=><button key={item} onClick={()=>setHistoryStep(index)} className={`flex w-full items-center gap-2 px-2 py-2 text-left ${index===historyStep?'bg-[#43566b]':''}`}><ReferenceIcon name="history" size={14}/>{item}</button>)}</div><PanelFooter labels={["Novo instantâneo","Excluir histórico"]}/></>);
  if (name === "Ações") return shell(<><div className="space-y-1">{["Ações padrão","Salvar para Web","Redimensionar","Converter em CMYK"].map((item,index)=><button key={item} className="flex w-full items-center gap-2 border-b border-[#555] px-2 py-2 text-left"><span>{index===0?'⌄':'▷'}</span>{item}</button>)}</div><PanelFooter labels={["Parar","Gravar","Executar","Nova ação","Excluir"]}/></>);
  if (name === "Informações") return shell(<div className="grid grid-cols-2 gap-x-5 gap-y-3">{[["X","112 pt"],["Y","150 pt"],["L","390 pt"],["A","120 pt"],["R","8"],["G","47"],["B","73"],["Opacidade","100%"]].map(([label,value])=><div key={label} className="flex justify-between border-b border-[#555] pb-1"><span className="text-[#aaa]">{label}</span><strong>{value}</strong></div>)}</div>);
  if (name === "Navegador") return shell(<><div className="relative aspect-[4/3] overflow-hidden border border-[#666] bg-white"><div className="absolute inset-[18%] bg-gradient-to-br from-cyan-400 to-violet-600"/><div className="absolute inset-[12%] border-2 border-red-500"/></div><div className="mt-3 flex items-center gap-2"><button>−</button><input type="range" defaultValue="72" className="flex-1"/><button>+</button><input defaultValue="72%" className={`${field} w-16`}/></div></>);
  return shell(<p className="text-[#aaa]">Painel disponível na área de trabalho.</p>);
}

function PanelFooter({ labels }) {
  return <div className="mt-5 flex items-center justify-end gap-1 border-t border-[#555] pt-3">{labels.map(label=><button key={label} title={label} className="grid h-8 min-w-8 place-items-center rounded border border-[#555] px-2 hover:bg-[#444]">{label.length > 2 ? label.slice(0,2) : label}</button>)}</div>;
}

const PATHFINDER_COMMANDS = {
  "dc-pf-unite": "pf:unite", "dc-pf-minus-front": "pf:minusFront", "dc-pf-intersect": "pf:intersect", "dc-pf-exclude": "pf:exclude",
  "dc-pf-divide": "pf:divide", "dc-pf-trim": "pf:trim", "dc-pf-merge": "pf:merge", "dc-pf-crop": "pf:crop", "dc-pf-outline": "pf:outline", "dc-pf-minus-back": "pf:minusBack",
};
const ICON_LABELS = {
  "dc-al-left": "Alinhar à esquerda", "dc-al-hcenter": "Alinhar ao centro horizontal", "dc-al-right": "Alinhar à direita",
  "dc-al-top": "Alinhar ao topo", "dc-al-vcenter": "Alinhar ao centro vertical", "dc-al-bottom": "Alinhar à base",
  "dc-dist-left": "Distribuir pela esquerda", "dc-dist-hcenter": "Distribuir pelo centro horizontal", "dc-dist-right": "Distribuir pela direita",
  "dc-dist-top": "Distribuir pelo topo", "dc-dist-vcenter": "Distribuir pelo centro vertical", "dc-dist-bottom": "Distribuir pela base",
  "dc-pf-unite": "Unir", "dc-pf-minus-front": "Menos frente", "dc-pf-intersect": "Interseção", "dc-pf-exclude": "Excluir sobreposição",
  "dc-pf-divide": "Dividir", "dc-pf-trim": "Aparar", "dc-pf-merge": "Mesclar", "dc-pf-crop": "Cortar", "dc-pf-outline": "Contorno", "dc-pf-minus-back": "Menos fundo",
};

function PanelIconGrid({ names, onPick }) {
  return <div className="grid grid-cols-6 gap-2">{names.map(name=><button key={name} title={name} aria-label={ICON_LABELS[name] || name} onClick={onPick ? () => onPick(name) : undefined} className="grid h-9 place-items-center rounded border border-transparent text-[#bbb] hover:border-[#666] hover:bg-[#444] hover:text-white"><ReferenceIcon name={name} size={22}/></button>)}</div>;
}

function ObjectProperties({ active, fill, stroke, setFill, setStroke, patchObject, addObject, onCommand = () => {} }) {
  const fields = [
    ["X", "x", active.x], ["L", "w", active.w],
    ["Y", "y", active.y], ["A", "h", active.h],
  ];

  return (
    <div className="p-4 text-[11px]">
      <p className="mb-4 text-slate-400">{active.kind}</p>
      <div className="mb-4 grid grid-cols-3 gap-2" aria-label="Adicionar elemento">
        <button onClick={() => addObject("Texto")} className="rounded border border-[#666] px-2 py-2">+ Texto</button>
        <button onClick={() => addObject("Retângulo")} className="rounded border border-[#666] px-2 py-2">+ Retângulo</button>
        <button onClick={() => addObject("Elipse")} className="rounded border border-[#666] px-2 py-2">+ Elipse</button>
      </div>
      <h3 className="mb-3 text-sm font-semibold">Transformar</h3>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([label, key, value]) => (
          <label key={key} className="flex items-center rounded border border-[#555] bg-[#383838] px-2 py-2">
            <span className="text-slate-400">{label}:</span>
            <input aria-label={label} value={value} onChange={(event) => patchObject(key, Number(event.target.value))} className="min-w-0 flex-1 bg-transparent text-right outline-none" />
            <span className="ml-1 text-slate-400">pt</span>
          </label>
        ))}
      </div>
      {(active.kind === "Texto" || active.onPath) && (
        <label className="mt-3 grid gap-1">
          Conteúdo do texto
          <textarea
            aria-label="Conteúdo do texto"
            value={active.text || ""}
            onChange={(event) => patchObject("text", event.target.value)}
            rows="3"
            className="resize-y rounded border border-[#555] bg-[#383838] px-3 py-2"
          />
        </label>
      )}
      <div className="mt-2 flex items-center gap-2">
        <label className="flex flex-1 items-center rounded border border-[#555] bg-[#383838] px-2 py-2">
          <RotateCcw size={13} className="mr-2" />
          <input aria-label="Rotação" value={active.rotation ?? 0} onChange={(event) => patchObject("rotation", Number(event.target.value))} className="w-full bg-transparent outline-none" />°
        </label>
        <button title="Inverter verticalmente" onClick={() => onCommand("flip:y")} className="rounded px-3 py-2 hover:bg-[#444]">↕</button>
        <button title="Inverter horizontalmente" onClick={() => onCommand("flip:x")} className="rounded px-3 py-2 hover:bg-[#444]">↔</button>
      </div>
      {(active.kind === "Retângulo" || active.kind === "Forma") && (
        <label className="mt-3 flex items-center gap-3">
          <span>Raio dos cantos:</span>
          <input
            aria-label="Raio dos cantos"
            type="number"
            min="0"
            value={active.cornerRadius ?? 0}
            onChange={(event) => patchObject("cornerRadius", Number(event.target.value))}
            className="w-24 rounded border border-[#555] bg-[#383838] px-3 py-2"
          />
          <span>pt</span>
        </label>
      )}

      <PropertySection title="Aparência">
        <label className="mb-3 flex items-center gap-3">
          <input type="color" value={active.color || fill} onChange={(event) => { setFill(event.target.value); patchObject("color", event.target.value); }} />
          <span className="mr-auto">Preenchimento</span>
          <ChevronDown size={14} />
        </label>
        <label className="mb-2 flex items-center gap-3">
          <input type="color" value={active.stroke || stroke} onChange={(event) => { setStroke(event.target.value); patchObject("stroke", event.target.value); }} />
          <span className="underline">Traçado</span>
          <span className="ml-auto flex flex-col border border-[#555] text-[8px]"><button className="px-1">▲</button><button className="border-t border-[#555] px-1">▼</button></span>
          <input aria-label="Espessura do traçado" type="number" min="0" value={active.strokeWidth ?? 0} onChange={(event) => patchObject("strokeWidth", Number(event.target.value))} className="w-14 rounded border border-[#555] bg-[#383838] px-2 py-1" />
          <span>pt</span>
          <ChevronDown size={14} />
        </label>
        <label className="flex items-center gap-3">
          <span>Opacidade</span>
          <input aria-label="Opacidade" type="number" min="0" max="100" value={active.opacity ?? 100} onChange={(event) => patchObject("opacity", Number(event.target.value))} className="ml-auto w-20 rounded border border-[#555] bg-[#383838] px-2 py-1" />%
          <button title="Mais opções">•••</button>
        </label>
        <button className="mt-3 rounded border border-[#666] px-4 py-2 text-base">fx</button>
      </PropertySection>

      <PropertySection title="Alinhar">
        <div className="flex justify-between text-lg text-slate-300">
          {["⊢", "↔", "⊣", "⊤", "↕", "⊥"].map((symbol, index) => <button key={index} title="Alinhar" aria-label={ICON_LABELS[`dc-al-${ALIGN_KEYS[index]}`]} onClick={() => onCommand(`align:${ALIGN_KEYS[index]}`)} className="rounded px-2 py-1 hover:bg-[#444]">{symbol}</button>)}
        </div>
      </PropertySection>

      <PropertySection title="Ações rápidas">
        <div className="grid grid-cols-2 gap-2">
          {[
            active.kind === "Retângulo" || active.kind === "Forma" ? "Expandir forma" : "Expandir objeto",
            "Recolorir",
            "Deslocar caminho",
            "Simplificar",
            "Organizar: trazer para frente",
          ].map((action) => <button key={action} onClick={() => onCommand(action)} className="truncate rounded border border-[#666] px-2 py-2" title={action}>{action}</button>)}
          <button onClick={() => patchObject("locked", !active.locked)} className="rounded border border-[#666] py-2">{active.locked ? "Desbloquear" : "Bloquear"}</button>
        </div>
      </PropertySection>
    </div>
  );
}

const ALIGN_KEYS = ["left", "hcenter", "right", "top", "vcenter", "bottom"];

function DocumentProperties({ units, setUnits, snapPoint, setSnapPoint, snapGrid, setSnapGrid, scaleEffects, setScaleEffects, keyIncrement, setKeyIncrement }) {

  return (
    <div className="p-4 text-[11px]">
      <p className="mb-4 text-slate-400">Documento</p>
      <h3 className="mb-3 text-sm font-semibold">Documento</h3>
      <label className="mb-3 flex items-center gap-3 text-slate-300">
        <span className="w-16">Unidades</span>
        <select value={units} onChange={(event) => setUnits(event.target.value)} className="flex-1 rounded border border-[#555] bg-[#3b3b3b] px-3 py-2">
          <option>Pixels</option>
          <option>Pontos</option>
          <option>Milímetros</option>
          <option>Centímetros</option>
          <option>Polegadas</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button className="rounded border border-[#666] py-2">Configurar documento</button>
        <button className="rounded border border-[#666] py-2">Editar pranchetas</button>
      </div>

      <PropertySection title="Réguas e grades">
        <div className="flex gap-3">
          <button title="Réguas" className="rounded bg-[#282828] px-3 py-2 text-base">⌑</button>
          <button title="Grade" className="rounded bg-[#282828] px-3 py-2 text-base">▦</button>
          <button title="Limites" className="rounded bg-[#282828] px-3 py-2 text-base">▧</button>
        </div>
      </PropertySection>

      <PropertySection title="Guias">
        <div className="flex gap-3">
          <button className="rounded bg-[#252525] px-3 py-2 text-base">▦</button>
          <button className="rounded bg-[#252525] px-3 py-2 text-base">✧</button>
        </div>
      </PropertySection>

      <PropertySection title="Opções de encaixe">
        <label className="mb-2 flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={snapPoint} onChange={(event) => setSnapPoint(event.target.checked)} />
          Encaixar no ponto
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={snapGrid} onChange={(event) => setSnapGrid(event.target.checked)} />
          Encaixar na grade
        </label>
      </PropertySection>

      <PropertySection title="Preferências">
        <label className="mb-3 flex items-center justify-between gap-3">
          Incremento do teclado
          <input aria-label="Incremento do teclado" value={keyIncrement} onChange={(event) => setKeyIncrement(event.target.value)} className="w-24 rounded border border-[#555] bg-[#3b3b3b] px-3 py-2" />
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={scaleEffects} onChange={(event) => setScaleEffects(event.target.checked)} />
          Dimensionar traçados e efeitos
        </label>
      </PropertySection>

      <PropertySection title="Ações rápidas">
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded border border-[#666] py-2">Configurar documento</button>
          <button className="rounded border border-[#666] py-2">Preferências</button>
        </div>
      </PropertySection>
    </div>
  );
}

function PropertySection({ title, children }) {
  return (
    <section className="mt-5 border-t border-[#494949] pt-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function LayersPanel({
  objects,
  selectedObject,
  setSelectedObject,
  toggle,
  addObject,
  removeSelectedObject,
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [groupExpanded, setGroupExpanded] = useState(true);
  const filteredObjects = objects.filter((object) =>
    `${object.name} ${object.kind}`.toLowerCase().includes(query.toLowerCase()),
  );
  const groupedIds = new Set(["circle", "wave", "path-cyan", "path-magenta"]);
  const groupChildren = filteredObjects.filter((object) => groupedIds.has(object.id));
  const rootObjects = filteredObjects.filter((object) => !groupedIds.has(object.id));

  return (
    <div className="text-[10px]">
      <input
        aria-label="Pesquisar camadas"
        placeholder="Pesquisar tudo"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="m-3 w-[calc(100%-24px)] border border-[#555] bg-[#252525] px-3 py-2 outline-none focus:border-orange-400"
      />
      <div className="flex items-center gap-2 border-y border-[#555] bg-[#49627a] px-2 py-2 text-white">
        <Eye size={13} />
        <button
          aria-label={expanded ? "Recolher Camada 1" : "Expandir Camada 1"}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <span className="h-5 w-5 border border-slate-300 bg-gradient-to-br from-fuchsia-500 to-cyan-400" />
        <strong>Camada 1</strong>
        <span className="ml-auto h-3 w-3 rounded-full border border-white" />
      </div>
      {expanded && (
        <>
          {rootObjects.slice(0, 1).map((object) => (
            <LayerRow key={object.id} object={object} depth={1} {...{ selectedObject, setSelectedObject, toggle }} />
          ))}
          {(groupChildren.length > 0 || !query) && (
            <>
              <div className="flex items-center gap-2 border-b border-[#454545] py-2 pl-8 pr-2 hover:bg-[#3b3b3b]">
                <Eye size={13} />
                <button aria-label={groupExpanded ? "Recolher Grupo de recorte" : "Expandir Grupo de recorte"} onClick={() => setGroupExpanded((value) => !value)}>
                  {groupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <span className="h-6 w-6 border border-slate-500 bg-gradient-to-br from-cyan-400 via-fuchsia-400 to-indigo-500" />
                <span className="min-w-0 flex-1 truncate">&lt;Grupo de recorte&gt;</span>
                <span className="h-3 w-3 rounded-full border border-slate-300" />
              </div>
              {groupExpanded && groupChildren.map((object) => (
                <LayerRow key={object.id} object={object} depth={2} {...{ selectedObject, setSelectedObject, toggle }} />
              ))}
            </>
          )}
          {rootObjects.slice(1).map((object) => (
            <LayerRow key={object.id} object={object} depth={1} {...{ selectedObject, setSelectedObject, toggle }} />
          ))}
        </>
      )}
      <footer className="mt-auto flex items-center gap-3 border-t border-[#555] p-3">
        <span className="mr-auto text-slate-400">1 camada</span>
        <button title="Localizar objeto">⌕</button>
        <button title="Nova subcamada">▦</button>
        <button onClick={() => addObject("Forma")} title="Novo objeto">
          <Plus size={14} />
        </button>
        <button onClick={() => addObject("Camada")} title="Nova camada">
          <Layers3 size={14} />
        </button>
        <button
          onClick={removeSelectedObject}
          disabled={!selectedObject}
          title="Excluir objeto selecionado"
          className="disabled:opacity-30"
        >
          <Trash2 size={14} />
        </button>
      </footer>
    </div>
  );
}

function LayerRow({ object, depth, selectedObject, setSelectedObject, toggle }) {
  return (
    <div
      onClick={() => setSelectedObject(object.id)}
      className={`flex cursor-default items-center gap-2 border-b border-[#454545] py-2 pr-2 ${selectedObject === object.id ? "bg-[#506b84] text-white" : "hover:bg-[#3b3b3b]"}`}
      style={{ paddingLeft: `${20 + depth * 14}px` }}
    >
      <button aria-label={`${object.visible ? "Ocultar" : "Mostrar"} ${object.name}`} onClick={(event) => { event.stopPropagation(); toggle(object.id, "visible"); }}>
        {object.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <ChevronRight size={12} className="text-slate-400" />
      <span className="h-6 w-6 shrink-0 border border-slate-500" style={{ background: object.color }} />
      <span className="min-w-0 flex-1 truncate">{object.name}</span>
      <button aria-label={`${object.locked ? "Desbloquear" : "Bloquear"} ${object.name}`} onClick={(event) => { event.stopPropagation(); toggle(object.id, "locked"); }} className={object.locked ? "text-amber-300" : "text-transparent hover:text-slate-400"}>
        <Lock size={12} />
      </button>
      <span className={`h-3 w-3 rounded-full border ${selectedObject === object.id ? "border-orange-300 bg-orange-300" : "border-slate-300"}`} />
    </div>
  );
}

function LibrariesPanel({ assets, selected, onSelect }) {
  return (
    <div className="p-3 text-[10px]">
      <input
        aria-label="Pesquisar bibliotecas"
        placeholder="Pesquisar bibliotecas"
        className="mb-3 w-full border border-[#555] bg-[#252525] px-3 py-2"
      />
      <h3 className="mb-2 font-bold">MM Library</h3>
      {assets.length ? (
        assets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            className={`mb-1 flex w-full items-center gap-2 border p-2 text-left ${selected?.id === asset.id ? "border-orange-400" : "border-[#555]"}`}
          >
            <span className="h-7 w-7 bg-[#222]" />
            <span className="truncate">{asset.name}</span>
          </button>
        ))
      ) : (
        <p className="border border-dashed border-[#555] p-5 text-center text-slate-400">
          Importe ativos ou abra a MM Library.
        </p>
      )}
    </div>
  );
}
