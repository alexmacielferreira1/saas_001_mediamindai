import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { registerMCPActions } from "../../lib/mcpActions";
import { mmeffectsCatalogue, runMMEffectsTool } from "./mmeffectsMcpTools";
import NumericField from "./NumericField";
import { useTextPrompt } from "./FilmCraftTextPrompt";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Anchor,
  Box,
  Camera,
  Circle,
  Film,
  FolderPlus,
  Hand,
  Lightbulb,
  MousePointer2,
  Pause,
  PenTool,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  Square,
  Type,
  Upload,
  ZoomIn,
} from "lucide-react";

// Ordem da barra como no After Effects. Câmera e Luz dividem um slot com menu suspenso.
const TOOLS = [
  ["V", "Seleção", MousePointer2],
  ["H", "Mão", Hand],
  ["Z", "Zoom", ZoomIn],
  ["W", "Rotação", RotateCw],
  ["C", "Câmera", Camera],
  ["L", "Luz", Lightbulb],
  ["Y", "Âncora", Anchor],
  ["Q", "Forma", Square],
  ["G", "Caneta", PenTool],
  ["T", "Texto", Type],
];
const CAMERA_LIGHT_TOOLS = ["Câmera", "Luz"];
const TAGLINE_TEXT = "MOTION GRAPHICS · VISUAL EFFECTS · PURE RUST";

// Texto padrão de camadas antigas que ainda não têm `text` gravado.
function defaultLayerText(layer) {
  return layer?.id === "tagline" ? TAGLINE_TEXT : "MMEffect";
}

const EFFECT_GROUPS = {
  "Animação predefinida": ["Texto · Entrada suave", "Transição · Dissolver", "Formas · Bounce"],
  "Áudio": ["Graves e agudos", "Equalizador paramétrico", "Reverberação"],
  "Desfoque e nitidez": ["Desfoque gaussiano", "Desfoque de câmera", "Máscara de nitidez"],
  "Canal": ["Definir canais", "Combinador de canais", "Remover fosco de cor"],
  "Correção de cor": ["Brilho e contraste", "Curvas", "Lumetri Color", "Tonalidade/Saturação"],
  "Distorcer": ["Turbulent Displace", "Transformar", "Ondulação", "Warp"],
  "Chaveamento": ["Keylight 1.2", "Key Cleaner", "Advanced Spill Suppressor"],
  "Gerar": ["Preenchimento", "Glow", "Gradiente de 4 cores", "Traçado"],
  "Perspectiva": ["Drop Shadow", "Bevel Alpha", "Rastreador de câmera 3D"],
  "Tempo": ["Eco", "Posterizar tempo", "Timewarp"],
  "Transição": ["Wipe linear", "Iris Wipe", "Block Dissolve"],
};

const COMP_DURATION = 10;
const FPS = 30;
const HISTORY_LIMIT = 100;
const PRESET_COMPOSITIONS = ["3D Showcase", "EffectCraft Intro", "Particles"];
const PRESET_SHARED_KEY = "__predefinidas__";
const DEFAULT_TRANSFORM = { x: 960, y: 540, scale: 100, rotation: 0, opacity: 100 };
const DEFAULT_CANVAS_BOX = { x: 22, y: 34, w: 60, h: 22 };
const TRANSFORM_PROPERTIES = ["x", "y", "scale", "rotation", "opacity"];
const PARAGRAPH_ALIGNMENTS = [
  ["left", "Alinhar texto à esquerda"],
  ["center", "Centralizar texto"],
  ["right", "Alinhar texto à direita"],
  ["justify", "Justificar texto"],
  ["justify-all", "Justificar todas as linhas"],
];

// Parâmetros editáveis por efeito: [rótulo, valor padrão, faixa opcional do controle deslizante].
const EFFECT_FIELDS = {
  "Color Range": [["Fuzziness","0"],["Color Space","Lab"],["Min (L, Y, R)","0"],["Max (L, Y, R)","255"],["Min (a, U, G)","0"],["Max (a, U, G)","100"],["Min (b, V, B)","128"],["Max (b, V, B)","255"]],
  "CC Particle World": [["Birth Rate","0.50"],["Longevity (sec)","1.00"],["Position X","0.00"],["Position Y","0.00"],["Position Z","0.00"],["Radius X","0.025"],["Radius Y","0.025"],["Radius Z","0.025"],["Animation","Explosive"],["Velocity","1.00"],["Inherit Velocity %","0.0"],["Gravity","0.500"],["Resistance","0.00"],["Extra","1.00"],["Extra Angle","360.0°"]],
  "Desfoque gaussiano": [["Desfoque","0",[0,50]]],
  "Desfoque de câmera": [["Raio do desfoque","0",[0,50]]],
  "Brilho e contraste": [["Brilho","0",[-100,100]],["Contraste","0",[-100,100]]],
  "Tonalidade/Saturação": [["Matiz","0",[-180,180]],["Saturação","0",[-100,100]]],
  "Glow": [["Raio do brilho","12",[0,60]],["Intensidade do brilho","1",[0,4]]],
  "Drop Shadow": [["Opacidade da sombra","50",[0,100]],["Distância","6",[0,100]],["Suavidade","4",[0,50]]],
};

function numeric(value, fallback = 0) {
  const parsed = parseFloat(String(value ?? "").replace("°", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function effectValue(effectParams, effect, label) {
  const field = (EFFECT_FIELDS[effect] || []).find(([name]) => name === label);
  return effectParams?.[effect]?.[label] ?? field?.[1];
}

// Converte os efeitos aplicados em filtros CSS/canvas reais (mesma sintaxe em ambos).
function buildEffectFilter(appliedEffects, effectParams, scale = 1) {
  const parts = [];
  for (const effect of appliedEffects || []) {
    if (!EFFECT_FIELDS[effect]) continue;
    const value = (label) => numeric(effectValue(effectParams, effect, label));
    if (effect === "Desfoque gaussiano" && value("Desfoque") > 0) parts.push(`blur(${value("Desfoque") * scale}px)`);
    if (effect === "Desfoque de câmera" && value("Raio do desfoque") > 0) parts.push(`blur(${value("Raio do desfoque") * scale}px)`);
    if (effect === "Brilho e contraste") {
      if (value("Brilho")) parts.push(`brightness(${Math.max(0, 1 + value("Brilho") / 100)})`);
      if (value("Contraste")) parts.push(`contrast(${Math.max(0, 1 + value("Contraste") / 100)})`);
    }
    if (effect === "Tonalidade/Saturação") {
      if (value("Matiz")) parts.push(`hue-rotate(${value("Matiz")}deg)`);
      if (value("Saturação")) parts.push(`saturate(${Math.max(0, 1 + value("Saturação") / 100)})`);
    }
    if (effect === "Glow" && value("Raio do brilho") > 0 && value("Intensidade do brilho") > 0) {
      parts.push(`drop-shadow(0px 0px ${value("Raio do brilho") * scale}px rgba(255, 255, 255, ${Math.min(1, value("Intensidade do brilho") / 2)}))`);
    }
    if (effect === "Drop Shadow" && value("Opacidade da sombra") > 0) {
      const distance = value("Distância") * scale;
      parts.push(`drop-shadow(${distance}px ${distance}px ${value("Suavidade") * scale}px rgba(0, 0, 0, ${Math.min(1, value("Opacidade da sombra") / 100)}))`);
    }
  }
  return parts.join(" ");
}

function particleField(effectParams, enabled) {
  const value = (label, fallback) => enabled ? numeric(effectValue(effectParams, "CC Particle World", label), fallback) : fallback;
  const birthRate = Math.max(0, value("Birth Rate", 0.5));
  const velocity = Math.max(0, value("Velocity", 1));
  const gravity = value("Gravity", 0.5);
  const longevity = Math.max(0.1, value("Longevity (sec)", 1));
  const count = Math.max(1, Math.min(240, Math.round(34 * birthRate * 2)));
  const center = { x: 320 + value("Position X", 0) * 320, y: 180 + value("Position Y", 0) * 180 };
  return {
    center,
    particles: Array.from({ length: count }, (_, index) => {
      const angle = (index * 137.5) * Math.PI / 180;
      const radius = (24 + ((index * 31) % 150)) * velocity;
      const length = (12 + (index % 5) * 5) * longevity;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius + (gravity - 0.5) * radius * 0.4;
      return { x1: x, y1: y, x2: x + Math.cos(angle) * length, y2: y + Math.sin(angle) * length, color: index % 3 === 0 ? "#ff6a00" : index % 3 === 1 ? "#ffd500" : "#fff500" };
    }),
  };
}

function layerTransformAt(propertyKeyframes, layerId, base, time) {
  const animated = propertyKeyframes?.[layerId] || {};
  return Object.fromEntries(Object.entries(base).map(([property, fallback]) => [property, evaluateKeyframes(animated[property], time, fallback)]));
}

function motionBlurAmount(propertyKeyframes, layerId, base, time) {
  const now = layerTransformAt(propertyKeyframes, layerId, base, time);
  const before = layerTransformAt(propertyKeyframes, layerId, base, Math.max(0, time - 1 / FPS));
  const travel = Math.hypot(now.x - before.x, now.y - before.y) / 4 + Math.abs(now.rotation - before.rotation) / 2 + Math.abs(now.scale - before.scale) / 2;
  return Math.min(12, travel);
}

function layerTextStyle(layer) {
  if (!layer) return {};
  const size = numeric(layer.fontSize, NaN);
  const lineHeight = numeric(layer.lineHeight, NaN);
  return {
    ...(layer.fontFamily ? { fontFamily: `"${layer.fontFamily}", Inter, sans-serif` } : {}),
    ...(layer.fontWeight ? { fontWeight: layer.fontWeight === "Regular" ? 400 : 900 } : {}),
    ...(size > 0 ? { fontSize: `calc(${size} / 1920 * 100cqw)` } : {}),
    ...(lineHeight > 0 ? { lineHeight: `calc(${lineHeight} / 1920 * 100cqw)` } : {}),
  };
}

function layerAlignStyle(layer) {
  if (!layer?.textAlign) return {};
  return layer.textAlign === "justify-all" ? { textAlign: "justify", textAlignLast: "justify" } : { textAlign: layer.textAlign };
}

function maskClipPath(layer) {
  if (layer?.maskPath?.closed && layer.maskPath.points.length >= 3) {
    return `polygon(${layer.maskPath.points.map((point) => `${point.x}% ${point.y}%`).join(", ")})`;
  }
  if (layer?.mask) return `inset(${layer.mask.top}% ${100 - layer.mask.right}% ${100 - layer.mask.bottom}% ${layer.mask.left}%)`;
  return undefined;
}

function snapValue(value, targets, threshold = 1.5) {
  for (const target of targets) if (Math.abs(value - target) <= threshold) return target;
  return value;
}

function sameDocument(left, right) {
  return Boolean(left && right) && Object.keys(left).every((key) => left[key] === right[key]);
}

function slugify(name) {
  return String(name || "projeto").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "projeto";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function formatTimecode(time) {
  const seconds = Math.floor(time + 1e-6);
  const frames = Math.min(FPS - 1, Math.floor((time - seconds) * FPS + 1e-6));
  return `00:00:${String(seconds).padStart(2, "0")}:${String(Math.max(0, frames)).padStart(2, "0")}`;
}

/**
 * Texto visível de uma camada no instante `time`, com a animação de texto aplicada
 * (máquina de escrever por letra ou por palavra). Sem animação, devolve o texto inteiro.
 */
export function textAt(layer, time) {
  const text = layer?.text ?? defaultLayerText(layer);
  const animation = layer?.textAnimation;
  if (!animation || !["letters", "words"].includes(animation.mode)) return text;
  const progress = Math.max(0, Math.min(1, (time - animation.start) / Math.max(0.01, animation.duration)));
  const units = animation.mode === "words" ? text.match(/\S+\s*/g) || [] : [...text];
  const visible = units.slice(0, Math.floor(progress * units.length + 1e-9)).join("");
  const typing = progress < 1;
  const blink = Math.floor(time * 2) % 2 === 0;
  return animation.cursor && (typing || blink) ? `${visible}|` : visible;
}

function evaluateKeyframes(frames, time, fallback) {
  if (!frames?.length) return fallback;
  const ordered = [...frames].sort((a, b) => a.time - b.time);
  if (time <= ordered[0].time) return ordered[0].value;
  if (time >= ordered.at(-1).time) return ordered.at(-1).value;
  const rightIndex = ordered.findIndex((frame) => frame.time >= time);
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  if (left.interpolation === "hold") return left.value;
  let progress = (time - left.time) / (right.time - left.time);
  if (["auto-bezier", "easy-ease"].includes(left.interpolation)) {
    progress = progress * progress * (3 - 2 * progress);
  }
  return left.value + (right.value - left.value) * progress;
}

// Desenha um quadro da composição num canvas 2D, nas mesmas coordenadas do visualizador.
function drawCompositionFrame(ctx, scene, time, width, height) {
  const w = scene.viewerWidth || 800;
  const h = w * 9 / 16;
  ctx.save();
  ctx.setTransform?.(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.scale(width / w, height / h);
  if (scene.composition === "Particles") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  } else if (scene.composition === "3D Showcase") {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#080611");
    gradient.addColorStop(0.58, "#15192a");
    gradient.addColorStop(1, "#07070c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  } else {
    const radius = Math.hypot(w, h) / 2;
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius);
    gradient.addColorStop(0, "#14295c");
    gradient.addColorStop(0.48, "#07122d");
    gradient.addColorStop(1, "#030713");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
  if (scene.image) {
    const ratio = Math.max(w / scene.image.width, h / scene.image.height) || 1;
    const iw = scene.image.width * ratio;
    const ih = scene.image.height * ratio;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(scene.image, (w - iw) / 2, (h - ih) / 2, iw, ih);
    ctx.globalAlpha = 1;
  }
  if (scene.composition === "Particles") {
    const field = particleField(scene.effectParams, scene.particleEnabled);
    const k = w / 640;
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(field.center.x, field.center.y);
    ctx.lineWidth = 2;
    for (const particle of field.particles) {
      ctx.strokeStyle = particle.color;
      ctx.beginPath();
      ctx.moveTo(particle.x1, particle.y1);
      ctx.lineTo(particle.x2, particle.y2);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff600";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (scene.composition === "3D Showcase") {
    const blue = ctx.createLinearGradient(w * 0.31, h * 0.26, w * 0.47, h * 0.61);
    blue.addColorStop(0, "#22d3ee");
    blue.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = blue;
    ctx.fillRect(w * 0.31, h * 0.26, w * 0.16, h * 0.35);
    const coral = ctx.createLinearGradient(w * 0.45, h * 0.22, w * 0.6, h * 0.59);
    coral.addColorStop(0, "#fb923c");
    coral.addColorStop(1, "#9f1239");
    ctx.fillStyle = coral;
    ctx.fillRect(w * 0.45, h * 0.22, w * 0.15, h * 0.37);
    ctx.save();
    ctx.translate(w * 0.39, h * 0.45);
    ctx.rotate(-6 * Math.PI / 180);
    ctx.fillStyle = "#fff";
    ctx.font = "italic 700 36px Inter, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("CLASSIC 3D", 0, 0);
    ctx.restore();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CÂMERAS · LUZES · SOMBRAS · PROFUNDIDADE DE CAMPO", w / 2, h * 0.9);
    ctx.textAlign = "left";
  }
  if (scene.composition === "EffectCraft Intro") {
    ctx.strokeStyle = "#e879f9";
    ctx.lineWidth = 0.7 * 110 / 24;
    ctx.beginPath();
    ctx.arc(w - w * 0.18 - 55, h * 0.3 + 55, 110 * 10 / 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 64 / 24;
    const bx = w - w * 0.28 - 64;
    const by = h - h * 0.18 - 64;
    ctx.strokeRect(bx + 64 * 0.2, by + 64 * 0.2, 64 * 0.6, 64 * 0.6);
  }
  const layer = scene.layer;
  if (scene.showBox && layer) {
    const box = scene.canvasBox;
    const bw = box.w / 100 * w;
    const bh = box.h / 100 * h;
    const left = box.x / 100 * w;
    const top = box.y / 100 * h;
    const value = layerTransformAt(scene.propertyKeyframes, layer.id, scene.transform, time);
    const anchor = layer.anchor || { x: 50, y: 50 };
    const ox = anchor.x / 100 * bw;
    const oy = anchor.y / 100 * bh;
    ctx.save();
    ctx.translate(left + ox + (value.x - 960) / 19.2 / 100 * bw, top + oy + (value.y - 540) / 10.8 / 100 * bh);
    ctx.scale(value.scale / 100, value.scale / 100);
    ctx.rotate(value.rotation * Math.PI / 180);
    ctx.translate(-ox, -oy);
    ctx.globalAlpha = Math.max(0, Math.min(1, value.opacity / 100));
    const filters = [];
    if (layer.effectsEnabled !== false) filters.push(buildEffectFilter(scene.appliedEffects, scene.effectParams));
    if (layer.motionBlur) {
      const blur = motionBlurAmount(scene.propertyKeyframes, layer.id, scene.transform, time);
      if (blur > 0.05) filters.push(`blur(${blur.toFixed(2)}px)`);
    }
    const filter = filters.filter(Boolean).join(" ");
    if (filter) ctx.filter = filter;
    if (layer.maskPath?.closed && layer.maskPath.points.length >= 3) {
      ctx.beginPath();
      layer.maskPath.points.forEach((point, index) => ctx[index ? "lineTo" : "moveTo"](point.x / 100 * bw, point.y / 100 * bh));
      ctx.closePath();
      ctx.clip();
    } else if (layer.mask) {
      ctx.beginPath();
      ctx.rect(layer.mask.left / 100 * bw, layer.mask.top / 100 * bh, (layer.mask.right - layer.mask.left) / 100 * bw, (layer.mask.bottom - layer.mask.top) / 100 * bh);
      ctx.clip();
    }
    const customSize = numeric(layer.fontSize, NaN);
    const size = customSize > 0 ? customSize * w / 1920 : Math.max(24, Math.min(62, (scene.viewportWidth || 1280) * 0.04));
    const weight = layer.fontWeight === "Regular" ? 400 : 900;
    const family = layer.fontFamily ? `"${layer.fontFamily}", Inter, sans-serif` : "Inter, sans-serif";
    const align = layer.textAlign === "left" ? "left" : layer.textAlign === "right" ? "right" : "center";
    const textX = align === "left" ? 24 : align === "right" ? bw - 24 : bw / 2;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(255,255,255,.7)";
    ctx.shadowBlur = 8;
    ctx.font = `${weight} ${size}px ${family}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${(size * 0.04).toFixed(2)}px`;
    const lineHeight = numeric(layer.lineHeight, NaN) > 0 ? numeric(layer.lineHeight) * w / 1920 : size * 1.5;
    ctx.fillText(textAt(layer, time), textX, 16 + (lineHeight - size) / 2);
    if (scene.composition === "EffectCraft Intro" && scene.tagline) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#67e8f9";
      ctx.font = "14px Inter, sans-serif";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "5.6px";
      ctx.fillText(textAt(scene.tagline, time), textX, 16 + lineHeight);
    }
    ctx.restore();
  }
  ctx.restore();
}

const APP_MENUS = {
  Arquivo: ["Novo projeto", "Importar mídia", "Salvar projeto", "Adicionar à fila de renderização"],
  Editar: ["Desfazer", "Refazer", "Duplicar camada", "Excluir camada"],
  Composição: ["Nova composição", "Configurações da composição", "Adicionar marcador"],
  Camada: ["Nova camada de texto", "Nova camada de forma", "Nova câmera", "Nova luz"],
  Efeito: ["Efeitos e predefinições", "Controles de efeitos", "Remover todos os efeitos"],
  Animação: ["Adicionar quadro-chave", "Editor de gráficos", "Assistente de quadro-chave"],
  Exibir: ["Ajustar composição", "100%", "Mostrar grades"],
  Janela: ["Projeto", "Controles de efeitos", "Propriedades", "Efeitos e predefinições"],
  Ajuda: ["Atalhos do MMEffect", "Sobre o MMEffect"],
};

export default function EffectCraftWorkspace({
  active = true,
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const [tool, setTool] = useGraphicDraftState("EffectCraftWorkspace.jsx:tool", "Seleção");
  const [openMenu, setOpenMenu] = useState(null);
  // Posição do menu suspenso: renderizado em portal com position fixed para não ser cortado
  // pelo overflow-x-auto da barra de menus.
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!openMenu) return undefined;
    const close = (event) => {
      if (!event.target.closest?.("[data-effect-menu]")) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openMenu]);
  const [workspace, setWorkspace] = useGraphicDraftState("EffectCraftWorkspace.jsx:workspace", "Padrão");
  const [viewportOffset, setViewportOffset] = useGraphicDraftState("EffectCraftWorkspace.jsx:viewportOffset", { x: 0, y: 0 });
  const [leftPanel, setLeftPanel] = useGraphicDraftState("EffectCraftWorkspace.jsx:leftPanel", "Controles de efeitos");
  const [rightTopPanel, setRightTopPanel] = useGraphicDraftState("EffectCraftWorkspace.jsx:rightTopPanel", "Informações");
  const [rightBottomPanel, setRightBottomPanel] = useGraphicDraftState("EffectCraftWorkspace.jsx:rightBottomPanel", "Propriedades");
  const [bottomPanel, setBottomPanel] = useGraphicDraftState("EffectCraftWorkspace.jsx:bottomPanel", "Timeline");
  const [graphEditor, setGraphEditor] = useGraphicDraftState("EffectCraftWorkspace.jsx:graphEditor", false);
  const [showSwitches, setShowSwitches] = useGraphicDraftState("EffectCraftWorkspace.jsx:showSwitches", true);
  const [showModes, setShowModes] = useGraphicDraftState("EffectCraftWorkspace.jsx:showModes", true);
  const [expandedLayers, setExpandedLayers] = useGraphicDraftState("EffectCraftWorkspace.jsx:expandedLayers", []);
  const [markers, setMarkers] = useGraphicDraftState("EffectCraftWorkspace.jsx:markers", [1.2, 5.8, 8.4]);
  const [propertyKeyframes, setPropertyKeyframes] = useGraphicDraftState("EffectCraftWorkspace.jsx:propertyKeyframes", {});
  const [selectedKeyframe, setSelectedKeyframe] = useGraphicDraftState("EffectCraftWorkspace.jsx:selectedKeyframe", null);
  const [canvasBox, setCanvasBox] = useGraphicDraftState("EffectCraftWorkspace.jsx:canvasBox", { x: 22, y: 34, w: 60, h: 22 });
  const [composition, setComposition] = useGraphicDraftState("EffectCraftWorkspace.jsx:composition", "EffectCraft Intro");
  const gesture = useRef(null);
  const timelineGesture = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useGraphicDraftState("EffectCraftWorkspace.jsx:playhead", 3);
  const [zoom, setZoom] = useGraphicDraftState("EffectCraftWorkspace.jsx:zoom", 100);
  const [search, setSearch] = useGraphicDraftState("EffectCraftWorkspace.jsx:search", "");
  const [openEffectGroups, setOpenEffectGroups] = useGraphicDraftState("EffectCraftWorkspace.jsx:openEffectGroups", ["Correção de cor", "Desfoque e nitidez"]);
  const [appliedEffects, setAppliedEffects] = useGraphicDraftState("EffectCraftWorkspace.jsx:appliedEffects", ["Color Range", "Transformar"]);
  const [selectedLayer, setSelectedLayer] = useGraphicDraftState("EffectCraftWorkspace.jsx:selectedLayer", "shape");
  const [editingLayer, setEditingLayer] = useState(null);
  // Edição do texto direto no canvas: { layerId, draft, original }.
  const [textEditing, setTextEditing] = useState(null);
  const [layerSearch, setLayerSearch] = useState("");
  const [loopPlayback, setLoopPlayback] = useState(true);
  const loopRef = useRef(loopPlayback);
  loopRef.current = loopPlayback;
  const [cameraLightTool, setCameraLightTool] = useState("Câmera");
  const [toolFlyout, setToolFlyout] = useState(null);
  const [askText, textPromptDialog] = useTextPrompt();
  const [layerNameDraft, setLayerNameDraft] = useGraphicDraftState("EffectCraftWorkspace.jsx:layerNameDraft", "");
  const [parentDrag, setParentDrag] = useState(null);
  const [layers, setLayers] = useGraphicDraftState("EffectCraftWorkspace.jsx:layers", [
    {
      id: "lower-third",
      name: "Lower Third",
      kind: "▰",
      color: "bg-[#8c7658]",
      visible: true,
      locked: false,
      start: 6.5,
      duration: 3.2,
    },
    {
      id: "text",
      name: "MMEffect",
      kind: "T",
      color: "bg-[#a9343c]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "tagline",
      name: "Tagline",
      kind: "T",
      color: "bg-[#8f2b32]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "accent",
      name: "Accent Line",
      kind: "★",
      color: "bg-[#536bc4]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "burst",
      name: "Tick Burst",
      kind: "★",
      color: "bg-[#5875d9]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "rings",
      name: "Orbit Rings",
      kind: "★",
      color: "bg-[#667ce2]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "shape",
      name: "Controller",
      kind: "□",
      color: "bg-[#a9343c]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "background",
      name: "Background",
      kind: "■",
      color: "bg-[#a9343c]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
  ]);
  const introLayers = useRef(layers);
  const [transform, setTransform] = useGraphicDraftState("EffectCraftWorkspace.jsx:transform", {
    x: 960,
    y: 540,
    scale: 100,
    rotation: 0,
    opacity: 100,
  });
  const [effectParams, setEffectParams] = useGraphicDraftState("EffectCraftWorkspace.jsx:effectParams", {});
  const [compStore, setCompStore] = useGraphicDraftState("EffectCraftWorkspace.jsx:compositions", {});
  const [snapping, setSnapping] = useGraphicDraftState("EffectCraftWorkspace.jsx:snapping", true);
  const [showGrid, setShowGrid] = useGraphicDraftState("EffectCraftWorkspace.jsx:showGrid", false);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeProperty, setActiveProperty] = useState("x");
  const [, setHistoryVersion] = useState(0);
  const frameRef = useRef(null);
  const documentState = useMemo(
    () => ({ composition, layers, transform, propertyKeyframes, markers, appliedEffects, canvasBox, effectParams, compStore }),
    [composition, layers, transform, propertyKeyframes, markers, appliedEffects, canvasBox, effectParams, compStore],
  );
  const history = useRef(null);
  if (!history.current) history.current = { undo: [], redo: [], last: documentState, gesture: null, pendingKey: null, lastKey: null, lastTime: 0 };

  // Histórico por instantâneos do documento (como o History do EffectCraft): cada edição
  // empilha o estado anterior; um gesto contínuo (arrasto) ou edições seguidas da mesma
  // propriedade viram um único passo.
  useEffect(() => {
    const state = history.current;
    if (sameDocument(state.last, documentState)) {
      state.last = documentState;
      return;
    }
    const now = Date.now();
    const merged = state.gesture?.recorded
      || (state.pendingKey && state.pendingKey === state.lastKey && now - state.lastTime < 800);
    if (!merged) {
      state.undo.push(state.last);
      if (state.undo.length > HISTORY_LIMIT) state.undo.shift();
      state.redo = [];
      if (state.gesture) state.gesture.recorded = true;
      setHistoryVersion((value) => value + 1);
    }
    state.lastKey = state.pendingKey;
    state.lastTime = now;
    state.pendingKey = null;
    state.last = documentState;
  }, [documentState]);

  function mergeHistoryAs(key) {
    history.current.pendingKey = key;
  }

  function beginHistoryGesture() {
    history.current.gesture = { recorded: false };
  }

  function endHistoryGesture() {
    history.current.gesture = null;
  }

  function applyDocument(snapshot) {
    setComposition(snapshot.composition);
    setLayers(snapshot.layers);
    setTransform(snapshot.transform);
    setPropertyKeyframes(snapshot.propertyKeyframes);
    setMarkers(snapshot.markers);
    setAppliedEffects(snapshot.appliedEffects);
    setCanvasBox(snapshot.canvasBox);
    setEffectParams(snapshot.effectParams);
    setCompStore(snapshot.compStore);
    if (selectedLayer && !snapshot.layers.some((layer) => layer.id === selectedLayer)) setSelectedLayer(null);
    setSelectedKeyframe(null);
  }

  function undo() {
    const state = history.current;
    const previous = state.undo.pop();
    if (!previous) {
      setStatusMessage("Nada para desfazer.");
      return;
    }
    state.redo.push(state.last);
    state.last = previous;
    state.lastKey = null;
    applyDocument(previous);
    setHistoryVersion((value) => value + 1);
    setStatusMessage("Ação desfeita.");
  }

  function redo() {
    const state = history.current;
    const next = state.redo.pop();
    if (!next) {
      setStatusMessage("Nada para refazer.");
      return;
    }
    state.undo.push(state.last);
    state.last = next;
    state.lastKey = null;
    applyDocument(next);
    setHistoryVersion((value) => value + 1);
    setStatusMessage("Ação refeita.");
  }

  useEffect(() => {
    if (!playing || !active) return;
    // "Repetir" desligado: a reprodução para no último quadro em vez de voltar ao início.
    const timer = setInterval(
      () => setPlayhead((old) => (old >= COMP_DURATION ? (loopRef.current ? 0 : COMP_DURATION) : Math.min(COMP_DURATION, old + 0.1))),
      100,
    );
    return () => clearInterval(timer);
  }, [playing, active]);

  useEffect(() => {
    if (playing && !loopPlayback && playhead >= COMP_DURATION) setPlaying(false);
  }, [playing, loopPlayback, playhead]);

  useEffect(() => {
    if (!toolFlyout) return undefined;
    const close = (event) => {
      if (!event.target.closest?.("[data-effect-flyout]")) setToolFlyout(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [toolFlyout]);

  useEffect(() => {
    const layouts = {
      Padrão: ["Controles de efeitos", "Informações", "Propriedades", false],
      Animação: ["Efeitos e predefinições", "Pré-visualização", "Efeitos e predefinições", true],
      Standard: ["Projeto", "Pré-visualização", "Efeitos e predefinições", false],
      "Tela pequena": ["Projeto", "Pré-visualização", "Propriedades", false],
    };
    const [left, top, right, graph] = layouts[workspace];
    setLeftPanel(left);
    setRightTopPanel(top);
    setRightBottomPanel(right);
    setBottomPanel("Timeline");
    setGraphEditor(graph);
  }, [workspace]);

  const visibleEffectGroups = useMemo(() => Object.entries(EFFECT_GROUPS).map(([group, effects]) => [group, effects.filter(effect => effect.toLowerCase().includes(search.toLowerCase()))]).filter(([group, effects]) => effects.length || group.toLowerCase().includes(search.toLowerCase())), [search]);
  const activeLayer = layers.find((layer) => layer.id === selectedLayer);
  const [maskSelected, setMaskSelected] = useState(false);
  const displayTransform = useMemo(() => {
    const animated = propertyKeyframes[selectedLayer] || {};
    return Object.fromEntries(Object.entries(transform).map(([property, fallback]) => [
      property,
      evaluateKeyframes(animated[property], playhead, fallback),
    ]));
  }, [playhead, propertyKeyframes, selectedLayer, transform]);
  const editingText = textEditing && activeLayer?.id === textEditing.layerId ? textEditing : null;
  // Nas composições de exemplo sem caixa de camada, a caixa aparece enquanto o texto é editado.
  const showLayerBox = composition === "EffectCraft Intro" || (!PRESET_COMPOSITIONS.includes(composition) && Boolean(activeLayer)) || Boolean(editingText);
  const taglineLayer = composition === "EffectCraft Intro" ? layers.find((layer) => layer.id === "tagline" && layer.kind === "T") : null;
  const timelineLayers = layerSearch.trim()
    ? layers.filter((layer) => layer.name.toLowerCase().includes(layerSearch.trim().toLowerCase()))
    : layers;
  const layerFilter = useMemo(() => {
    const filters = [];
    if (activeLayer && activeLayer.effectsEnabled !== false) filters.push(buildEffectFilter(appliedEffects, effectParams));
    if (activeLayer?.motionBlur) {
      const blur = motionBlurAmount(propertyKeyframes, activeLayer.id, transform, playhead);
      if (blur > 0.05) filters.push(`blur(${blur.toFixed(2)}px)`);
    }
    return filters.filter(Boolean).join(" ");
  }, [activeLayer, appliedEffects, effectParams, propertyKeyframes, transform, playhead]);
  const customCompositions = Object.keys(compStore).filter((name) => name !== PRESET_SHARED_KEY && !PRESET_COMPOSITIONS.includes(name));
  if (!PRESET_COMPOSITIONS.includes(composition) && !customCompositions.includes(composition)) customCompositions.push(composition);
  const timelineColumns = `18px repeat(6,18px) 22px 14px 18px 100px${showSwitches ? " repeat(8,16px)" : ""}${showModes ? " 60px 16px 80px 16px 80px" : ""}`;
  const timelinePanelWidth = 280 + (showSwitches ? 128 : 0) + (showModes ? 252 : 0);

  function beginLayerRename(layer) {
    setSelectedLayer(layer.id);
    setEditingLayer(layer.id);
    setLayerNameDraft(layer.name);
  }

  function commitLayerRename(layerId) {
    const nextName = layerNameDraft.trim();
    if (nextName) setLayerValue(layerId, "name", nextName);
    setEditingLayer(null);
  }

  function beginParentDrag(event, layerId) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setParentDrag({ layerId, x1: event.clientX, y1: event.clientY, x2: event.clientX, y2: event.clientY });
  }

  function moveParentDrag(event) {
    setParentDrag((current) => current ? { ...current, x2: event.clientX, y2: event.clientY } : current);
  }

  function finishParentDrag(targetId) {
    setParentDrag((current) => {
      if (current && current.layerId !== targetId) setLayerValue(current.layerId, "parent", targetId);
      return null;
    });
  }

  function finishParentDragAtPoint(event) {
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest?.("[data-parent-layer-id]");
    const targetId = target?.dataset.parentLayerId;
    if (targetId) finishParentDrag(targetId);
    else setParentDrag(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function addLayer(kind) {
    commitTextEdit();
    const id = crypto.randomUUID();
    const isText = kind === "Texto";
    setLayers((old) => [
      {
        id,
        name: `${kind} ${old.length + 1}`,
        kind: isText ? "T" : "▣",
        color: "bg-fuchsia-500",
        visible: true,
        locked: false,
        start: playhead,
        duration: 4,
        ...(isText ? { text: "" } : {}),
      },
      ...old,
    ]);
    setSelectedLayer(id);
    // Camada de texto nova já entra em edição com o foco no editor (letras não viram atalhos).
    if (isText) setTextEditing({ layerId: id, draft: "", original: "" });
  }

  function beginTextEdit(layer) {
    if (!layer || layer.kind !== "T" || layer.locked) return false;
    if (textEditing?.layerId === layer.id) return true;
    commitTextEdit();
    const current = layer.text ?? defaultLayerText(layer);
    setSelectedLayer(layer.id);
    setTextEditing({ layerId: layer.id, draft: current, original: current });
    return true;
  }

  function commitTextEdit() {
    if (!textEditing) return;
    const { layerId, draft, original } = textEditing;
    setTextEditing(null);
    // Cada confirmação é um passo próprio no histórico.
    if (draft !== original) setLayerValue(layerId, "text", draft);
  }

  function cancelTextEdit() {
    setTextEditing(null);
  }

  function projectSnapshot() {
    return {
      schema: "mmeffect-project/v1",
      savedAt: new Date().toISOString(),
      composition,
      layers,
      transform,
      propertyKeyframes,
      markers,
      appliedEffects,
      canvasBox,
      effectParams,
      compositions: compStore,
      selectedLayer,
      playhead,
    };
  }

  function saveProject() {
    try {
      const filename = `${slugify(composition)}.mmeffect.json`;
      downloadBlob(new Blob([JSON.stringify(projectSnapshot(), null, 2)], { type: "application/json" }), filename);
      setStatusMessage(`Projeto salvo no arquivo ${filename}.`);
    } catch {
      setStatusMessage("Não foi possível gerar o arquivo do projeto.");
    }
  }

  async function openProjectFile(file) {
    try {
      const project = JSON.parse(await file.text());
      if (project?.schema !== "mmeffect-project/v1" || !Array.isArray(project.layers) || typeof project.composition !== "string") throw new Error("inválido");
      applyDocument({
        composition: project.composition,
        layers: project.layers,
        transform: { ...DEFAULT_TRANSFORM, ...(project.transform || {}) },
        propertyKeyframes: project.propertyKeyframes || {},
        markers: Array.isArray(project.markers) ? project.markers : [],
        appliedEffects: Array.isArray(project.appliedEffects) ? project.appliedEffects : [],
        canvasBox: { ...DEFAULT_CANVAS_BOX, ...(project.canvasBox || {}) },
        effectParams: project.effectParams || {},
        compStore: project.compositions || {},
      });
      setSelectedLayer(project.layers.some((layer) => layer.id === project.selectedLayer) ? project.selectedLayer : project.layers[0]?.id ?? null);
      setStatusMessage(`Projeto ${file.name} aberto.`);
    } catch {
      setStatusMessage(`O arquivo ${file.name} não é um projeto MMEffect válido. Nada foi alterado.`);
    }
  }

  function importFiles(fileList) {
    const files = [...(fileList || [])];
    const projects = files.filter((file) => /\.mmeffect\.json$/i.test(file.name));
    const media = files.filter((file) => !projects.includes(file));
    projects.forEach(openProjectFile);
    if (media.length) onOpenFiles(media);
  }

  function newProject() {
    if (!window.confirm("Criar um novo projeto? A composição atual será descartada (salve o projeto antes, se precisar).")) return;
    setComposition("Composição 1");
    setLayers([]);
    setTransform(DEFAULT_TRANSFORM);
    setPropertyKeyframes({});
    setMarkers([]);
    setAppliedEffects([]);
    setCanvasBox(DEFAULT_CANVAS_BOX);
    setEffectParams({});
    setCompStore({});
    setSelectedLayer(null);
    setSelectedKeyframe(null);
    setPlayhead(0);
    setViewportOffset({ x: 0, y: 0 });
    setZoom(100);
    history.current = { ...history.current, undo: [], redo: [], lastKey: null, pendingKey: null };
    setHistoryVersion((value) => value + 1);
    setStatusMessage("Novo projeto criado.");
  }

  function currentCompositionData() {
    return { layers, propertyKeyframes, markers, appliedEffects, selectedLayer };
  }

  // window.prompt é bloqueado em painéis embutidos: a caixa de texto do app substitui.
  async function newComposition() {
    const existing = new Set([...PRESET_COMPOSITIONS, ...Object.keys(compStore), composition]);
    let index = 1;
    while (existing.has(`Composição ${index}`)) index += 1;
    const answer = await askText("Nome da nova composição (1920×1080, 10 s):", `Composição ${index}`);
    if (answer === null) return;
    const name = answer.trim();
    if (!name) return;
    if (existing.has(name)) {
      setStatusMessage(`Já existe uma composição chamada ${name}.`);
      return;
    }
    const leaving = PRESET_COMPOSITIONS.includes(composition)
      ? { [PRESET_SHARED_KEY]: { propertyKeyframes, markers } }
      : { [composition]: currentCompositionData() };
    setCompStore((old) => ({ ...old, ...leaving, [name]: { layers: [], propertyKeyframes: {}, markers: [], appliedEffects: [], selectedLayer: null } }));
    setComposition(name);
    setLayers([]);
    setPropertyKeyframes({});
    setMarkers([]);
    setAppliedEffects([]);
    setSelectedLayer(null);
    setSelectedKeyframe(null);
    setPlayhead(0);
    setGraphEditor(false);
    setStatusMessage(`Composição ${name} criada.`);
  }

  async function renameComposition() {
    if (PRESET_COMPOSITIONS.includes(composition)) {
      setStatusMessage("Composições de exemplo não podem ser renomeadas. Use Nova composição.");
      return;
    }
    const answer = await askText("Nome da composição:", composition);
    const name = answer?.trim();
    if (!name || name === composition) return;
    if (PRESET_COMPOSITIONS.includes(name) || compStore[name]) {
      setStatusMessage(`Já existe uma composição chamada ${name}.`);
      return;
    }
    setCompStore((old) => {
      const next = { ...old };
      if (next[composition]) {
        next[name] = next[composition];
        delete next[composition];
      }
      return next;
    });
    setComposition(name);
  }

  function addKeyframeAtPlayhead() {
    if (!selectedLayer) {
      setStatusMessage("Selecione uma camada para adicionar o quadro-chave.");
      return;
    }
    const property = selectedKeyframe?.layerId === selectedLayer ? selectedKeyframe.property : activeProperty;
    const time = Math.round(playhead * 100) / 100;
    const value = displayTransform[property];
    setPropertyKeyframes((old) => {
      const layerFrames = old[selectedLayer] || {};
      const frames = layerFrames[property] || [];
      const nextFrames = frames.some((frame) => frame.time === time)
        ? frames.map((frame) => frame.time === time ? { ...frame, value } : frame)
        : [...frames, { time, value, interpolation: "linear" }];
      return { ...old, [selectedLayer]: { ...layerFrames, [property]: nextFrames } };
    });
    setStatusMessage(`Quadro-chave de ${property} adicionado em ${time.toFixed(2)}s.`);
  }

  function resetLayerTransform() {
    setTransform(DEFAULT_TRANSFORM);
    if (selectedLayer) {
      setPropertyKeyframes((old) => {
        if (!old[selectedLayer]) return old;
        const layerFrames = { ...old[selectedLayer] };
        TRANSFORM_PROPERTIES.forEach((property) => delete layerFrames[property]);
        return { ...old, [selectedLayer]: layerFrames };
      });
      setLayers((old) => old.map((layer) => layer.id === selectedLayer && layer.anchor ? { ...layer, anchor: null } : layer));
    }
    setStatusMessage("Transformação da camada redefinida.");
  }

  function anchorLabel(layer) {
    if (!layer?.anchor) return "960, 540";
    return `${Math.round(layer.anchor.x / 100 * canvasBox.w / 100 * 1920)}, ${Math.round(layer.anchor.y / 100 * canvasBox.h / 100 * 1080)}`;
  }

  function getRenderScene() {
    return {
      composition,
      layer: activeLayer || null,
      tagline: taglineLayer && taglineLayer.id !== activeLayer?.id ? taglineLayer : null,
      showBox: showLayerBox,
      canvasBox,
      transform,
      propertyKeyframes,
      appliedEffects,
      effectParams,
      particleEnabled: appliedEffects.includes("CC Particle World"),
      imageUrl: selected?.type?.startsWith("image") ? selected.url : null,
      viewerWidth: frameRef.current?.clientWidth || 800,
      viewportWidth: typeof window === "undefined" ? 1280 : window.innerWidth,
      duration: COMP_DURATION,
    };
  }

  function stepPlayhead(delta) {
    setPlaying(false);
    setPlayhead((old) => Math.max(0, Math.min(COMP_DURATION, Math.round((old + delta) * FPS) / FPS)));
  }

  function runMenuCommand(command) {
    setOpenMenu(null);
    if (command === "Importar mídia") document.getElementById("mmeffect-import")?.click();
    else if (command === "Novo projeto") newProject();
    else if (command === "Salvar projeto") saveProject();
    else if (command === "Desfazer") undo();
    else if (command === "Refazer") redo();
    else if (command === "Adicionar à fila de renderização") setBottomPanel("Fila de renderização");
    else if (command === "Nova composição") newComposition();
    else if (command === "Configurações da composição") renameComposition();
    else if (command === "Adicionar marcador") setMarkers(old=>[...old,playhead]);
    else if (command === "Adicionar quadro-chave") addKeyframeAtPlayhead();
    else if (command === "Assistente de quadro-chave") {
      if (selectedKeyframe) { setKeyframeInterpolation("easy-ease"); setStatusMessage("Suavização aplicada ao quadro-chave selecionado."); }
      else setStatusMessage("Selecione um quadro-chave na timeline para aplicar a suavização.");
    }
    else if (command === "Ajustar composição") { setZoom(100); setViewportOffset({ x: 0, y: 0 }); }
    else if (command === "Mostrar grades") setShowGrid((value) => !value);
    else if (command === "Atalhos do MMEffect") setStatusMessage("Atalhos: V Seleção · H Mão · Q Forma · G Caneta · T Texto · C Câmera · L Luz · W Rotação · Y Âncora · Z Zoom · Ctrl+Z/Ctrl+Shift+Z · Ctrl+S · Ctrl+D · Delete.");
    else if (command === "Sobre o MMEffect") setStatusMessage("MMEffect — editor de animação e efeitos do MediaMind.");
    else if (command === "Nova camada de texto") addLayer("Texto");
    else if (command === "Nova camada de forma") addLayer("Forma");
    else if (command === "Nova câmera") addLayer("Câmera");
    else if (command === "Nova luz") addLayer("Luz");
    else if (command === "Efeitos e predefinições") setRightBottomPanel("Efeitos e predefinições");
    else if (command === "Controles de efeitos") setLeftPanel("Controles de efeitos");
    else if (command === "Remover todos os efeitos") setAppliedEffects([]);
    else if (command === "Editor de gráficos") setGraphEditor(value=>!value);
    else if (command === "Projeto") setLeftPanel("Projeto");
    else if (command === "Propriedades") setRightBottomPanel("Propriedades");
    else if (command === "100%") setZoom(100);
    else if (command === "Excluir camada" && selectedLayer) setLayers(old=>old.filter(layer=>layer.id!==selectedLayer));
    else if (command === "Duplicar camada" && activeLayer) setLayers(old=>[{...activeLayer,id:crypto.randomUUID(),name:`${activeLayer.name} cópia`},...old]);
  }

  // Ferramentas de um clique do MCP (grade de ícones no Copiloto): planejam sobre o documento atual e
  // gravam o resultado de uma vez; o histórico por instantâneos registra isso como um passo de desfazer.
  const toolState = useRef(null);
  toolState.current = { layers, selectedLayer, transform, propertyKeyframes, markers, appliedEffects, effectParams };
  const toolActions = useRef(null);
  toolActions.current = {
    setters: { layers: setLayers, transform: setTransform, propertyKeyframes: setPropertyKeyframes, markers: setMarkers, appliedEffects: setAppliedEffects, effectParams: setEffectParams },
    undo,
    setStatusMessage,
    // O histórico por instantâneos grava depois do redesenho: lê ao vivo (ou a marca da última aplicação).
    canUndo: false,
  };
  useEffect(() => {
    if (!active) return undefined;
    const strip = ({ patch: _patch, ...result }) => result;
    return registerMCPActions({
      source: "mmeffects",
      label: "MMEffects",
      catalogue: mmeffectsCatalogue,
      analyze: async (toolId, params) => {
        const result = runMMEffectsTool(toolId, toolState.current, params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const result = runMMEffectsTool(toolId, toolState.current, params);
        if (result.ok) {
          const actions = toolActions.current;
          // Atualiza já o estado lido pela próxima operação de uma fila, antes do React redesenhar.
          toolState.current = { ...toolState.current, ...result.patch };
          for (const [key, value] of Object.entries(result.patch)) actions.setters[key](value);
          actions.canUndo = true;
          actions.setStatusMessage(`MCP · ${result.summary}`);
        }
        return strip(result);
      },
      undo: () => {
        if (!toolActions.current.canUndo && !history.current.undo.length) return false;
        toolActions.current.undo();
        return true;
      },
      canUndo: () => toolActions.current.canUndo || history.current.undo.length > 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function patchLayer(id, key) {
    setLayers((old) =>
      old.map((layer) =>
        layer.id === id ? { ...layer, [key]: !layer[key] } : layer,
      ),
    );
  }

  function setLayerValue(id, key, value) {
    setLayers(old=>old.map(layer=>layer.id===id?{...layer,[key]:value}:layer));
  }

  function toggleLayerMarker(id) {
    const time = Math.round(playhead * 100) / 100;
    setLayers((old) => old.map((layer) => {
      if (layer.id !== id) return layer;
      const layerMarkers = layer.markers || [];
      const exists = layerMarkers.includes(time);
      return { ...layer, markers: exists ? layerMarkers.filter((at) => at !== time) : [...layerMarkers, time] };
    }));
  }

  function toggleLayerExpanded(id) {
    setExpandedLayers(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id]);
  }

  function beginTimelineGesture(event, layer, mode) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayer(layer.id);
    timelineGesture.current = { id: layer.id, mode, startX: event.clientX, start: layer.start, duration: layer.duration };
    beginHistoryGesture();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveTimelineGesture(event) {
    const active = timelineGesture.current;
    if (!active) return;
    const delta = (event.clientX - active.startX) / 60;
    setLayers(old=>old.map(layer=>{
      if (layer.id !== active.id) return layer;
      if (active.mode === "move") {
        let start = Math.max(0,Math.min(9.9,active.start+delta));
        // "Ajustar": encaixa o início ou o fim da camada na agulha e nos marcadores.
        if (snapping) {
          const targets = [playhead, ...markers];
          const snappedStart = snapValue(start, targets, 0.1);
          const snappedEnd = snapValue(start + active.duration, targets, 0.1);
          if (snappedStart !== start) start = snappedStart;
          else if (snappedEnd !== start + active.duration) start = Math.max(0, snappedEnd - active.duration);
        }
        return {...layer,start,duration:Math.max(.1,Math.min(active.duration,10-start))};
      }
      if (active.mode === "trim-start") {
        const start = Math.max(0,Math.min(active.start+active.duration-.1,active.start+delta));
        return {...layer,start,duration:active.duration+(active.start-start)};
      }
      return {...layer,duration:Math.max(.1,Math.min(10-active.start,active.duration+delta))};
    }));
  }

  function togglePropertyKeyframe(property) {
    if (!selectedLayer) return;
    setActiveProperty(property);
    const time = Math.round(playhead*100)/100;
    setPropertyKeyframes(old=>{
      const layerFrames = old[selectedLayer] || {};
      const frames = layerFrames[property] || [];
      const exists = frames.some(frame=>frame.time===time);
      return {...old,[selectedLayer]:{...layerFrames,[property]:exists?frames.filter(frame=>frame.time!==time):[...frames,{time,value:displayTransform[property],interpolation:"linear"}]}};
    });
  }

  function changeTransform(property, nextValue) {
    const value = Number(nextValue);
    if (!Number.isFinite(value)) return;
    if (TRANSFORM_PROPERTIES.includes(property)) setActiveProperty(property);
    if (!history.current.gesture) mergeHistoryAs(`transform:${selectedLayer}:${property}`);
    setTransform((old) => ({ ...old, [property]: value }));
    if (!selectedLayer) return;
    const time = Math.round(playhead * 100) / 100;
    setPropertyKeyframes((old) => {
      const layerFrames = old[selectedLayer] || {};
      const frames = layerFrames[property] || [];
      if (!frames.length) return old;
      const existsAtTime = frames.some((frame) => frame.time === time);
      const nextFrames = existsAtTime
        ? frames.map((frame) => frame.time === time ? { ...frame, value } : frame)
        : [...frames, { time, value, interpolation: "linear" }];
      return {
        ...old,
        [selectedLayer]: { ...layerFrames, [property]: nextFrames },
      };
    });
  }

  function setKeyframeInterpolation(interpolation) {
    if (!selectedKeyframe) return;
    const {layerId,property,time}=selectedKeyframe;
    setPropertyKeyframes(old=>({...old,[layerId]:{...old[layerId],[property]:(old[layerId]?.[property]||[]).map(frame=>frame.time===time?{...frame,interpolation}:frame)}}));
  }

  function beginCanvasGesture(event, mode) {
    event.preventDefault();
    event.stopPropagation();
    gesture.current = { mode, startX: event.clientX, startY: event.clientY, box: canvasBox, offset: viewportOffset };
    beginHistoryGesture();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleEditorKey(event) {
    if (!active) return;
    if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const key = String(event.key || "").toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      saveProject();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (!selectedLayer || activeLayer?.locked) return;
      event.preventDefault();
      if (maskSelected && (activeLayer?.mask || activeLayer?.maskPath)) {
        setLayers(old => old.map(layer => layer.id === selectedLayer ? { ...layer, mask: null, maskPath: null } : layer));
        setMaskSelected(false);
        return;
      }
      setLayers(old => old.filter(layer => layer.id !== selectedLayer));
      setSelectedLayer(null);
    } else if ((event.ctrlKey || event.metaKey) && key === "d") {
      if (!activeLayer) return;
      event.preventDefault();
      const copy = { ...activeLayer, id: crypto.randomUUID(), name: `${activeLayer.name} cópia` };
      setLayers(old => [copy, ...old]);
      setSelectedLayer(copy.id);
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === "Enter" && activeLayer?.maskPath && !activeLayer.maskPath.closed && activeLayer.maskPath.points.length >= 3) {
        event.preventDefault();
        setLayerValue(activeLayer.id, "maskPath", { ...activeLayer.maskPath, closed: true });
        return;
      }
      const shortcut = TOOLS.find(([shortcutKey]) => shortcutKey.toLowerCase() === key);
      if (shortcut) { event.preventDefault(); selectTool(shortcut[1]); }
      if (event.key === "Escape") setSelectedLayer(null);
    }
  }
  const keyHandler = useRef(handleEditorKey);
  keyHandler.current = handleEditorKey;

  useEffect(() => {
    const listener = (event) => keyHandler.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  function layerPoint(element, event) {
    const bounds = element.getBoundingClientRect();
    const width = bounds.width || 1;
    const height = bounds.height || 1;
    return {
      bounds,
      x: Math.max(0, Math.min(100, (event.clientX - bounds.left) / width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - bounds.top) / height * 100)),
    };
  }

  function selectTool(name) {
    setTool(name);
    if (CAMERA_LIGHT_TOOLS.includes(name)) setCameraLightTool(name);
  }

  function useActiveTool(event) {
    // Cliques dentro do editor de texto não criam camadas nem mexem em ferramentas.
    if (event.target?.closest?.("[data-effect-text-editor]")) return;
    if (tool === "Seleção") return;
    // Texto sobre uma camada de texto existente: edita em vez de criar outra.
    if (tool === "Texto" && event.target?.closest?.("[data-effect-layer]") && beginTextEdit(activeLayer)) {
      event.preventDefault();
      return;
    }
    if (tool === "Mão") {
      beginCanvasGesture(event, "pan");
      return;
    }
    if (tool === "Zoom") {
      event.preventDefault();
      const out = event.altKey || event.shiftKey;
      setZoom((old) => Math.max(25, Math.min(200, old + (out ? -25 : 25))));
      return;
    }
    const element = event.currentTarget.querySelector('[data-effect-layer]');
    const editable = activeLayer && !activeLayer.locked && element;
    if (tool === "Forma" && editable) {
      const { bounds, x, y } = layerPoint(element, event);
      gesture.current = { mode: "mask", layerId: activeLayer.id, bounds, point: { x, y } };
      beginHistoryGesture();
      setMaskSelected(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (tool === "Caneta" && editable) {
      event.preventDefault();
      const { x, y } = layerPoint(element, event);
      const point = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
      const path = activeLayer.maskPath;
      let next;
      if (!path || path.closed) next = { points: [point], closed: false };
      else if (path.points.length >= 3 && Math.hypot(point.x - path.points[0].x, point.y - path.points[0].y) <= 3) next = { ...path, closed: true };
      else next = { ...path, points: [...path.points, point] };
      setLayerValue(activeLayer.id, "maskPath", next);
      setMaskSelected(true);
      return;
    }
    if (tool === "Rotação" && editable) {
      const bounds = element.getBoundingClientRect();
      const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      gesture.current = { mode: "rotate", center, startAngle: Math.atan2(event.clientY - center.y, event.clientX - center.x), rotation: displayTransform.rotation };
      beginHistoryGesture();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (tool === "Âncora" && editable) {
      const { bounds, x, y } = layerPoint(element, event);
      gesture.current = { mode: "anchor", layerId: activeLayer.id, bounds };
      beginHistoryGesture();
      setLayerValue(activeLayer.id, "anchor", { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    const layerKind = tool === "Caneta" ? "Forma" : tool;
    if (["Texto", "Forma", "Câmera", "Luz"].includes(layerKind)) {
      // Evita que o mousedown seguinte tire o foco do editor de texto recém-aberto.
      if (layerKind === "Texto") event.preventDefault();
      addLayer(layerKind);
    }
  }

  function placeAsset(event) {
    event.preventDefault();
    const asset = assets.find((item) => item.id === event.dataTransfer.getData("text/plain"));
    if (!asset) return;
    onSelect(asset);
    const id = crypto.randomUUID();
    setLayers((old)=>[{id,name:asset.name,kind:asset.type.startsWith("audio")?"♫":"▣",color:"bg-[#5671c7]",visible:true,locked:false,start:playhead,duration:Math.max(1,10-playhead)},...old]);
    setSelectedLayer(id);
  }

  function openComposition(name) {
    if (name === composition && !PRESET_COMPOSITIONS.includes(name)) return;
    const leavingCustom = !PRESET_COMPOSITIONS.includes(composition);
    const enteringCustom = !PRESET_COMPOSITIONS.includes(name);
    // Quadros-chave e marcadores das composições predefinidas ficam guardados enquanto
    // uma composição criada pelo usuário está aberta.
    if (leavingCustom) setCompStore((old) => ({ ...old, [composition]: currentCompositionData() }));
    else if (enteringCustom) setCompStore((old) => ({ ...old, [PRESET_SHARED_KEY]: { propertyKeyframes, markers } }));
    if (leavingCustom && !enteringCustom && compStore[PRESET_SHARED_KEY]) {
      setPropertyKeyframes(compStore[PRESET_SHARED_KEY].propertyKeyframes || {});
      setMarkers(compStore[PRESET_SHARED_KEY].markers || []);
    }
    setComposition(name);
    setPlayhead(name === "3D Showcase" ? 2 : 3);
    setGraphEditor(false);
    if (!PRESET_COMPOSITIONS.includes(name)) {
      const saved = compStore[name] || {};
      setLayers(saved.layers || []);
      setPropertyKeyframes(saved.propertyKeyframes || {});
      setMarkers(saved.markers || []);
      setAppliedEffects(saved.appliedEffects || []);
      setSelectedLayer(saved.selectedLayer ?? null);
      setPlayhead(0);
    } else if (name === "Particles") {
      setLayers([{id:"particles",name:"Particles",kind:"■",color:"bg-[#a9343c]",visible:true,locked:false,start:0,duration:10}]);
      setSelectedLayer("particles");
      setAppliedEffects(["CC Particle World"]);
      setLeftPanel("Controles de efeitos");
    } else if (name === "3D Showcase") {
      const names = [["caption","Caption","T"],["camera","Camera 1","⌁"],["key-light","Key Light","●"],["fill-light","Fill Light","●"],["title-3d","3D Title","T"],["card-blue","Card Blue","■"],["card-coral","Card Coral","■"],["cross-a","Cross A","■"],["cross-b","Cross B","■"],["floor","Floor","■"]];
      setLayers(names.map(([id,label,kind])=>({id,name:label,kind,color:id.includes("light")?"bg-[#e3b8c5]":"bg-[#a9343c]",visible:true,locked:false,start:0,duration:10})));
      setSelectedLayer("title-3d");
      setAppliedEffects(["Transformar"]);
      setLeftPanel("Projeto");
    } else {
      setLayers(introLayers.current);
      setSelectedLayer("text");
      setAppliedEffects(["Color Range", "Transformar"]);
    }
  }

  function moveCanvasGesture(event) {
    const active = gesture.current;
    if (!active) return;
    if (active.mode === "mask-edit") {
      const dx = (event.clientX - active.startX) / active.bounds.width * 100;
      const dy = (event.clientY - active.startY) / active.bounds.height * 100;
      const mask = { ...active.mask };
      if (active.edge === "move") { mask.left += dx; mask.right += dx; mask.top += dy; mask.bottom += dy; }
      else {
        if (active.edge.includes("w")) mask.left = Math.min(mask.right - 1, mask.left + dx);
        if (active.edge.includes("e")) mask.right = Math.max(mask.left + 1, mask.right + dx);
        if (active.edge.includes("n")) mask.top = Math.min(mask.bottom - 1, mask.top + dy);
        if (active.edge.includes("s")) mask.bottom = Math.max(mask.top + 1, mask.bottom + dy);
      }
      setLayers(old => old.map(layer => layer.id === active.layerId ? { ...layer, mask } : layer));
      return;
    }
    if (active.mode === "mask") {
      const x = (event.clientX - active.bounds.left) / active.bounds.width * 100;
      const y = (event.clientY - active.bounds.top) / active.bounds.height * 100;
      const mask = { left: Math.min(x, active.point.x), top: Math.min(y, active.point.y), right: Math.max(x, active.point.x), bottom: Math.max(y, active.point.y) };
      setLayers(old => old.map(layer => layer.id === active.layerId ? { ...layer, mask } : layer));
      return;
    }
    if (active.mode === "pan") {
      setViewportOffset({
        x: active.offset.x + event.clientX - active.startX,
        y: active.offset.y + event.clientY - active.startY,
      });
      return;
    }
    if (active.mode === "rotate") {
      const angle = Math.atan2(event.clientY - active.center.y, event.clientX - active.center.x);
      let rotation = active.rotation + (angle - active.startAngle) * 180 / Math.PI;
      rotation = ((rotation + 180) % 360 + 360) % 360 - 180;
      changeTransform("rotation", Math.round(rotation * 10) / 10);
      return;
    }
    if (active.mode === "anchor") {
      const width = active.bounds.width || 1;
      const height = active.bounds.height || 1;
      const x = Math.max(0, Math.min(100, (event.clientX - active.bounds.left) / width * 100));
      const y = Math.max(0, Math.min(100, (event.clientY - active.bounds.top) / height * 100));
      setLayerValue(active.layerId, "anchor", { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
      return;
    }
    const dx = (event.clientX - active.startX) / 8;
    const dy = (event.clientY - active.startY) / 5;
    if (active.mode === "resize") {
      setCanvasBox({ ...active.box, w: Math.max(18, Math.min(78, active.box.w + dx)), h: Math.max(10, Math.min(55, active.box.h + dy)) });
      return;
    }
    let x = active.box.x + dx;
    let y = active.box.y + dy;
    // "Ajustar": encaixa bordas e centro da camada nas bordas e no centro da composição.
    if (snapping) {
      const w = active.box.w;
      const h = active.box.h;
      const snappedX = snapValue(x, [0, 50 - w / 2, 100 - w]);
      const snappedY = snapValue(y, [0, 50 - h / 2, 100 - h]);
      x = snappedX;
      y = snappedY;
    }
    setCanvasBox({ ...active.box, x, y });
  }

  const compactWorkspace = workspace === "Tela pequena";
  const workspaceGrid = compactWorkspace
    ? "grid-cols-[0_minmax(0,1fr)_0] grid-rows-[minmax(340px,58%)_minmax(260px,42%)]"
    : workspace === "Animação"
      ? "grid-cols-[300px_minmax(520px,1fr)_300px] grid-rows-[minmax(300px,45%)_minmax(340px,55%)]"
      : "grid-cols-[290px_minmax(520px,1fr)_290px] grid-rows-[minmax(320px,52%)_minmax(300px,48%)]";
  const viewerCursor = tool === "Mão" ? "cursor-grab" : tool === "Texto" ? "cursor-text" : tool === "Seleção" ? "cursor-default" : "cursor-crosshair";

  return (
    <section className="h-screen min-h-[720px] overflow-hidden bg-[#1b1b1b] text-slate-200">
      <h1 className="sr-only">MMEffect</h1>
      <select aria-label="Área de trabalho do MMEffect" value={workspace} onChange={(event)=>setWorkspace(event.target.value)} className="sr-only">
        {["Padrão","Animação","Standard","Tela pequena"].map(item=><option key={item}>{item}</option>)}
      </select>
      <div className="flex h-7 items-center gap-0 overflow-x-auto border-b border-[#080808] bg-[#202020] px-1 text-[11px]">
        {Object.entries(APP_MENUS).map(([item,commands]) => (
          <div key={item} className="relative h-full shrink-0">
            <button data-effect-menu aria-haspopup="menu" onClick={(event)=>{const rect=event.currentTarget.getBoundingClientRect();setMenuPosition({left:rect.left,top:rect.bottom});setOpenMenu(openMenu===item?null:item)}} aria-expanded={openMenu===item} className={`h-full px-2 text-[#c8c8c8] hover:bg-[#343434] hover:text-white ${openMenu===item?'bg-[#343434] text-white':''}`}>{item}</button>
            {openMenu===item && typeof document !== "undefined" && createPortal(<div data-effect-menu role="menu" aria-label={`Menu ${item}`} className="fixed z-50 min-w-52 border border-[#555] bg-[#292929] py-1 text-[11px] text-slate-200 shadow-xl" style={{left:menuPosition.left,top:menuPosition.top}}>
              {commands.map(command=><button key={command} onClick={()=>runMenuCommand(command)} className="block w-full whitespace-nowrap px-4 py-1.5 text-left text-[11px] hover:bg-[#2675df] hover:text-white">{command}</button>)}
            </div>, document.body)}
          </div>
        ))}
      </div>

      <div role="toolbar" aria-label="Ferramentas do MMEffect" className="flex h-9 items-center gap-0.5 overflow-x-auto border-b border-[#080808] bg-[#202020] px-1">
        <span className="mr-1 grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-blue-400 to-violet-600 text-[10px] font-black">M</span>
        {TOOLS.filter(([, name]) => !CAMERA_LIGHT_TOOLS.includes(name) || name === "Câmera").map(([toolShortcut, toolName, ToolIcon]) => {
          const grouped = CAMERA_LIGHT_TOOLS.includes(toolName);
          const [shortcut, name, Icon] = grouped ? TOOLS.find(([, item]) => item === cameraLightTool) : [toolShortcut, toolName, ToolIcon];
          const button = (
            <button
              key={name}
              title={`${name} (${shortcut})`}
              aria-label={`${name} (${shortcut})`}
              aria-pressed={tool === name}
              onClick={() => selectTool(name)}
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-sm ${tool === name ? "bg-[#2675df] text-white" : "text-[#bdbdbd] hover:bg-[#353535]"}`}
            >
              <Icon size={15} />
            </button>
          );
          if (!grouped) return button;
          return (
            <span key="camera-light" data-effect-flyout className="flex shrink-0 items-center">
              {button}
              <button
                aria-label="Mais ferramentas de câmera e luz"
                title="Câmera (C) / Luz (L)"
                aria-haspopup="menu"
                aria-expanded={Boolean(toolFlyout)}
                onClick={(event) => {
                  const rect = event.currentTarget.parentElement.getBoundingClientRect();
                  setToolFlyout(toolFlyout ? null : { left: rect.left, top: rect.bottom });
                }}
                className="grid h-7 w-3 shrink-0 place-items-center rounded-sm text-[9px] text-[#bdbdbd] hover:bg-[#353535]"
              >
                ▾
              </button>
              {toolFlyout && typeof document !== "undefined" && createPortal(
                <div data-effect-flyout role="menu" aria-label="Câmera e luz" className="fixed z-50 min-w-36 border border-[#555] bg-[#292929] py-1 text-[11px] text-slate-200 shadow-xl" style={{ left: toolFlyout.left, top: toolFlyout.top }}>
                  {TOOLS.filter(([, item]) => CAMERA_LIGHT_TOOLS.includes(item)).map(([itemShortcut, item, ItemIcon]) => (
                    <button
                      key={item}
                      role="menuitemradio"
                      aria-checked={cameraLightTool === item}
                      aria-label={`${item} (${itemShortcut})`}
                      onClick={() => { selectTool(item); setToolFlyout(null); }}
                      className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left hover:bg-[#2675df] hover:text-white"
                    >
                      <ItemIcon size={13} />{item}<span className="ml-auto text-[#999]">{itemShortcut}</span>
                    </button>
                  ))}
                </div>,
                document.body,
              )}
            </span>
          );
        })}
        <span className="mx-1 h-5 w-px bg-[#555]" />
        <label className="flex items-center gap-2 px-2 text-[10px] text-slate-400"><input type="checkbox" aria-label="Ajustar (encaixe)" checked={Boolean(snapping)} onChange={(event)=>setSnapping(event.target.checked)} className="accent-blue-500"/> Ajustar</label>
        <span className="ml-auto flex h-full items-center text-[10px]">{["Padrão","Animação","Standard","Tela pequena"].map(item=><button key={item} onClick={()=>setWorkspace(item)} className={`h-full px-3 ${workspace===item?'border-b-2 border-blue-400 text-blue-300':'text-[#aaa] hover:text-white'}`}>{item}</button>)}</span>
        <label className="ml-2 cursor-pointer rounded bg-[#5663e8] px-3 py-1 text-[10px] font-bold text-white"><Upload className="mr-1 inline" size={11}/>Importar<input id="mmeffect-import" hidden multiple type="file" accept="video/*,image/*,audio/*,.json,application/json" onChange={(event)=>{importFiles(event.target.files);event.target.value=""}}/></label>
      </div>

      <div aria-label="Grade do workspace MMEffect" data-workspace={workspace} className={`grid h-[calc(100%-64px)] min-h-0 gap-px bg-[#080808] ${workspaceGrid}`}>
        <aside className={`row-span-1 flex min-h-0 flex-col overflow-hidden bg-[#202020] ${compactWorkspace ? "invisible" : ""}`}>
          <PanelTabs labels={["Projeto", "Controles de efeitos", "Efeitos e predefinições"]} active={leftPanel} onChange={setLeftPanel} />
          {leftPanel === "Projeto" ? <>
          <div className="flex items-center gap-2 border-b border-slate-800 p-2 text-[10px] text-slate-500"><FolderPlus size={13} /><span>Projeto MMEffect</span><span className="ml-auto">{assets.length} itens</span></div>
          <button onClick={()=>document.getElementById("mmeffect-import")?.click()} className="m-2 flex items-center justify-center gap-2 rounded border border-[#555] bg-[#292929] px-3 py-2 text-[10px] hover:border-blue-400 hover:bg-[#343434]"><Upload size={12}/>Importar mídia</button>
          <div className="border-b border-[#333] px-2 py-1 text-[9px] text-[#aaa]">Nome <span className="float-right">Tipo&nbsp;&nbsp;&nbsp;Tamanho</span></div>
          <div className="space-y-px p-1 text-[10px]">
            {[['3D Showcase','▣','Composição'],['EffectCraft Intro','▣','Composição'],['Particles','▣','Composição'],...customCompositions.map(name=>[name,'▣','Composição']),['Precomps','▱','Pasta'],['Solids','▱','Pasta']].map(([name,icon,type])=><button key={name} onDoubleClick={()=>type==='Composição'&&openComposition(name)} className={`grid w-full grid-cols-[18px_1fr_78px] items-center px-1 py-1 text-left hover:bg-[#353535] ${composition===name?'bg-[#3a3f46]':''}`}><span className={type==='Pasta'?'text-yellow-300':'text-violet-300'}>{icon}</span><span>{name}</span><span className="text-[#999]">{type}</span></button>)}
          </div>
          <div className="space-y-px p-1">
            {assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => onSelect(asset)}
                draggable
                onDragStart={(event)=>event.dataTransfer.setData("text/plain",asset.id)}
                className={`grid w-full grid-cols-[34px_1fr_70px] items-center gap-2 px-1 py-1 text-left ${selected?.id === asset.id ? "bg-[#315e89]" : "hover:bg-[#353535]"}`}
              >
                {asset.type.startsWith("image") ? (
                  <img
                    src={asset.url}
                    alt=""
                    className="h-7 w-8 object-cover"
                  />
                ) : (
                  <div className="grid h-7 w-8 place-items-center bg-black">
                    <Film size={13} />
                  </div>
                )}
                <span className="truncate text-[9px]">{asset.name}</span><span className="truncate text-[9px] text-[#999]">Mídia</span>
              </button>
            ))}
          </div>
          {!assets.length && (
            <p className="p-4 text-xs text-slate-500">
              Importe vídeos, imagens e áudio para o painel Projeto.
            </p>
          )}
          <div className="mt-auto border-t border-slate-800 p-2 text-[10px] text-slate-500">
            8 bpc <span className="float-right">▱　＋　⌫</span>
          </div>
          </> : leftPanel === "Controles de efeitos" ? <div className="p-3 text-[10px]">
            <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-3"><span className="grid h-6 w-6 place-items-center rounded bg-cyan-500 text-black">{activeLayer?.kind}</span><b className="truncate">{activeLayer?.name}</b></div>
            {appliedEffects.map((effect, index) => <EffectControl key={`${effect}-${index}`} effect={effect} transform={displayTransform} onTransformChange={changeTransform} values={effectParams[effect] || {}} onValueChange={(label,value)=>{mergeHistoryAs(`effect:${effect}:${label}`);setEffectParams(old=>({...old,[effect]:{...(old[effect]||{}),[label]:value}}))}} onReset={()=>{setEffectParams(old=>{const next={...old};delete next[effect];return next});if(!EFFECT_FIELDS[effect])resetLayerTransform()}} onRemove={()=>setAppliedEffects(old=>old.filter((_,i)=>i!==index))}/>) }
          </div> : <EffectsBrowser search={search} setSearch={setSearch} visibleEffectGroups={visibleEffectGroups} openEffectGroups={openEffectGroups} setOpenEffectGroups={setOpenEffectGroups} setAppliedEffects={setAppliedEffects} setLeftPanel={setLeftPanel} />}
        </aside>

        <main className="relative col-start-2 row-start-1 min-w-0 bg-[#171717]">
          <div className="flex h-full min-h-0 flex-col bg-black">
            <div className="flex items-center border-b border-slate-800 bg-[#151920] px-3 py-2 text-[10px]">
              <b>Composição: {composition}</b>
              {activeLayer && <label className="ml-3 flex items-center gap-2">Texto da camada<input aria-label="Texto da camada selecionada" disabled={activeLayer.locked} value={activeLayer.text ?? defaultLayerText(activeLayer)} onChange={event => setLayers(old => old.map(layer => layer.id === activeLayer.id ? { ...layer, text: event.target.value } : layer))} className="w-40 bg-[#252525] px-2 py-1"/></label>}
              {statusMessage && <span role="status" aria-label="Status do MMEffect" title={statusMessage} className="ml-3 min-w-0 truncate text-amber-300">{statusMessage}</span>}
              <span className="ml-auto shrink-0 text-slate-500">
                Visualização: Ativa · Resolução: Completa · {zoom}%
              </span>
            </div>
            <div aria-label="Visualizador da composição" onPointerDown={useActiveTool} onPointerMove={moveCanvasGesture} onPointerUp={()=>{gesture.current=null;endHistoryGesture()}} onDragOver={(event)=>event.preventDefault()} onDrop={placeAsset} className={`relative grid flex-1 place-items-center overflow-hidden bg-[#181818] p-4 ${viewerCursor}`}>
              <div ref={frameRef} aria-label="Quadro da composição" style={{transform:`translate(${viewportOffset.x}px, ${viewportOffset.y}px)${zoom !== 100 ? ` scale(${zoom/100})` : ""}`,...(numeric(activeLayer?.fontSize, NaN) > 0 || numeric(activeLayer?.lineHeight, NaN) > 0 ? {containerType:"inline-size"} : {})}} className={`relative aspect-video h-[88%] max-h-full max-w-[92%] overflow-hidden shadow-2xl ${composition==='Particles'?'bg-black':composition==='3D Showcase'?'bg-[linear-gradient(155deg,#080611,#15192a_58%,#07070c)]':'bg-[radial-gradient(circle_at_center,#14295c_0,#07122d_48%,#030713_100%)]'}`}>
                {selected?.type.startsWith("image") && (
                  <img
                    src={selected.url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-70"
                  />
                )}
                {composition === "Particles" && <ParticlePreview params={effectParams} enabled={appliedEffects.includes("CC Particle World")} />}
                {composition === "3D Showcase" && <ThreeDPreview />}
                <div className="absolute inset-8 border border-dashed border-indigo-300/50" />
                {showGrid && <div aria-label="Grade da composição" className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(148,163,184,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.25)_1px,transparent_1px)] bg-[size:10%_10%]" />}
                {showLayerBox && <>
                <div
                  aria-label={`Camada ${activeLayer?.name || "EFFECTCRAFT"} na composição`}
                  data-effect-layer
                  onPointerDown={(event)=>tool === "Seleção" && beginCanvasGesture(event,"move")}
                  onPointerMove={moveCanvasGesture}
                  onPointerUp={()=>{gesture.current=null;endHistoryGesture()}}
                  className="absolute cursor-move select-none border border-[#55a4ff] px-6 py-4 text-center"
                  style={{left:`${canvasBox.x}%`,top:`${canvasBox.y}%`,width:`${canvasBox.w}%`,height:`${canvasBox.h}%`,transform:`translate(${(displayTransform.x-960)/19.2}%, ${(displayTransform.y-540)/10.8}%) scale(${displayTransform.scale/100}) rotate(${displayTransform.rotation}deg)`,opacity:displayTransform.opacity/100,...(activeLayer?.anchor ? {transformOrigin:`${activeLayer.anchor.x}% ${activeLayer.anchor.y}%`} : {}),...(layerFilter ? {filter:layerFilter} : {}),...(activeLayer?.threeD ? {transformStyle:"preserve-3d"} : {})}}
                  data-motion-blur={activeLayer?.motionBlur ? "on" : undefined}
                  data-three-d={activeLayer?.threeD ? "on" : undefined}
                >
                  <div style={{clipPath: maskClipPath(activeLayer), ...layerAlignStyle(activeLayer)}}>
                  {editingText ? <textarea
                    autoFocus
                    data-effect-text-editor
                    aria-label="Editar texto da camada"
                    placeholder="Digite o texto"
                    rows={1}
                    value={editingText.draft}
                    onChange={(event) => setTextEditing((current) => current && { ...current, draft: event.target.value })}
                    onBlur={commitTextEdit}
                    onPointerDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") { event.preventDefault(); cancelTextEdit(); }
                      else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); commitTextEdit(); }
                    }}
                    className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-center text-[clamp(24px,4vw,62px)] font-black tracking-[0.04em] text-white caret-white outline-none ring-1 ring-[#55a4ff]/60 drop-shadow-[0_0_8px_rgba(255,255,255,.7)] placeholder:text-white/40"
                    style={{ ...layerTextStyle(activeLayer), ...layerAlignStyle(activeLayer) }}
                  /> : <span aria-label="Texto renderizado da camada" onDoubleClick={() => beginTextEdit(activeLayer)} className="block text-[clamp(24px,4vw,62px)] font-black tracking-[0.04em] text-white drop-shadow-[0_0_8px_rgba(255,255,255,.7)]" style={layerTextStyle(activeLayer)}>
                    {textAt(activeLayer, playhead)}
                  </span>}
                  {taglineLayer && taglineLayer.id !== activeLayer?.id && <span aria-label={`Texto da camada ${taglineLayer.name}`} className="text-sm tracking-[0.4em] text-cyan-300">
                    {textAt(taglineLayer, playhead)}
                  </span>}
                  </div>
                  {activeLayer?.maskPath?.points?.length > 0 && <svg aria-label="Traçado da caneta" data-closed={activeLayer.maskPath.closed ? "true" : "false"} className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {activeLayer.maskPath.closed
                      ? <polygon points={activeLayer.maskPath.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#facc15" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                      : <polyline points={activeLayer.maskPath.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#facc15" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
                    {activeLayer.maskPath.points.map((point, index) => <rect key={index} x={point.x - 0.8} y={point.y - 1.4} width="1.6" height="2.8" fill="#facc15" />)}
                  </svg>}
                  {activeLayer?.mask && <div
                    aria-label="Máscara da camada"
                    onPointerDown={event => {
                      event.preventDefault(); event.stopPropagation();
                      if (activeLayer.locked) return;
                      setMaskSelected(true);
                      gesture.current = { mode: "mask-edit", layerId: activeLayer.id, edge: event.target.dataset.edge || "move", mask: { ...activeLayer.mask }, bounds: event.currentTarget.parentElement.getBoundingClientRect(), startX: event.clientX, startY: event.clientY };
                      beginHistoryGesture();
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                    }}
                    className="absolute z-20 cursor-move border border-yellow-400"
                    style={{left:`${activeLayer.mask.left}%`,top:`${activeLayer.mask.top}%`,width:`${activeLayer.mask.right-activeLayer.mask.left}%`,height:`${activeLayer.mask.bottom-activeLayer.mask.top}%`}}
                  >
                    {[['nw',0,0],['n',50,0],['ne',100,0],['e',100,50],['se',100,100],['s',50,100],['sw',0,100],['w',0,50]].map(([edge,x,y]) => <button key={edge} data-edge={edge} aria-label={`Redimensionar máscara ${edge}`} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-yellow-400" style={{left:`${x}%`,top:`${y}%`,cursor:`${edge}-resize`}}/>)}
                    <button aria-label="Excluir máscara" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setLayers(old => old.map(layer => layer.id === activeLayer.id ? {...layer,mask:null} : layer)); setMaskSelected(false); }} className="absolute -top-7 left-0 whitespace-nowrap bg-[#252525] px-2 text-xs text-yellow-300">Excluir máscara</button>
                  </div>}
                  <i className="absolute -left-1 -top-1 h-2 w-2 bg-indigo-300" />
                  <button aria-label="Redimensionar camada" onPointerDown={(event)=>{event.stopPropagation();beginCanvasGesture(event,"resize")}} onPointerMove={moveCanvasGesture} onPointerUp={()=>{gesture.current=null;endHistoryGesture()}} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize bg-[#55a4ff]" />
                </div>
                {composition === "EffectCraft Intro" && <>
                <Circle
                  className="absolute right-[18%] top-[30%] text-fuchsia-400"
                  size={110}
                  strokeWidth={0.7}
                />
                <Box
                  className="absolute bottom-[18%] right-[28%] text-cyan-300"
                  size={64}
                  strokeWidth={1}
                />
                </>}
                </>}
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-800 bg-[#151920] p-2 text-[10px]">
              <button
                onClick={() => setPlaying(!playing)}
                className="rounded bg-indigo-500 p-2"
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <span className="font-mono text-indigo-300">
                {formatTimecode(playhead)}
              </span>
              <input
                type="range"
                min="25"
                max="200"
                value={zoom}
                onChange={(e) => setZoom(+e.target.value)}
                className="ml-auto accent-indigo-400"
              />
              <span>{zoom}%</span>
            </div>
          </div>
        </main>

          <div className="col-span-2 col-start-1 row-start-2 overflow-hidden bg-[#11151b]">
            <div className="flex border-b border-slate-800 bg-[#181c23] text-[10px] font-semibold"><button onClick={()=>setBottomPanel("Timeline")} className={`px-3 py-2 ${bottomPanel === "Timeline" ? "border-b-2 border-blue-500 text-white" : "text-slate-500"}`}>{composition}</button><button onClick={()=>setBottomPanel("Fila de renderização")} className={`px-3 py-2 ${bottomPanel === "Fila de renderização" ? "border-b-2 border-blue-500 text-white" : "text-slate-500"}`}>Fila de renderização</button></div>
            {bottomPanel === "Timeline" ? <>
            <div className="flex items-center gap-3 border-b border-slate-800 p-2 text-[10px]">
              <b className="text-white">{composition}</b>
              <span className="font-mono text-xl text-[#33a3ff]">{formatTimecode(playhead)}</span>
              <label className="ml-2 flex items-center gap-2 rounded-full bg-[#171b22] px-3 py-1"><Search size={12}/><input aria-label="Pesquisar camadas" placeholder="Pesquisar" value={layerSearch} onChange={(event)=>setLayerSearch(event.target.value)} className="w-24 bg-transparent outline-none"/></label>
              <button onClick={()=>setShowSwitches(value=>!value)} aria-pressed={showSwitches} className={`ml-auto rounded px-2 py-1 ${showSwitches?'bg-[#2675df]':'bg-[#30343b]'}`}>Switches</button>
              <button onClick={()=>setShowModes(value=>!value)} aria-pressed={showModes} className={`rounded px-2 py-1 ${showModes?'bg-[#2675df]':'bg-[#30343b]'}`}>Modos</button>
              <button onClick={()=>setGraphEditor(value=>!value)} aria-pressed={graphEditor} className={`rounded border px-2 py-1 ${graphEditor?'border-blue-400 bg-blue-500/20 text-blue-200':'border-slate-700'}`}>Editor de gráficos</button>
            </div>
            <div className="relative flex h-7 text-[9px] text-slate-500" style={{paddingLeft:timelinePanelWidth}}>
              {[0, 2, 4, 6, 8, 10].map((tick) => (
                <button
                  key={tick}
                  onClick={() => setPlayhead(tick)}
                  className="flex-1 border-l border-slate-700 text-left"
                >
                  {tick}s
                </button>
              ))}
              {markers.map((at)=><button key={`comp-marker-${at}`} aria-label={`Marcador da composição em ${at.toFixed(2)}s`} onClick={()=>setPlayhead(at)} className="absolute bottom-0 z-20 h-3 w-2 -translate-x-1/2 bg-[#79a9d8] [clip-path:polygon(0_0,100%_0,50%_100%)]" style={{left:`calc(${timelinePanelWidth}px + (100% - ${timelinePanelWidth}px) * ${at/10})`}} />)}
              <input aria-label="Agulha da timeline" type="range" min="0" max="10" step="0.01" value={playhead} onChange={event=>setPlayhead(Number(event.target.value))} className="absolute bottom-0 top-0 z-10 h-full cursor-ew-resize opacity-0" style={{left:timelinePanelWidth,width:`calc(100% - ${timelinePanelWidth}px)`}}/>
            </div>
            <div className="relative">
              <div className="flex h-7 border-t border-[#3c3c3c] bg-[#242424] text-[11px] text-[#a9a9a9]">
                <div className="grid shrink-0 items-center border-r border-[#3b3b3b]" style={{width:timelinePanelWidth,gridTemplateColumns:timelineColumns}}>
                  <span/><span className="grid place-items-center"><EffectIcon name="eye"/></span><span className="grid place-items-center"><EffectIcon name="speaker"/></span><span className="grid place-items-center"><EffectIcon name="solo"/></span><span className="grid place-items-center"><EffectIcon name="lock"/></span><span className="grid place-items-center"><EffectIcon name="keyframe"/></span><span/><span className="text-center">#</span><span/>
                  <span className="px-2 text-[12px]">Layer Name</span>
                  {showSwitches && ["shy","collapse","quality","fx","frameBlend","motionBlur","adjustment","cube"].map(name=><span key={name} className="grid place-items-center"><EffectIcon name={name}/></span>)}
                  {showModes && <><span className="px-1 text-[11px]">Mode</span><span className="text-center">T</span><span className="px-1 text-[11px]">Track Matte</span><span className="grid place-items-center"><EffectIcon name="pickWhip"/></span><span className="px-1 text-[11px]">Parent &amp; Link</span></>}
                </div>
                <div className="flex-1 bg-[linear-gradient(90deg,transparent_98%,#334155_98%)] bg-[size:10%_100%]"/>
              </div>
              {timelineLayers.map((layer) => (
                <div
                  key={layer.id}
                  className={`flex min-h-7 flex-wrap border-t border-[#333] ${selectedLayer === layer.id ? "bg-[#454545]" : ""}`}
                >
                  <div className="grid h-7 shrink-0 items-center border-r border-[#3b3b3b] bg-[#202020] text-[10px]" style={{width:timelinePanelWidth,gridTemplateColumns:timelineColumns}}>
                    <span/>
                    <button aria-label={`${layer.visible?"Ocultar":"Mostrar"} ${layer.name}`} aria-pressed={Boolean(layer.visible)} className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${layer.visible?"text-[#bcbcbc]":"text-[#555]"}`} onClick={() => patchLayer(layer.id, "visible")}>
                      <EffectIcon name="eye" />
                    </button>
                    <button aria-label={`${layer.audioMuted?"Ativar":"Silenciar"} áudio de ${layer.name}`} aria-pressed={Boolean(layer.audioMuted)} onClick={() => patchLayer(layer.id, "audioMuted")} className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${layer.audioMuted?"text-[#555]":"text-[#bcbcbc]"}`}><EffectIcon name="speaker"/></button>
                    <button aria-label={`${layer.solo?"Desativar":"Ativar"} solo de ${layer.name}`} aria-pressed={Boolean(layer.solo)} onClick={() => patchLayer(layer.id, "solo")} className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${layer.solo?"text-[#d7d7d7]":"text-[#555]"}`}><EffectIcon name="solo"/></button>
                    <button
                      onClick={() => patchLayer(layer.id, "locked")}
                      className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${layer.locked?"text-[#bcbcbc]":"text-transparent"}`}
                    >
                      <EffectIcon name="lock" />
                    </button>
                    <button aria-label={`${(layer.markers||[]).includes(Math.round(playhead*100)/100)?"Remover":"Adicionar"} marcador de ${layer.name}`} aria-pressed={(layer.markers||[]).includes(Math.round(playhead*100)/100)} onClick={() => toggleLayerMarker(layer.id)} className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${(layer.markers||[]).length?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="keyframe"/></button>
                    <span className={`mx-auto h-4 w-4 rounded-[3px] ${layer.color}`}/>
                    <span className="text-center text-[#aaa]">{layers.indexOf(layer) + 1}</span>
                    <button aria-label={`${expandedLayers.includes(layer.id)?"Recolher":"Expandir"} propriedades de ${layer.name}`} onClick={()=>toggleLayerExpanded(layer.id)} className="grid place-items-center text-[#999]"><EffectIcon name={expandedLayers.includes(layer.id)?"chevronDown":"chevronRight"}/></button>
                    <span className="grid place-items-center text-[#858585]"><EffectIcon name="footage"/></span>
                    {editingLayer === layer.id ? <input
                      autoFocus
                      aria-label={`Renomear ${layer.name}`}
                      value={layerNameDraft}
                      onChange={(event)=>setLayerNameDraft(event.target.value)}
                      onBlur={()=>commitLayerRename(layer.id)}
                      onKeyDown={(event)=>{if(event.key==="Enter")commitLayerRename(layer.id);if(event.key==="Escape")setEditingLayer(null)}}
                      className="h-5 min-w-0 border border-[#4c98d8] bg-[#111] px-1.5 text-[#f0f0f0] outline-none"
                    /> : <button
                      data-parent-layer-id={layer.id}
                      onClick={() => setSelectedLayer(layer.id)}
                      onDoubleClick={() => beginLayerRename(layer)}
                      onPointerUp={() => finishParentDrag(layer.id)}
                      className="h-5 truncate border border-[#111] bg-[#2b2b2b] px-1.5 text-left text-[#d0d0d0]"
                    >
                      {layer.name}
                    </button>}
                    {showSwitches && <>
                    <button aria-label={`Camada tímida de ${layer.name}`} aria-pressed={Boolean(layer.shy)} onClick={()=>patchLayer(layer.id,"shy")} className={`grid place-items-center ${layer.shy?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="shy"/></button>
                    <button aria-label={`Recolher transformações de ${layer.name}`} aria-pressed={Boolean(layer.collapse)} onClick={()=>patchLayer(layer.id,"collapse")} className={`grid place-items-center ${layer.collapse?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="collapse"/></button>
                    <button aria-label={`Qualidade de ${layer.name}`} aria-pressed={Boolean(layer.bestQuality)} onClick={()=>patchLayer(layer.id,"bestQuality")} className={`grid place-items-center ${layer.bestQuality?"text-[#bcbcbc]":"text-[#777]"}`}><EffectIcon name="quality"/></button>
                    <button aria-label={`Efeitos de ${layer.name}`} aria-pressed={layer.effectsEnabled!==false} onClick={()=>setLayerValue(layer.id,"effectsEnabled",layer.effectsEnabled===false)} className={`grid place-items-center ${layer.effectsEnabled===false?"text-[#555]":"text-[#bcbcbc]"}`}><EffectIcon name="fx"/></button>
                    <button aria-label={`Mesclagem de quadros de ${layer.name}`} aria-pressed={Boolean(layer.frameBlend)} onClick={()=>patchLayer(layer.id,"frameBlend")} className={`grid place-items-center ${layer.frameBlend?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="frameBlend"/></button>
                    <button aria-label={`Desfoque de movimento de ${layer.name}`} aria-pressed={Boolean(layer.motionBlur)} onClick={()=>patchLayer(layer.id,"motionBlur")} className={`grid place-items-center ${layer.motionBlur?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="motionBlur"/></button>
                    <button aria-label={`Ajuste de camada de ${layer.name}`} aria-pressed={Boolean(layer.adjustment)} onClick={()=>patchLayer(layer.id,"adjustment")} className={`grid place-items-center ${layer.adjustment?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="adjustment"/></button>
                    <button aria-label={`Camada 3D de ${layer.name}`} aria-pressed={Boolean(layer.threeD)} onClick={()=>patchLayer(layer.id,"threeD")} className={`grid place-items-center ${layer.threeD?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="cube"/></button>
                    </>}
                    {showModes && <>
                    <select aria-label={`Modo de mesclagem de ${layer.name}`} value={layer.blendMode||"normal"} onChange={event=>setLayerValue(layer.id,"blendMode",event.target.value)} className="mx-1 h-5 border border-[#111] bg-[#171717] px-1 text-[#d0d0d0]"><option value="normal">Normal</option><option value="multiply">Multiplicar</option><option value="screen">Tela</option><option value="overlay">Sobrepor</option><option value="add">Adicionar</option></select>
                    <span/>
                    <select aria-label={`Track matte de ${layer.name}`} value={layer.trackMatte||"none"} onChange={event=>setLayerValue(layer.id,"trackMatte",event.target.value)} className="mx-1 h-5 border border-[#111] bg-[#171717] px-1 text-[#d0d0d0]"><option value="none">No Track Matte</option><option value="alpha">Alpha Matte</option><option value="alpha-inverted">Alpha Inverted</option><option value="luma">Luma Matte</option><option value="luma-inverted">Luma Inverted</option></select>
                    <button aria-label={`Vincular ${layer.name} a outra camada`} title="Arraste até a camada que será o pai" onPointerDown={(event)=>beginParentDrag(event,layer.id)} onPointerMove={moveParentDrag} onPointerUp={finishParentDragAtPoint} className={`grid cursor-crosshair place-items-center ${parentDrag?.layerId===layer.id?"text-[#48a9ff]":"text-[#888]"}`}><EffectIcon name="pickWhip"/></button>
                    <select aria-label={`Pai de ${layer.name}`} value={layer.parent||""} onChange={event=>setLayerValue(layer.id,"parent",event.target.value)} className="mx-1 h-5 border border-[#111] bg-[#171717] px-1 text-[#d0d0d0]"><option value="">None</option>{layers.filter(candidate=>candidate.id!==layer.id).map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>
                    </>}
                  </div>
                  <div className="relative h-7 flex-1 bg-[linear-gradient(90deg,transparent_98%,#334155_98%)] bg-[size:10%_100%]">
                    {!graphEditor && <>
                    <button
                      aria-label={`Mover ${layer.name} na timeline`}
                      aria-valuetext={`Início ${layer.start.toFixed(2)}s, duração ${layer.duration.toFixed(2)}s`}
                      onPointerDown={(event)=>beginTimelineGesture(event,layer,"move")}
                      onPointerMove={moveTimelineGesture}
                      onPointerUp={()=>{timelineGesture.current=null;endHistoryGesture()}}
                      className={`absolute top-1 h-5 cursor-grab ${layer.color} px-2 text-left text-[9px] text-white active:cursor-grabbing`}
                      style={{
                        left: `${(layer.start / 10) * 100}%`,
                        width: `${(layer.duration / 10) * 100}%`,
                      }}
                    >
                      {layer.name}
                    </button>
                    <button aria-label={`Aparar início de ${layer.name}`} onPointerDown={(event)=>beginTimelineGesture(event,layer,"trim-start")} onPointerMove={moveTimelineGesture} onPointerUp={()=>{timelineGesture.current=null;endHistoryGesture()}} className="absolute top-1 z-10 h-5 w-1.5 cursor-ew-resize bg-white/75" style={{left:`${(layer.start/10)*100}%`}} />
                    <button aria-label={`Aparar fim de ${layer.name}`} onPointerDown={(event)=>beginTimelineGesture(event,layer,"trim-end")} onPointerMove={moveTimelineGesture} onPointerUp={()=>{timelineGesture.current=null;endHistoryGesture()}} className="absolute top-1 z-10 h-5 w-1.5 -translate-x-full cursor-ew-resize bg-white/75" style={{left:`${((layer.start+layer.duration)/10)*100}%`}} />
                    {(layer.markers||[]).map((at) => (
                      <button key={`layer-marker-${layer.id}-${at}`} aria-label={`Marcador de ${layer.name} em ${at.toFixed(2)}s`} onClick={()=>setPlayhead(at)} className="absolute top-0 z-20 h-3 w-2 -translate-x-1/2 bg-[#8eb7d8] [clip-path:polygon(0_0,100%_0,50%_100%)]" style={{ left: `${(at/10)*100}%` }} />
                    ))}
                    {Object.entries(propertyKeyframes[layer.id] || {}).flatMap(([property,frames])=>frames.map(frame=><button key={`${property}-${frame.time}`} aria-label={`Keyframe ${property} em ${frame.time.toFixed(2)}s`} data-interpolation={frame.interpolation} onClick={()=>{setPlayhead(frame.time);setSelectedKeyframe({layerId:layer.id,property,time:frame.time})}} className={`absolute top-2 z-20 h-2 w-2 rotate-45 border ${selectedKeyframe?.layerId===layer.id&&selectedKeyframe?.property===property&&selectedKeyframe?.time===frame.time?'border-white bg-blue-300':'border-sky-200 bg-sky-500'}`} style={{left:`${(frame.time/10)*100}%`}} />))}
                    </>}
                  </div>
                  {expandedLayers.includes(layer.id) && <div className="ml-8 grid w-[292px] grid-cols-1 border-l border-[#444] bg-[#1b1b1b] py-1 pl-3 text-[9px] text-[#bbb]">{[["anchor","Ponto de ancoragem"],["position","Posição"],["scale","Escala"],["rotation","Rotação"],["opacity","Opacidade"]].map(([property,label])=><button key={property} aria-label={`${label} de ${layer.name}`} onClick={()=>{setSelectedLayer(layer.id);togglePropertyKeyframe(property==="position"?"x":property)}} className="flex items-center gap-2 py-0.5 text-left"><span className="text-slate-500"><EffectIcon name="stopwatch"/></span><span>{label}</span><span className="ml-auto pr-2 text-blue-400">{property==="position"?`${displayTransform.x}, ${displayTransform.y}`:property==="anchor"?anchorLabel(layer):displayTransform[property]??100}</span></button>)}</div>}
                </div>
              ))}
              {graphEditor && <div className="absolute bottom-0 right-0 top-7 overflow-hidden bg-[#151515]/95" style={{left:timelinePanelWidth}}>
                <div className="absolute inset-0 bg-[linear-gradient(#2b2b2b_1px,transparent_1px),linear-gradient(90deg,#2b2b2b_1px,transparent_1px)] bg-[size:100%_25%,10%_100%]" />
                <div className="absolute left-2 top-2 text-[9px] text-slate-500"><span className="block">100</span><span className="mt-8 block">80</span><span className="mt-8 block">60</span><span className="mt-8 block">40</span><span className="mt-8 block">20</span></div>
                <svg className="absolute inset-x-8 bottom-8 top-2 h-[calc(100%-40px)] w-[calc(100%-48px)]" viewBox="0 0 600 220" preserveAspectRatio="none" aria-label="Curva de velocidade dos quadros-chave">
                  <path d="M20 190 C 70 190, 72 28, 150 28 S 390 28, 580 28" fill="none" stroke="#e0c342" strokeWidth="2"/>
                  <path d="M20 190 L70 190 M150 28 L235 28" fill="none" stroke="#8e7f3c" strokeWidth="1"/>
                  <rect x="16" y="186" width="8" height="8" fill="#f1d75c"/><rect x="146" y="24" width="8" height="8" fill="#f1d75c"/>
                </svg>
                <div className="absolute bottom-1 left-2 right-2 flex gap-1 overflow-x-auto text-[9px]">
                  {["Valor","Velocidade","Selecionados","Zoom automático","Ajustar","Ajustar seleção","Separar dimensões","Manter","Linear","Bézier automático","Suavização"].map((label,index)=><button key={label} onClick={()=>({"Manter":"hold","Linear":"linear","Bézier automático":"auto-bezier","Suavização":"easy-ease"}[label]&&setKeyframeInterpolation({"Manter":"hold","Linear":"linear","Bézier automático":"auto-bezier","Suavização":"easy-ease"}[label]))} className={`shrink-0 rounded px-2 py-1 ${[0,2,3].includes(index)?'bg-[#2879c7] text-white':'bg-[#292929] text-[#bbb]'}`}>{label}</button>)}
                </div>
              </div>}
              {parentDrag && <svg aria-label="Linha de vínculo de camada" className="pointer-events-none fixed inset-0 z-50 h-screen w-screen"><path d={`M ${parentDrag.x1} ${parentDrag.y1} C ${parentDrag.x1+55} ${parentDrag.y1}, ${parentDrag.x2-55} ${parentDrag.y2}, ${parentDrag.x2} ${parentDrag.y2}`} fill="none" stroke="#48a9ff" strokeWidth="2"/><circle cx={parentDrag.x2} cy={parentDrag.y2} r="4" fill="#48a9ff"/></svg>}
              <span
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-indigo-300"
                style={{
                  left: `calc(${timelinePanelWidth}px + (100% - ${timelinePanelWidth}px) * ${playhead / 10})`,
                }}
              >
                <i className="absolute -left-1 top-0 h-2 w-2 rotate-45 bg-indigo-300" />
              </span>
            </div>
            </> : <RenderQueuePanel composition={composition} setBottomPanel={setBottomPanel} getScene={getRenderScene} onImport={onOpenFiles} />}
          </div>

        <aside className={`col-start-3 row-span-2 row-start-1 min-h-0 overflow-auto bg-[#202020] ${compactWorkspace ? "invisible" : ""}`}>
          <PanelTabs labels={["Pré-visualização", "Informações", "Áudio"]} active={rightTopPanel} onChange={setRightTopPanel} />
          {rightTopPanel === "Pré-visualização" ? <PreviewPanel playing={playing} setPlaying={setPlaying} loop={loopPlayback} setLoop={setLoopPlayback} onJump={(time)=>{setPlaying(false);setPlayhead(time)}} onStep={stepPlayhead} /> : rightTopPanel === "Informações" ? <InfoPanel transform={displayTransform} /> : <AudioPanel />}
          <PanelTabs labels={["Propriedades", "Efeitos e predefinições"]} active={rightBottomPanel} onChange={setRightBottomPanel} />
          {rightBottomPanel === "Efeitos e predefinições" ? <EffectsBrowser search={search} setSearch={setSearch} visibleEffectGroups={visibleEffectGroups} openEffectGroups={openEffectGroups} setOpenEffectGroups={setOpenEffectGroups} setAppliedEffects={setAppliedEffects} setLeftPanel={setLeftPanel} /> : <>
          <div className="border-t border-slate-800 p-3">
            <div className="mb-3 flex items-center border-b border-slate-700 pb-2"><h3 className="text-xs font-bold">Propriedades: {activeLayer?.name}</h3><span className="ml-auto">☰</span></div>
            <h4 className="mb-2 text-[10px] font-semibold">Transformação da camada <button onClick={resetLayerTransform} className="float-right text-indigo-300">Redefinir</button></h4>
            <div className="border-y border-[#353535] py-1">
              {Object.entries(displayTransform).map(([key, value]) => (
                <AePropertyRow
                  key={key}
                  propertyKey={key}
                  value={value}
                  playhead={playhead}
                  keyed={(propertyKeyframes[selectedLayer]?.[key]||[]).some(frame=>frame.time===Math.round(playhead*100)/100)}
                  onToggleKeyframe={()=>togglePropertyKeyframe(key)}
                  onChange={(next)=>changeTransform(key,next)}
                />
              ))}
            </div>
            <button
              onClick={() =>
                setTransform({
                  x: 960,
                  y: 540,
                  scale: 100,
                  rotation: 0,
                  opacity: 100,
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded border border-slate-700 p-2 text-[10px]"
            >
              <RotateCcw size={12} /> Restaurar
            </button>
          </div>
          <PropertiesExtras activeLayer={activeLayer} onChange={(key,value)=>{if(!activeLayer||activeLayer.locked)return;mergeHistoryAs(`layer:${activeLayer.id}:${key}`);setLayerValue(activeLayer.id,key,value)}} />
          <div className="border-t border-[#383838] p-3 text-[10px]">
            <div className="mb-3 flex items-center border-b border-[#383838] pb-2"><b>Alinhar</b><span className="ml-auto text-[#999]">☰</span></div>
            <label className="mb-2 flex items-center gap-2 text-[#aaa]">Alinhar camadas a:<select aria-label="Alinhar camadas a" disabled defaultValue="Composição" title="Ainda não disponível: o MMEffect seleciona uma camada por vez, então os botões alinham sempre à composição." className="ml-auto rounded border border-[#444] bg-[#191919] px-2 py-1 text-white disabled:opacity-60"><option>Composição</option><option>Seleção</option></select></label>
            <div className="grid grid-cols-6 gap-1">
              <button aria-label="Alinhar à esquerda" onClick={()=>changeTransform("x",0)} className="rounded bg-[#292929] py-2">▏←</button>
              <button aria-label="Centralizar horizontalmente" onClick={()=>changeTransform("x",960)} className="rounded bg-[#292929] py-2">↔</button>
              <button aria-label="Alinhar à direita" onClick={()=>changeTransform("x",1920)} className="rounded bg-[#292929] py-2">→▕</button>
              <button aria-label="Alinhar ao topo" onClick={()=>changeTransform("y",0)} className="rounded bg-[#292929] py-2">▔↑</button>
              <button aria-label="Centralizar verticalmente" onClick={()=>changeTransform("y",540)} className="rounded bg-[#292929] py-2">↕</button>
              <button aria-label="Alinhar à base" onClick={()=>changeTransform("y",1080)} className="rounded bg-[#292929] py-2">↓▁</button>
            </div>
          </div>
          <div className="border-t border-[#383838] p-3 text-[10px]">
            <div className="mb-2 flex items-center border-b border-[#383838] pb-2"><b>Áudio</b><span className="ml-auto text-[#999]">☰</span></div>
            <div className="grid grid-cols-[18px_18px_1fr] gap-2"><div className="relative h-28 bg-[#111]"><i className="absolute inset-x-1 bottom-0 h-[42%] bg-gradient-to-t from-emerald-500 via-yellow-400 to-red-500"/></div><div className="relative h-28 bg-[#111]"><i className="absolute inset-x-1 bottom-0 h-[36%] bg-gradient-to-t from-emerald-500 via-yellow-400 to-red-500"/></div><div className="flex flex-col justify-between text-[#777]"><span>0</span><span>-6</span><span>-12</span><span>-24</span><span>-48</span></div></div>
          </div>
          </>}
        </aside>
      </div>
      {textPromptDialog}
    </section>
  );
}

function ParticlePreview({ params, enabled }) {
  const field = particleField(params, enabled);
  return <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 360" aria-label="Prévia de partículas" data-particles={field.particles.length}><g transform={`translate(${field.center.x} ${field.center.y})`}>{field.particles.map((particle,index)=><line key={index} x1={particle.x1} y1={particle.y1} x2={particle.x2} y2={particle.y2} stroke={particle.color} strokeWidth="2"/>)}<circle r="8" fill="#fff600"/></g></svg>;
}

function ThreeDPreview() {
  return <div className="absolute inset-0 overflow-hidden [perspective:700px]">
    <div className="absolute inset-x-[10%] bottom-[8%] h-[58%] origin-bottom rotate-x-[65deg] bg-[linear-gradient(#29445c55_1px,transparent_1px),linear-gradient(90deg,#29445c55_1px,transparent_1px)] bg-[size:38px_38px]" />
    <div className="absolute left-[31%] top-[26%] h-[35%] w-[16%] -skew-y-6 bg-gradient-to-br from-cyan-400 to-blue-700 shadow-xl" />
    <div className="absolute left-[45%] top-[22%] h-[37%] w-[15%] skew-y-6 bg-gradient-to-br from-orange-400 to-rose-800 shadow-xl" />
    <strong className="absolute left-[39%] top-[45%] -rotate-6 text-4xl italic text-white drop-shadow-lg">CLASSIC 3D</strong>
    <span className="absolute bottom-[9%] left-1/2 -translate-x-1/2 text-[10px] tracking-[.35em] text-slate-200">CÂMERAS · LUZES · SOMBRAS · PROFUNDIDADE DE CAMPO</span>
  </div>;
}

function AePropertyRow({ propertyKey, value, playhead, keyed, onToggleKeyframe, onChange }) {
  const label = propertyKey === "scale" ? "Escala" : propertyKey === "rotation" ? "Rotação" : propertyKey === "opacity" ? "Opacidade" : propertyKey.toUpperCase();
  const min = propertyKey === "rotation" ? -180 : 0;
  const max = propertyKey === "x" ? 1920 : propertyKey === "y" ? 1080 : propertyKey === "scale" ? 400 : propertyKey === "rotation" ? 180 : 100;
  return <div className="group grid h-7 grid-cols-[18px_minmax(58px,1fr)_64px] items-center gap-1 px-1 text-[10px] hover:bg-[#2a2a2a]">
    <button type="button" aria-label={`Criar keyframe de ${propertyKey} em ${playhead.toFixed(2)}s`} aria-pressed={keyed} onClick={onToggleKeyframe} className={`grid place-items-center ${keyed?"text-blue-400":"text-[#888] hover:text-blue-300"}`}><EffectIcon name="stopwatch"/></button>
    <span className="capitalize text-[#c5c5c5]">{label}</span>
    <NumericField aria-label={`Valor ${label} da camada`} value={value} onChange={onChange} className="h-5 w-full border-0 border-b border-transparent bg-transparent px-1 text-right text-[#3ea6ff] outline-none hover:border-[#666] focus:border-[#3ea6ff]"/>
    <input aria-label={`${label} da camada`} type="range" min={min} max={max} value={value} onChange={(event)=>onChange(Number(event.target.value))} className="col-span-3 -mt-1 h-1 w-full accent-[#3b8edb]"/>
  </div>;
}

function EffectIcon({ name, size = 12 }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round", strokeLinejoin: "round" };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" {...common}>
    {name === "eye" && <><path d="M1.5 8 4 5l4-1.2L12 5l2.5 3-2.5 3L8 12.2 4 11Z"/><circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none"/></>}
    {name === "speaker" && <><path d="M2 6h3l4-3.5v11L5 10H2Z" fill="currentColor" stroke="none"/><path d="M10 5.5c1.3 1.4 1.3 3.6 0 5M11.7 3.8c2.3 2.4 2.3 6 0 8.4"/></>}
    {name === "solo" && <><circle cx="8" cy="8" r="4.5"/><circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none"/></>}
    {name === "lock" && <><rect x="3.5" y="7" width="9" height="7"/><path d="M5 7a3 3 0 0 1 6 0"/><circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none"/></>}
    {name === "keyframe" && <path d="m8 2.5 5.5 5.5L8 13.5 2.5 8Z" fill="currentColor" stroke="none"/>}
    {name === "shy" && <><circle cx="8" cy="8" r="5.8"/><circle cx="6" cy="7" r=".8" fill="currentColor" stroke="none"/><circle cx="10" cy="7" r=".8" fill="currentColor" stroke="none"/><path d="M5.7 11c1.4-1 3.2-1 4.6 0"/></>}
    {name === "collapse" && <><circle cx="8" cy="8" r="2.8"/><path d="M8 1.7v2M8 12.3v2M1.7 8h2M12.3 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4"/></>}
    {name === "quality" && <path d="m4 2.5 8 11"/>}
    {name === "fx" && <><path d="M7 3H5.6L4.6 4.2V13M3 7h4M8.5 7l4.5 6M13 7l-4.5 6"/></>}
    {name === "frameBlend" && <><rect x="2" y="4" width="7" height="7"/><rect x="7" y="5" width="7" height="7"/></>}
    {name === "motionBlur" && <><circle cx="10.5" cy="8" r="3.5"/><circle cx="7" cy="8" r="3.5"/><circle cx="4" cy="8" r="3"/></>}
    {name === "adjustment" && <><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 1 0-11Z" fill="currentColor" stroke="none"/></>}
    {name === "cube" && <><path d="m8 2 5.5 3v6L8 14l-5.5-3V5Z"/><path d="m2.5 5 5.5 3 5.5-3M8 8v6"/></>}
    {name === "pickWhip" && <><circle cx="8" cy="8" r="5.4"/><circle cx="8" cy="8" r="2.8"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><path d="m12 3 2 2-2.7.7"/></>}
    {name === "footage" && <><rect x="2" y="3" width="12" height="10"/><path d="M5.5 3v10M10.5 3v10"/><circle cx="3.8" cy="5" r=".6" fill="currentColor" stroke="none"/><circle cx="12.2" cy="5" r=".6" fill="currentColor" stroke="none"/><circle cx="3.8" cy="8" r=".6" fill="currentColor" stroke="none"/><circle cx="12.2" cy="8" r=".6" fill="currentColor" stroke="none"/></>}
    {name === "stopwatch" && <><circle cx="8" cy="9" r="4.5"/><path d="M8 4.5V2M6 2h4M11.5 5.5l1.3-1.3M8 9V6.2"/></>}
    {name === "chevronRight" && <path d="m6 3.5 4.5 4.5L6 12.5"/>}
    {name === "chevronDown" && <path d="m3.5 6 4.5 4.5L12.5 6"/>}
  </svg>;
}

function EffectControl({ effect, transform, onTransformChange, values = {}, onValueChange, onReset, onRemove }) {
  const fields = EFFECT_FIELDS[effect] || null;
  const [open, setOpen] = useState(true);
  // Valores gravados pela versão anterior (por efeito) são migrados uma vez para o projeto.
  const [legacyValues] = useGraphicDraftState(`effect:control:${effect}`, null);
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current || !fields || !legacyValues || Object.keys(values).length) return;
    migrated.current = true;
    fields.forEach(([label, initial]) => {
      if (legacyValues[label] !== undefined && String(legacyValues[label]) !== String(initial)) onValueChange?.(label, legacyValues[label]);
    });
  }, [fields, legacyValues, values, onValueChange]);
  const setValues = (update) => {
    const next = update(values);
    Object.entries(next).forEach(([label, value]) => { if (values[label] !== value) onValueChange?.(label, value); });
  };
  const rangeFor = (label) => {
    const normalized = label.toLowerCase();
    if (normalized.includes("angle") || normalized.includes("rotation")) return [-360, 360];
    if (["x", "y"].includes(normalized) || normalized.includes("position")) return [-1920, 1920];
    if (normalized.includes("max") || normalized.includes("min")) return [0, 255];
    if (normalized.includes("opacity") || normalized.includes("scale") || normalized.includes("strength")) return [0, normalized.includes("scale") ? 400 : 100];
    return [0, 10];
  };
  return <section className="mb-2 border-b border-[#3a3a3a] pb-2">
    <div className="flex h-7 items-center gap-1 bg-[#34476c] px-1">
      <button aria-label={`${open?"Recolher":"Expandir"} ${effect}`} aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="grid w-4 place-items-center text-[#ddd]"><EffectIcon name={open?"chevronDown":"chevronRight"}/></button><EffectIcon name="fx"/><b className="truncate">{effect}</b><button aria-label={`Redefinir ${effect}`} onClick={onReset} className="ml-auto text-[#bbb]">Redefinir</button><button aria-label={`Remover ${effect}`} onClick={onRemove} className="relative h-4 w-4 before:absolute before:left-1/2 before:top-0 before:h-4 before:w-px before:rotate-45 before:bg-current after:absolute after:left-1/2 after:top-0 after:h-4 after:w-px after:-rotate-45 after:bg-current"/>
    </div>
    {open && (fields ? <div className="py-1">{fields.map(([label,initial,range])=>{const value=values[label]??initial;const isChoice=label.includes("Space")||label==="Animation";const [min,max]=range||rangeFor(label);return <div key={label} className="group grid min-h-7 grid-cols-[18px_minmax(82px,1fr)_58px_64px] items-center gap-1 px-1 text-[10px] hover:bg-[#292929]"><span className="text-[#888]"><EffectIcon name="stopwatch"/></span><span className="truncate text-[#c6c6c6]">{label}</span>{isChoice?<select aria-label={`Valor de ${label}`} value={value} onChange={event=>setValues(old=>({...old,[label]:event.target.value}))} className="col-span-2 h-5 border border-[#444] bg-[#191919] px-1"><option>{value}</option></select>:<><NumericField aria-label={`Valor de ${label}`} value={numeric(value)} onChange={next=>setValues(old=>({...old,[label]:next}))} className="h-5 border-0 bg-transparent px-1 text-right text-[#3ea6ff] outline-none hover:bg-[#171717]"/><input aria-label={`${label} deslizante`} type="range" min={min} max={max} step="any" value={String(value).replace("°","")} onChange={event=>setValues(old=>({...old,[label]:event.target.value}))} className="h-1 w-full accent-[#3b8edb]"/></>}</div>})}</div> : Object.entries(transform).map(([key,value])=>{const [min,max]=rangeFor(key);return <label key={key} className="grid h-7 grid-cols-[18px_1fr_58px_64px] items-center gap-1 px-1 capitalize hover:bg-[#292929]"><span className="text-[#888]"><EffectIcon name="stopwatch"/></span><span>{key}</span><NumericField aria-label={`Valor de ${key} no efeito`} value={value} onChange={next=>onTransformChange(key,next)} className="h-5 border-0 bg-transparent px-1 text-right text-[#3ea6ff] outline-none"/><input aria-label={`${key} do efeito deslizante`} type="range" min={min} max={max} value={value} onChange={event=>onTransformChange(key,event.target.value)} className="h-1 w-full accent-[#3b8edb]"/></label>}))}
  </section>;
}

function EffectsBrowser({ search, setSearch, visibleEffectGroups, openEffectGroups, setOpenEffectGroups, setAppliedEffects, setLeftPanel }) {
  return <div className="p-3"><label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-2 py-1.5"><Search size={13}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Pesquisar efeitos e predefinições" className="min-w-0 flex-1 bg-transparent text-xs outline-none"/></label><div className="mt-2 space-y-1">{visibleEffectGroups.map(([group,effects])=>{const open=openEffectGroups.includes(group)||search;return <section key={group}><button onClick={()=>setOpenEffectGroups(old=>old.includes(group)?old.filter(item=>item!==group):[...old,group])} className="flex w-full items-center gap-2 px-1 py-1.5 text-left text-[10px] font-semibold hover:bg-slate-800"><span>{open?'⌄':'›'}</span><span className="text-amber-300">▱</span>{group}<span className="ml-auto text-slate-600">{effects.length}</span></button>{open&&<div className="ml-4 border-l border-slate-700 pl-2">{effects.map(effect=><button key={effect} onDoubleClick={()=>{setAppliedEffects(old=>old.includes(effect)?old:[...old,effect]);setLeftPanel('Controles de efeitos')}} className="block w-full rounded px-2 py-1.5 text-left text-[10px] hover:bg-indigo-500/20">fx&nbsp; {effect}</button>)}</div>}</section>})}</div><p className="mt-3 text-[9px] text-slate-500">Clique duas vezes para aplicar à camada selecionada.</p></div>;
}

function PreviewPanel({ playing, setPlaying, loop, setLoop, onJump, onStep }) {
  return <div className="p-3 text-[10px]"><div className="mb-4 flex items-center justify-center gap-5"><button aria-label="Ir para o primeiro quadro" title="Ir para o primeiro quadro" onClick={()=>onJump?.(0)}>◀◀</button><button aria-label="Quadro anterior" title="Quadro anterior" onClick={()=>onStep?.(-1/FPS)}>◀</button><button aria-label={playing?"Pausar prévia":"Reproduzir prévia"} title={playing?"Pausar prévia":"Reproduzir prévia"} onClick={()=>setPlaying(!playing)} className="grid h-8 w-8 place-items-center rounded hover:bg-slate-800">{playing?<Pause size={15}/>:<Play size={15}/>}</button><button aria-label="Próximo quadro" title="Próximo quadro" onClick={()=>onStep?.(1/FPS)}>▶</button><button aria-label="Ir para o último quadro" title="Ir para o último quadro" onClick={()=>onJump?.(COMP_DURATION)}>▶▶</button></div><dl className="grid grid-cols-[110px_1fr] gap-y-2 text-slate-400"><dt>Atalho</dt><dd className="text-slate-200">Barra de espaço</dd><dt>Repetir</dt><dd><input type="checkbox" aria-label="Repetir reprodução" title="Ao chegar ao fim, voltar ao início" checked={Boolean(loop)} onChange={(event)=>setLoop?.(event.target.checked)}/></dd><dt>Intervalo</dt><dd className="text-slate-200">Área de trabalho</dd><dt>Reproduzir de</dt><dd className="text-slate-200">Tempo atual</dd><dt>Taxa de quadros</dt><dd className="text-slate-200">29,97</dd><dt>Resolução</dt><dd className="text-slate-200">Automática</dd></dl><div className="mt-4 h-1.5 overflow-hidden rounded bg-slate-900"><div className="h-full w-1/3 bg-emerald-500"/></div><p className="mt-2 text-slate-500">36 / 300 quadros em cache</p></div>;
}

function InfoPanel({ transform }) {
  return <div className="grid grid-cols-2 gap-2 p-3 text-[10px]">{Object.entries(transform).map(([key,value])=><div key={key} className="border-b border-slate-700 pb-2"><span className="block capitalize text-slate-500">{key}</span><b>{value}</b></div>)}</div>;
}

function AudioPanel() {
  return <div className="p-3 text-[10px]"><div className="mb-3 flex h-28 items-end gap-2">{[45,72,88,64,38,80,55,92,66,41].map((height,index)=><span key={index} className="flex-1 bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500" style={{height:`${height}%`}}/>)}</div><div className="flex justify-between text-slate-500"><span>-48 dB</span><span>-12</span><span>0 dB</span></div></div>;
}

function PropertiesExtras({ activeLayer, onChange }) {
  const disabled = !activeLayer || activeLayer.locked;
  if (activeLayer?.kind !== "T") return <div className="border-t border-slate-800 p-3 text-[10px]"><h4 className="mb-2 font-semibold">Opções da camada</h4><label className="flex gap-2"><input type="checkbox" disabled={disabled} checked={Boolean(activeLayer?.motionBlur)} onChange={(event)=>onChange?.("motionBlur",event.target.checked)}/> Desfoque de movimento</label><label className="mt-2 flex gap-2"><input type="checkbox" disabled={disabled} checked={Boolean(activeLayer?.threeD)} onChange={(event)=>onChange?.("threeD",event.target.checked)}/> Camada 3D</label></div>;
  return <div className="border-t border-slate-800 p-3 text-[10px]"><h4 className="mb-2 font-semibold">Texto</h4><label className="mb-2 block">Texto de origem<textarea aria-label="Texto de origem" disabled={disabled} rows={2} placeholder="Digite o texto" value={activeLayer.text ?? defaultLayerText(activeLayer)} onChange={(event)=>onChange?.("text",event.target.value)} className="mt-1 w-full resize-y rounded border border-slate-700 bg-[#0d1015] p-2"/></label><select aria-label="Fonte do texto" disabled={disabled} value={activeLayer.fontFamily || "Inter"} onChange={(event)=>onChange?.("fontFamily",event.target.value)} className="mb-2 w-full rounded border border-slate-700 bg-[#0d1015] p-2"><option>Inter</option><option>Source Sans 3</option></select><select aria-label="Peso da fonte" disabled={disabled} value={activeLayer.fontWeight || "Bold"} onChange={(event)=>onChange?.("fontWeight",event.target.value)} className="mb-3 w-full rounded border border-slate-700 bg-[#0d1015] p-2"><option>Bold</option><option>Regular</option></select><div className="grid grid-cols-2 gap-2"><label>Tamanho<input aria-label="Tamanho do texto" disabled={disabled} value={activeLayer.fontSize ?? "148 px"} onChange={(event)=>onChange?.("fontSize",event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-[#0d1015] p-2"/></label><label>Entrelinha<input aria-label="Entrelinha do texto" disabled={disabled} value={activeLayer.lineHeight ?? "Auto"} onChange={(event)=>onChange?.("lineHeight",event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-[#0d1015] p-2"/></label></div><h4 className="mb-2 mt-4 font-semibold">Parágrafo</h4><div className="flex justify-between">{['≡','≣','≡','☷','☰'].map((item,index)=><button key={index} aria-label={PARAGRAPH_ALIGNMENTS[index][1]} aria-pressed={(activeLayer.textAlign || "center") === PARAGRAPH_ALIGNMENTS[index][0]} disabled={disabled} onClick={()=>onChange?.("textAlign",PARAGRAPH_ALIGNMENTS[index][0])} className="h-8 w-8 rounded hover:bg-slate-800">{item}</button>)}</div><button disabled title="Animadores de texto ainda não estão disponíveis no MMEffect" className="mt-4 rounded border border-slate-700 px-3 py-2">+ Adicionar animador</button></div>;
}

const RENDER_SIZES = [
  ["Melhores configurações", 1920, 1080],
  ["Metade da resolução", 960, 540],
];

function supportedRecorderTypes() {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return [];
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const check = window.MediaRecorder.isTypeSupported?.bind(window.MediaRecorder);
  return check ? candidates.filter((type) => check(type)) : ["video/webm"];
}

function canvasRecordingAvailable() {
  return typeof window !== "undefined"
    && typeof window.MediaRecorder !== "undefined"
    && typeof HTMLCanvasElement !== "undefined"
    && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

// Renderização real no navegador: desenha cada quadro num canvas e grava com MediaRecorder (WebM).
function RenderQueuePanel({ composition, setBottomPanel, getScene, onImport }) {
  const [queued, setQueued] = useState(true);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [typeIndex, setTypeIndex] = useState(0);
  const [postAction, setPostAction] = useState("Nenhuma");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState("");
  const job = useRef(null);
  const types = supportedRecorderTypes();
  const available = canvasRecordingAvailable() && types.length > 0;
  const outputName = `${fileName || slugify(composition)}.webm`;
  const mimeType = types[typeIndex % Math.max(1, types.length)] || "video/webm";
  const [sizeLabel, width, height] = RENDER_SIZES[sizeIndex];
  const rendering = progress !== null;

  useEffect(() => () => { if (job.current) job.current.cancelled = true; job.current?.stop?.(); }, []);

  async function render() {
    if (rendering) {
      if (job.current) job.current.cancelled = true;
      job.current?.stop?.();
      return;
    }
    const current = { cancelled: false, stop: null };
    job.current = current;
    setMessage("");
    setProgress(0);
    let timer = null;
    let stream = null;
    try {
      const scene = getScene();
      scene.image = await loadImage(scene.imageUrl);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D indisponível neste navegador.");
      drawCompositionFrame(context, scene, 0, width, height);
      stream = canvas.captureStream(FPS);
      const recorder = new window.MediaRecorder(stream, { mimeType, videoBitsPerSecond: width >= 1920 ? 12_000_000 : 5_000_000 });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      const stopped = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (event) => reject(event?.error || new Error("Falha no gravador de vídeo."));
      });
      recorder.start(250);
      const total = Math.round(scene.duration * FPS);
      let frame = 0;
      await new Promise((resolve) => {
        current.stop = resolve;
        timer = setInterval(() => {
          if (current.cancelled || frame > total) { resolve(); return; }
          drawCompositionFrame(context, scene, frame / FPS, width, height);
          setProgress(Math.min(99, Math.round(frame / total * 100)));
          frame += 1;
        }, 1000 / FPS);
      });
      clearInterval(timer);
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      if (current.cancelled) {
        setMessage("Renderização cancelada. Nenhum arquivo foi gerado.");
        return;
      }
      const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
      if (!blob.size) throw new Error("O gravador não produziu dados de vídeo.");
      downloadBlob(blob, outputName);
      if (postAction !== "Nenhuma" && typeof File !== "undefined") onImport?.([new File([blob], outputName, { type: blob.type })]);
      setMessage(`Renderização concluída: ${outputName} (${Math.max(1, Math.round(blob.size / 1024))} KB, ${width}×${height}, ${FPS} qps).`);
    } catch (error) {
      setMessage(`Falha na renderização: ${error?.message || "erro desconhecido"}. Nenhum arquivo foi gerado.`);
    } finally {
      clearInterval(timer);
      stream?.getTracks?.().forEach((track) => track.stop());
      if (job.current === current) job.current = null;
      setProgress(null);
    }
  }

  const unavailableReason = !available ? "Este navegador não permite gravar o canvas em vídeo (MediaRecorder/captureStream indisponível)." : !queued ? "Marque a composição na fila para renderizar." : "";
  const statusText = rendering ? `Renderizando ${composition}… ${progress}% (tempo real)` : message || unavailableReason || `Pronto para renderizar ${outputName} no navegador.`;
  return <div className="flex h-[288px] flex-col text-[10px]"><div className="flex items-center gap-2 border-b border-slate-800 p-2"><button aria-label={queued?"Remover composição da fila":"Incluir composição na fila"} aria-pressed={queued} onClick={()=>setQueued(!queued)} className={`h-4 w-4 rounded border ${queued?'border-emerald-400 bg-emerald-500':'border-slate-600'}`}/><b>{composition}</b><span className="rounded bg-[#3d4655] px-2 py-0.5">{rendering?"Renderizando":"Configuração pronta"}</span><button onClick={()=>setBottomPanel('Timeline')} className="ml-auto text-slate-400">Voltar à Timeline</button></div><div className="grid grid-cols-[140px_1fr] gap-y-2 p-4"><span className="text-slate-500">Configurações de renderização:</span><button disabled={rendering} onClick={()=>setSizeIndex(index=>(index+1)%RENDER_SIZES.length)} className="text-left text-blue-400 underline">{sizeLabel} · {width}×{height} · {FPS} qps</button><span className="text-slate-500">Módulo de saída:</span><button disabled={rendering||types.length<2} onClick={()=>setTypeIndex(index=>index+1)} className="text-left text-blue-400 underline">WebM · {mimeType.includes("vp9")?"VP9":mimeType.includes("vp8")?"VP8":"codec do navegador"}</button><span className="text-slate-500">Saída para:</span><button disabled={rendering} onClick={()=>{const answer=window.prompt("Nome do arquivo de vídeo (sem extensão):",fileName||slugify(composition));if(answer!==null&&answer.trim())setFileName(slugify(answer));}} className="truncate text-left text-blue-400 underline">Downloads\{outputName}</button><span className="text-slate-500">Ação pós-renderização:</span><select aria-label="Ação pós-renderização" value={postAction} onChange={(event)=>setPostAction(event.target.value)} className="w-48 rounded border border-slate-700 bg-[#0d1015] px-2 py-1"><option>Nenhuma</option><option>Importar</option><option>Importar e substituir uso</option></select></div><div className="mt-auto flex items-center border-t border-slate-800 p-3"><span role="status" className="text-amber-300">{statusText}</span><button disabled={!available||(!queued&&!rendering)} title={unavailableReason||undefined} onClick={render} className={`ml-auto rounded bg-[#2675df] px-5 py-2 font-semibold text-white ${!available||(!queued&&!rendering)?"opacity-40":""}`}>{rendering?"Cancelar":"Renderizar"}</button></div></div>;
}

function PanelTabs({ labels, active = labels[0], onChange }) {
  return (
    <div className="flex border-b border-slate-800">
      {labels.map((label) => (
        <button
          key={label}
          onClick={() => onChange?.(label)}
          aria-pressed={active === label}
          className={`flex-1 px-2 py-2 text-[10px] font-bold ${active === label ? "border-b-2 border-indigo-400 text-indigo-300" : "text-slate-500"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
