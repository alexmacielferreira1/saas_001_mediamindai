// Comportamento inspirado no FigCraft (storytold/figcraft, Apache-2.0); implementação própria do MediaMind.
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Circle,
  Component,
  Diamond,
  Download,
  Eye,
  EyeOff,
  Frame,
  Group,
  Hand,
  Lock,
  LockOpen,
  Maximize,
  MessageCircle,
  Minus,
  MousePointer2,
  PenTool,
  Play,
  Plus,
  Spline,
  Square,
  Trash2,
  Type,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { registerMCPActions } from "../../lib/mcpActions";
import { mmfigCatalogue, runMMFigTool } from "./mmfigMcpTools";

/* ------------------------------------------------------------------ */
/* Modelo do documento                                                 */
/* ------------------------------------------------------------------ */

export const SCHEMA = "mmfig/v1";
const KEY = "FigCraftWorkspace.jsx";
const ACCENT = "#0d99ff";
const COMPONENT_COLOR = "#9747ff";
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export const TOOLS = [
  { id: "move", label: "Mover", key: "V", icon: MousePointer2 },
  { id: "frame", label: "Frame", key: "F", icon: Frame },
  { id: "rect", label: "Retângulo", key: "R", icon: Square },
  { id: "ellipse", label: "Elipse", key: "O", icon: Circle },
  { id: "line", label: "Linha", key: "L", icon: Minus },
  { id: "arrow", label: "Seta", key: "Shift+L", icon: ArrowUpRight },
  { id: "pen", label: "Caneta", key: "P", icon: PenTool },
  { id: "text", label: "Texto", key: "T", icon: Type },
  { id: "hand", label: "Mão", key: "H", icon: Hand },
  { id: "comment", label: "Comentário", key: "C", icon: MessageCircle },
];

export const FRAME_PRESETS = [
  { id: "desktop", label: "Desktop", w: 1440, h: 1024 },
  { id: "macbook", label: "MacBook Air", w: 1280, h: 832 },
  { id: "tablet", label: "Tablet", w: 768, h: 1024 },
  { id: "iphone14", label: "iPhone 14", w: 390, h: 844 },
  { id: "iphone14max", label: "iPhone 14 Plus", w: 428, h: 926 },
  { id: "android", label: "Android", w: 360, h: 800 },
];

export const FONTS = ["Inter", "Roboto", "Arial", "Georgia", "Courier New"];
const TYPE_LABEL = {
  frame: "Frame",
  rect: "Retângulo",
  ellipse: "Elipse",
  line: "Linha",
  arrow: "Seta",
  path: "Vetor",
  text: "Texto",
  group: "Grupo",
  instance: "Instância",
};
const TYPE_ICON = {
  frame: Frame,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: ArrowUpRight,
  path: Spline,
  text: Type,
  group: Group,
  instance: Diamond,
};
const NODE_TYPES = new Set(Object.keys(TYPE_LABEL));
const TRANSITIONS = [
  ["instant", "Instantânea"],
  ["dissolve", "Dissolver"],
  ["slide-left", "Deslizar para a esquerda"],
  ["slide-right", "Deslizar para a direita"],
];
const H_CONSTRAINTS = [
  ["left", "Esquerda"],
  ["right", "Direita"],
  ["leftright", "Esquerda e direita"],
  ["center", "Centro"],
  ["scale", "Escala"],
];
const V_CONSTRAINTS = [
  ["top", "Topo"],
  ["bottom", "Base"],
  ["topbottom", "Topo e base"],
  ["center", "Centro"],
  ["scale", "Escala"],
];

let idCounter = 0;
export function newId(prefix = "n") {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
const clone = (value) => JSON.parse(JSON.stringify(value));
export const round2 = (value) => {
  const r = Math.round(Number(value) * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};
const rad = (deg) => (deg * Math.PI) / 180;

export function baseNode(type, props = {}) {
  const n = {
    id: newId(),
    type,
    name: TYPE_LABEL[type],
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    parentId: null,
    fill: {
      on: !["line", "arrow", "group", "instance", "path"].includes(type),
      color: type === "frame" ? "#FFFFFF" : type === "text" ? "#000000" : "#D9D9D9",
    },
    stroke: { on: ["line", "arrow", "path"].includes(type), color: "#000000", width: type === "path" ? 2 : 1 },
    radius: 0,
    shadow: { on: false, x: 0, y: 4, blur: 4, color: "#000000", opacity: 0.25 },
    blur: { on: false, radius: 4 },
    constraints: { h: "left", v: "top" },
    absolute: false,
    proto: null,
  };
  if (type === "frame" || type === "group") n.children = [];
  if (type === "frame") {
    n.clip = true;
    n.isComponent = false;
    n.autoLayout = {
      on: false,
      direction: "horizontal",
      gap: 10,
      padding: { t: 10, r: 10, b: 10, l: 10 },
      justify: "start",
      align: "start",
      spaceBetween: false,
      hugW: true,
      hugH: true,
    };
  }
  if (type === "text") {
    Object.assign(n, {
      text: "Texto",
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.2,
      textAlign: "left",
      textResize: "auto",
    });
  }
  if (type === "path") Object.assign(n, { points: [], closed: false });
  if (type === "line" || type === "arrow") Object.assign(n, { flipX: false, flipY: false });
  if (type === "instance") Object.assign(n, { mainId: null, overrides: {} });
  return Object.assign(n, props);
}

export function createDocument() {
  const pageId = newId("p");
  return {
    schema: SCHEMA,
    name: "Projeto sem título",
    pages: [{ id: pageId, name: "Página 1", background: "#1E1E1E" }],
    roots: { [pageId]: [] },
    nodes: {},
    comments: [],
    flowStart: {},
  };
}

/* Geometria: matrizes afins [a, b, c, d, e, f] como no SVG. */
const IDENTITY = [1, 0, 0, 1, 0, 0];
function localMatrix(n) {
  const r = rad(n.rotation || 0);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const cx = n.w / 2;
  const cy = n.h / 2;
  return [c, s, -s, c, n.x + cx - c * cx + s * cy, n.y + cy - s * cx - c * cy];
}
function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
function apply(m, x, y) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}
function invert(m) {
  const det = m[0] * m[3] - m[1] * m[2] || 1;
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}
function decompose(m, w, h) {
  const rotation = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  const r = rad(rotation);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const cx = w / 2;
  const cy = h / 2;
  return {
    rotation: round2(rotation),
    x: round2(m[4] - cx + c * cx - s * cy),
    y: round2(m[5] - cy + s * cx + c * cy),
  };
}
export function absMatrix(doc, id) {
  const n = doc.nodes[id];
  if (!n) return IDENTITY;
  return mul(n.parentId ? absMatrix(doc, n.parentId) : IDENTITY, localMatrix(n));
}
function parentMatrix(doc, id) {
  const parentId = doc.nodes[id]?.parentId;
  return parentId ? absMatrix(doc, parentId) : IDENTITY;
}
function boundsOf(m, w, h) {
  const pts = [apply(m, 0, 0), apply(m, w, 0), apply(m, 0, h), apply(m, w, h)];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
export function absBounds(doc, id) {
  const n = doc.nodes[id];
  return boundsOf(absMatrix(doc, id), n.w, n.h);
}
export function unionBounds(list) {
  if (!list.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...list.map((b) => b.x));
  const y = Math.min(...list.map((b) => b.y));
  const r = Math.max(...list.map((b) => b.x + b.w));
  const b = Math.max(...list.map((item) => item.y + item.h));
  return { x, y, w: r - x, h: b - y };
}
const intersects = (a, b) => a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
function worldToLocal(doc, id, p) {
  return apply(invert(absMatrix(doc, id)), p.x, p.y);
}
export function moveByWorld(doc, id, dx, dy) {
  const n = doc.nodes[id];
  const inv = invert(parentMatrix(doc, id));
  n.x = round2(n.x + inv[0] * dx + inv[2] * dy);
  n.y = round2(n.y + inv[1] * dx + inv[3] * dy);
}

/* Árvore */
export function pageOfNode(doc, id) {
  let n = doc.nodes[id];
  let guard = 0;
  while (n?.parentId && guard < 200) {
    n = doc.nodes[n.parentId];
    guard += 1;
  }
  if (!n) return null;
  return doc.pages.find((p) => doc.roots[p.id]?.includes(n.id))?.id || null;
}
export function descendants(doc, id, out = []) {
  (doc.nodes[id]?.children || []).forEach((childId) => {
    out.push(childId);
    descendants(doc, childId, out);
  });
  return out;
}
function isAncestor(doc, ancestorId, id) {
  let n = doc.nodes[id];
  while (n?.parentId) {
    if (n.parentId === ancestorId) return true;
    n = doc.nodes[n.parentId];
  }
  return false;
}
export function containerList(doc, pageId, parentId) {
  return parentId ? doc.nodes[parentId].children : doc.roots[pageId];
}
function removeFromParent(doc, id) {
  const n = doc.nodes[id];
  const list = n.parentId
    ? doc.nodes[n.parentId]?.children
    : Object.values(doc.roots).find((roots) => roots.includes(id));
  if (!list) return -1;
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
  return index;
}
export function insertInto(doc, pageId, parentId, id, index) {
  const list = containerList(doc, pageId, parentId);
  list.splice(index == null || index < 0 ? list.length : Math.min(index, list.length), 0, id);
  doc.nodes[id].parentId = parentId || null;
}
function reparentKeep(doc, pageId, id, newParentId, index) {
  const n = doc.nodes[id];
  const m = absMatrix(doc, id);
  removeFromParent(doc, id);
  const pm = newParentId ? absMatrix(doc, newParentId) : IDENTITY;
  Object.assign(n, decompose(mul(invert(pm), m), n.w, n.h));
  insertInto(doc, pageId, newParentId, id, index);
}
export function orderIndex(doc, pageId) {
  const order = new Map();
  let i = 0;
  const visit = (ids) =>
    ids.forEach((id) => {
      order.set(id, i);
      i += 1;
      visit(doc.nodes[id]?.children || []);
    });
  visit(doc.roots[pageId] || []);
  return order;
}
export function topLevel(doc, pageId, ids) {
  const set = new Set(ids);
  const order = orderIndex(doc, pageId);
  return ids
    .filter((id) => doc.nodes[id] && !ids.some((other) => other !== id && set.has(other) && isAncestor(doc, other, id)))
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}
export function nextName(doc, type, label = TYPE_LABEL[type]) {
  const count = Object.values(doc.nodes).filter((n) => n.type === type).length;
  return `${label} ${count + 1}`;
}
function frameAt(doc, pageId, p, exclude) {
  const visit = (ids) => {
    for (let i = ids.length - 1; i >= 0; i -= 1) {
      const n = doc.nodes[ids[i]];
      if (!n || !n.visible || n.locked || exclude.has(n.id)) continue;
      if (n.type !== "frame" && n.type !== "group") continue;
      const l = worldToLocal(doc, n.id, p);
      if (l.x < 0 || l.y < 0 || l.x > n.w || l.y > n.h) continue;
      const deeper = visit(n.children);
      if (deeper) return deeper;
      if (n.type === "frame") return n.id;
    }
    return null;
  };
  return visit(doc.roots[pageId] || []);
}
function instanceWouldRecurse(doc, parentId, nodeId) {
  if (!parentId) return false;
  const ids = [nodeId, ...descendants(doc, nodeId)];
  return ids.some((id) => {
    const n = doc.nodes[id];
    return n?.type === "instance" && (n.mainId === parentId || isAncestor(doc, n.mainId, parentId));
  });
}

/* Texto */
function charWidth(n) {
  return n.fontSize * (n.fontWeight >= 600 ? 0.6 : 0.55) * (n.fontFamily === "Courier New" ? 1.1 : 1);
}
export function textLines(n) {
  const paragraphs = String(n.text ?? "").split("\n");
  if (n.textResize === "auto") return paragraphs;
  const max = Math.max(1, Math.floor(n.w / charWidth(n)));
  const out = [];
  paragraphs.forEach((paragraph) => {
    let line = "";
    paragraph.split(" ").forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > max && line) {
        out.push(line);
        line = word;
      } else line = candidate;
    });
    out.push(line);
  });
  return out;
}
function sizeText(n) {
  const lines = textLines(n);
  const lh = n.fontSize * n.lineHeight;
  if (n.textResize === "auto") n.w = round2(Math.max(1, Math.max(...lines.map((l) => l.length)) * charWidth(n)));
  if (n.textResize !== "fixed") n.h = round2(Math.max(lh, lines.length * lh));
}

/* Auto layout, grupos, restrições */
export function layoutFrame(doc, f) {
  const al = f.autoLayout;
  const horizontal = al.direction !== "vertical";
  const kids = f.children.map((id) => doc.nodes[id]).filter((k) => k && k.visible && !k.absolute);
  const p = al.padding;
  const gap = Number(al.gap) || 0;
  const mainSize = (k) => (horizontal ? k.w : k.h);
  const crossSize = (k) => (horizontal ? k.h : k.w);
  const [padMainStart, padMainEnd, padCrossStart, padCrossEnd] = horizontal ? [p.l, p.r, p.t, p.b] : [p.t, p.b, p.l, p.r];
  const sum = kids.reduce((total, k) => total + mainSize(k), 0);
  const content = sum + (kids.length > 1 ? gap * (kids.length - 1) : 0);
  const crossMax = kids.reduce((max, k) => Math.max(max, crossSize(k)), 0);
  const hugMain = horizontal ? al.hugW : al.hugH;
  const hugCross = horizontal ? al.hugH : al.hugW;
  if (kids.length && hugMain) {
    const size = round2(content + padMainStart + padMainEnd);
    if (horizontal) f.w = size;
    else f.h = size;
  }
  if (kids.length && hugCross) {
    const size = round2(crossMax + padCrossStart + padCrossEnd);
    if (horizontal) f.h = size;
    else f.w = size;
  }
  const frameMain = horizontal ? f.w : f.h;
  const frameCross = horizontal ? f.h : f.w;
  const availMain = frameMain - padMainStart - padMainEnd;
  const availCross = frameCross - padCrossStart - padCrossEnd;
  let step = gap;
  let cursor = padMainStart;
  if (al.spaceBetween && kids.length > 1 && !hugMain) step = Math.max(0, (availMain - sum) / (kids.length - 1));
  else if (al.justify === "center") cursor += (availMain - content) / 2;
  else if (al.justify === "end") cursor += availMain - content;
  kids.forEach((k) => {
    const cross =
      al.align === "center"
        ? padCrossStart + (availCross - crossSize(k)) / 2
        : al.align === "end"
          ? padCrossStart + availCross - crossSize(k)
          : padCrossStart;
    if (horizontal) {
      k.x = round2(cursor);
      k.y = round2(cross);
    } else {
      k.y = round2(cursor);
      k.x = round2(cross);
    }
    cursor += mainSize(k) + step;
  });
}
function fitGroup(doc, g) {
  const boxes = g.children.map((id) => doc.nodes[id]).filter(Boolean).map((c) => boundsOf(localMatrix(c), c.w, c.h));
  if (!boxes.length) return;
  const b = unionBounds(boxes);
  if (Math.abs(b.x) > 0.001 || Math.abs(b.y) > 0.001) {
    g.children.forEach((id) => {
      doc.nodes[id].x = round2(doc.nodes[id].x - b.x);
      doc.nodes[id].y = round2(doc.nodes[id].y - b.y);
    });
    g.x = round2(g.x + b.x);
    g.y = round2(g.y + b.y);
  }
  g.rotation = 0;
  g.w = round2(b.w);
  g.h = round2(b.h);
}
function applyConstraint(doc, id, w0, h0, w1, h1) {
  const c = doc.nodes[id];
  const dw = w1 - w0;
  const dh = h1 - h0;
  const { h, v } = c.constraints || {};
  let { x, y, w, h: ch } = c;
  if (h === "right") x += dw;
  else if (h === "center") x += dw / 2;
  else if (h === "leftright") w += dw;
  else if (h === "scale" && w0) {
    x *= w1 / w0;
    w *= w1 / w0;
  }
  if (v === "bottom") y += dh;
  else if (v === "center") y += dh / 2;
  else if (v === "topbottom") ch += dh;
  else if (v === "scale" && h0) {
    y *= h1 / h0;
    ch *= h1 / h0;
  }
  c.x = round2(x);
  c.y = round2(y);
  if (w !== c.w || ch !== c.h) resizeNode(doc, id, w, ch);
}
export function resizeNode(doc, id, width, height) {
  const n = doc.nodes[id];
  if (!n || n.type === "instance") return;
  const min = n.type === "line" || n.type === "arrow" ? 0 : 1;
  const w1 = Math.max(min, round2(width));
  const h1 = Math.max(min, round2(height));
  const w0 = n.w;
  const h0 = n.h;
  const sx = w0 ? w1 / w0 : 1;
  const sy = h0 ? h1 / h0 : 1;
  if (n.type === "group") {
    n.children.forEach((childId) => {
      const c = doc.nodes[childId];
      c.x = round2(c.x * sx);
      c.y = round2(c.y * sy);
      resizeNode(doc, childId, c.w * sx, c.h * sy);
    });
  } else if (n.type === "frame") {
    if (n.autoLayout.on) {
      if (w1 !== w0) n.autoLayout.hugW = false;
      if (h1 !== h0) n.autoLayout.hugH = false;
    }
    n.children.forEach((childId) => {
      if (!n.autoLayout.on || doc.nodes[childId].absolute) applyConstraint(doc, childId, w0, h0, w1, h1);
    });
  }
  if (n.type === "path") n.points = n.points.map((p) => ({ x: round2(p.x * sx), y: round2(p.y * sy) }));
  if (n.type === "text") {
    if (h1 !== h0) n.textResize = "fixed";
    else if (w1 !== w0 && n.textResize === "auto") n.textResize = "height";
  }
  n.w = w1;
  n.h = h1;
}

function settle(doc, ids) {
  return ids.filter((id) => {
    const n = doc.nodes[id];
    if (!n) return false;
    if (n.children) n.children = settle(doc, n.children);
    if (n.type === "group" && !n.children.length) {
      delete doc.nodes[id];
      return false;
    }
    if (n.type === "text") sizeText(n);
    if (n.type === "instance") {
      const main = doc.nodes[n.mainId];
      if (main) {
        n.w = main.w;
        n.h = main.h;
      }
    }
    if (n.type === "group") fitGroup(doc, n);
    if (n.type === "frame" && n.autoLayout?.on) layoutFrame(doc, n);
    return true;
  });
}

export function normalize(doc) {
  const seen = new Set();
  const fix = (ids, parentId) =>
    (ids || []).filter((id) => {
      const n = doc.nodes[id];
      if (!n || seen.has(id)) return false;
      seen.add(id);
      n.parentId = parentId;
      if (n.children) n.children = fix(n.children, id);
      return true;
    });
  doc.pages.forEach((page) => {
    doc.roots[page.id] = fix(doc.roots[page.id], null);
  });
  Object.keys(doc.roots).forEach((pageId) => {
    if (!doc.pages.some((p) => p.id === pageId)) delete doc.roots[pageId];
  });
  Object.keys(doc.nodes).forEach((id) => {
    if (!seen.has(id)) delete doc.nodes[id];
  });
  for (let pass = 0; pass < 2; pass += 1) {
    doc.pages.forEach((page) => {
      doc.roots[page.id] = settle(doc, doc.roots[page.id]);
    });
  }
  Object.values(doc.nodes).forEach((n) => {
    if (n.proto?.action === "navigate" && !doc.nodes[n.proto.targetId]) n.proto = null;
  });
  Object.keys(doc.flowStart || {}).forEach((pageId) => {
    if (!doc.nodes[doc.flowStart[pageId]] || !doc.pages.some((p) => p.id === pageId)) delete doc.flowStart[pageId];
  });
  doc.comments = (doc.comments || []).filter((c) => doc.pages.some((p) => p.id === c.pageId));
  return doc;
}

/* Operações estruturais */
export function cloneSubtree(src, id, out, asInstance, map = {}) {
  const s = src.nodes[id];
  if (asInstance && s.type === "frame" && s.isComponent) {
    const inst = baseNode("instance", {
      name: s.name,
      x: s.x,
      y: s.y,
      w: s.w,
      h: s.h,
      rotation: s.rotation,
      opacity: s.opacity,
      mainId: s.id,
      overrides: {},
      constraints: clone(s.constraints),
    });
    out[inst.id] = inst;
    map[id] = inst.id;
    return inst.id;
  }
  const c = clone(s);
  c.id = newId();
  map[id] = c.id;
  out[c.id] = c;
  if (s.children) {
    c.children = s.children
      .filter((childId) => src.nodes[childId])
      .map((childId) => {
        const nid = cloneSubtree(src, childId, out, false, map);
        out[nid].parentId = c.id;
        return nid;
      });
  }
  return c.id;
}
export function detachInstance(doc, id) {
  const inst = doc.nodes[id];
  const main = doc.nodes[inst?.mainId];
  if (!inst || !main) return null;
  const pageId = pageOfNode(doc, id);
  const map = {};
  const out = {};
  const fid = cloneSubtree(doc, main.id, out, false, map);
  Object.assign(doc.nodes, out);
  const f = doc.nodes[fid];
  Object.assign(f, {
    isComponent: false,
    name: inst.name,
    x: inst.x,
    y: inst.y,
    rotation: inst.rotation,
    opacity: inst.opacity,
    visible: inst.visible,
    locked: inst.locked,
    constraints: clone(inst.constraints),
    absolute: inst.absolute,
    proto: inst.proto ? clone(inst.proto) : f.proto,
  });
  Object.entries(inst.overrides || {}).forEach(([sourceId, override]) => {
    const target = doc.nodes[map[sourceId]];
    if (target && typeof override?.text === "string") target.text = override.text;
  });
  const parentId = inst.parentId;
  const index = removeFromParent(doc, id);
  delete doc.nodes[id];
  insertInto(doc, pageId, parentId, fid, index);
  return fid;
}
export function deleteNodes(doc, ids) {
  const all = new Set();
  ids.forEach((id) => {
    if (!doc.nodes[id]) return;
    all.add(id);
    descendants(doc, id).forEach((d) => all.add(d));
  });
  const orphans = Object.values(doc.nodes).filter((n) => n.type === "instance" && all.has(n.mainId) && !all.has(n.id));
  orphans.forEach((n) => detachInstance(doc, n.id));
  ids.forEach((id) => {
    if (doc.nodes[id]) removeFromParent(doc, id);
  });
  all.forEach((id) => delete doc.nodes[id]);
  return orphans.length;
}
export function wrapSelection(doc, pageId, ids, kind) {
  const nodes = ids.map((id) => doc.nodes[id]).filter(Boolean);
  if (!nodes.length) return { error: "Selecione ao menos uma camada." };
  const parentId = nodes[0].parentId;
  if (nodes.some((n) => n.parentId !== parentId)) return { error: "Selecione camadas do mesmo nível para agrupar." };
  const list = containerList(doc, pageId, parentId);
  const ordered = list.filter((id) => ids.includes(id));
  const index = Math.max(...ordered.map((id) => list.indexOf(id))) - (ordered.length - 1);
  const b = unionBounds(ordered.map((id) => boundsOf(localMatrix(doc.nodes[id]), doc.nodes[id].w, doc.nodes[id].h)));
  const g = baseNode(kind, {
    name: nextName(doc, kind),
    x: round2(b.x),
    y: round2(b.y),
    w: round2(Math.max(1, b.w)),
    h: round2(Math.max(1, b.h)),
  });
  if (kind === "frame") {
    g.fill.on = false;
    g.clip = false;
  }
  doc.nodes[g.id] = g;
  ordered.forEach((id) => {
    removeFromParent(doc, id);
    const n = doc.nodes[id];
    n.x = round2(n.x - b.x);
    n.y = round2(n.y - b.y);
    n.parentId = g.id;
  });
  g.children = ordered;
  insertInto(doc, pageId, parentId, g.id, index);
  return { id: g.id };
}
export function ungroup(doc, pageId, id) {
  const g = doc.nodes[id];
  if (!g || g.type !== "group") return [];
  const index = removeFromParent(doc, id);
  const kids = [...g.children];
  kids.forEach((childId, i) => {
    const c = doc.nodes[childId];
    c.x = round2(c.x + g.x);
    c.y = round2(c.y + g.y);
    c.opacity = round2(c.opacity * g.opacity);
    insertInto(doc, pageId, g.parentId, childId, index + i);
  });
  delete doc.nodes[id];
  return kids;
}
export function sortFlow(doc, f) {
  const horizontal = f.autoLayout.direction !== "vertical";
  f.children.sort((a, b) => (horizontal ? doc.nodes[a].x - doc.nodes[b].x : doc.nodes[a].y - doc.nodes[b].y));
}
function reorderInFlow(doc, parent, id, worldPoint) {
  const local = worldToLocal(doc, parent.id, worldPoint);
  const horizontal = parent.autoLayout.direction !== "vertical";
  const others = parent.children.filter((childId) => childId !== id);
  const index = others.filter((childId) => {
    const c = doc.nodes[childId];
    return horizontal ? c.x + c.w / 2 < local.x : c.y + c.h / 2 < local.y;
  }).length;
  others.splice(index, 0, id);
  parent.children = others;
}
export function reorder(doc, pageId, ids, mode) {
  const byParent = new Map();
  ids.forEach((id) => {
    const n = doc.nodes[id];
    if (!n) return;
    const key = n.parentId || "";
    byParent.set(key, [...(byParent.get(key) || []), id]);
  });
  byParent.forEach((selected, key) => {
    const list = containerList(doc, pageId, key || null);
    const chosen = new Set(selected);
    let next = [...list];
    if (mode === "front") next = [...list.filter((id) => !chosen.has(id)), ...list.filter((id) => chosen.has(id))];
    if (mode === "back") next = [...list.filter((id) => chosen.has(id)), ...list.filter((id) => !chosen.has(id))];
    if (mode === "forward") {
      for (let i = next.length - 2; i >= 0; i -= 1) {
        if (chosen.has(next[i]) && !chosen.has(next[i + 1])) [next[i], next[i + 1]] = [next[i + 1], next[i]];
      }
    }
    if (mode === "backward") {
      for (let i = 1; i < next.length; i += 1) {
        if (chosen.has(next[i]) && !chosen.has(next[i - 1])) [next[i], next[i - 1]] = [next[i - 1], next[i]];
      }
    }
    list.splice(0, list.length, ...next);
  });
}

/* Importação segura */
function mergeSafe(def, raw, key) {
  if (raw === undefined || raw === null) return def;
  if (typeof def === "number") return Number.isFinite(Number(raw)) ? Number(raw) : def;
  if (typeof def === "boolean") return typeof raw === "boolean" ? raw : def;
  if (typeof def === "string") {
    if (typeof raw !== "string") return def;
    if (key === "color" || key === "background") return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : def;
    return raw.slice(0, 20000);
  }
  if (def && typeof def === "object" && !Array.isArray(def)) {
    if (typeof raw !== "object" || Array.isArray(raw)) return def;
    const out = {};
    Object.keys(def).forEach((k) => {
      out[k] = mergeSafe(def[k], raw[k], k);
    });
    return out;
  }
  return def;
}
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
function sanitizeProto(raw) {
  if (!raw || typeof raw !== "object") return null;
  const action = oneOf(raw.action, ["navigate", "back", "url"], null);
  if (!action) return null;
  const url = typeof raw.url === "string" && /^https?:\/\//i.test(raw.url) ? raw.url.slice(0, 2000) : "";
  return {
    trigger: "click",
    action,
    targetId: typeof raw.targetId === "string" ? raw.targetId : null,
    transition: oneOf(raw.transition, TRANSITIONS.map(([id]) => id), "instant"),
    url,
  };
}
export function sanitizeDocument(raw) {
  const src = raw?.schema === SCHEMA ? raw.document || raw : null;
  if (!src || !Array.isArray(src.pages) || !src.pages.length || !src.nodes || typeof src.nodes !== "object" || !src.roots || typeof src.roots !== "object") {
    throw new Error("Arquivo inválido: não é um projeto MMFig (mmfig/v1).");
  }
  const doc = { ...createDocument(), pages: [], roots: {}, nodes: {} };
  doc.name = typeof src.name === "string" && src.name.trim() ? src.name.slice(0, 200) : "Projeto importado";
  const seen = new Set();
  const take = (id, parentId, depth) => {
    const r = src.nodes[id];
    if (typeof id !== "string" || !r || typeof r !== "object" || seen.has(id) || !NODE_TYPES.has(r.type) || depth > 60) return null;
    seen.add(id);
    const def = baseNode(r.type);
    const n = mergeSafe(def, r);
    n.id = id;
    n.type = r.type;
    n.parentId = parentId;
    n.proto = sanitizeProto(r.proto);
    n.constraints = {
      h: oneOf(r.constraints?.h, H_CONSTRAINTS.map(([v]) => v), "left"),
      v: oneOf(r.constraints?.v, V_CONSTRAINTS.map(([v]) => v), "top"),
    };
    n.opacity = Math.min(1, Math.max(0, n.opacity));
    n.w = Math.max(0, n.w);
    n.h = Math.max(0, n.h);
    if (n.type === "text") {
      n.fontFamily = oneOf(r.fontFamily, FONTS, "Inter");
      n.textAlign = oneOf(r.textAlign, ["left", "center", "right"], "left");
      n.textResize = oneOf(r.textResize, ["auto", "height", "fixed"], "auto");
      n.fontSize = Math.min(1000, Math.max(1, n.fontSize));
    }
    if (n.type === "frame") {
      n.autoLayout.direction = oneOf(r.autoLayout?.direction, ["horizontal", "vertical"], "horizontal");
      n.autoLayout.justify = oneOf(r.autoLayout?.justify, ["start", "center", "end"], "start");
      n.autoLayout.align = oneOf(r.autoLayout?.align, ["start", "center", "end"], "start");
    }
    if (n.type === "path") {
      n.points = (Array.isArray(r.points) ? r.points : [])
        .slice(0, 5000)
        .filter((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
        .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
    }
    if (n.type === "instance") {
      n.mainId = typeof r.mainId === "string" ? r.mainId : null;
      n.overrides = {};
      if (r.overrides && typeof r.overrides === "object") {
        Object.entries(r.overrides).forEach(([k, v]) => {
          if (typeof v?.text === "string") n.overrides[k] = { text: v.text.slice(0, 20000) };
        });
      }
    }
    if (n.children) {
      n.children = (Array.isArray(r.children) ? r.children : []).map((childId) => take(childId, id, depth + 1)).filter(Boolean);
    }
    doc.nodes[id] = n;
    return id;
  };
  src.pages.slice(0, 200).forEach((p) => {
    if (!p || typeof p.id !== "string" || doc.roots[p.id]) return;
    doc.pages.push({
      id: p.id,
      name: typeof p.name === "string" ? p.name.slice(0, 200) : "Página",
      background: mergeSafe("#1E1E1E", p.background, "background"),
    });
    doc.roots[p.id] = (Array.isArray(src.roots[p.id]) ? src.roots[p.id] : []).map((id) => take(id, null, 0)).filter(Boolean);
  });
  if (!doc.pages.length) throw new Error("Arquivo inválido: o projeto não tem páginas.");
  doc.comments = (Array.isArray(src.comments) ? src.comments : [])
    .filter((c) => c && typeof c.id === "string" && typeof c.pageId === "string")
    .map((c) => ({
      id: c.id,
      pageId: c.pageId,
      x: Number(c.x) || 0,
      y: Number(c.y) || 0,
      text: typeof c.text === "string" ? c.text.slice(0, 5000) : "",
      resolved: Boolean(c.resolved),
      createdAt: typeof c.createdAt === "string" ? c.createdAt : new Date().toISOString(),
    }));
  doc.flowStart = {};
  if (src.flowStart && typeof src.flowStart === "object") {
    Object.entries(src.flowStart).forEach(([pageId, frameId]) => {
      if (typeof frameId === "string") doc.flowStart[pageId] = frameId;
    });
  }
  return normalize(doc);
}

/* ------------------------------------------------------------------ */
/* Cena: uma única descrição gera o canvas React e o SVG exportado     */
/* ------------------------------------------------------------------ */

function h(tag, attrs, ...children) {
  return {
    tag,
    attrs: attrs || {},
    children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false && c !== ""),
  };
}
function toReact(node, key) {
  if (node === null || node === undefined) return null;
  if (typeof node !== "object") return node;
  return createElement(node.tag, key === undefined ? node.attrs : { ...node.attrs, key }, ...node.children.map((c) => toReact(c)));
}
const SVG_CAMEL = new Set(["viewBox", "stdDeviation", "preserveAspectRatio", "markerWidth", "markerHeight", "refX", "refY", "markerUnits", "filterUnits"]);
const attrName = (k) => (k === "className" ? "class" : SVG_CAMEL.has(k) ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`));
const escapeXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function toSvgString(node) {
  if (typeof node !== "object") return escapeXml(node);
  const attrs = Object.entries(node.attrs)
    .filter(
      ([k, v]) =>
        v !== undefined &&
        v !== null &&
        typeof v !== "function" &&
        typeof v !== "object" &&
        !k.startsWith("data-") &&
        !k.startsWith("aria-") &&
        !["role", "tabIndex", "key", "className"].includes(k),
    )
    .map(([k, v]) => ` ${attrName(k)}="${escapeXml(v)}"`)
    .join("");
  return `<${node.tag}${attrs}>${node.children.map(toSvgString).join("")}</${node.tag}>`;
}
const transformAttr = (n) => `translate(${n.x} ${n.y})${n.rotation ? ` rotate(${n.rotation} ${n.w / 2} ${n.h / 2})` : ""}`;
const matrixAttr = (m) => `matrix(${m.map((v) => Math.round(v * 10000) / 10000).join(" ")})`;
const paint = (n) => ({
  fill: n.fill?.on ? n.fill.color : "none",
  stroke: n.stroke?.on ? n.stroke.color : undefined,
  strokeWidth: n.stroke?.on ? n.stroke.width : undefined,
});
function effectFilter(n, id) {
  const shadow = n.shadow?.on;
  const blur = n.blur?.on;
  if (!shadow && !blur) return null;
  const m = Math.max(
    20,
    shadow ? Math.abs(n.shadow.x) + Math.abs(n.shadow.y) + n.shadow.blur * 2 : 0,
    blur ? n.blur.radius * 3 : 0,
  );
  return h(
    "filter",
    { id, filterUnits: "userSpaceOnUse", x: -m, y: -m, width: n.w + 2 * m, height: n.h + 2 * m, colorInterpolationFilters: "sRGB" },
    blur && h("feGaussianBlur", { in: "SourceGraphic", stdDeviation: n.blur.radius / 2, result: "mmblur" }),
    shadow &&
      h("feDropShadow", {
        in: blur ? "mmblur" : "SourceGraphic",
        dx: n.shadow.x,
        dy: n.shadow.y,
        stdDeviation: n.shadow.blur / 2,
        floodColor: n.shadow.color,
        floodOpacity: n.shadow.opacity,
      }),
  );
}
function frameContent(doc, f, o) {
  const clipId = `${o.prefix}clip-${o.instKey || ""}${f.id}`;
  const rx = f.radius || undefined;
  return [
    f.clip && h("defs", null, h("clipPath", { id: clipId }, h("rect", { width: f.w, height: f.h, rx }))),
    h("rect", { x: 0, y: 0, width: f.w, height: f.h, rx, fill: f.fill.on ? f.fill.color : o.canvas ? "transparent" : "none" }),
    h("g", { clipPath: f.clip ? `url(#${clipId})` : undefined }, f.children.map((childId) => sceneNode(doc, childId, o))),
    f.stroke.on && h("rect", { width: f.w, height: f.h, rx, fill: "none", stroke: f.stroke.color, strokeWidth: f.stroke.width }),
  ];
}
function shapeContent(doc, n, o) {
  const hit = 12 / (o.zoom || 1);
  if (n.type === "rect") return [h("rect", { x: 0, y: 0, width: n.w, height: n.h, rx: n.radius || undefined, ...paint(n) })];
  if (n.type === "ellipse") return [h("ellipse", { cx: n.w / 2, cy: n.h / 2, rx: n.w / 2, ry: n.h / 2, ...paint(n) })];
  if (n.type === "line" || n.type === "arrow") {
    const [x1, x2] = n.flipX ? [n.w, 0] : [0, n.w];
    const [y1, y2] = n.flipY ? [n.h, 0] : [0, n.h];
    const markerId = `${o.prefix}arrow-${o.instKey || ""}${n.id}`;
    const color = n.stroke.on ? n.stroke.color : "none";
    return [
      n.type === "arrow" &&
        h(
          "defs",
          null,
          h(
            "marker",
            { id: markerId, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse", markerUnits: "strokeWidth" },
            h("path", { d: "M0 0 L10 5 L0 10 z", fill: color }),
          ),
        ),
      h("line", { x1, y1, x2, y2, stroke: color, strokeWidth: n.stroke.width, strokeLinecap: "round", markerEnd: n.type === "arrow" ? `url(#${markerId})` : undefined }),
      o.canvas && h("line", { x1, y1, x2, y2, stroke: "transparent", strokeWidth: hit }),
    ];
  }
  if (n.type === "path") {
    const d = n.points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") + (n.closed ? " Z" : "");
    if (!d) return [];
    return [
      h("path", { d, ...paint(n), fill: n.closed && n.fill.on ? n.fill.color : "none", strokeLinejoin: "round", strokeLinecap: "round" }),
      o.canvas && h("path", { d, fill: "none", stroke: "transparent", strokeWidth: hit }),
    ];
  }
  if (n.type === "text") {
    const text = o.overrides?.[n.id]?.text ?? n.text;
    const lines = textLines({ ...n, text });
    const lh = n.fontSize * n.lineHeight;
    const anchor = n.textAlign === "center" ? "middle" : n.textAlign === "right" ? "end" : "start";
    const tx = n.textAlign === "center" ? n.w / 2 : n.textAlign === "right" ? n.w : 0;
    return [
      o.canvas && h("rect", { x: 0, y: 0, width: n.w, height: n.h, fill: "transparent" }),
      h(
        "text",
        {
          fontFamily: `${n.fontFamily}, Arial, sans-serif`,
          fontSize: n.fontSize,
          fontWeight: n.fontWeight,
          textAnchor: anchor,
          ...paint(n),
        },
        lines.map((line, i) => h("tspan", { x: tx, y: round2(i * lh + (lh - n.fontSize) / 2 + n.fontSize * 0.8) }, line || " ")),
      ),
    ];
  }
  if (n.type === "frame") return frameContent(doc, n, o);
  if (n.type === "group") return n.children.map((childId) => sceneNode(doc, childId, o));
  if (n.type === "instance") {
    const main = doc.nodes[n.mainId];
    if (!main) return [h("rect", { width: n.w, height: n.h, fill: "none", stroke: "#f24822", strokeDasharray: "4 4" })];
    if ((o.stack || []).includes(main.id)) return [];
    return frameContent(doc, main, {
      ...o,
      inInstance: true,
      overrides: n.overrides,
      instKey: `${o.instKey || ""}${n.id}-`,
      stack: [...(o.stack || []), main.id],
    });
  }
  return [];
}
function sceneNode(doc, id, o) {
  const n = doc.nodes[id];
  if (!n || !n.visible || o.hideId === id) return null;
  const filterId = `${o.prefix}fx-${o.instKey || ""}${id}`;
  const filter = effectFilter(n, filterId);
  const attrs = { transform: transformAttr(n), opacity: n.opacity < 1 ? n.opacity : undefined };
  if (o.canvas && !o.inInstance) {
    attrs["data-node-id"] = id;
    if (n.locked) attrs.style = { pointerEvents: "none" };
  }
  const proto = n.proto;
  const live =
    proto &&
    (proto.action === "back" || (proto.action === "navigate" && doc.nodes[proto.targetId]) || (proto.action === "url" && proto.url));
  if (o.onHotspot && live) {
    attrs.role = "button";
    attrs.tabIndex = 0;
    attrs["aria-label"] = `Interação: ${n.name}`;
    attrs.style = { cursor: "pointer" };
    attrs.onClick = (event) => {
      event.stopPropagation();
      o.onHotspot(proto);
    };
    attrs.onKeyDown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        o.onHotspot(proto);
      }
    };
  }
  const content = shapeContent(doc, n, o);
  return h(
    "g",
    attrs,
    filter && h("defs", null, filter),
    filter ? h("g", { filter: `url(#${filterId})` }, content) : content,
    o.showHotspots && attrs.role && h("rect", { width: n.w, height: n.h, fill: "rgba(13,153,255,0.18)", stroke: ACCENT, strokeWidth: 2, pointerEvents: "none" }),
  );
}
export function exportSvgMarkup(doc, ids) {
  const b = unionBounds(ids.map((id) => absBounds(doc, id)));
  const w = Math.max(1, round2(b.w));
  const hgt = Math.max(1, round2(b.h));
  const content = ids.map((id) => h("g", { transform: matrixAttr(parentMatrix(doc, id)) }, sceneNode(doc, id, { prefix: "x" })));
  const svg = h("svg", { xmlns: "http://www.w3.org/2000/svg", width: w, height: hgt, viewBox: `${round2(b.x)} ${round2(b.y)} ${w} ${hgt}` }, content);
  return { markup: `<?xml version="1.0" encoding="UTF-8"?>\n${toSvgString(svg)}`, width: w, height: hgt };
}
function svgToPng(markup, width, height, scale) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponível neste navegador.");
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("O navegador não gerou o PNG."))), "image/png");
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error("Não foi possível rasterizar o SVG."));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
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
/** Gera e baixa PNG/SVG das camadas; devolve o resultado real (o nome do arquivo ou a falha). */
async function exportToFile(d, targets, name, opts) {
  try {
    const { markup, width, height } = exportSvgMarkup(d, targets);
    const scale = opts.format === "png" ? opts.scale : 1;
    const blob = opts.format === "svg" ? new Blob([markup], { type: "image/svg+xml" }) : await svgToPng(markup, width, height, scale);
    const file = `${slug(name)}${scale !== 1 ? `@${scale}x` : ""}.${opts.format}`;
    downloadBlob(blob, file);
    return { ok: true, summary: `Arquivo ${file} gerado (${Math.round(width * scale)}×${Math.round(height * scale)} px).` };
  } catch (error) {
    return { ok: false, summary: `Falha ao exportar: ${error.message}` };
  }
}
const slug = (s) =>
  String(s || "mmfig")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "mmfig";

export function cssFor(doc, n) {
  const parent = n.parentId ? doc.nodes[n.parentId] : null;
  const lines = [`/* ${n.name} */`, `width: ${round2(n.w)}px;`, `height: ${round2(n.h)}px;`];
  if (!parent?.autoLayout?.on || n.absolute) lines.push("position: absolute;", `left: ${round2(n.x)}px;`, `top: ${round2(n.y)}px;`);
  if (n.rotation) lines.push(`transform: rotate(${n.rotation}deg);`);
  if (n.type === "text") {
    lines.push(
      `font-family: "${n.fontFamily}", sans-serif;`,
      `font-size: ${n.fontSize}px;`,
      `font-weight: ${n.fontWeight};`,
      `line-height: ${round2(n.fontSize * n.lineHeight)}px;`,
      `text-align: ${n.textAlign};`,
    );
    if (n.fill.on) lines.push(`color: ${n.fill.color};`);
  } else if (n.fill?.on) lines.push(`background: ${n.fill.color};`);
  if (n.type === "ellipse") lines.push("border-radius: 50%;");
  else if (n.radius) lines.push(`border-radius: ${n.radius}px;`);
  if (n.stroke?.on && !["line", "arrow", "path", "text"].includes(n.type)) lines.push(`border: ${n.stroke.width}px solid ${n.stroke.color};`);
  if (n.shadow?.on) {
    const alpha = Math.round(n.shadow.opacity * 255).toString(16).padStart(2, "0");
    lines.push(`box-shadow: ${n.shadow.x}px ${n.shadow.y}px ${n.shadow.blur}px ${n.shadow.color}${alpha};`);
  }
  if (n.blur?.on) lines.push(`filter: blur(${n.blur.radius}px);`);
  if (n.opacity < 1) lines.push(`opacity: ${n.opacity};`);
  if (n.type === "frame" && n.autoLayout.on) {
    const al = n.autoLayout;
    const map = { start: "flex-start", center: "center", end: "flex-end" };
    lines.push(
      "display: flex;",
      `flex-direction: ${al.direction === "vertical" ? "column" : "row"};`,
      `gap: ${al.gap}px;`,
      `padding: ${al.padding.t}px ${al.padding.r}px ${al.padding.b}px ${al.padding.l}px;`,
      `justify-content: ${al.spaceBetween ? "space-between" : map[al.justify]};`,
      `align-items: ${map[al.align]};`,
    );
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Interface                                                           */
/* ------------------------------------------------------------------ */

const KEYFRAMES =
  "@keyframes mmfigDissolve{from{opacity:0}to{opacity:1}}" +
  "@keyframes mmfigSlideLeft{from{transform:translateX(35%);opacity:.3}to{transform:none;opacity:1}}" +
  "@keyframes mmfigSlideRight{from{transform:translateX(-35%);opacity:.3}to{transform:none;opacity:1}}";
const ANIMATIONS = {
  dissolve: "mmfigDissolve .3s ease-out",
  "slide-left": "mmfigSlideLeft .3s ease-out",
  "slide-right": "mmfigSlideRight .3s ease-out",
};
const HANDLES = [
  ["nw", 0, 0, "nwse-resize"],
  ["n", 0.5, 0, "ns-resize"],
  ["ne", 1, 0, "nesw-resize"],
  ["e", 1, 0.5, "ew-resize"],
  ["se", 1, 1, "nwse-resize"],
  ["s", 0.5, 1, "ns-resize"],
  ["sw", 0, 1, "nesw-resize"],
  ["w", 0, 0.5, "ew-resize"],
];
const TOOL_HINTS = {
  move: "Clique para selecionar · Shift soma à seleção · arraste no vazio para seleção por área · Ctrl+clique seleciona dentro de grupos",
  frame: "Arraste para desenhar um frame ou escolha um tamanho predefinido no painel Design",
  rect: "Arraste para desenhar · Shift mantém proporção",
  ellipse: "Arraste para desenhar · Shift desenha um círculo",
  line: "Arraste para desenhar · Shift trava em 45°",
  arrow: "Arraste para desenhar a seta · Shift trava em 45°",
  pen: "Clique para adicionar pontos · Enter ou duplo clique conclui · clique no primeiro ponto fecha · Esc cancela",
  text: "Clique para criar um texto",
  hand: "Arraste para mover a visualização · roda do mouse desloca, Ctrl+roda aplica zoom",
  comment: "Clique no canvas para deixar um comentário neste projeto",
};
const toHex6 = (color) => {
  const c = String(color || "#000000");
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  if (/^#[0-9a-f]{6}/i.test(c)) return c.slice(0, 7).toLowerCase();
  return "#000000";
};

function Section({ title, action, children }) {
  return (
    <section className="border-b border-[#3b3b3b] px-3 py-3">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-slate-200">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}
function NumField({ label, short, value, onChange, disabled, step = 1, min, max, title }) {
  return (
    <label
      title={title || label}
      className={`flex min-w-0 items-center gap-1 rounded border border-transparent bg-[#383838] px-1.5 py-1 text-[10px] text-slate-400 hover:border-[#4a4a4a] focus-within:border-[#0d99ff] ${disabled ? "opacity-50" : ""}`}
    >
      <span className="shrink-0 select-none">{short}</span>
      <input
        aria-label={label}
        type="number"
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        value={Number.isFinite(value) ? round2(value) : ""}
        onChange={(event) => {
          const next = parseFloat(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-full min-w-0 bg-transparent text-right text-[11px] text-slate-100 outline-none"
      />
    </label>
  );
}
function ColorField({ label, value, onChange }) {
  const [draft, setDraft] = useState(null);
  return (
    <div className="flex items-center gap-2 rounded bg-[#383838] px-1.5 py-1">
      <input aria-label={`Cor ${label}`} type="color" value={toHex6(value)} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
      <input
        aria-label={`Hex ${label}`}
        value={draft ?? String(value).replace("#", "").toUpperCase()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== null && /^[0-9a-f]{6}$/i.test(draft)) onChange(`#${draft.toUpperCase()}`);
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="w-full min-w-0 bg-transparent text-[11px] uppercase text-slate-100 outline-none"
      />
    </div>
  );
}
function SmallButton({ label, onClick, children, pressed, disabled, className = "" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-7 min-w-7 place-items-center rounded px-1 text-[10px] disabled:opacity-40 ${pressed ? "bg-[#0d99ff] text-white" : "text-slate-300 hover:bg-[#414141]"} ${className}`}
    >
      {children}
    </button>
  );
}
const selectClass = "w-full rounded border border-transparent bg-[#383838] px-1.5 py-1 text-[11px] text-slate-100 outline-none focus:border-[#0d99ff]";

function Presentation({ doc, pageId, startId, onClose }) {
  const [state, setState] = useState({ frameId: startId, history: [], transition: "instant", key: 0 });
  const [showHotspots, setShowHotspots] = useState(false);
  const [flash, setFlash] = useState(false);
  const ref = useRef(null);
  const flashTimer = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    return () => clearTimeout(flashTimer.current);
  }, []);
  const frames = (doc.roots[pageId] || []).map((id) => doc.nodes[id]).filter((n) => n?.type === "frame" && n.visible);
  const frame = doc.nodes[state.frameId];
  function back() {
    setState((s) =>
      s.history.length
        ? { frameId: s.history[s.history.length - 1], history: s.history.slice(0, -1), transition: "dissolve", key: s.key + 1 }
        : s,
    );
  }
  function onHotspot(proto) {
    if (proto.action === "back") back();
    else if (proto.action === "url") {
      if (/^https?:\/\//i.test(proto.url)) window.open(proto.url, "_blank", "noopener,noreferrer");
    } else if (proto.action === "navigate" && doc.nodes[proto.targetId]) {
      setState((s) => ({ frameId: proto.targetId, history: [...s.history, s.frameId], transition: proto.transition, key: s.key + 1 }));
    }
  }
  const scene = frame ? sceneNode(doc, frame.id, { prefix: "p", onHotspot, showHotspots: showHotspots || flash }) : null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação do protótipo"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") onClose();
        if (event.key === "ArrowLeft" || event.key === "Backspace") back();
      }}
      className="fixed inset-0 z-[90] flex flex-col bg-[#1e1e1e] text-slate-200 outline-none"
    >
      <header className="flex items-center gap-2 border-b border-[#383838] bg-[#2c2c2c] px-3 py-2 text-[11px]">
        <Play size={14} className="text-[#0d99ff]" />
        <b>Apresentação</b>
        <select
          aria-label="Frame da apresentação"
          value={state.frameId}
          onChange={(event) => {
            const frameId = event.target.value;
            setState((s) => ({ frameId, history: [...s.history, s.frameId], transition: "instant", key: s.key + 1 }));
          }}
          className="rounded bg-[#383838] px-2 py-1"
        >
          {frames.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={back} disabled={!state.history.length} className="rounded border border-[#444] px-2 py-1 disabled:opacity-40">
          Voltar
        </button>
        <button
          type="button"
          onClick={() => setState((s) => ({ frameId: startId, history: [], transition: "instant", key: s.key + 1 }))}
          className="rounded border border-[#444] px-2 py-1"
        >
          Reiniciar
        </button>
        <label className="flex items-center gap-1">
          <input type="checkbox" aria-label="Mostrar áreas clicáveis" checked={showHotspots} onChange={(event) => setShowHotspots(event.target.checked)} />
          Áreas clicáveis
        </label>
        <span className="ml-auto text-slate-500">Esc fecha · ← volta</span>
        <button type="button" aria-label="Fechar apresentação" onClick={onClose} className="rounded p-1 hover:bg-[#414141]">
          <X size={15} />
        </button>
      </header>
      <div
        className="grid flex-1 place-items-center overflow-auto p-6"
        onClick={() => {
          setFlash(true);
          clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlash(false), 600);
        }}
      >
        {frame ? (
          <div key={state.key} style={{ animation: ANIMATIONS[state.transition] }}>
            <svg
              aria-label={`Tela ${frame.name}`}
              width={frame.w}
              height={frame.h}
              viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
              style={{ maxWidth: "100%", maxHeight: "calc(100vh - 120px)", height: "auto" }}
              className="shadow-2xl"
            >
              {toReact(scene)}
            </svg>
          </div>
        ) : (
          <p className="text-sm text-slate-400">O frame desta tela não existe mais.</p>
        )}
      </div>
    </div>
  );
}

export default function FigCraftWorkspace({ active = true } = {}) {
  const [doc, setDoc] = useGraphicDraftState(`${KEY}:doc`, createDocument);
  const [storedPage, setStoredPage] = useGraphicDraftState(`${KEY}:page`, null);
  const [view, setViewState] = useGraphicDraftState(`${KEY}:view`, { zoom: 0.5, x: 80, y: 80 });
  const [tool, setTool] = useState("move");
  const [selection, setSelection] = useState([]);
  const [leftTab, setLeftTab] = useState("layers");
  const [rightTab, setRightTab] = useState("design");
  const [status, setStatus] = useState("");
  const [menu, setMenu] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renamingPage, setRenamingPage] = useState(null);
  const [pen, setPen] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [hover, setHover] = useState(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [presenting, setPresenting] = useState(null);
  const [commentEdit, setCommentEdit] = useState(null);
  const [showComments, setShowComments] = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [exportOpts, setExportOpts] = useState({ format: "png", scale: 1 });
  const [assetQuery, setAssetQuery] = useState("");
  const [, setHistoryTick] = useState(0);

  const docRef = useRef(doc);
  docRef.current = doc;
  const viewRef = useRef(view);
  viewRef.current = view;
  const selRef = useRef(selection);
  selRef.current = selection;
  const historyRef = useRef({ past: [], future: [], key: null, at: 0 });
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const clipRef = useRef(null);
  const dragLayerRef = useRef(null);

  const pageId = doc.pages.some((p) => p.id === storedPage) ? storedPage : doc.pages[0].id;
  const page = doc.pages.find((p) => p.id === pageId);
  const roots = doc.roots[pageId] || [];
  const sel = useMemo(() => selection.filter((id) => doc.nodes[id] && pageOfNode(doc, id) === pageId), [selection, doc, pageId]);
  const single = sel.length === 1 ? doc.nodes[sel[0]] : null;
  const rootFrames = roots.map((id) => doc.nodes[id]).filter((n) => n?.type === "frame");
  const components = Object.values(doc.nodes).filter((n) => n.type === "frame" && n.isComponent);

  function setView(next) {
    viewRef.current = next;
    setViewState(next);
  }
  function setSel(ids) {
    selRef.current = ids;
    setSelection(ids);
  }
  function pushHistory(previous, coalesce) {
    const hst = historyRef.current;
    const now = Date.now();
    if (coalesce && hst.key === coalesce && now - hst.at < 1200) {
      hst.at = now;
      return;
    }
    hst.past.push(previous);
    if (hst.past.length > 100) hst.past.shift();
    hst.future = [];
    hst.key = coalesce || null;
    hst.at = now;
    setHistoryTick((t) => t + 1);
  }
  function commit(mutator, opts = {}) {
    const base = opts.base || docRef.current;
    const draft = clone(base);
    const result = mutator(draft);
    if (result === false) return null;
    normalize(draft);
    if (opts.record !== false) pushHistory(base, opts.coalesce);
    docRef.current = draft;
    setDoc(draft);
    return result;
  }
  function undo() {
    const hst = historyRef.current;
    if (!hst.past.length) {
      setStatus("Nada para desfazer.");
      return;
    }
    hst.future.push(docRef.current);
    const previous = hst.past.pop();
    hst.key = null;
    docRef.current = previous;
    setDoc(previous);
    setHistoryTick((t) => t + 1);
    setStatus("Ação desfeita.");
  }
  function redo() {
    const hst = historyRef.current;
    if (!hst.future.length) {
      setStatus("Nada para refazer.");
      return;
    }
    hst.past.push(docRef.current);
    const next = hst.future.pop();
    hst.key = null;
    docRef.current = next;
    setDoc(next);
    setHistoryTick((t) => t + 1);
    setStatus("Ação refeita.");
  }

  /* Visualização */
  function canvasSize() {
    const r = canvasRef.current?.getBoundingClientRect();
    return { w: r?.width || 1000, h: r?.height || 700, left: r?.left || 0, top: r?.top || 0 };
  }
  function toWorld(event) {
    const r = canvasSize();
    const v = viewRef.current;
    const sx = event.clientX - r.left;
    const sy = event.clientY - r.top;
    return { x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom, sx, sy };
  }
  function zoomAt(factor, sx, sy) {
    const v = viewRef.current;
    const zoom = Math.min(16, Math.max(0.05, v.zoom * factor));
    const wx = (sx - v.x) / v.zoom;
    const wy = (sy - v.y) / v.zoom;
    setView({ zoom: Math.round(zoom * 10000) / 10000, x: round2(sx - wx * zoom), y: round2(sy - wy * zoom) });
  }
  function zoomCenter(factor) {
    const c = canvasSize();
    zoomAt(factor, c.w / 2, c.h / 2);
  }
  function zoomToBounds(b) {
    if (!b || !b.w || !b.h) return;
    const c = canvasSize();
    const zoom = Math.min(8, Math.max(0.05, Math.min((c.w - 80) / b.w, (c.h - 80) / b.h)));
    setView({ zoom: Math.round(zoom * 10000) / 10000, x: round2(c.w / 2 - (b.x + b.w / 2) * zoom), y: round2(c.h / 2 - (b.y + b.h / 2) * zoom) });
  }
  function zoomFit() {
    const d = docRef.current;
    const list = (d.roots[pageId] || []).filter((id) => d.nodes[id]?.visible);
    if (!list.length) {
      setView({ zoom: 1, x: 80, y: 80 });
      return;
    }
    zoomToBounds(unionBounds(list.map((id) => absBounds(d, id))));
  }
  function zoomSelection() {
    if (!sel.length) return;
    zoomToBounds(unionBounds(sel.map((id) => absBounds(docRef.current, id))));
  }
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const r = el.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        zoomAt(Math.exp(-event.deltaY * 0.01), event.clientX - r.left, event.clientY - r.top);
      } else {
        const v = viewRef.current;
        const dx = event.shiftKey ? event.deltaY : event.deltaX;
        const dy = event.shiftKey ? 0 : event.deltaY;
        setView({ ...v, x: round2(v.x - dx), y: round2(v.y - dy) });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenu(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  /* Sessões de ponteiro */
  function track(onMove, onUp) {
    const move = (event) => onMove(event);
    const up = (event) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      onUp(event);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }
  function resolveHit(d, hitId, current, deep) {
    if (deep) return hitId;
    let target = hitId;
    let parent = d.nodes[target]?.parentId;
    while (parent && d.nodes[parent]?.type === "group" && !current.some((id) => id !== parent && d.nodes[id]?.parentId === parent)) {
      target = parent;
      parent = d.nodes[parent].parentId;
    }
    return target;
  }
  function startPan(event) {
    const start = { x: event.clientX, y: event.clientY };
    const v0 = viewRef.current;
    track(
      (ev) => setView({ ...v0, x: round2(v0.x + ev.clientX - start.x), y: round2(v0.y + ev.clientY - start.y) }),
      () => {},
    );
  }
  function startMarquee(p0, event, candidates) {
    const base = event.shiftKey ? selRef.current : [];
    let moved = false;
    track(
      (ev) => {
        const p = toWorld(ev);
        if (!moved && Math.hypot(p.sx - p0.sx, p.sy - p0.sy) < 3) return;
        moved = true;
        const rect = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) };
        setMarquee(rect);
        const d = docRef.current;
        const hits = candidates.filter((id) => {
          const n = d.nodes[id];
          return n && n.visible && !n.locked && intersects(absBounds(d, id), rect);
        });
        setSel([...new Set([...base, ...hits])]);
      },
      () => {
        setMarquee(null);
        if (!moved && !event.shiftKey) setSel([]);
      },
    );
  }
  function startMove(ids, p0, clickSelect) {
    const start = docRef.current;
    const movable = ids.filter((id) => start.nodes[id] && !start.nodes[id].locked);
    if (!movable.length) return;
    let moved = false;
    const deltaOf = (ev) => {
      const p = toWorld(ev);
      let dx = p.x - p0.x;
      let dy = p.y - p0.y;
      if (ev.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      return { p, dx, dy };
    };
    track(
      (ev) => {
        const { p, dx, dy } = deltaOf(ev);
        if (!moved && Math.hypot(p.sx - p0.sx, p.sy - p0.sy) < 3) return;
        moved = true;
        commit(
          (d) => {
            movable.forEach((id) => {
              const n = d.nodes[id];
              const parent = n.parentId ? d.nodes[n.parentId] : null;
              if (parent?.autoLayout?.on && !n.absolute) reorderInFlow(d, parent, id, p);
              else moveByWorld(d, id, dx, dy);
            });
          },
          { base: start, record: false },
        );
      },
      (ev) => {
        if (!moved) {
          if (clickSelect) setSel([clickSelect]);
          return;
        }
        const { p, dx, dy } = deltaOf(ev);
        commit(
          (d) => {
            const exclude = new Set(movable.flatMap((id) => [id, ...descendants(d, id)]));
            movable.forEach((id) => {
              const n = d.nodes[id];
              const parent = n.parentId ? d.nodes[n.parentId] : null;
              const inFlow = parent?.autoLayout?.on && !n.absolute;
              if (inFlow) {
                const local = worldToLocal(d, parent.id, p);
                if (local.x >= 0 && local.y >= 0 && local.x <= parent.w && local.y <= parent.h) return;
                moveByWorld(d, id, dx, dy);
              }
              let target = frameAt(d, pageId, p, exclude);
              if (n.type === "frame" && target) {
                const b = absBounds(d, id);
                const t = absBounds(d, target);
                if (b.x < t.x || b.y < t.y || b.x + b.w > t.x + t.w || b.y + b.h > t.y + t.h) target = n.parentId;
              }
              if (target === n.parentId && !inFlow) return;
              if (instanceWouldRecurse(d, target, id)) return;
              reparentKeep(d, pageId, id, target || null);
              const nextParent = target ? d.nodes[target] : null;
              if (nextParent?.autoLayout?.on) reorderInFlow(d, nextParent, id, p);
            });
          },
          { base: docRef.current, record: false },
        );
        pushHistory(start);
      },
    );
  }
  function startResize(dir, p0) {
    const id = selRef.current[0];
    const start = docRef.current;
    const n0 = start.nodes[id];
    if (!n0 || n0.locked) return;
    if (n0.type === "instance") {
      setStatus("O tamanho da instância segue o componente principal. Redimensione o principal ou desanexe a instância.");
      return;
    }
    const hx = dir.includes("e") ? 1 : dir.includes("w") ? -1 : 0;
    const hy = dir.includes("s") ? 1 : dir.includes("n") ? -1 : 0;
    const pInv = invert(parentMatrix(start, id));
    const r = -rad(n0.rotation || 0);
    let moved = false;
    track(
      (ev) => {
        const p = toWorld(ev);
        const dx = p.x - p0.x;
        const dy = p.y - p0.y;
        const px = pInv[0] * dx + pInv[2] * dy;
        const py = pInv[1] * dx + pInv[3] * dy;
        const lx = px * Math.cos(r) - py * Math.sin(r);
        const ly = px * Math.sin(r) + py * Math.cos(r);
        let w1 = n0.w + hx * lx;
        let h1 = n0.h + hy * ly;
        if (ev.shiftKey && n0.w && n0.h) {
          if (hx && hy) {
            const s = Math.max(w1 / n0.w, h1 / n0.h);
            w1 = n0.w * s;
            h1 = n0.h * s;
          } else if (hx) h1 = n0.h * (w1 / n0.w);
          else w1 = n0.w * (h1 / n0.h);
        }
        moved = true;
        commit(
          (d) => {
            const n = d.nodes[id];
            resizeNode(d, id, w1, h1);
            const fx = hx === 1 ? 0 : hx === -1 ? 1 : 0.5;
            const fy = hy === 1 ? 0 : hy === -1 ? 1 : 0.5;
            const anchor = apply(localMatrix(n0), fx * n0.w, fy * n0.h);
            const moving = apply(localMatrix({ ...n, x: 0, y: 0 }), fx * n.w, fy * n.h);
            n.x = round2(anchor.x - moving.x);
            n.y = round2(anchor.y - moving.y);
          },
          { base: start, record: false },
        );
      },
      () => {
        if (moved) pushHistory(start);
      },
    );
  }
  function startCreate(type, p0) {
    const start = docRef.current;
    const parentId = frameAt(start, pageId, p0, new Set());
    const id = newId();
    const make = (p, shift) =>
      commit(
        (d) => {
          let x1 = p.x;
          let y1 = p.y;
          const dx = x1 - p0.x;
          const dy = y1 - p0.y;
          if (shift && (type === "line" || type === "arrow")) {
            const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(dx, dy);
            x1 = p0.x + Math.cos(angle) * len;
            y1 = p0.y + Math.sin(angle) * len;
          } else if (shift) {
            const s = Math.max(Math.abs(dx), Math.abs(dy));
            x1 = p0.x + Math.sign(dx || 1) * s;
            y1 = p0.y + Math.sign(dy || 1) * s;
          }
          const label = type === "frame" ? "Frame" : TYPE_LABEL[type];
          const n = baseNode(type, {
            id,
            name: nextName(d, type, label),
            x: round2(Math.min(p0.x, x1)),
            y: round2(Math.min(p0.y, y1)),
            w: round2(Math.abs(x1 - p0.x)),
            h: round2(Math.abs(y1 - p0.y)),
          });
          if (type === "line" || type === "arrow") {
            n.flipX = x1 < p0.x;
            n.flipY = y1 < p0.y;
            if (!parentId) n.stroke.color = "#FFFFFF";
          }
          d.nodes[id] = n;
          insertInto(d, pageId, null, id);
          if (parentId && d.nodes[parentId]) reparentKeep(d, pageId, id, parentId);
        },
        { base: start, record: false },
      );
    make(p0, false);
    track(
      (ev) => make(toWorld(ev), ev.shiftKey),
      (ev) => {
        const p = toWorld(ev);
        if (Math.hypot(p.sx - (p0.sx ?? p.sx), p.sy - (p0.sy ?? p.sy)) < 3) {
          make({ x: p0.x + 100, y: p0.y + (type === "line" || type === "arrow" ? 0 : 100) }, false);
        }
        pushHistory(start);
        setSel([id]);
        setTool("move");
      },
    );
  }
  function createText(p) {
    const d0 = docRef.current;
    const parentId = frameAt(d0, pageId, p, new Set());
    const id = commit((d) => {
      const n = baseNode("text", { name: nextName(d, "text"), x: round2(p.x), y: round2(p.y) });
      if (!parentId) n.fill.color = "#FFFFFF";
      d.nodes[n.id] = n;
      insertInto(d, pageId, null, n.id);
      if (parentId) reparentKeep(d, pageId, n.id, parentId);
      return n.id;
    });
    setSel([id]);
    setTool("move");
    setEditingText({ id, value: "Texto", fresh: true });
  }
  function finishPen(closed) {
    const raw = pen?.points || [];
    setPen(null);
    const pts = raw.filter((p, i) => i === 0 || Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y) > 0.5);
    if (pts.length < 2) return;
    const d0 = docRef.current;
    const parentId = frameAt(d0, pageId, pts[0], new Set());
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const bx = Math.min(...xs);
    const by = Math.min(...ys);
    const id = commit((d) => {
      const n = baseNode("path", {
        name: nextName(d, "path"),
        x: round2(bx),
        y: round2(by),
        w: round2(Math.max(1, Math.max(...xs) - bx)),
        h: round2(Math.max(1, Math.max(...ys) - by)),
        points: pts.map((p) => ({ x: round2(p.x - bx), y: round2(p.y - by) })),
        closed,
      });
      n.fill.on = closed;
      if (!parentId) n.stroke.color = "#FFFFFF";
      d.nodes[n.id] = n;
      insertInto(d, pageId, null, n.id);
      if (parentId) reparentKeep(d, pageId, n.id, parentId);
      return n.id;
    });
    setSel([id]);
    setTool("move");
  }
  function penClick(p) {
    if (!pen) {
      setPen({ points: [p] });
      return;
    }
    const first = pen.points[0];
    if (pen.points.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) * viewRef.current.zoom < 8) {
      finishPen(true);
      return;
    }
    setPen({ points: [...pen.points, p] });
  }
  function onCanvasPointerDown(event) {
    if (event.button === 2) return;
    rootRef.current?.focus({ preventScroll: true });
    const p = toWorld(event);
    if (tool === "hand" || spaceHeld || event.button === 1) {
      startPan(event);
      return;
    }
    if (tool === "comment") {
      setCommentEdit({ id: null, x: round2(p.x), y: round2(p.y), value: "" });
      return;
    }
    if (tool === "pen") {
      penClick(p);
      return;
    }
    if (["frame", "rect", "ellipse", "line", "arrow"].includes(tool)) {
      startCreate(tool, p);
      return;
    }
    if (tool === "text") {
      createText(p);
      return;
    }
    const target = event.target;
    const handle = target.closest?.("[data-handle]");
    if (handle) {
      startResize(handle.getAttribute("data-handle"), p);
      return;
    }
    const d = docRef.current;
    const label = target.closest?.("[data-frame-label]");
    const hitEl = target.closest?.("[data-node-id]");
    let id = label?.getAttribute("data-frame-label") || null;
    if (!id && hitEl) {
      const hitId = hitEl.getAttribute("data-node-id");
      const n = d.nodes[hitId];
      const deep = event.ctrlKey || event.metaKey;
      if (n && !n.parentId && n.type === "frame" && n.children.length && !deep && !selRef.current.includes(hitId)) {
        startMarquee(p, event, n.children);
        return;
      }
      id = resolveHit(d, hitId, selRef.current, deep);
    }
    if (!id || !d.nodes[id]) {
      startMarquee(p, event, d.roots[pageId] || []);
      return;
    }
    const current = selRef.current;
    const wasSelected = current.includes(id);
    let next;
    if (event.shiftKey) next = wasSelected ? current.filter((x) => x !== id) : [...current.filter((x) => !isAncestor(d, x, id) && !isAncestor(d, id, x)), id];
    else next = wasSelected ? current : [id];
    setSel(next);
    if (event.shiftKey && wasSelected) return;
    startMove(next, p, wasSelected && !event.shiftKey && current.length > 1 ? id : null);
  }
  function onCanvasHover(event) {
    if (event.buttons) return;
    const hitEl = event.target.closest?.("[data-node-id]");
    const id = hitEl ? resolveHit(doc, hitEl.getAttribute("data-node-id"), selection, event.ctrlKey || event.metaKey) : event.target.closest?.("[data-frame-label]")?.getAttribute("data-frame-label") || null;
    if (id !== hover) setHover(id);
  }
  function onCanvasDoubleClick(event) {
    if (tool === "pen") {
      finishPen(false);
      return;
    }
    const hitEl = event.target.closest?.("[data-node-id]");
    if (!hitEl) return;
    const id = hitEl.getAttribute("data-node-id");
    const n = doc.nodes[id];
    if (!n) return;
    setSel([id]);
    if (n.type === "text" && !n.locked) setEditingText({ id, value: n.text, fresh: false });
  }
  function finishTextEdit() {
    const current = editingText;
    setEditingText(null);
    if (!current || !docRef.current.nodes[current.id]) return;
    if (!current.value.trim() && current.fresh) {
      commit((d) => {
        deleteNodes(d, [current.id]);
      }, { record: false });
      setSel([]);
      return;
    }
    if (docRef.current.nodes[current.id].text === current.value) return;
    commit((d) => {
      d.nodes[current.id].text = current.value;
      if (d.nodes[current.id].name.startsWith("Texto") && current.fresh) d.nodes[current.id].name = current.value.split("\n")[0].slice(0, 40) || d.nodes[current.id].name;
    });
  }

  /* Comandos */
  function patchSelected(fn, key) {
    const ids = sel;
    if (!ids.length) return;
    commit(
      (d) => {
        ids.forEach((id) => {
          if (d.nodes[id]) fn(d.nodes[id], d, id);
        });
      },
      { coalesce: key ? `${key}:${ids.join(",")}` : undefined },
    );
  }
  function deleteSelection() {
    if (!sel.length) return;
    let detached = 0;
    commit((d) => {
      detached = deleteNodes(d, topLevel(d, pageId, sel));
    });
    setSel([]);
    setStatus(detached ? `Camadas excluídas. ${detached} instância(s) foram desanexadas e preservadas.` : "Camadas excluídas.");
  }
  function copySelection() {
    const d = docRef.current;
    const ids = topLevel(d, pageId, sel);
    if (!ids.length) {
      setStatus("Selecione camadas para copiar.");
      return false;
    }
    const nodes = {};
    ids.forEach((id) => {
      nodes[id] = clone(d.nodes[id]);
      descendants(d, id).forEach((x) => {
        nodes[x] = clone(d.nodes[x]);
      });
    });
    clipRef.current = {
      nodes,
      roots: ids,
      abs: Object.fromEntries(ids.map((id) => [id, absMatrix(d, id)])),
      parents: Object.fromEntries(ids.map((id) => [id, d.nodes[id].parentId])),
    };
    setStatus(`${ids.length} camada(s) copiada(s) na área de transferência interna do MMFig.`);
    return true;
  }
  function pasteClipboard() {
    const clip = clipRef.current;
    if (!clip) {
      setStatus("Nada para colar. Copie camadas do MMFig primeiro (Ctrl+C).");
      return;
    }
    const d0 = docRef.current;
    let target = null;
    if (sel.length === 1) {
      const s = d0.nodes[sel[0]];
      target = s?.type === "frame" && !clip.roots.includes(s.id) ? s.id : s?.parentId || null;
    }
    const ids = commit((d) => {
      const out = [];
      clip.roots.forEach((rid) => {
        const asInstance = Boolean(clip.nodes[rid].isComponent && d.nodes[rid]?.isComponent);
        const created = {};
        const nid = cloneSubtree({ nodes: clip.nodes }, rid, created, asInstance);
        Object.assign(d.nodes, created);
        const n = d.nodes[nid];
        let parent = target && d.nodes[target] ? target : null;
        if (instanceWouldRecurse(d, parent, nid)) parent = null;
        if (parent && parent !== clip.parents[rid]) {
          n.x = clip.nodes[rid].x;
          n.y = clip.nodes[rid].y;
        } else {
          Object.assign(n, decompose(mul(invert(parent ? absMatrix(d, parent) : IDENTITY), clip.abs[rid]), n.w, n.h));
          n.x = round2(n.x + 20);
          n.y = round2(n.y + 20);
        }
        insertInto(d, pageId, parent, nid);
        out.push(nid);
      });
      return out;
    });
    setSel(ids || []);
    setStatus(`${ids?.length || 0} camada(s) colada(s).`);
  }
  function duplicateSelection() {
    if (!sel.length) return;
    const ids = commit((d) => {
      const out = [];
      topLevel(d, pageId, sel).forEach((id) => {
        const src = d.nodes[id];
        const created = {};
        const nid = cloneSubtree(d, id, created, Boolean(src.isComponent));
        Object.assign(d.nodes, created);
        const n = d.nodes[nid];
        n.x = round2(src.x + 20);
        n.y = round2(src.y + 20);
        const list = containerList(d, pageId, src.parentId);
        insertInto(d, pageId, src.parentId, nid, list.indexOf(id) + 1);
        out.push(nid);
      });
      return out;
    });
    setSel(ids || []);
    setStatus("Camadas duplicadas. Componentes principais duplicados viram instâncias.");
  }
  function selectAll() {
    const d = docRef.current;
    const parentId = sel.length ? d.nodes[sel[0]].parentId : null;
    const scope = containerList(d, pageId, parentId) || [];
    setSel(scope.filter((id) => d.nodes[id]?.visible && !d.nodes[id].locked));
  }
  function groupSelection(kind = "group") {
    if (!sel.length) {
      setStatus("Selecione camadas para agrupar.");
      return;
    }
    const id = commit((d) => {
      const res = wrapSelection(d, pageId, topLevel(d, pageId, sel), kind);
      if (res.error) {
        setStatus(res.error);
        return false;
      }
      return res.id;
    });
    if (id) {
      setSel([id]);
      setStatus(kind === "group" ? "Camadas agrupadas." : "Seleção colocada em um frame.");
    }
  }
  function ungroupSelection() {
    if (!sel.some((id) => doc.nodes[id]?.type === "group")) {
      setStatus("Selecione um grupo para desagrupar.");
      return;
    }
    const ids = commit((d) => {
      const out = [];
      sel.forEach((id) => {
        if (d.nodes[id]?.type === "group") out.push(...ungroup(d, pageId, id));
        else if (d.nodes[id]) out.push(id);
      });
      return out;
    });
    setSel(ids || []);
    setStatus("Grupo desfeito.");
  }
  function makeComponent() {
    if (!sel.length) {
      setStatus("Selecione camadas para criar um componente.");
      return;
    }
    const id = commit((d) => {
      const ids = topLevel(d, pageId, sel);
      if (ids.length === 1) {
        const n = d.nodes[ids[0]];
        if (n.type === "instance") {
          setStatus("Desanexe a instância antes de transformá-la em componente.");
          return false;
        }
        if (n.isComponent) {
          setStatus("Esta camada já é um componente principal.");
          return false;
        }
        if (n.type === "frame") {
          n.isComponent = true;
          return n.id;
        }
        if (n.type === "group") {
          const def = baseNode("frame");
          Object.assign(n, { type: "frame", clip: false, isComponent: true, autoLayout: def.autoLayout, fill: { ...n.fill, on: false } });
          return n.id;
        }
      }
      const res = wrapSelection(d, pageId, ids, "frame");
      if (res.error) {
        setStatus(res.error);
        return false;
      }
      const count = Object.values(d.nodes).filter((n) => n.isComponent).length;
      Object.assign(d.nodes[res.id], { isComponent: true, name: `Componente ${count + 1}` });
      return res.id;
    });
    if (id) {
      setSel([id]);
      setStatus("Componente criado. Duplique (Ctrl+D) ou use Assets para inserir instâncias.");
    }
  }
  function insertInstance(mainId) {
    const d0 = docRef.current;
    const main = d0.nodes[mainId];
    if (!main) return;
    let parent = null;
    if (sel.length === 1) {
      const s = d0.nodes[sel[0]];
      if (s?.type === "frame" && s.id !== mainId && !isAncestor(d0, mainId, s.id)) parent = s.id;
    }
    const mainPage = pageOfNode(d0, mainId);
    const b = absBounds(d0, mainId);
    const existing = Object.values(d0.nodes).filter((n) => n.type === "instance" && n.mainId === mainId).length;
    const id = commit((d) => {
      const inst = baseNode("instance", { name: main.name, mainId, w: main.w, h: main.h, overrides: {} });
      d.nodes[inst.id] = inst;
      if (parent) {
        inst.x = 10;
        inst.y = 10;
      } else if (mainPage === pageId) {
        inst.x = round2(b.x + b.w + 40);
        inst.y = round2(b.y + existing * (main.h + 20));
      } else {
        const c = canvasSize();
        const v = viewRef.current;
        inst.x = round2((c.w / 2 - v.x) / v.zoom - main.w / 2);
        inst.y = round2((c.h / 2 - v.y) / v.zoom - main.h / 2);
      }
      insertInto(d, pageId, parent, inst.id);
      return inst.id;
    });
    setSel([id]);
    setStatus(`Instância de ${main.name} criada.`);
  }
  function goToMain(mainId) {
    const target = pageOfNode(docRef.current, mainId);
    if (!target) return;
    setStoredPage(target);
    setSel([mainId]);
    zoomToBounds(absBounds(docRef.current, mainId));
  }
  function toggleAutoLayout() {
    if (!sel.length) {
      setStatus("Selecione um frame ou camadas para aplicar auto layout.");
      return;
    }
    const id = commit((d) => {
      const ids = topLevel(d, pageId, sel);
      if (ids.length === 1 && d.nodes[ids[0]].type === "frame") {
        const f = d.nodes[ids[0]];
        f.autoLayout.on = !f.autoLayout.on;
        if (f.autoLayout.on) {
          const kids = f.children.map((childId) => d.nodes[childId]);
          const spanX = kids.length ? Math.max(...kids.map((k) => k.x + k.w)) - Math.min(...kids.map((k) => k.x)) : 1;
          const spanY = kids.length ? Math.max(...kids.map((k) => k.y + k.h)) - Math.min(...kids.map((k) => k.y)) : 0;
          f.autoLayout.direction = spanY > spanX ? "vertical" : "horizontal";
          f.autoLayout.hugW = kids.length > 0;
          f.autoLayout.hugH = kids.length > 0;
          sortFlow(d, f);
        }
        return f.id;
      }
      const res = wrapSelection(d, pageId, ids, "frame");
      if (res.error) {
        setStatus(res.error);
        return false;
      }
      const f = d.nodes[res.id];
      f.autoLayout.on = true;
      sortFlow(d, f);
      return f.id;
    });
    if (id) {
      setSel([id]);
      setStatus(docRef.current.nodes[id]?.autoLayout?.on ? "Auto layout aplicado." : "Auto layout removido.");
    }
  }
  function alignNodes(mode) {
    if (!sel.length) return;
    const d0 = docRef.current;
    let ref;
    if (sel.length === 1) {
      const n = d0.nodes[sel[0]];
      if (!n.parentId) {
        setStatus("Para alinhar, selecione duas camadas ou uma camada dentro de um frame.");
        return;
      }
      ref = absBounds(d0, n.parentId);
    } else ref = unionBounds(sel.map((id) => absBounds(d0, id)));
    commit((d) => {
      sel.forEach((id) => {
        const b = absBounds(d, id);
        let dx = 0;
        let dy = 0;
        if (mode === "left") dx = ref.x - b.x;
        if (mode === "hcenter") dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
        if (mode === "right") dx = ref.x + ref.w - (b.x + b.w);
        if (mode === "top") dy = ref.y - b.y;
        if (mode === "vcenter") dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
        if (mode === "bottom") dy = ref.y + ref.h - (b.y + b.h);
        moveByWorld(d, id, dx, dy);
      });
    });
  }
  function reorderSelection(mode) {
    if (!sel.length) return;
    commit((d) => reorder(d, pageId, sel, mode));
  }
  function toggleNodeFlag(id, flag) {
    commit((d) => {
      d.nodes[id][flag] = !d.nodes[id][flag];
    });
    if (flag === "locked" && !doc.nodes[id].locked) setSel(sel.filter((x) => x !== id));
  }
  function addFramePreset(preset) {
    const d0 = docRef.current;
    const list = d0.roots[pageId] || [];
    let x = 0;
    let y = 0;
    if (list.length) {
      const b = unionBounds(list.map((rid) => absBounds(d0, rid)));
      x = round2(b.x + b.w + 100);
      y = round2(b.y);
    }
    const id = commit((d) => {
      const n = baseNode("frame", { name: nextName(d, "frame", preset.label), x, y, w: preset.w, h: preset.h });
      d.nodes[n.id] = n;
      insertInto(d, pageId, null, n.id);
      return n.id;
    });
    setSel([id]);
    setTool("move");
    zoomToBounds({ x, y, w: preset.w, h: preset.h });
  }
  async function runExport(overrides) {
    const opts = { ...exportOpts, ...(overrides || {}) };
    const d = docRef.current;
    let targets = topLevel(d, pageId, sel).filter((id) => d.nodes[id]?.visible);
    let name = targets.length === 1 ? d.nodes[targets[0]].name : `${targets.length}-camadas`;
    if (!targets.length) {
      targets = (d.roots[pageId] || []).filter((id) => d.nodes[id].visible);
      name = page.name;
    }
    if (!targets.length) {
      setStatus("Nada para exportar nesta página.");
      return;
    }
    setStatus((await exportToFile(d, targets, name, opts)).summary);
  }
  function downloadProject() {
    const payload = JSON.stringify({ schema: SCHEMA, exportedAt: new Date().toISOString(), document: docRef.current }, null, 2);
    downloadBlob(new Blob([payload], { type: "application/json" }), `${slug(docRef.current.name)}.mmfig.json`);
    setStatus("Projeto baixado como JSON.");
  }
  async function importProject(file) {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("Arquivo maior que 20 MB.");
      const text = typeof file.text === "function"
        ? await file.text()
        : await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          });
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("o conteúdo não é JSON válido.");
      }
      const next = sanitizeDocument(parsed);
      pushHistory(docRef.current);
      docRef.current = next;
      setDoc(next);
      setStoredPage(next.pages[0].id);
      setSel([]);
      setStatus(`Projeto "${next.name}" importado. Use Desfazer para voltar ao anterior.`);
    } catch (error) {
      setStatus(`Não foi possível importar: ${error.message} O projeto atual foi preservado.`);
    }
  }
  function newProject() {
    if (!window.confirm("Criar um projeto novo? O atual pode ser recuperado com Desfazer enquanto a página estiver aberta. Baixe uma cópia se precisar.")) return;
    const next = createDocument();
    pushHistory(docRef.current);
    docRef.current = next;
    setDoc(next);
    setStoredPage(next.pages[0].id);
    setSel([]);
    setStatus("Novo projeto criado.");
  }
  function startPresentation() {
    const d = docRef.current;
    const frames = (d.roots[pageId] || []).filter((id) => d.nodes[id]?.type === "frame" && d.nodes[id].visible);
    if (!frames.length) {
      setStatus("Crie ao menos um frame nesta página para apresentar.");
      return;
    }
    const selectedTop = sel.length === 1 ? rootOf(d, sel[0]) : null;
    const start = frames.includes(d.flowStart[pageId]) ? d.flowStart[pageId] : frames.includes(selectedTop) ? selectedTop : frames[0];
    setPresenting({ startId: start });
  }
  function rootOf(d, id) {
    let n = d.nodes[id];
    while (n?.parentId) n = d.nodes[n.parentId];
    return n?.id || null;
  }
  function addPage() {
    const id = newId("p");
    commit((d) => {
      d.pages.push({ id, name: `Página ${d.pages.length + 1}`, background: "#1E1E1E" });
      d.roots[id] = [];
    });
    setStoredPage(id);
    setSel([]);
  }
  function deletePage(id) {
    if (doc.pages.length < 2) return;
    const target = doc.pages.find((p) => p.id === id);
    if (!window.confirm(`Excluir a página "${target.name}" e todas as suas camadas? Você pode desfazer em seguida.`)) return;
    commit((d) => {
      deleteNodes(d, [...(d.roots[id] || [])]);
      d.pages = d.pages.filter((p) => p.id !== id);
      delete d.roots[id];
    });
    if (id === pageId) setStoredPage(doc.pages.find((p) => p.id !== id).id);
    setSel([]);
  }
  function commitRename() {
    const current = renaming;
    setRenaming(null);
    if (!current || !current.value.trim() || !docRef.current.nodes[current.id]) return;
    commit((d) => {
      d.nodes[current.id].name = current.value.trim().slice(0, 200);
    });
  }
  function onLayerDrop(event, targetId) {
    event.preventDefault();
    const dragId = dragLayerRef.current;
    dragLayerRef.current = null;
    const d0 = docRef.current;
    if (!dragId || dragId === targetId || !d0.nodes[dragId] || isAncestor(d0, dragId, targetId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const height = rect.height || 24;
    const measured = (event.clientY - rect.top) / height;
    // Sem coordenadas (ex.: arrastar por teclado/acessibilidade), solta acima da linha alvo.
    const rel = Number.isFinite(measured) ? measured : 0;
    const t = d0.nodes[targetId];
    const container = t.type === "frame" || t.type === "group";
    const zone = container && rel > 0.3 && rel < 0.7 ? "inside" : rel < 0.5 ? "above" : "below";
    if (zone === "inside" && instanceWouldRecurse(d0, targetId, dragId)) return;
    commit((d) => {
      const target = d.nodes[targetId];
      if (zone === "inside") {
        reparentKeep(d, pageId, dragId, targetId);
        return;
      }
      if (instanceWouldRecurse(d, target.parentId, dragId)) return false;
      reparentKeep(d, pageId, dragId, target.parentId);
      const list = containerList(d, pageId, target.parentId);
      list.splice(list.indexOf(dragId), 1);
      const ti = list.indexOf(targetId);
      list.splice(zone === "above" ? ti + 1 : ti, 0, dragId);
    });
  }
  function saveComment() {
    const current = commentEdit;
    setCommentEdit(null);
    if (!current) return;
    const text = current.value.trim();
    commit((d) => {
      if (current.id) {
        const c = d.comments.find((item) => item.id === current.id);
        if (!c) return false;
        if (!text) d.comments = d.comments.filter((item) => item.id !== current.id);
        else c.text = text.slice(0, 5000);
        return undefined;
      }
      if (!text) return false;
      d.comments.push({ id: newId("c"), pageId, x: current.x, y: current.y, text: text.slice(0, 5000), resolved: false, createdAt: new Date().toISOString() });
      return undefined;
    });
  }
  function patchComment(id, fn) {
    commit((d) => {
      const c = d.comments.find((item) => item.id === id);
      if (!c) return false;
      fn(d, c);
      return undefined;
    });
  }

  /* Teclado */
  function onKeyDown(event) {
    const tag = event.target.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || event.target.isContentEditable) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const run = (fn) => {
      event.preventDefault();
      fn();
    };
    if (event.key === " ") return run(() => setSpaceHeld(true));
    if (mod && key === "z") return run(() => (event.shiftKey ? redo() : undo()));
    if (mod && key === "y") return run(redo);
    if (mod && key === "c") return run(copySelection);
    if (mod && key === "x") return run(() => copySelection() && deleteSelection());
    if (mod && key === "v") return run(pasteClipboard);
    if (mod && key === "d") return run(duplicateSelection);
    if (mod && key === "a") return run(selectAll);
    if (mod && key === "g") return run(() => (event.shiftKey ? ungroupSelection() : event.altKey ? groupSelection("frame") : groupSelection()));
    if (mod && event.altKey && key === "k") return run(makeComponent);
    if (mod && event.code === "BracketRight") return run(() => reorderSelection(event.shiftKey ? "front" : "forward"));
    if (mod && event.code === "BracketLeft") return run(() => reorderSelection(event.shiftKey ? "back" : "backward"));
    if (mod && event.shiftKey && key === "h") return run(() => sel.forEach((id) => toggleNodeFlag(id, "visible")));
    if (mod && event.shiftKey && key === "l") return run(() => sel.forEach((id) => toggleNodeFlag(id, "locked")));
    if (mod && (key === "=" || key === "+")) return run(() => zoomCenter(1.25));
    if (mod && key === "-") return run(() => zoomCenter(0.8));
    if (event.shiftKey && event.code === "Digit0") return run(() => setView({ ...viewRef.current, zoom: 1 }));
    if (event.shiftKey && event.code === "Digit1") return run(zoomFit);
    if (event.shiftKey && event.code === "Digit2") return run(zoomSelection);
    if (event.shiftKey && key === "a" && !mod) return run(toggleAutoLayout);
    if (event.key === "Delete" || event.key === "Backspace") return run(deleteSelection);
    if (event.key === "Escape") {
      return run(() => {
        if (pen) setPen(null);
        else if (menu) setMenu(null);
        else if (single?.parentId) setSel([single.parentId]);
        else setSel([]);
      });
    }
    if (event.key === "Enter") {
      return run(() => {
        if (pen) finishPen(false);
        else if (event.shiftKey && single?.parentId) setSel([single.parentId]);
        else if (single?.type === "text") setEditingText({ id: single.id, value: single.text, fresh: false });
        else if (single?.children?.length) setSel([...single.children]);
      });
    }
    if (event.key.startsWith("Arrow") && sel.length) {
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      return run(() => patchSelected((n, d, id) => !n.locked && moveByWorld(d, id, dx, dy), "nudge"));
    }
    if (!mod && !event.altKey) {
      const shortcut = event.shiftKey ? `Shift+${event.key.toUpperCase()}` : event.key.toUpperCase();
      const match = TOOLS.find((t) => t.key === shortcut);
      if (match) return run(() => chooseTool(match.id));
    }
    return undefined;
  }
  function onKeyUp(event) {
    if (event.key === " ") setSpaceHeld(false);
  }
  function chooseTool(id) {
    if (tool === "pen" && id !== "pen" && pen) finishPen(false);
    setTool(id);
  }

  /* MCP: ferramentas de um clique (grade de ícones no Copiloto). Planejam sobre o documento atual e gravam
     pelo histórico do MMFig (Ctrl+Z). Refs porque a fila executa várias ações antes do React redesenhar. */
  const mcpState = useRef(null);
  mcpState.current = { pageId };
  const mcpActions = useRef(null);
  mcpActions.current = { pushHistory, undo, setDoc, setSel, setStatus };
  const mcpHistory = useRef([]);
  useEffect(() => {
    if (!active) return undefined;
    const current = () => {
      const d = docRef.current;
      const wanted = mcpState.current.pageId;
      return { doc: d, pageId: d.pages.some((p) => p.id === wanted) ? wanted : d.pages[0].id, selection: selRef.current };
    };
    const strip = ({ doc: _doc, selection: _selection, exportJob: _exportJob, ...result }) => result;
    return registerMCPActions({
      source: "mmfig",
      label: "MMFig",
      catalogue: () => mmfigCatalogue(current()),
      analyze: async (toolId, params) => {
        const result = runMMFigTool(toolId, current(), params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const state = current();
        const result = runMMFigTool(toolId, state, params);
        const actions = mcpActions.current;
        if (!result.ok) return strip(result);
        if (result.exportJob) {
          const { ids, name, ...opts } = result.exportJob;
          const outcome = await exportToFile(state.doc, ids, name, opts);
          actions.setStatus(outcome.ok ? `MCP · ${outcome.summary}` : outcome.summary);
          return { ...outcome, count: ids.length };
        }
        actions.pushHistory(state.doc);
        docRef.current = result.doc;
        actions.setDoc(result.doc);
        if (result.selection) actions.setSel(result.selection);
        mcpHistory.current.push(result.doc);
        actions.setStatus(`MCP · ${result.summary}`);
        return strip(result);
      },
      undo: () => {
        const last = mcpHistory.current.at(-1);
        if (!last) return false;
        if (docRef.current !== last) {
          mcpHistory.current = [];
          mcpActions.current.setStatus("O projeto mudou depois da ação do MCP: desfazer cancelado para não perder suas alterações (use Ctrl+Z no MMFig).");
          return false;
        }
        mcpHistory.current.pop();
        mcpActions.current.undo();
        mcpActions.current.setStatus("MCP · Última ação desfeita.");
        return true;
      },
      canUndo: () => mcpHistory.current.length > 0,
    });
  }, [active]);

  /* Menus */
  const hst = historyRef.current;
  const MENUS = [
    {
      label: "Arquivo",
      items: [
        { label: "Novo projeto", run: newProject },
        { label: "Abrir projeto (.json)…", run: () => document.getElementById(`${KEY}-import`)?.click() },
        { label: "Baixar projeto (.json)", run: downloadProject },
        "-",
        { label: "Exportar como PNG", run: () => { setExportOpts((o) => ({ ...o, format: "png" })); runExport({ format: "png" }); } },
        { label: "Exportar como SVG", run: () => { setExportOpts((o) => ({ ...o, format: "svg" })); runExport({ format: "svg" }); } },
      ],
    },
    {
      label: "Editar",
      items: [
        { label: "Desfazer", shortcut: "Ctrl+Z", run: undo, disabled: !hst.past.length },
        { label: "Refazer", shortcut: "Ctrl+Shift+Z", run: redo, disabled: !hst.future.length },
        "-",
        { label: "Copiar", shortcut: "Ctrl+C", run: copySelection, disabled: !sel.length },
        { label: "Colar", shortcut: "Ctrl+V", run: pasteClipboard },
        { label: "Duplicar", shortcut: "Ctrl+D", run: duplicateSelection, disabled: !sel.length },
        { label: "Excluir", shortcut: "Delete", run: deleteSelection, disabled: !sel.length },
        { label: "Selecionar tudo", shortcut: "Ctrl+A", run: selectAll },
      ],
    },
    {
      label: "Objeto",
      items: [
        { label: "Agrupar seleção", shortcut: "Ctrl+G", run: () => groupSelection(), disabled: !sel.length },
        { label: "Desagrupar", shortcut: "Ctrl+Shift+G", run: ungroupSelection, disabled: !sel.length },
        { label: "Colocar em frame", shortcut: "Ctrl+Alt+G", run: () => groupSelection("frame"), disabled: !sel.length },
        { label: "Criar componente", shortcut: "Ctrl+Alt+K", run: makeComponent, disabled: !sel.length },
        { label: "Adicionar/remover auto layout", shortcut: "Shift+A", run: toggleAutoLayout, disabled: !sel.length },
        "-",
        { label: "Trazer para frente", shortcut: "Ctrl+Shift+]", run: () => reorderSelection("front"), disabled: !sel.length },
        { label: "Avançar", shortcut: "Ctrl+]", run: () => reorderSelection("forward"), disabled: !sel.length },
        { label: "Recuar", shortcut: "Ctrl+[", run: () => reorderSelection("backward"), disabled: !sel.length },
        { label: "Enviar para trás", shortcut: "Ctrl+Shift+[", run: () => reorderSelection("back"), disabled: !sel.length },
        "-",
        { label: "Mostrar/ocultar", shortcut: "Ctrl+Shift+H", run: () => sel.forEach((id) => toggleNodeFlag(id, "visible")), disabled: !sel.length },
        { label: "Bloquear/desbloquear", shortcut: "Ctrl+Shift+L", run: () => sel.forEach((id) => toggleNodeFlag(id, "locked")), disabled: !sel.length },
      ],
    },
    {
      label: "Exibir",
      items: [
        { label: "Aumentar zoom", shortcut: "Ctrl++", run: () => zoomCenter(1.25) },
        { label: "Diminuir zoom", shortcut: "Ctrl+-", run: () => zoomCenter(0.8) },
        { label: "Zoom 100%", shortcut: "Shift+0", run: () => setView({ ...viewRef.current, zoom: 1 }) },
        { label: "Ajustar tudo", shortcut: "Shift+1", run: zoomFit },
        { label: "Ajustar à seleção", shortcut: "Shift+2", run: zoomSelection, disabled: !sel.length },
        "-",
        { label: showComments ? "Ocultar comentários" : "Mostrar comentários", run: () => setShowComments((v) => !v) },
      ],
    },
    {
      label: "Protótipo",
      items: [
        { label: "Apresentar", run: startPresentation },
        { label: "Editar interações", run: () => setRightTab("prototype") },
      ],
    },
  ];

  /* Sobreposição do canvas */
  const z = view.zoom;
  const overlay = [];
  rootFrames.forEach((f) => {
    if (!f.visible) return;
    const selected = sel.includes(f.id);
    overlay.push(
      <text
        key={`label-${f.id}`}
        data-frame-label={f.id}
        x={f.x}
        y={f.y - 6 / z}
        fontSize={11 / z}
        fill={selected ? ACCENT : f.isComponent ? COMPONENT_COLOR : "#a3a3a3"}
        style={{ cursor: "default", userSelect: "none" }}
      >
        {f.isComponent ? `◆ ${f.name}` : f.name}
      </text>,
    );
  });
  if (rightTab === "prototype") {
    Object.values(doc.nodes).forEach((n) => {
      if (n.proto?.action !== "navigate" || !doc.nodes[n.proto.targetId] || pageOfNode(doc, n.id) !== pageId || pageOfNode(doc, n.proto.targetId) !== pageId) return;
      const a = absBounds(doc, n.id);
      const b = absBounds(doc, n.proto.targetId);
      const fx = a.x + a.w;
      const fy = a.y + a.h / 2;
      const tx = b.x;
      const ty = b.y + b.h / 2;
      overlay.push(
        <g key={`proto-${n.id}`} pointerEvents="none" aria-label={`Conexão de ${n.name} para ${doc.nodes[n.proto.targetId].name}`}>
          <path d={`M${fx} ${fy} C${fx + 80 / z} ${fy} ${tx - 80 / z} ${ty} ${tx} ${ty}`} fill="none" stroke={ACCENT} strokeWidth={2 / z} />
          <circle cx={fx} cy={fy} r={4 / z} fill={ACCENT} />
          <path d={`M${tx} ${ty} l${-8 / z} ${-5 / z} l0 ${10 / z} z`} fill={ACCENT} />
        </g>,
      );
    });
  }
  if (hover && !sel.includes(hover) && doc.nodes[hover]) {
    const n = doc.nodes[hover];
    overlay.push(<rect key="hover" transform={matrixAttr(absMatrix(doc, hover))} width={n.w} height={n.h} fill="none" stroke={ACCENT} strokeWidth={1.5 / z} pointerEvents="none" />);
  }
  sel.forEach((id) => {
    const n = doc.nodes[id];
    overlay.push(
      <g key={`sel-${id}`} transform={matrixAttr(absMatrix(doc, id))} aria-label={`Seleção ${n.name}`}>
        <rect width={n.w} height={n.h} fill="none" stroke={n.isComponent || n.type === "instance" ? COMPONENT_COLOR : ACCENT} strokeWidth={1.5 / z} pointerEvents="none" />
        {sel.length === 1 && !n.locked &&
          HANDLES.map(([dir, fx, fy, cursor]) => (
            <rect
              key={dir}
              data-handle={dir}
              aria-label={`Redimensionar ${dir}`}
              x={fx * n.w - 4 / z}
              y={fy * n.h - 4 / z}
              width={8 / z}
              height={8 / z}
              fill="#ffffff"
              stroke={ACCENT}
              strokeWidth={1 / z}
              style={{ cursor }}
            />
          ))}
        {sel.length === 1 && (
          <text x={n.w / 2} y={n.h + 16 / z} fontSize={10 / z} textAnchor="middle" fill={ACCENT} pointerEvents="none">
            {`${round2(n.w)} × ${round2(n.h)}`}
          </text>
        )}
      </g>,
    );
  });
  if (marquee) overlay.push(<rect key="marquee" x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="rgba(13,153,255,0.12)" stroke={ACCENT} strokeWidth={1 / z} pointerEvents="none" />);
  if (pen) {
    overlay.push(
      <g key="pen" pointerEvents="none">
        <polyline points={pen.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={ACCENT} strokeWidth={1.5 / z} />
        {pen.points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4 / z} fill="#ffffff" stroke={ACCENT} strokeWidth={1 / z} />
        ))}
      </g>,
    );
  }
  const pageComments = doc.comments.filter((c) => c.pageId === pageId);
  const cursor = tool === "hand" || spaceHeld ? "grab" : tool === "text" ? "text" : tool === "move" ? "default" : "crosshair";

  /* Painéis */
  function renderLayer(id, depth) {
    const n = doc.nodes[id];
    if (!n) return null;
    const Icon = n.isComponent ? Component : TYPE_ICON[n.type];
    const selected = sel.includes(id);
    const open = !collapsed[id];
    const kids = n.children ? [...n.children].reverse() : [];
    return (
      <li key={id} role="none">
        <div
          role="treeitem"
          aria-selected={selected}
          aria-level={depth + 1}
          aria-expanded={n.children ? open : undefined}
          draggable={!renaming}
          onDragStart={(event) => {
            dragLayerRef.current = id;
            event.dataTransfer?.setData?.("text/plain", id);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onLayerDrop(event, id)}
          className={`group flex h-7 items-center gap-1 pr-1 text-[11px] ${selected ? "bg-[#0d99ff]/25 text-white" : "text-slate-300 hover:bg-[#383838]"}`}
          style={{ paddingLeft: 4 + depth * 14 }}
        >
          {n.children ? (
            <button type="button" aria-label={`${open ? "Recolher" : "Expandir"} ${n.name}`} onClick={() => setCollapsed((c) => ({ ...c, [id]: open }))} className="grid h-4 w-4 place-items-center text-slate-500">
              {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Icon size={12} className={n.isComponent || n.type === "instance" ? "shrink-0 text-[#9747ff]" : "shrink-0 text-slate-400"} />
          {renaming?.id === id ? (
            <input
              autoFocus
              aria-label={`Renomear camada ${n.name}`}
              value={renaming.value}
              onChange={(event) => setRenaming({ id, value: event.target.value })}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") commitRename();
                if (event.key === "Escape") setRenaming(null);
              }}
              onBlur={commitRename}
              className="min-w-0 flex-1 bg-[#1f1f1f] px-1 text-[11px] text-white outline outline-1 outline-[#0d99ff]"
            />
          ) : (
            <button
              type="button"
              aria-label={`Camada ${n.name}`}
              onClick={(event) => {
                if (event.shiftKey) setSel(selected ? sel.filter((x) => x !== id) : [...sel, id]);
                else setSel([id]);
              }}
              onDoubleClick={() => setRenaming({ id, value: n.name })}
              className={`min-w-0 flex-1 truncate text-left ${n.visible ? "" : "opacity-40"} ${n.isComponent || n.type === "instance" ? "text-[#c4a5ff]" : ""}`}
            >
              {n.name}
            </button>
          )}
          <button
            type="button"
            aria-label={`${n.locked ? "Desbloquear" : "Bloquear"} ${n.name}`}
            onClick={() => toggleNodeFlag(id, "locked")}
            className={`text-slate-400 ${n.locked ? "" : "opacity-0 focus:opacity-100 group-hover:opacity-100"}`}
          >
            {n.locked ? <Lock size={11} /> : <LockOpen size={11} />}
          </button>
          <button
            type="button"
            aria-label={`${n.visible ? "Ocultar" : "Mostrar"} ${n.name}`}
            onClick={() => toggleNodeFlag(id, "visible")}
            className={`text-slate-400 ${n.visible ? "opacity-0 focus:opacity-100 group-hover:opacity-100" : ""}`}
          >
            {n.visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
        </div>
        {n.children && open && kids.length > 0 && <ul role="group">{kids.map((childId) => renderLayer(childId, depth + 1))}</ul>}
      </li>
    );
  }

  function renderExportSection(label) {
    return (
      <Section title="Exportar">
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Escala de exportação" value={exportOpts.scale} disabled={exportOpts.format === "svg"} onChange={(event) => setExportOpts((o) => ({ ...o, scale: Number(event.target.value) }))} className={selectClass}>
            {[0.5, 1, 2, 3, 4].map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
          <select aria-label="Formato de exportação" value={exportOpts.format} onChange={(event) => setExportOpts((o) => ({ ...o, format: event.target.value }))} className={selectClass}>
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
          </select>
        </div>
        <button type="button" onClick={() => runExport()} className="mt-2 w-full rounded border border-[#4a4a4a] py-1.5 text-[11px] hover:bg-[#383838]">
          <Download size={12} className="mr-1 inline" />
          {`Exportar ${label}`}
        </button>
      </Section>
    );
  }

  function renderDesign() {
    const presets = (
      <Section title="Frames predefinidos">
        <div className="grid gap-1">
          {FRAME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-label={`Criar frame ${preset.label}`}
              onClick={() => addFramePreset(preset)}
              className="flex justify-between rounded px-2 py-1.5 text-left text-[11px] text-slate-300 hover:bg-[#383838]"
            >
              <span>{preset.label}</span>
              <span className="text-slate-500">
                {preset.w}×{preset.h}
              </span>
            </button>
          ))}
        </div>
      </Section>
    );
    if (!sel.length) {
      return (
        <>
          {presets}
          <Section title="Página">
            <ColorField label="do fundo da página" value={page.background} onChange={(color) => commit((d) => { d.pages.find((p) => p.id === pageId).background = color; }, { coalesce: "page-bg" })} />
          </Section>
          {renderExportSection("página")}
        </>
      );
    }
    const n = single || doc.nodes[sel[0]];
    const parent = single?.parentId ? doc.nodes[single.parentId] : null;
    const inFlow = Boolean(parent?.autoLayout?.on && !single?.absolute);
    const set = (key, fn) => (value) => patchSelected((node, d, id) => fn(node, value, d, id), key);
    const al = single?.type === "frame" ? single.autoLayout : null;
    const alCells = ["start", "center", "end"];
    return (
      <>
        {tool === "frame" && presets}
        <Section title={single ? `${single.isComponent ? "Componente" : TYPE_LABEL[single.type]} · ${single.name}` : `${sel.length} camadas selecionadas`}>
          {single?.type === "frame" && (
            <select
              aria-label="Predefinição do frame"
              value={FRAME_PRESETS.find((p) => p.w === single.w && p.h === single.h)?.id || ""}
              onChange={(event) => {
                const preset = FRAME_PRESETS.find((p) => p.id === event.target.value);
                if (preset) patchSelected((node, d, id) => resizeNode(d, id, preset.w, preset.h));
              }}
              className={`${selectClass} mb-2`}
            >
              <option value="">Tamanho personalizado</option>
              {FRAME_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{`${p.label} · ${p.w}×${p.h}`}</option>
              ))}
            </select>
          )}
          <div className="mb-2 flex gap-0.5" role="group" aria-label="Alinhamento">
            <SmallButton label="Alinhar à esquerda" onClick={() => alignNodes("left")}><AlignStartVertical size={13} /></SmallButton>
            <SmallButton label="Centralizar horizontalmente" onClick={() => alignNodes("hcenter")}><AlignCenterVertical size={13} /></SmallButton>
            <SmallButton label="Alinhar à direita" onClick={() => alignNodes("right")}><AlignEndVertical size={13} /></SmallButton>
            <SmallButton label="Alinhar ao topo" onClick={() => alignNodes("top")}><AlignStartHorizontal size={13} /></SmallButton>
            <SmallButton label="Centralizar verticalmente" onClick={() => alignNodes("vcenter")}><AlignCenterHorizontal size={13} /></SmallButton>
            <SmallButton label="Alinhar à base" onClick={() => alignNodes("bottom")}><AlignEndHorizontal size={13} /></SmallButton>
          </div>
          {single && (
            <div className="grid grid-cols-2 gap-1.5">
              <NumField label="Posição X" short="X" value={single.x} disabled={inFlow} title={inFlow ? "Posição controlada pelo auto layout" : "Posição X"} onChange={set("x", (node, v) => { node.x = v; })} />
              <NumField label="Posição Y" short="Y" value={single.y} disabled={inFlow} title={inFlow ? "Posição controlada pelo auto layout" : "Posição Y"} onChange={set("y", (node, v) => { node.y = v; })} />
              <NumField label="Largura" short="L" value={single.w} disabled={single.type === "instance"} title={single.type === "instance" ? "O tamanho segue o componente principal" : "Largura"} onChange={set("w", (node, v, d, id) => resizeNode(d, id, v, node.h))} />
              <NumField label="Altura" short="A" value={single.h} disabled={single.type === "instance"} title={single.type === "instance" ? "O tamanho segue o componente principal" : "Altura"} onChange={set("h", (node, v, d, id) => resizeNode(d, id, node.w, v))} />
              <NumField label="Rotação" short="↻" value={single.rotation} disabled={single.type === "group"} title={single.type === "group" ? "Gire as camadas do grupo individualmente" : "Rotação em graus"} onChange={set("rotation", (node, v) => { node.rotation = ((v % 360) + 360) % 360 > 180 ? (((v % 360) + 360) % 360) - 360 : ((v % 360) + 360) % 360; })} />
              {["rect", "frame"].includes(single.type) && <NumField label="Raio dos cantos" short="◜" min={0} value={single.radius} onChange={set("radius", (node, v) => { node.radius = Math.max(0, v); })} />}
            </div>
          )}
          {single?.type === "frame" && (
            <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-300">
              <input type="checkbox" aria-label="Recortar conteúdo" checked={single.clip} onChange={(event) => patchSelected((node) => { node.clip = event.target.checked; })} />
              Recortar conteúdo
            </label>
          )}
        </Section>
        {single && (single.type !== "frame" || !single.isComponent) && single.type !== "instance" && (
          <Section title="Componente">
            <button type="button" onClick={makeComponent} className="w-full rounded border border-[#4a4a4a] py-1.5 text-[11px] text-[#c4a5ff] hover:bg-[#383838]">
              <Component size={12} className="mr-1 inline" />
              Criar componente
            </button>
          </Section>
        )}
        {single?.isComponent && (
          <Section title="Componente principal">
            <p className="mb-2 text-[10px] text-slate-500">
              {Object.values(doc.nodes).filter((x) => x.type === "instance" && x.mainId === single.id).length} instância(s) seguem este componente.
            </p>
            <button type="button" onClick={() => insertInstance(single.id)} className="w-full rounded border border-[#4a4a4a] py-1.5 text-[11px] text-[#c4a5ff] hover:bg-[#383838]">
              Criar instância
            </button>
          </Section>
        )}
        {single?.type === "instance" && (() => {
          const main = doc.nodes[single.mainId];
          const texts = main ? descendants(doc, main.id).map((id) => doc.nodes[id]).filter((x) => x.type === "text") : [];
          return (
            <Section title={main ? `Instância de ${main.name}` : "Instância sem componente principal"}>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" disabled={!main} onClick={() => goToMain(single.mainId)} className="rounded border border-[#4a4a4a] py-1.5 text-[10px] hover:bg-[#383838] disabled:opacity-40">Ir para o principal</button>
                <button type="button" disabled={!main} onClick={() => { const id = commit((d) => detachInstance(d, single.id)); if (id) { setSel([id]); setStatus("Instância desanexada."); } }} className="rounded border border-[#4a4a4a] py-1.5 text-[10px] hover:bg-[#383838] disabled:opacity-40">Desanexar instância</button>
                <button type="button" disabled={!Object.keys(single.overrides || {}).length} onClick={() => patchSelected((node) => { node.overrides = {}; })} className="col-span-2 rounded border border-[#4a4a4a] py-1.5 text-[10px] hover:bg-[#383838] disabled:opacity-40">Redefinir substituições</button>
              </div>
              {texts.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[10px] text-slate-500">Substituições de texto</p>
                  {texts.map((t) => (
                    <input
                      key={t.id}
                      aria-label={`Texto de ${t.name}`}
                      value={single.overrides?.[t.id]?.text ?? t.text}
                      onChange={(event) => patchSelected((node) => { node.overrides = { ...(node.overrides || {}), [t.id]: { text: event.target.value } }; }, `override-${t.id}`)}
                      className="w-full rounded bg-[#383838] px-1.5 py-1 text-[11px] text-slate-100 outline-none focus:outline focus:outline-1 focus:outline-[#0d99ff]"
                    />
                  ))}
                </div>
              )}
            </Section>
          );
        })()}
        {single?.type === "frame" && (
          <Section
            title="Auto layout"
            action={
              <SmallButton label={al.on ? "Remover auto layout" : "Adicionar auto layout"} onClick={toggleAutoLayout}>
                {al.on ? <Minus size={13} /> : <Plus size={13} />}
              </SmallButton>
            }
          >
            {al.on ? (
              <div className="space-y-2">
                <div className="flex gap-1">
                  <SmallButton label="Direção horizontal" pressed={al.direction === "horizontal"} onClick={() => patchSelected((node) => { node.autoLayout.direction = "horizontal"; })}><ArrowRight size={13} /></SmallButton>
                  <SmallButton label="Direção vertical" pressed={al.direction === "vertical"} onClick={() => patchSelected((node) => { node.autoLayout.direction = "vertical"; })}><ArrowDown size={13} /></SmallButton>
                  <label className="ml-auto flex items-center gap-1 text-[10px] text-slate-300">
                    <input type="checkbox" aria-label="Espaçamento automático" checked={al.spaceBetween} onChange={(event) => patchSelected((node) => { node.autoLayout.spaceBetween = event.target.checked; })} />
                    Automático
                  </label>
                </div>
                <div className="grid grid-cols-[72px_1fr] gap-2">
                  <div className="grid grid-cols-3 gap-0.5 rounded bg-[#383838] p-1" role="group" aria-label="Alinhamento do auto layout">
                    {[0, 1, 2].map((row) =>
                      [0, 1, 2].map((col) => {
                        const horizontal = al.direction !== "vertical";
                        const justify = alCells[horizontal ? col : row];
                        const align = alCells[horizontal ? row : col];
                        const active = al.align === align && (al.spaceBetween || al.justify === justify);
                        return (
                          <button
                            key={`${row}-${col}`}
                            type="button"
                            aria-label={`Alinhar ${["topo", "meio", "base"][row]} ${["esquerda", "centro", "direita"][col]}`}
                            aria-pressed={active}
                            onClick={() => patchSelected((node) => { node.autoLayout.justify = justify; node.autoLayout.align = align; })}
                            className="grid h-5 place-items-center"
                          >
                            <span className={`block rounded-sm ${active ? "h-2 w-2 bg-[#0d99ff]" : "h-1 w-1 bg-slate-500"}`} />
                          </button>
                        );
                      }),
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <NumField label="Espaçamento entre itens" short="↔" value={al.gap} onChange={set("gap", (node, v) => { node.autoLayout.gap = v; })} />
                    <NumField label="Padding horizontal" short="H" min={0} value={al.padding.l} onChange={set("padh", (node, v) => { node.autoLayout.padding.l = Math.max(0, v); node.autoLayout.padding.r = Math.max(0, v); })} />
                    <NumField label="Padding vertical" short="V" min={0} value={al.padding.t} onChange={set("padv", (node, v) => { node.autoLayout.padding.t = Math.max(0, v); node.autoLayout.padding.b = Math.max(0, v); })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <select aria-label="Largura no auto layout" value={al.hugW ? "hug" : "fixed"} onChange={(event) => patchSelected((node) => { node.autoLayout.hugW = event.target.value === "hug"; })} className={selectClass}>
                    <option value="fixed">L fixa</option>
                    <option value="hug">L abraça conteúdo</option>
                  </select>
                  <select aria-label="Altura no auto layout" value={al.hugH ? "hug" : "fixed"} onChange={(event) => patchSelected((node) => { node.autoLayout.hugH = event.target.value === "hug"; })} className={selectClass}>
                    <option value="fixed">A fixa</option>
                    <option value="hug">A abraça conteúdo</option>
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">Organize os filhos em linha ou coluna com espaçamento e padding (Shift+A).</p>
            )}
          </Section>
        )}
        {single && parent?.type === "frame" && (
          <Section title={inFlow || parent.autoLayout.on ? "Layout no frame pai" : "Restrições"}>
            {parent.autoLayout.on && (
              <label className="mb-2 flex items-center gap-2 text-[11px] text-slate-300">
                <input type="checkbox" aria-label="Ignorar auto layout" checked={single.absolute} onChange={(event) => patchSelected((node) => { node.absolute = event.target.checked; })} />
                Posição absoluta (ignorar auto layout)
              </label>
            )}
            {(!parent.autoLayout.on || single.absolute) && (
              <div className="grid grid-cols-2 gap-1.5">
                <select aria-label="Restrição horizontal" value={single.constraints.h} onChange={(event) => patchSelected((node) => { node.constraints.h = event.target.value; })} className={selectClass}>
                  {H_CONSTRAINTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select aria-label="Restrição vertical" value={single.constraints.v} onChange={(event) => patchSelected((node) => { node.constraints.v = event.target.value; })} className={selectClass}>
                  {V_CONSTRAINTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
          </Section>
        )}
        <Section title="Camada">
          <NumField label="Opacidade da camada" short="%" min={0} max={100} value={Math.round(n.opacity * 100)} onChange={set("opacity", (node, v) => { node.opacity = Math.min(1, Math.max(0, v / 100)); })} />
        </Section>
        {single?.type === "text" && (
          <Section title="Texto">
            <textarea aria-label="Conteúdo do texto" value={single.text} onChange={(event) => patchSelected((node) => { node.text = event.target.value; }, "text")} rows={2} className="mb-1.5 w-full resize-y rounded bg-[#383838] p-1.5 text-[11px] text-slate-100 outline-none" />
            <select aria-label="Fonte" value={single.fontFamily} onChange={(event) => patchSelected((node) => { node.fontFamily = event.target.value; })} className={`${selectClass} mb-1.5`}>
              {FONTS.map((f) => <option key={f}>{f}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-1.5">
              <select aria-label="Peso da fonte" value={single.fontWeight} onChange={(event) => patchSelected((node) => { node.fontWeight = Number(event.target.value); })} className={selectClass}>
                {[[300, "Light"], [400, "Regular"], [500, "Medium"], [600, "Semibold"], [700, "Bold"], [800, "Extra bold"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <NumField label="Tamanho da fonte" short="T" min={1} value={single.fontSize} onChange={set("fontSize", (node, v) => { node.fontSize = Math.min(1000, Math.max(1, v)); })} />
              <NumField label="Altura da linha" short="↕" step={0.1} min={0.5} value={single.lineHeight} onChange={set("lineHeight", (node, v) => { node.lineHeight = Math.max(0.5, v); })} />
              <select aria-label="Redimensionamento do texto" value={single.textResize} onChange={(event) => patchSelected((node) => { node.textResize = event.target.value; })} className={selectClass}>
                <option value="auto">Largura automática</option>
                <option value="height">Altura automática</option>
                <option value="fixed">Tamanho fixo</option>
              </select>
            </div>
            <div className="mt-1.5 flex gap-0.5">
              {[["left", "Alinhar texto à esquerda", "Esq."], ["center", "Centralizar texto", "Centro"], ["right", "Alinhar texto à direita", "Dir."]].map(([v, l, s]) => (
                <SmallButton key={v} label={l} pressed={single.textAlign === v} onClick={() => patchSelected((node) => { node.textAlign = v; })}>{s}</SmallButton>
              ))}
            </div>
          </Section>
        )}
        {n.type !== "group" && n.type !== "instance" && (
          <Section
            title="Preenchimento"
            action={<SmallButton label={n.fill.on ? "Remover preenchimento" : "Adicionar preenchimento"} onClick={() => patchSelected((node) => { if (node.fill) node.fill.on = !n.fill.on; })}>{n.fill.on ? <Minus size={13} /> : <Plus size={13} />}</SmallButton>}
          >
            {n.fill.on && <ColorField label="do preenchimento" value={n.fill.color} onChange={(color) => patchSelected((node) => { if (node.fill) node.fill.color = color; }, "fill")} />}
          </Section>
        )}
        {n.type !== "group" && n.type !== "instance" && (
          <Section
            title="Traço"
            action={<SmallButton label={n.stroke.on ? "Remover traço" : "Adicionar traço"} onClick={() => patchSelected((node) => { if (node.stroke) node.stroke.on = !n.stroke.on; })}>{n.stroke.on ? <Minus size={13} /> : <Plus size={13} />}</SmallButton>}
          >
            {n.stroke.on && (
              <div className="grid grid-cols-[1fr_70px] gap-1.5">
                <ColorField label="do traço" value={n.stroke.color} onChange={(color) => patchSelected((node) => { if (node.stroke) node.stroke.color = color; }, "stroke")} />
                <NumField label="Espessura do traço" short="≡" min={0} value={n.stroke.width} onChange={set("strokeWidth", (node, v) => { if (node.stroke) node.stroke.width = Math.max(0, v); })} />
              </div>
            )}
          </Section>
        )}
        <Section title="Efeitos">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>Sombra projetada</span>
            <SmallButton label={n.shadow.on ? "Remover sombra" : "Adicionar sombra"} onClick={() => patchSelected((node) => { node.shadow.on = !n.shadow.on; })}>{n.shadow.on ? <Minus size={13} /> : <Plus size={13} />}</SmallButton>
          </div>
          {n.shadow.on && (
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <NumField label="Sombra X" short="X" value={n.shadow.x} onChange={set("shx", (node, v) => { node.shadow.x = v; })} />
              <NumField label="Sombra Y" short="Y" value={n.shadow.y} onChange={set("shy", (node, v) => { node.shadow.y = v; })} />
              <NumField label="Desfoque da sombra" short="D" min={0} value={n.shadow.blur} onChange={set("shb", (node, v) => { node.shadow.blur = Math.max(0, v); })} />
              <NumField label="Opacidade da sombra" short="%" min={0} max={100} value={Math.round(n.shadow.opacity * 100)} onChange={set("sho", (node, v) => { node.shadow.opacity = Math.min(1, Math.max(0, v / 100)); })} />
              <div className="col-span-2">
                <ColorField label="da sombra" value={n.shadow.color} onChange={(color) => patchSelected((node) => { node.shadow.color = color; }, "shc")} />
              </div>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
            <span>Desfoque da camada</span>
            <SmallButton label={n.blur.on ? "Remover desfoque de camada" : "Adicionar desfoque de camada"} onClick={() => patchSelected((node) => { node.blur.on = !n.blur.on; })}>{n.blur.on ? <Minus size={13} /> : <Plus size={13} />}</SmallButton>
          </div>
          {n.blur.on && <div className="mt-1"><NumField label="Raio do desfoque" short="R" min={0} value={n.blur.radius} onChange={set("blr", (node, v) => { node.blur.radius = Math.max(0, v); })} /></div>}
        </Section>
        {renderExportSection(single ? single.name : "seleção")}
      </>
    );
  }

  function renderPrototype() {
    const flow = (
      <Section title="Ponto de partida do fluxo">
        <select
          aria-label="Frame inicial do fluxo"
          value={doc.flowStart[pageId] || ""}
          onChange={(event) => {
            const value = event.target.value;
            commit((d) => {
              if (value) d.flowStart[pageId] = value;
              else delete d.flowStart[pageId];
            });
          }}
          className={selectClass}
        >
          <option value="">Frame selecionado ou o primeiro</option>
          {rootFrames.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button type="button" onClick={startPresentation} className="mt-2 w-full rounded bg-[#0d99ff] py-1.5 text-[11px] font-bold text-white">
          <Play size={12} className="mr-1 inline" />
          Apresentar
        </button>
      </Section>
    );
    if (!single) {
      return (
        <>
          {flow}
          <Section title="Interações">
            <p className="text-[10px] text-slate-500">Selecione uma camada para ligá-la a outro frame. No modo Apresentar, clique nas áreas ligadas para navegar.</p>
          </Section>
        </>
      );
    }
    const proto = single.proto;
    const ownRoot = rootOf(doc, single.id);
    const targets = rootFrames.filter((f) => f.id !== ownRoot);
    return (
      <>
        <Section
          title={`Interação · ${single.name}`}
          action={
            !proto && (
              <SmallButton
                label="Adicionar interação"
                onClick={() => {
                  if (!targets.length) setStatus("Crie outro frame nesta página para servir de destino.");
                  patchSelected((node) => { node.proto = { trigger: "click", action: "navigate", targetId: targets[0]?.id || null, transition: "instant", url: "" }; });
                }}
              >
                <Plus size={13} />
              </SmallButton>
            )
          }
        >
          {proto ? (
            <div className="space-y-1.5 text-[11px]">
              <p className="rounded bg-[#383838] px-1.5 py-1 text-slate-300">Gatilho: ao clicar</p>
              <select aria-label="Ação da interação" value={proto.action} onChange={(event) => patchSelected((node) => { node.proto.action = event.target.value; })} className={selectClass}>
                <option value="navigate">Navegar para</option>
                <option value="back">Voltar</option>
                <option value="url">Abrir link</option>
              </select>
              {proto.action === "navigate" && (
                <>
                  <select aria-label="Destino da interação" value={proto.targetId || ""} onChange={(event) => patchSelected((node) => { node.proto.targetId = event.target.value || null; })} className={selectClass}>
                    <option value="">Escolha um frame</option>
                    {targets.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <select aria-label="Transição" value={proto.transition} onChange={(event) => patchSelected((node) => { node.proto.transition = event.target.value; })} className={selectClass}>
                    {TRANSITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </>
              )}
              {proto.action === "url" && (
                <input
                  aria-label="Endereço do link"
                  placeholder="https://"
                  value={proto.url}
                  onChange={(event) => patchSelected((node) => { node.proto.url = event.target.value.slice(0, 2000); }, "url")}
                  className="w-full rounded bg-[#383838] px-1.5 py-1 text-[11px] text-slate-100 outline-none"
                />
              )}
              {proto.action === "url" && proto.url && !/^https?:\/\//i.test(proto.url) && <p className="text-[10px] text-amber-300">Use um endereço iniciado por http:// ou https://.</p>}
              <button type="button" onClick={() => patchSelected((node) => { node.proto = null; })} className="w-full rounded border border-[#4a4a4a] py-1 text-[10px] hover:bg-[#383838]">
                Remover interação
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-slate-500">Sem interação. Use + para ligar esta camada a outro frame.</p>
          )}
        </Section>
        {flow}
      </>
    );
  }

  function renderInspect() {
    if (!single) return <Section title="Inspecionar"><p className="text-[10px] text-slate-500">Selecione uma camada para ver medidas e o CSS gerado.</p></Section>;
    const b = absBounds(doc, single.id);
    const css = cssFor(doc, single);
    return (
      <>
        <Section title="Medidas">
          <dl className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
            <dt>Largura</dt><dd className="text-right text-slate-200">{round2(single.w)} px</dd>
            <dt>Altura</dt><dd className="text-right text-slate-200">{round2(single.h)} px</dd>
            <dt>X no canvas</dt><dd className="text-right text-slate-200">{round2(b.x)} px</dd>
            <dt>Y no canvas</dt><dd className="text-right text-slate-200">{round2(b.y)} px</dd>
          </dl>
        </Section>
        <Section
          title="CSS"
          action={
            <button
              type="button"
              onClick={async () => {
                try {
                  if (!navigator.clipboard?.writeText) throw new Error("indisponível");
                  await navigator.clipboard.writeText(css);
                  setStatus("CSS copiado.");
                } catch {
                  setStatus("Área de transferência indisponível neste navegador. Selecione o texto e copie manualmente.");
                }
              }}
              className="rounded px-2 py-0.5 text-[10px] text-slate-300 hover:bg-[#414141]"
            >
              Copiar CSS
            </button>
          }
        >
          <pre aria-label="CSS gerado" className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-[#1f1f1f] p-2 text-[10px] text-emerald-300">{css}</pre>
        </Section>
      </>
    );
  }

  const comps = components.filter((c) => c.name.toLowerCase().includes(assetQuery.trim().toLowerCase()));
  const editingNode = editingText ? doc.nodes[editingText.id] : null;
  const editingBounds = editingNode ? absBounds(doc, editingNode.id) : null;

  return (
    <section ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown} onKeyUp={onKeyUp} className="space-y-2 bg-[#151515] text-slate-200 outline-none">
      <style>{KEYFRAMES}</style>
      <header className="flex items-center gap-3 border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold text-white">MMFig</h1>
          <p className="text-[10px] text-slate-500">
            {`${doc.name} · ${doc.pages.length} página(s) · ${Object.values(doc.nodes).filter((n) => n.type === "frame").length} frame(s) · ${components.length} componente(s)`}
          </p>
        </div>
        <p role="status" aria-label="Mensagens do MMFig" className="min-w-0 flex-1 truncate text-[11px] text-sky-300">
          {status}
        </p>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded border border-slate-700 px-3 py-2 text-xs">
            <Upload size={14} className="mr-1 inline" />
            Abrir projeto
            <input
              id={`${KEY}-import`}
              hidden
              type="file"
              aria-label="Abrir projeto MMFig"
              accept="application/json,.json"
              onChange={(event) => {
                importProject(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" onClick={downloadProject} className="rounded border border-slate-700 px-3 py-2 text-xs">
            <Download size={14} className="mr-1 inline" />
            Baixar projeto
          </button>
          <button type="button" onClick={() => runExport()} className="rounded bg-sky-400 px-3 py-2 text-xs font-bold text-slate-950">
            <Download size={14} className="mr-1 inline" />
            Exportar
          </button>
        </div>
      </header>
      <div ref={menuRef} className="flex items-center gap-1 border-b border-slate-800 pb-1 text-[11px]">
        {MENUS.map((m) => (
          <div key={m.label} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu === m.label}
              onClick={() => setMenu((current) => (current === m.label ? null : m.label))}
              className={`rounded px-2 py-1 ${menu === m.label ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800"}`}
            >
              {m.label}
            </button>
            {menu === m.label && (
              <div role="menu" aria-label={m.label} className="absolute left-0 top-full z-40 mt-1 min-w-60 rounded border border-[#4b4b4b] bg-[#2c2c2c] py-1 shadow-2xl">
                {m.items.map((item, index) =>
                  item === "-" ? (
                    <div key={`sep-${index}`} className="my-1 border-t border-[#444]" />
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => {
                        setMenu(null);
                        item.run();
                      }}
                      className="flex w-full justify-between gap-6 px-3 py-1.5 text-left text-slate-200 hover:bg-[#0d99ff] disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <span>{item.label}</span>
                      <span className="text-slate-400">{item.shortcut}</span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
        <span className="ml-auto text-slate-500">Design · Protótipo · Inspecionar</span>
      </div>
      <div role="toolbar" aria-label="Ferramentas do MMFig" className="flex items-center gap-1 rounded border border-slate-800 bg-[#2c2c2c] px-2 py-1">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={`${t.label} (${t.key})`}
              title={`${t.label} (${t.key})`}
              aria-pressed={tool === t.id}
              onClick={() => chooseTool(t.id)}
              className={`grid h-8 w-9 place-items-center rounded ${tool === t.id ? "bg-[#0d99ff] text-white" : "text-slate-300 hover:bg-[#414141]"}`}
            >
              <Icon size={17} strokeWidth={1.7} />
            </button>
          );
        })}
        <span className="mx-1 h-5 w-px bg-[#444]" />
        <button type="button" aria-label="Criar componente (Ctrl+Alt+K)" title="Criar componente (Ctrl+Alt+K)" onClick={makeComponent} disabled={!sel.length} className="grid h-8 w-9 place-items-center rounded text-[#c4a5ff] hover:bg-[#414141] disabled:opacity-40">
          <Component size={17} strokeWidth={1.7} />
        </button>
        <input
          aria-label="Nome do projeto"
          value={doc.name}
          onChange={(event) => commit((d) => { d.name = event.target.value.slice(0, 200); }, { coalesce: "doc-name" })}
          className="mx-auto w-64 rounded bg-transparent px-2 py-1 text-center text-xs text-slate-200 outline-none hover:bg-[#383838] focus:bg-[#1f1f1f]"
        />
        <button type="button" aria-label="Diminuir zoom" title="Diminuir zoom" onClick={() => zoomCenter(0.8)} className="grid h-8 w-8 place-items-center rounded text-slate-300 hover:bg-[#414141]">
          <ZoomOut size={15} />
        </button>
        <span aria-label="Zoom atual" className="w-12 text-center text-[11px] text-slate-300">
          {Math.round(view.zoom * 100)}%
        </span>
        <button type="button" aria-label="Aumentar zoom" title="Aumentar zoom" onClick={() => zoomCenter(1.25)} className="grid h-8 w-8 place-items-center rounded text-slate-300 hover:bg-[#414141]">
          <ZoomIn size={15} />
        </button>
        <button type="button" aria-label="Ajustar tudo à tela" title="Ajustar tudo à tela (Shift+1)" onClick={zoomFit} className="grid h-8 w-8 place-items-center rounded text-slate-300 hover:bg-[#414141]">
          <Maximize size={15} />
        </button>
        <button type="button" onClick={startPresentation} className="ml-2 flex items-center gap-1 rounded bg-[#0d99ff] px-3 py-1.5 text-[11px] font-bold text-white">
          <Play size={13} />
          Apresentar
        </button>
      </div>
      <div className="grid min-h-[720px] grid-cols-[240px_minmax(560px,1fr)_280px] gap-px bg-[#111]">
        <aside className="flex max-h-[760px] flex-col overflow-hidden border border-slate-800 bg-[#2c2c2c]">
          <div role="tablist" aria-label="Painéis de camadas do MMFig" className="flex border-b border-[#4b4b4b] bg-[#353535]">
            {[["layers", "Camadas"], ["pages", "Páginas"], ["assets", "Assets"]].map(([id, label]) => (
              <button key={id} type="button" role="tab" onClick={() => setLeftTab(id)} aria-selected={leftTab === id} className={`flex-1 px-2 py-3 text-xs font-semibold ${leftTab === id ? "bg-[#414141] text-white" : "text-slate-400"}`}>
                {label}
              </button>
            ))}
          </div>
          {leftTab === "layers" && (
            <div className="min-h-0 flex-1 overflow-auto py-1">
              <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-500">{page.name}</p>
              {roots.length ? (
                <ul role="tree" aria-label="Camadas">
                  {[...roots].reverse().map((id) => renderLayer(id, 0))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-[10px] text-slate-500">Página vazia. Use Frame (F) ou as formas da barra de ferramentas.</p>
              )}
            </div>
          )}
          {leftTab === "pages" && (
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {doc.pages.map((p) => (
                <div key={p.id} className={`group mb-1 flex items-center gap-1 rounded px-1 ${p.id === pageId ? "bg-[#0d99ff]/25" : "hover:bg-[#383838]"}`}>
                  {renamingPage?.id === p.id ? (
                    <input
                      autoFocus
                      aria-label={`Renomear página ${p.name}`}
                      value={renamingPage.value}
                      onChange={(event) => setRenamingPage({ id: p.id, value: event.target.value })}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") setRenamingPage(null);
                      }}
                      onBlur={() => {
                        const current = renamingPage;
                        setRenamingPage(null);
                        if (current?.value.trim()) commit((d) => { d.pages.find((x) => x.id === current.id).name = current.value.trim().slice(0, 200); });
                      }}
                      className="min-w-0 flex-1 bg-[#1f1f1f] px-1 py-1 text-[11px] text-white outline outline-1 outline-[#0d99ff]"
                    />
                  ) : (
                    <button
                      type="button"
                      aria-label={`Página ${p.name}`}
                      aria-pressed={p.id === pageId}
                      onClick={() => {
                        setStoredPage(p.id);
                        setSel([]);
                      }}
                      onDoubleClick={() => setRenamingPage({ id: p.id, value: p.name })}
                      className="min-w-0 flex-1 truncate py-1.5 text-left text-[11px] text-slate-200"
                    >
                      {p.name}
                    </button>
                  )}
                  {doc.pages.length > 1 && (
                    <button type="button" aria-label={`Excluir página ${p.name}`} onClick={() => deletePage(p.id)} className="text-slate-500 opacity-0 hover:text-red-300 focus:opacity-100 group-hover:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addPage} className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-[#4a4a4a] py-1.5 text-[11px] hover:bg-[#383838]">
                <Plus size={12} />
                Adicionar página
              </button>
            </div>
          )}
          {leftTab === "assets" && (
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <input aria-label="Buscar componentes" placeholder="Buscar componentes" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} className="mb-2 w-full rounded bg-[#383838] px-2 py-1.5 text-[11px] text-slate-100 outline-none" />
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Componentes locais</p>
              {comps.map((c) => (
                <div key={c.id} className="mb-1 rounded border border-[#3b3b3b] p-2">
                  <p className="flex items-center gap-1 truncate text-[11px] text-[#c4a5ff]">
                    <Component size={12} />
                    {c.name}
                  </p>
                  <p className="text-[10px] text-slate-500">{doc.pages.find((p) => p.id === pageOfNode(doc, c.id))?.name} · {round2(c.w)}×{round2(c.h)}</p>
                  <div className="mt-1 flex gap-1">
                    <button type="button" aria-label={`Inserir instância de ${c.name}`} onClick={() => insertInstance(c.id)} className="flex-1 rounded bg-[#383838] py-1 text-[10px] hover:bg-[#444]">Inserir instância</button>
                    <button type="button" aria-label={`Ir para ${c.name}`} onClick={() => goToMain(c.id)} className="flex-1 rounded bg-[#383838] py-1 text-[10px] hover:bg-[#444]">Ir para principal</button>
                  </div>
                </div>
              ))}
              {!comps.length && <p className="text-[10px] text-slate-500">Nenhum componente. Selecione camadas e use Criar componente (Ctrl+Alt+K).</p>}
            </div>
          )}
        </aside>
        <main className="relative min-w-0 overflow-hidden border border-slate-800">
          <div
            ref={canvasRef}
            aria-label="Canvas do MMFig"
            className="relative h-[720px] w-full select-none overflow-hidden"
            style={{ background: page.background, cursor }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasHover}
            onPointerLeave={() => setHover(null)}
            onDoubleClick={onCanvasDoubleClick}
            onContextMenu={(event) => event.preventDefault()}
          >
            <svg className="absolute inset-0 h-full w-full">
              <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
                {roots.map((id) => toReact(sceneNode(doc, id, { prefix: "c", canvas: true, zoom: view.zoom, hideId: editingText?.id }), id))}
                {overlay}
              </g>
            </svg>
            {!roots.length && (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-xs text-slate-500">
                Escolha Frame (F) e um tamanho no painel Design, ou desenhe direto no canvas.
              </p>
            )}
            {(showComments || tool === "comment") &&
              pageComments.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Comentário ${i + 1}`}
                  title={c.text}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setCommentEdit({ id: c.id, x: c.x, y: c.y, value: c.text })}
                  style={{ left: view.x + c.x * view.zoom, top: view.y + c.y * view.zoom - 28 }}
                  className={`absolute z-10 grid h-7 w-7 place-items-center rounded-full rounded-bl-none border-2 border-white text-[10px] font-bold text-white shadow ${c.resolved ? "bg-slate-500" : "bg-[#0d99ff]"}`}
                >
                  {i + 1}
                </button>
              ))}
            {commentEdit && (
              <div
                className="absolute z-30 w-64 rounded border border-[#4b4b4b] bg-[#2c2c2c] p-2 shadow-2xl"
                style={{ left: view.x + commentEdit.x * view.zoom + 12, top: view.y + commentEdit.y * view.zoom }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <textarea
                  autoFocus
                  aria-label="Texto do comentário"
                  value={commentEdit.value}
                  onChange={(event) => setCommentEdit({ ...commentEdit, value: event.target.value })}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") setCommentEdit(null);
                  }}
                  rows={3}
                  className="w-full resize-none rounded bg-[#1f1f1f] p-1.5 text-[11px] text-slate-100 outline-none"
                />
                <div className="mt-1 flex gap-1 text-[10px]">
                  <button type="button" onClick={saveComment} className="rounded bg-[#0d99ff] px-2 py-1 font-bold text-white">Salvar comentário</button>
                  {commentEdit.id && (
                    <>
                      <button type="button" onClick={() => { patchComment(commentEdit.id, (d, c) => { c.resolved = !c.resolved; }); setCommentEdit(null); }} className="rounded border border-[#4a4a4a] px-2 py-1">
                        {doc.comments.find((c) => c.id === commentEdit.id)?.resolved ? "Reabrir" : "Resolver"}
                      </button>
                      <button type="button" aria-label="Excluir comentário" onClick={() => { patchComment(commentEdit.id, (d) => { d.comments = d.comments.filter((c) => c.id !== commentEdit.id); }); setCommentEdit(null); }} className="rounded border border-[#4a4a4a] px-2 py-1">
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => setCommentEdit(null)} className="ml-auto px-1 text-slate-400">Cancelar</button>
                </div>
                <p className="mt-1 text-[9px] text-slate-500">Fica salvo neste projeto; não é enviado a outras pessoas.</p>
              </div>
            )}
            {editingNode && editingBounds && (
              <textarea
                autoFocus
                aria-label="Editar texto"
                value={editingText.value}
                onChange={(event) => setEditingText({ ...editingText, value: event.target.value })}
                onBlur={finishTextEdit}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape") event.currentTarget.blur();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                style={{
                  left: view.x + editingBounds.x * view.zoom,
                  top: view.y + editingBounds.y * view.zoom,
                  minWidth: Math.max(40, editingBounds.w * view.zoom + 12),
                  height: Math.max(20, editingBounds.h * view.zoom + 4),
                  fontSize: editingNode.fontSize * view.zoom,
                  fontFamily: `${editingNode.fontFamily}, Arial, sans-serif`,
                  fontWeight: editingNode.fontWeight,
                  lineHeight: editingNode.lineHeight,
                  color: editingNode.fill.on ? editingNode.fill.color : "#ffffff",
                  textAlign: editingNode.textAlign,
                }}
                className="absolute z-20 resize-none overflow-hidden border border-[#0d99ff] bg-transparent p-0 outline-none"
              />
            )}
            <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/40 px-2 py-1 text-[10px] text-slate-400">{TOOL_HINTS[tool]}</p>
          </div>
        </main>
        <aside className="max-h-[760px] overflow-auto border border-slate-800 bg-[#2c2c2c]">
          <div role="tablist" aria-label="Painéis de propriedades do MMFig" className="sticky top-0 z-10 flex border-b border-[#4b4b4b] bg-[#353535]">
            {[["design", "Design"], ["prototype", "Protótipo"], ["inspect", "Inspecionar"]].map(([id, label]) => (
              <button key={id} type="button" role="tab" onClick={() => setRightTab(id)} aria-selected={rightTab === id} className={`flex-1 px-2 py-3 text-xs font-semibold ${rightTab === id ? "bg-[#414141] text-white" : "text-slate-400"}`}>
                {label}
              </button>
            ))}
          </div>
          {tool === "comment" && (
            <Section title={`Comentários (${pageComments.length})`}>
              {pageComments.map((c, i) => (
                <button key={c.id} type="button" onClick={() => setCommentEdit({ id: c.id, x: c.x, y: c.y, value: c.text })} className={`mb-1 block w-full rounded border border-[#3b3b3b] p-2 text-left text-[11px] ${c.resolved ? "text-slate-500 line-through" : "text-slate-200"}`}>
                  {`${i + 1}. ${c.text}`}
                </button>
              ))}
              {!pageComments.length && <p className="text-[10px] text-slate-500">Clique no canvas para comentar.</p>}
            </Section>
          )}
          {rightTab === "design" && renderDesign()}
          {rightTab === "prototype" && renderPrototype()}
          {rightTab === "inspect" && renderInspect()}
        </aside>
      </div>
      {presenting && <Presentation doc={doc} pageId={pageId} startId={presenting.startId} onClose={() => { setPresenting(null); rootRef.current?.focus({ preventScroll: true }); }} />}
    </section>
  );
}
