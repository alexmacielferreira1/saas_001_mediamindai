import { useWorkDraftState, useWorkStorageKey } from "../lib/workProtection";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, FilePlus2, Italic, LayoutTemplate, PaintBucket, Plus, Redo2, Save, Trash2, Underline, Undo2 } from "lucide-react";
import { registerMCPActions } from "../lib/mcpActions";
import { runWordTool, wordCatalogue } from "../components/graphic-tools/wordMcpTools";
import { excelCatalogue, runExcelTool } from "../components/graphic-tools/excelMcpTools";
import { powerpointCatalogue, runPowerPointTool } from "../components/graphic-tools/powerpointMcpTools";

const apps = ["Word", "Excel", "PowerPoint"];
const ribbonButton = "rounded border px-3 py-2 text-xs";
const unavailableTab = "Os comandos desta guia ainda não estão disponíveis no navegador.";

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function downloadFile(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.rel = "noopener";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function readFileText(file) {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(file); });
}

/* ------------------------------------------------------------------ Word helpers */

const ALLOWED_TAGS = new Set(["P", "H1", "H2", "H3", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "SPAN", "UL", "OL", "LI", "HR", "BLOCKQUOTE"]);
const DROPPED_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "HEAD", "TITLE", "META", "LINK", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "IMG", "VIDEO", "AUDIO", "CANVAS"]);
const ALLOWED_STYLES = new Set(["font-family", "font-size", "font-weight", "font-style", "text-decoration", "text-align"]);
const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "DIV", "LI", "UL", "OL", "BLOCKQUOTE", "HR"]);
const INLINE_ALIASES = { strong: ["STRONG", "B"], em: ["EM", "I"], u: ["U"] };

function cleanNode(parent) {
  [...parent.childNodes].forEach((node) => {
    if (node.nodeType === 3) return;
    if (node.nodeType !== 1) { node.remove(); return; }
    const tag = node.tagName.toUpperCase();
    if (DROPPED_TAGS.has(tag)) { node.remove(); return; }
    cleanNode(node);
    if (!ALLOWED_TAGS.has(tag)) { while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node); node.remove(); return; }
    const style = node.getAttribute("style") || "";
    [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    const safe = style.split(";").map((part) => {
      const index = part.indexOf(":");
      if (index < 0) return null;
      const property = part.slice(0, index).trim().toLowerCase();
      const value = part.slice(index + 1).trim();
      if (!ALLOWED_STYLES.has(property) || !value || value.length > 120 || /url\(|expression|javascript:|[<>]/i.test(value)) return null;
      return `${property}: ${value}`;
    }).filter(Boolean).join("; ");
    if (safe) node.setAttribute("style", safe);
  });
}

/** Removes scripts, event handlers, links and any tag/style that the editor does not use. */
export function sanitizeDocumentHtml(html) {
  const source = String(html ?? "");
  let root;
  if (typeof DOMParser !== "undefined") root = new DOMParser().parseFromString(`<!doctype html><body>${source}`, "text/html").body;
  else { const template = document.createElement("template"); template.innerHTML = source; root = template.content; }
  cleanNode(root);
  const box = document.createElement("div");
  while (root.firstChild) box.appendChild(root.firstChild);
  return box.innerHTML;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function textToDocumentHtml(text) {
  return String(text ?? "").split(/\r?\n/).map((line) => line ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>").join("");
}

/** Older versions stored plain text from the textarea; HTML is kept (sanitized). */
export function normalizeDocument(value) {
  const text = typeof value === "string" ? value : "";
  if (/<\/?(p|h[1-3]|div|br|strong|b|em|i|u|span|ul|ol|li|hr|blockquote)\b/i.test(text)) return sanitizeDocumentHtml(text);
  return textToDocumentHtml(text);
}

export function documentHtmlToText(html) {
  const box = document.createElement("div");
  box.innerHTML = sanitizeDocumentHtml(html);
  let out = "";
  const walk = (node) => {
    if (node.nodeType === 3) { out += node.data.replace(/​/g, ""); return; }
    if (node.nodeType !== 1) return;
    if (node.tagName === "BR") { out += "\n"; return; }
    const block = BLOCK_TAGS.has(node.tagName);
    if (block && out && !out.endsWith("\n")) out += "\n";
    node.childNodes.forEach(walk);
    if (block && !out.endsWith("\n")) out += "\n";
  };
  box.childNodes.forEach(walk);
  return out.replace(/\n$/, "");
}

export function countWords(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

export function buildWordDocument(html, title = "Documento") {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family: Aptos, Calibri, sans-serif; font-size: 11pt">${sanitizeDocumentHtml(html)}</body></html>`;
}

function closestWithin(node, root, predicate) {
  let current = node?.nodeType === 1 ? node : node?.parentNode;
  while (current && current !== root) {
    if (current.nodeType === 1 && predicate(current)) return current;
    current = current.parentNode;
  }
  return null;
}

function splitRangeText(range) {
  let sc = range.startContainer, so = range.startOffset, ec = range.endContainer, eo = range.endOffset;
  if (ec.nodeType === 3 && eo > 0 && eo < ec.length) ec.splitText(eo);
  if (sc.nodeType === 3 && so > 0 && so < sc.length) {
    const tail = sc.splitText(so);
    if (ec === sc) { ec = tail; eo -= so; }
    sc = tail; so = 0;
  }
  const next = sc.ownerDocument.createRange();
  next.setStart(sc, so); next.setEnd(ec, eo);
  return next;
}

function textNodesIn(root, range) {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.length || !range.intersectsNode(node)) continue;
    if (node === range.startContainer && range.startOffset >= node.length) continue;
    if (node === range.endContainer && range.endOffset === 0) continue;
    nodes.push(node);
  }
  return nodes;
}

function hasContent(fragment) {
  return Boolean(fragment.textContent.replace(/​/g, "").length || fragment.querySelector?.("br,hr"));
}

function liftOut(owner, node) {
  const doc = owner.ownerDocument;
  const before = doc.createRange(); before.setStart(owner, 0); before.setEndBefore(node);
  const beforeFragment = before.extractContents();
  const after = doc.createRange(); after.setStartAfter(node); after.setEnd(owner, owner.childNodes.length);
  const afterFragment = after.extractContents();
  if (hasContent(beforeFragment)) { const clone = owner.cloneNode(false); clone.appendChild(beforeFragment); owner.parentNode.insertBefore(clone, owner); }
  if (hasContent(afterFragment)) { const clone = owner.cloneNode(false); clone.appendChild(afterFragment); owner.parentNode.insertBefore(clone, owner.nextSibling); }
  while (owner.firstChild) owner.parentNode.insertBefore(owner.firstChild, owner);
  owner.remove();
}

function selectBetween(first, last) {
  const selection = window.getSelection?.();
  if (!selection || !first) return null;
  const range = first.ownerDocument.createRange();
  range.setStartBefore(first); range.setEndAfter(last || first);
  selection.removeAllRanges(); selection.addRange(range);
  return range;
}

function insertCaretElement(range, element) {
  const marker = range.startContainer.ownerDocument.createTextNode("​");
  element.appendChild(marker);
  range.insertNode(element);
  const selection = window.getSelection?.();
  const caret = marker.ownerDocument.createRange();
  caret.setStart(marker, 1); caret.collapse(true);
  selection?.removeAllRanges(); selection?.addRange(caret);
  return caret;
}

/** Toggles <strong>/<em>/<u> on the selected text, splitting runs when only part is formatted. */
export function toggleInlineFormat(root, range, tag) {
  const names = INLINE_ALIASES[tag];
  if (range.collapsed) return insertCaretElement(range, root.ownerDocument.createElement(tag));
  const split = splitRangeText(range);
  const nodes = textNodesIn(root, split);
  if (!nodes.length) return null;
  const owner = (node) => closestWithin(node, root, (element) => names.includes(element.tagName));
  if (nodes.every(owner)) nodes.forEach((node) => { let found = owner(node); while (found) { liftOut(found, node); found = owner(node); } });
  else nodes.forEach((node) => { if (owner(node)) return; const element = root.ownerDocument.createElement(tag); node.parentNode.insertBefore(element, node); element.appendChild(node); });
  return selectBetween(nodes[0], nodes[nodes.length - 1]);
}

/** Applies an inline CSS property (font-family, font-size) to the selected text. */
export function applyInlineStyle(root, range, property, value) {
  if (range.collapsed) { const span = root.ownerDocument.createElement("span"); span.style.setProperty(property, value); return insertCaretElement(range, span); }
  const split = splitRangeText(range);
  const nodes = textNodesIn(root, split);
  nodes.forEach((node) => {
    const parent = node.parentNode;
    if (parent !== root && parent.tagName === "SPAN" && parent.childNodes.length === 1) { parent.style.setProperty(property, value); return; }
    const span = root.ownerDocument.createElement("span");
    span.style.setProperty(property, value);
    parent.insertBefore(span, node); span.appendChild(node);
  });
  return nodes.length ? selectBetween(nodes[0], nodes[nodes.length - 1]) : null;
}

function topLevelBlocks(root, range) {
  const doc = root.ownerDocument;
  const nodes = range.collapsed ? [range.startContainer] : textNodesIn(root, range);
  if (!nodes.length) nodes.push(range.startContainer);
  const blocks = [];
  nodes.forEach((start) => {
    let node = start;
    if (node === root) node = root.childNodes[Math.min(range.startOffset, root.childNodes.length - 1)];
    while (node && node.parentNode !== root) node = node.parentNode;
    if (!node) return;
    if (node.nodeType !== 1 || !BLOCK_TAGS.has(node.tagName)) {
      const paragraph = doc.createElement("p");
      let first = node;
      while (first.previousSibling && (first.previousSibling.nodeType !== 1 || !BLOCK_TAGS.has(first.previousSibling.tagName))) first = first.previousSibling;
      root.insertBefore(paragraph, first);
      while (paragraph.nextSibling && (paragraph.nextSibling.nodeType !== 1 || !BLOCK_TAGS.has(paragraph.nextSibling.tagName))) paragraph.appendChild(paragraph.nextSibling);
      node = paragraph;
    }
    if (!blocks.includes(node)) blocks.push(node);
  });
  if (!blocks.length && !root.childNodes.length) { const paragraph = doc.createElement("p"); paragraph.appendChild(doc.createElement("br")); root.appendChild(paragraph); blocks.push(paragraph); }
  return blocks;
}

/** Converts the paragraphs touched by the selection to a block tag (p, h1). */
export function setBlockFormat(root, range, tag) {
  const blocks = topLevelBlocks(root, range);
  const changed = blocks.map((block) => {
    if (block.tagName === tag.toUpperCase() || block.tagName === "HR") return block;
    const next = root.ownerDocument.createElement(tag);
    const align = block.style?.textAlign;
    if (align) next.style.textAlign = align;
    while (block.firstChild) next.appendChild(block.firstChild);
    block.replaceWith(next);
    return next;
  });
  if (changed.length && !range.collapsed) return selectBetween(changed[0], changed[changed.length - 1]);
  return null;
}

export function setBlockAlignment(root, range, align) {
  topLevelBlocks(root, range).forEach((block) => { if (block.tagName !== "HR") block.style.textAlign = align; });
}

export function insertPlainText(root, range, text) {
  const doc = root.ownerDocument;
  range.deleteContents();
  const fragment = doc.createDocumentFragment();
  const lines = String(text).split(/\r?\n/);
  let last = null;
  lines.forEach((line, index) => {
    if (index) { last = doc.createElement("br"); fragment.appendChild(last); }
    if (line) { last = doc.createTextNode(line); fragment.appendChild(last); }
  });
  if (!last) return range;
  range.insertNode(fragment);
  const caret = doc.createRange();
  caret.setStartAfter(last); caret.collapse(true);
  const selection = window.getSelection?.();
  selection?.removeAllRanges(); selection?.addRange(caret);
  return caret;
}

/* ------------------------------------------------------------------ Word */

const DEFAULT_DOCUMENT = "Título do documento\n\nComece a escrever aqui.";
const wordTabs = ["Arquivo", "Início", "Inserir", "Layout", "Referências", "Revisão", "Exibir"];
export const fontFamilies = { Aptos: "Aptos, Calibri, sans-serif", Arial: "Arial, Helvetica, sans-serif", Georgia: "Georgia, serif" };

function WordCraft({ active = true }) {
  const storageKey = useWorkStorageKey("mm-office-word");
  const [document, setDocument] = useWorkDraftState("pages/OfficeCraft.jsx:document", () => readLocal(storageKey, DEFAULT_DOCUMENT));
  const html = useMemo(() => normalizeDocument(document), [document]);
  const editorRef = useRef(null);
  const savedRange = useRef(null);
  const fileRef = useRef(null);
  const history = useRef({ stack: [html], index: 0, at: 0 });
  const [historyState, setHistoryState] = useState({ index: 0, length: 1 });
  const [tab, setTab] = useState("Início");
  const [font, setFont] = useState("Aptos");
  const [size, setSize] = useState("11");
  const [spell, setSpell] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState("Salvo neste dispositivo");
  const statusNote = useRef(null); // aviso do MCP que deve sobreviver ao "Salvo neste dispositivo" da mesma mudança
  useEffect(() => { const note = statusNote.current; statusNote.current = null; setStatus(writeLocal(storageKey, html) ? note || "Salvo neste dispositivo" : "Falha ao salvar neste dispositivo — baixe o arquivo"); }, [html, storageKey]);
  useLayoutEffect(() => { if (editorRef.current) editorRef.current.innerHTML = html; }, []);
  useEffect(() => {
    const remember = () => {
      const selection = window.getSelection?.();
      if (!selection?.rangeCount || !editorRef.current) return;
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.startContainer) && editorRef.current.contains(range.endContainer)) savedRange.current = range.cloneRange();
    };
    window.document.addEventListener("selectionchange", remember);
    return () => window.document.removeEventListener("selectionchange", remember);
  }, []);
  const words = countWords(documentHtmlToText(html));

  const record = useCallback((value, coalesce) => {
    const state = history.current;
    const now = Date.now();
    if (state.stack[state.index] === value) return;
    if (coalesce && state.index > 0 && state.index === state.stack.length - 1 && now - state.at < 700) state.stack[state.index] = value;
    else { state.stack = [...state.stack.slice(0, state.index + 1), value].slice(-200); state.index = state.stack.length - 1; }
    state.at = coalesce ? now : 0;
    setHistoryState({ index: state.index, length: state.stack.length });
  }, []);
  const commit = useCallback((coalesce = false) => {
    const value = editorRef.current?.innerHTML ?? "";
    setDocument(value); record(value, coalesce);
  }, [record, setDocument]);
  function replaceContent(value) {
    const clean = sanitizeDocumentHtml(value);
    if (editorRef.current) editorRef.current.innerHTML = clean;
    setDocument(clean); record(clean, false);
    return clean;
  }
  function travel(step) {
    const state = history.current;
    const index = state.index + step;
    if (index < 0 || index >= state.stack.length) return;
    state.index = index; state.at = 0;
    if (editorRef.current) editorRef.current.innerHTML = state.stack[index];
    setDocument(state.stack[index]);
    setHistoryState({ index, length: state.stack.length });
  }
  // Ferramentas de um clique do MCP (grade de ícones no Copiloto). Lê o conteúdo atual do editor e grava
  // pelo caminho normal (replaceContent → histórico do WordCraft); o desfazer do MCP só volta um passo
  // se ninguém editou o documento depois da ação.
  const mcp = useRef({});
  mcp.current = { html, replaceContent, travel, setStatus };
  const mcpAfter = useRef([]);
  useEffect(() => {
    if (!active) return undefined;
    const read = () => ({ html: editorRef.current?.innerHTML ?? mcp.current.html });
    const strip = ({ html: _html, ...result }) => result;
    return registerMCPActions({
      source: "word",
      label: "Word",
      catalogue: () => wordCatalogue(read()),
      analyze: async (toolId, params) => {
        const result = runWordTool(toolId, read(), params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const result = runWordTool(toolId, read(), params);
        if (result.ok && result.html !== undefined) {
          const before = history.current.index;
          const clean = mcp.current.replaceContent(result.html);
          const message = `MCP · ${result.summary}`;
          if (history.current.index !== before) { mcpAfter.current.push(clean); statusNote.current = message; }
          mcp.current.setStatus(message);
        }
        return strip(result);
      },
      undo: () => {
        const last = mcpAfter.current.at(-1);
        if (last === undefined) return false;
        const state = history.current;
        if (state.stack[state.index] !== last) {
          mcpAfter.current = [];
          mcp.current.setStatus("O documento mudou depois da ação do MCP: desfazer cancelado para não perder suas alterações.");
          return false;
        }
        mcpAfter.current.pop();
        statusNote.current = "MCP · Última ação desfeita.";
        mcp.current.travel(-1);
        mcp.current.setStatus(statusNote.current);
        return true;
      },
      canUndo: () => mcpAfter.current.length > 0,
    });
  }, [active]);
  function currentRange() {
    const root = editorRef.current;
    const selection = window.getSelection?.();
    if (root && selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      if (root.contains(range.startContainer) && root.contains(range.endContainer)) return range;
    }
    const saved = savedRange.current;
    return root && saved && root.contains(saved.startContainer) && root.contains(saved.endContainer) ? saved : null;
  }
  function format(action) {
    const root = editorRef.current;
    const range = currentRange();
    if (!root || !range) { setStatus("Clique no documento ou selecione um trecho antes de formatar"); root?.focus(); return; }
    const result = action(root, range);
    if (result) savedRange.current = result.cloneRange();
    commit(false);
  }
  const keepSelection = (event) => event.preventDefault();
  function save() {
    try {
      downloadFile("documento-wordcraft.doc", buildWordDocument(html, "Documento WordCraft"), "application/msword");
      downloadFile("documento-wordcraft.txt", documentHtmlToText(html), "text/plain;charset=utf-8");
      setStatus("Arquivos .doc e .txt baixados · cópia salva neste dispositivo");
    } catch { setStatus("Não foi possível gerar o arquivo neste navegador"); }
  }
  async function open(file) {
    if (!file) return;
    try {
      const text = await readFileText(file);
      const isHtml = /\.(html?|doc)$/i.test(file.name) && /<html|<body|<p[\s>]/i.test(text);
      if (/\.doc$/i.test(file.name) && !isHtml) { setStatus("Arquivo .doc binário não é suportado; use .doc salvo pelo WordCraft, .html ou .txt"); return; }
      replaceContent(isHtml ? sanitizeDocumentHtml(text) : textToDocumentHtml(text));
      setStatus(`Aberto: ${file.name}`);
    } catch { setStatus("Não foi possível ler o arquivo"); }
  }
  function newDocument() {
    if (documentHtmlToText(html).trim() && !window.confirm("Criar um documento novo? O conteúdo atual poderá ser recuperado com Desfazer.")) return;
    replaceContent("<p><br></p>");
  }
  function onKeyDown(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    const actions = {
      z: () => travel(event.shiftKey ? 1 : -1), y: () => travel(1), s: save,
      b: () => format((root, range) => toggleInlineFormat(root, range, "strong")),
      i: () => format((root, range) => toggleInlineFormat(root, range, "em")),
      u: () => format((root, range) => toggleInlineFormat(root, range, "u")),
    };
    if (actions[key]) { event.preventDefault(); actions[key](); }
  }
  function onPaste(event) {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") ?? "";
    format((root, range) => insertPlainText(root, range, text));
  }
  const ribbon = {
    Arquivo: <><button className={ribbonButton} onClick={newDocument}>Novo documento</button><button className={ribbonButton} onClick={() => fileRef.current?.click()}>Abrir arquivo</button><button className={ribbonButton} onClick={() => { try { downloadFile("documento-wordcraft.doc", buildWordDocument(html, "Documento WordCraft"), "application/msword"); setStatus("Arquivo .doc baixado"); } catch { setStatus("Não foi possível gerar o arquivo neste navegador"); } }}>Baixar .doc</button><button className={ribbonButton} onClick={() => { try { downloadFile("documento-wordcraft.txt", documentHtmlToText(html), "text/plain;charset=utf-8"); setStatus("Arquivo .txt baixado"); } catch { setStatus("Não foi possível gerar o arquivo neste navegador"); } }}>Baixar .txt</button></>,
    Início: <><select aria-label="Fonte" value={font} onChange={(event) => { setFont(event.target.value); format((root, range) => applyInlineStyle(root, range, "font-family", fontFamilies[event.target.value])); }} className="h-8 w-40 border bg-white px-2 text-xs"><option>Aptos</option><option>Arial</option><option>Georgia</option></select><select aria-label="Tamanho da fonte" value={size} onChange={(event) => { setSize(event.target.value); format((root, range) => applyInlineStyle(root, range, "font-size", `${event.target.value}pt`)); }} className="h-8 w-16 border bg-white px-2 text-xs"><option>11</option><option>14</option><option>18</option></select><span className="h-10 w-px bg-slate-300"/><button title="Negrito" onMouseDown={keepSelection} onClick={() => format((root, range) => toggleInlineFormat(root, range, "strong"))} className="p-2"><Bold size={17}/></button><button title="Itálico" onMouseDown={keepSelection} onClick={() => format((root, range) => toggleInlineFormat(root, range, "em"))} className="p-2"><Italic size={17}/></button><button title="Sublinhado" onMouseDown={keepSelection} onClick={() => format((root, range) => toggleInlineFormat(root, range, "u"))} className="p-2"><Underline size={17}/></button><span className="h-10 w-px bg-slate-300"/><button onMouseDown={keepSelection} onClick={() => format((root, range) => setBlockFormat(root, range, "p"))} className="rounded border px-3 py-2 text-xs">Normal</button><button onMouseDown={keepSelection} onClick={() => format((root, range) => setBlockFormat(root, range, "h1"))} className="rounded border px-3 py-2 text-xs font-bold">Título 1</button></>,
    Inserir: <><button className={ribbonButton} onMouseDown={keepSelection} onClick={() => format((root, range) => { const block = topLevelBlocks(root, range).pop(); const line = root.ownerDocument.createElement("hr"); if (block) block.after(line); else root.appendChild(line); })}>Linha horizontal</button><button className={ribbonButton} onMouseDown={keepSelection} onClick={() => format((root, range) => insertPlainText(root, range, new Date().toLocaleString("pt-BR")))}>Data e hora</button></>,
    Layout: <>{[["left", "Alinhar à esquerda"], ["center", "Centralizar"], ["right", "Alinhar à direita"], ["justify", "Justificar"]].map(([align, label]) => <button key={align} className={ribbonButton} onMouseDown={keepSelection} onClick={() => format((root, range) => setBlockAlignment(root, range, align))}>{label}</button>)}</>,
    Revisão: <><button className={ribbonButton} aria-pressed={spell} onClick={() => setSpell(!spell)}>Verificação ortográfica: {spell ? "ativada" : "desativada"}</button><button className={ribbonButton} onClick={() => { const text = documentHtmlToText(html); setStatus(`${countWords(text)} palavras · ${text.replace(/\s/g, "").length} caracteres sem espaços`); }}>Contar palavras</button></>,
    Exibir: <>{[75, 100, 125, 150].map((value) => <button key={value} className={ribbonButton} aria-pressed={zoom === value} onClick={() => setZoom(value)}>Zoom {value}%</button>)}</>,
  };
  return <div className="flex min-h-[680px] flex-col bg-[#e8e8e8] text-[#242424]">
    <div className="flex h-10 items-center gap-2 border-b border-[#c8c8c8] bg-white px-4"><button title="Desfazer" disabled={historyState.index === 0} onMouseDown={keepSelection} onClick={() => travel(-1)}><Undo2 size={16}/></button><button title="Refazer" disabled={historyState.index >= historyState.length - 1} onMouseDown={keepSelection} onClick={() => travel(1)}><Redo2 size={16}/></button><span className="mx-2 h-5 w-px bg-slate-300"/><button onClick={save} className="rounded bg-[#185abd] px-3 py-1 text-xs text-white"><Save size={14} className="mr-1 inline"/>Salvar</button><span role="status" className="ml-auto text-xs text-slate-500">{status}</span></div>
    <div className="border-b border-[#c8c8c8] bg-white"><div className="flex gap-6 px-5 pt-2 text-xs">{wordTabs.map((x)=><button key={x} aria-pressed={tab===x} onClick={()=>setTab(x)} className={tab===x?"border-b-2 border-[#185abd] pb-2 text-[#185abd]":"pb-2"}>{x}</button>)}</div><div className="flex h-20 items-center gap-3 border-t px-5">{ribbon[tab] || <span className="text-xs text-slate-500">{unavailableTab}</span>}</div></div>
    <div className="flex flex-1 justify-center overflow-auto p-8"><div ref={editorRef} role="textbox" aria-multiline="true" aria-label="Documento WordCraft" contentEditable suppressContentEditableWarning spellCheck={spell} tabIndex={0} onInput={() => commit(true)} onKeyDown={onKeyDown} onPaste={onPaste} style={zoom === 100 ? undefined : { zoom: zoom / 100 }} className="min-h-[700px] w-[720px] resize-none bg-white px-20 py-16 text-[15px] leading-7 shadow-xl outline-none [&_h1]:text-[26px] [&_h1]:font-bold [&_h1]:leading-snug [&_h2]:text-[20px] [&_h2]:font-bold [&_h3]:text-[17px] [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-8 [&_ol]:list-decimal [&_ol]:pl-8 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic"/></div>
    <input ref={fileRef} className="hidden" type="file" accept=".txt,.html,.htm,.doc,text/plain,text/html" aria-label="Abrir documento" onChange={(event) => { open(event.target.files?.[0]); event.target.value = ""; }}/>
    <div className="flex h-7 items-center bg-white px-4 text-[11px] text-slate-500"><span>Página 1 de 1</span><span className="ml-5">{words} palavras</span><span className="ml-auto">{zoom}%</span></div>
  </div>;
}

/* ------------------------------------------------------------------ Excel formula engine */

const MAX_COLUMNS = 16384;
const MAX_ROWS = 1048576;
export const formulaError = (code) => ({ error: code });
export const isFormulaError = (value) => Boolean(value && typeof value === "object" && "error" in value);
class FormulaSyntaxError extends Error {}

export function columnToIndex(letters) {
  return [...letters.toUpperCase()].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

export function indexToColumn(index) {
  let value = index + 1, result = "";
  while (value > 0) { const rest = (value - 1) % 26; result = String.fromCharCode(65 + rest) + result; value = Math.floor((value - 1) / 26); }
  return result;
}

/**
 * Área mostrada da planilha: no mínimo A–F e 1–18 (como antes) e, se houver dados ou formatos além disso,
 * até a última coluna/linha usada mais uma de folga (limite de 52 colunas e 500 linhas na tela).
 */
export function gridExtent(sheet, { minCols = 6, minRows = 18, maxCols = 52, maxRows = 500 } = {}) {
  let lastCol = minCols - 1;
  let lastRow = minRows;
  for (const key of [...Object.keys(sheet?.cells || {}), ...Object.keys(sheet?.formats || {})]) {
    const pos = parseCellKey(key);
    if (!pos) continue;
    lastCol = Math.max(lastCol, Math.min(maxCols - 1, pos.col + 1));
    lastRow = Math.max(lastRow, Math.min(maxRows, pos.row + 1));
  }
  return {
    columns: Array.from({ length: lastCol + 1 }, (_, index) => indexToColumn(index)),
    rows: Array.from({ length: lastRow }, (_, index) => index + 1),
  };
}

export function parseCellKey(key) {
  const match = /^([A-Z]{1,3})(\d+)$/.exec(String(key).toUpperCase());
  return match ? { col: columnToIndex(match[1]), row: Number(match[2]) } : null;
}

export function tokenizeFormula(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const rest = source.slice(index);
    if (/\s/.test(char)) { index += 1; continue; }
    const number = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(rest);
    if (number) { tokens.push({ type: "num", value: Number(number[0]) }); index += number[0].length; continue; }
    if (char === '"') {
      let cursor = index + 1, text = "";
      while (cursor < source.length) {
        if (source[cursor] === '"') { if (source[cursor + 1] === '"') { text += '"'; cursor += 2; continue; } break; }
        text += source[cursor]; cursor += 1;
      }
      if (cursor >= source.length) throw new FormulaSyntaxError("texto sem aspas finais");
      tokens.push({ type: "str", value: text }); index = cursor + 1; continue;
    }
    if (char === "'") {
      let cursor = index + 1, name = "";
      while (cursor < source.length) {
        if (source[cursor] === "'") { if (source[cursor + 1] === "'") { name += "'"; cursor += 2; continue; } break; }
        name += source[cursor]; cursor += 1;
      }
      if (source[cursor + 1] !== "!") throw new FormulaSyntaxError("nome de planilha inválido");
      tokens.push({ type: "sheet", value: name }); index = cursor + 2; continue;
    }
    const word = /^[A-Za-z_$À-ſ][A-Za-z0-9_.$À-ſ]*/.exec(rest);
    if (word) {
      index += word[0].length;
      if (source[index] === "!") { tokens.push({ type: "sheet", value: word[0] }); index += 1; continue; }
      const ref = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(word[0]);
      if (ref && source[index] !== "(") tokens.push({ type: "ref", col: columnToIndex(ref[1]), row: Number(ref[2]) });
      else if (/\$/.test(word[0])) throw new FormulaSyntaxError("referência inválida");
      else tokens.push({ type: "ident", value: word[0].toUpperCase() });
      continue;
    }
    const pair = rest.slice(0, 2);
    if (["<=", ">=", "<>"].includes(pair)) { tokens.push({ type: "op", value: pair }); index += 2; continue; }
    if ("+-*/^&=<>(),;:%".includes(char)) { tokens.push({ type: "op", value: char }); index += 1; continue; }
    throw new FormulaSyntaxError(`caractere inesperado ${char}`);
  }
  return tokens;
}

export function parseFormula(source) {
  const tokens = tokenizeFormula(source);
  let position = 0;
  const peek = () => tokens[position];
  const isOp = (...values) => peek()?.type === "op" && values.includes(peek().value);
  const take = () => tokens[position++];
  const expect = (value) => { if (!isOp(value)) throw new FormulaSyntaxError(`esperado ${value}`); take(); };
  const binary = (next, operators) => () => {
    let left = next();
    while (isOp(...operators)) { const op = take().value; left = { type: "binary", op, left, right: next() }; }
    return left;
  };
  const primary = () => {
    const token = take();
    if (!token) throw new FormulaSyntaxError("fórmula incompleta");
    if (token.type === "num") return { type: "num", value: token.value };
    if (token.type === "str") return { type: "str", value: token.value };
    if (token.type === "sheet" || token.type === "ref") {
      const sheet = token.type === "sheet" ? token.value : null;
      const from = token.type === "ref" ? token : take();
      if (!from || from.type !== "ref") throw new FormulaSyntaxError("referência esperada");
      if (isOp(":")) {
        take();
        const to = take();
        if (!to || to.type !== "ref") throw new FormulaSyntaxError("intervalo inválido");
        return { type: "range", sheet, from, to };
      }
      return { type: "ref", sheet, col: from.col, row: from.row };
    }
    if (token.type === "ident") {
      if (isOp("(")) {
        take();
        const args = [];
        if (!isOp(")")) { do { args.push(comparison()); } while (isOp(",", ";") && take()); }
        expect(")");
        return { type: "call", name: token.value, args };
      }
      return { type: "name", value: token.value };
    }
    if (token.type === "op" && token.value === "(") { const inner = comparison(); expect(")"); return inner; }
    throw new FormulaSyntaxError("símbolo inesperado");
  };
  const postfix = () => { let node = primary(); while (isOp("%")) { take(); node = { type: "percent", value: node }; } return node; };
  const unary = () => {
    if (isOp("-", "+")) { const op = take().value; return { type: "unary", op, value: unary() }; }
    return postfix();
  };
  const power = binary(unary, ["^"]);
  const multiplicative = binary(power, ["*", "/"]);
  const additive = binary(multiplicative, ["+", "-"]);
  const concat = binary(additive, ["&"]);
  const comparison = binary(concat, ["=", "<>", "<", ">", "<=", ">="]);
  const tree = comparison();
  if (position < tokens.length) throw new FormulaSyntaxError("símbolos sobrando");
  return tree;
}

export function parseLiteral(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) return Number(text);
  if (/^[+-]?\d+,\d+$/.test(text)) return Number(text.replace(",", "."));
  const percent = /^([+-]?\d+([.,]\d+)?)%$/.exec(text);
  if (percent) return Number(percent[1].replace(",", ".")) / 100;
  const upper = text.toUpperCase();
  if (upper === "TRUE" || upper === "VERDADEIRO") return true;
  if (upper === "FALSE" || upper === "FALSO") return false;
  return String(raw);
}

function toNumber(value) {
  if (isFormulaError(value)) return value;
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed = parseLiteral(value);
  return typeof parsed === "number" ? parsed : formulaError("#VALUE!");
}

function toText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(Math.round(value * 1e10) / 1e10);
  return String(value);
}

function toBoolean(value) {
  if (isFormulaError(value)) return value;
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const upper = String(value).trim().toUpperCase();
  if (upper === "TRUE" || upper === "VERDADEIRO") return true;
  if (upper === "FALSE" || upper === "FALSO") return false;
  return formulaError("#VALUE!");
}

function compareValues(left, right) {
  const rank = (value) => value === null || typeof value === "number" ? 0 : typeof value === "string" ? 1 : 2;
  const a = left ?? (typeof right === "string" ? "" : typeof right === "boolean" ? false : 0);
  const b = right ?? (typeof left === "string" ? "" : typeof left === "boolean" ? false : 0);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === "string") return a.toLowerCase().localeCompare(b.toLowerCase());
  return Number(a) - Number(b);
}

const finite = (value) => Number.isFinite(value) ? value : formulaError("#NUM!");
const FUNCTION_ALIASES = { SOMA: "SUM", "MÉDIA": "AVERAGE", MEDIA: "AVERAGE", "MÍNIMO": "MIN", MINIMO: "MIN", "MÁXIMO": "MAX", MAXIMO: "MAX", "CONT.NÚM": "COUNT", "CONT.NUM": "COUNT", SE: "IF", ARRED: "ROUND" };

function roundHalfAway(value, digits) {
  const factor = 10 ** digits;
  const shifted = Number(`${Math.abs(value)}e${digits}`);
  const rounded = Number.isFinite(shifted) ? Number(`${Math.round(shifted)}e${-digits}`) : Math.round(Math.abs(value) * factor) / factor;
  return Math.sign(value) * (Number.isFinite(rounded) ? rounded : Math.round(Math.abs(value) * factor) / factor);
}

function evaluateNode(node, ctx) {
  switch (node.type) {
    case "num": return node.value;
    case "str": return node.value;
    case "name":
      if (node.value === "TRUE" || node.value === "VERDADEIRO") return true;
      if (node.value === "FALSE" || node.value === "FALSO") return false;
      return formulaError("#NAME?");
    case "ref": return ctx.getCell(node.sheet, node.col, node.row);
    case "range": return formulaError("#VALUE!");
    case "percent": { const value = toNumber(evaluateNode(node.value, ctx)); return isFormulaError(value) ? value : value / 100; }
    case "unary": { const value = toNumber(evaluateNode(node.value, ctx)); return isFormulaError(value) ? value : node.op === "-" ? -value : value; }
    case "binary": {
      const left = evaluateNode(node.left, ctx);
      if (isFormulaError(left)) return left;
      const right = evaluateNode(node.right, ctx);
      if (isFormulaError(right)) return right;
      if (node.op === "&") return toText(left) + toText(right);
      if (["=", "<>", "<", ">", "<=", ">="].includes(node.op)) {
        const diff = compareValues(left, right);
        return { "=": diff === 0, "<>": diff !== 0, "<": diff < 0, ">": diff > 0, "<=": diff <= 0, ">=": diff >= 0 }[node.op];
      }
      const a = toNumber(left); if (isFormulaError(a)) return a;
      const b = toNumber(right); if (isFormulaError(b)) return b;
      if (node.op === "+") return finite(a + b);
      if (node.op === "-") return finite(a - b);
      if (node.op === "*") return finite(a * b);
      if (node.op === "/") return b === 0 ? formulaError("#DIV/0!") : finite(a / b);
      if (node.op === "^") return a === 0 && b < 0 ? formulaError("#DIV/0!") : finite(a ** b);
      return formulaError("#VALUE!");
    }
    case "call": return callFunction(FUNCTION_ALIASES[node.name] || node.name, node.args, ctx);
    default: return formulaError("#VALUE!");
  }
}

function argumentValues(args, ctx) {
  return args.map((arg) => arg.type === "range" ? { range: ctx.getRange(arg.sheet, arg.from, arg.to) } : { value: evaluateNode(arg, ctx), direct: arg.type !== "ref" });
}

function collectNumbers(args, ctx) {
  const numbers = [];
  for (const item of argumentValues(args, ctx)) {
    if (item.range) {
      if (isFormulaError(item.range)) return item.range;
      for (const value of item.range) { if (isFormulaError(value)) return value; if (typeof value === "number") numbers.push(value); }
    } else {
      if (isFormulaError(item.value)) return item.value;
      if (item.value === null) { if (item.direct) numbers.push(0); continue; }
      if (!item.direct && typeof item.value !== "number") continue;
      const value = toNumber(item.value);
      if (isFormulaError(value)) return value;
      numbers.push(value);
    }
  }
  return numbers;
}

function callFunction(name, args, ctx) {
  if (name === "IF") {
    if (args.length < 2 || args.length > 3) return formulaError("#VALUE!");
    const condition = toBoolean(evaluateNode(args[0], ctx));
    if (isFormulaError(condition)) return condition;
    if (condition) return evaluateNode(args[1], ctx);
    return args[2] ? evaluateNode(args[2], ctx) : false;
  }
  if (name === "ROUND") {
    if (args.length < 1 || args.length > 2) return formulaError("#VALUE!");
    const value = toNumber(evaluateNode(args[0], ctx)); if (isFormulaError(value)) return value;
    const digits = args[1] ? toNumber(evaluateNode(args[1], ctx)) : 0; if (isFormulaError(digits)) return digits;
    return roundHalfAway(value, Math.trunc(digits));
  }
  if (name === "COUNT") {
    let count = 0;
    for (const item of argumentValues(args, ctx)) {
      if (item.range) { if (!isFormulaError(item.range)) count += item.range.filter((value) => typeof value === "number").length; }
      else if (typeof item.value === "number" || (item.direct && (typeof item.value === "boolean" || typeof parseLiteral(item.value) === "number"))) count += 1;
    }
    return count;
  }
  if (!["SUM", "AVERAGE", "MIN", "MAX"].includes(name)) return formulaError("#NAME?");
  if (!args.length) return formulaError("#VALUE!");
  const numbers = collectNumbers(args, ctx);
  if (isFormulaError(numbers)) return numbers;
  if (name === "SUM") return finite(numbers.reduce((total, value) => total + value, 0));
  if (name === "AVERAGE") return numbers.length ? finite(numbers.reduce((total, value) => total + value, 0) / numbers.length) : formulaError("#DIV/0!");
  if (!numbers.length) return 0;
  return name === "MIN" ? Math.min(...numbers) : Math.max(...numbers);
}

/**
 * Evaluates every cell of a workbook ({sheets:[{name, cells:{A1: raw}}]}) lazily, with memoization,
 * cross-sheet references (Planilha2!A1) and circular reference detection (#CIRC!).
 */
export function createWorkbookEvaluator(workbook) {
  const sheets = workbook.sheets || [];
  const byName = new Map(sheets.map((sheet) => [sheet.name.toUpperCase(), sheet]));
  const cache = new Map();
  const visiting = new Set();
  const parsed = new Map();
  const resolve = (current, name) => name === null || name === undefined ? current : byName.get(String(name).toUpperCase()) || null;
  function cellValue(sheet, key) {
    const id = `${sheet.id}!${key}`;
    if (cache.has(id)) return cache.get(id);
    if (visiting.has(id)) return formulaError("#CIRC!");
    const raw = sheet.cells?.[key];
    let result;
    if (typeof raw === "string" && raw.startsWith("=") && raw.length > 1) {
      visiting.add(id);
      try {
        if (!parsed.has(raw)) { try { parsed.set(raw, parseFormula(raw.slice(1))); } catch (error) { if (error instanceof FormulaSyntaxError) parsed.set(raw, null); else throw error; } }
        const tree = parsed.get(raw);
        result = tree ? evaluateNode(tree, context(sheet)) : formulaError("#ERROR!");
      } catch (error) {
        if (error instanceof RangeError) result = formulaError("#CIRC!");
        else throw error;
      } finally { visiting.delete(id); }
    } else result = parseLiteral(raw);
    if (result === undefined) result = null;
    cache.set(id, result);
    return result;
  }
  function context(sheet) {
    return {
      getCell(name, col, row) {
        const target = resolve(sheet, name);
        if (!target || col < 0 || col >= MAX_COLUMNS || row < 1 || row > MAX_ROWS) return formulaError("#REF!");
        return cellValue(target, `${indexToColumn(col)}${row}`);
      },
      getRange(name, from, to) {
        const target = resolve(sheet, name);
        if (!target) return formulaError("#REF!");
        const c1 = Math.min(from.col, to.col), c2 = Math.max(from.col, to.col), r1 = Math.min(from.row, to.row), r2 = Math.max(from.row, to.row);
        if (c1 < 0 || c2 >= MAX_COLUMNS || r1 < 1 || r2 > MAX_ROWS) return formulaError("#REF!");
        return Object.keys(target.cells || {}).map((key) => ({ key, pos: parseCellKey(key) })).filter(({ pos }) => pos && pos.col >= c1 && pos.col <= c2 && pos.row >= r1 && pos.row <= r2).sort((a, b) => a.pos.row - b.pos.row || a.pos.col - b.pos.col).map(({ key }) => cellValue(target, key)).filter((value) => value !== null);
      },
    };
  }
  return {
    value(sheetId, key) { const sheet = sheets.find((item) => item.id === sheetId); return sheet ? cellValue(sheet, key.toUpperCase()) : formulaError("#REF!"); },
  };
}

/** Evaluates one formula string against a map of cells (single sheet). */
export function evaluateFormula(raw, cells = {}) {
  const evaluator = createWorkbookEvaluator({ sheets: [{ id: "s", name: "Planilha1", cells: { ...cells, __F: raw } }] });
  return evaluator.value("s", "__F");
}

const currencyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentFormat = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });
const number2Format = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCellValue(value, format = {}) {
  if (isFormulaError(value)) return value.error;
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "VERDADEIRO" : "FALSO";
  if (typeof value === "number") {
    if (format.numFmt === "currency") return currencyFormat.format(value);
    if (format.numFmt === "percent") return percentFormat.format(value);
    if (format.numFmt === "number2") return number2Format.format(value);
    return String(Math.round(value * 1e10) / 1e10);
  }
  return String(value);
}

/* ------------------------------------------------------------------ Excel: cores, regras e gráficos */

export const isHexColor = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
export const MAX_CONDITIONAL_RULES = 50;
export const MAX_SHEET_CHARTS = 10;
export const MAX_CHART_POINTS = 100;
export const CONDITIONAL_OPS = [[">", "maior que"], ["<", "menor que"], ["between", "entre"], ["=", "igual a"], ["contains", "contém"], ["top", "N maiores"], ["bottom", "N menores"]];
export const CHART_TYPES = [["bar", "Barras"], ["line", "Linhas"]];
export const CHART_COLORS = ["#217346", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

/** "B2:B20" ou "B2" → { c1, c2, r1, r2 } (colunas a partir de 0); null se inválido. */
export function parseCellRange(text) {
  const match = /^\s*([A-Za-z]{1,3}\d+)\s*(?::\s*([A-Za-z]{1,3}\d+))?\s*$/.exec(String(text ?? ""));
  if (!match) return null;
  const a = parseCellKey(match[1]);
  const b = parseCellKey(match[2] || match[1]);
  if (!a.row || !b.row || Math.max(a.col, b.col) >= MAX_COLUMNS || Math.max(a.row, b.row) > MAX_ROWS) return null;
  return { c1: Math.min(a.col, b.col), c2: Math.max(a.col, b.col), r1: Math.min(a.row, b.row), r2: Math.max(a.row, b.row) };
}

export const rangeToText = (range) => `${indexToColumn(range.c1)}${range.r1}:${indexToColumn(range.c2)}${range.r2}`;
const inRange = (range, pos) => pos.col >= range.c1 && pos.col <= range.c2 && pos.row >= range.r1 && pos.row <= range.r2;
const ruleNumber = (text) => { const clean = String(text ?? "").trim().replace(",", "."); const number = Number(clean); return clean !== "" && Number.isFinite(number) ? number : null; };
const ruleText = (value) => (isFormulaError(value) ? value.error : typeof value === "boolean" ? (value ? "VERDADEIRO" : "FALSO") : String(value)).trim().toLocaleLowerCase("pt-BR");

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object") return null;
  const range = parseCellRange(rule.range);
  const fill = isHexColor(rule.fill) ? rule.fill : "";
  const color = isHexColor(rule.color) ? rule.color : "";
  if (!range || !CONDITIONAL_OPS.some(([op]) => op === rule.op) || (!fill && !color)) return null;
  return { range: rangeToText(range), op: rule.op, value: String(rule.value ?? ""), value2: String(rule.value2 ?? ""), fill, color };
}

function normalizeChart(chart, index) {
  if (!chart || typeof chart !== "object") return null;
  const range = parseCellRange(chart.range);
  if (!range || range.c1 === range.c2) return null;
  return { id: String(chart.id || `chart-${index + 1}`), range: rangeToText(range), type: chart.type === "line" ? "line" : "bar", title: String(chart.title ?? "").slice(0, 80), header: chart.header !== false };
}

const listOf = (value, normalize, limit) => (Array.isArray(value) ? value.map(normalize).filter(Boolean).slice(0, limit) : []);

/** Descrição curta de uma regra de formatação condicional ("B2:B9 · maior que “10”"). */
export function describeRule(rule) {
  if (rule.op === "between") return `${rule.range} · entre ${rule.value} e ${rule.value2}`;
  if (rule.op === "top" || rule.op === "bottom") return `${rule.range} · ${rule.value} ${rule.op === "top" ? "maiores" : "menores"}`;
  return `${rule.range} · ${CONDITIONAL_OPS.find(([op]) => op === rule.op)[1]} “${rule.value}”`;
}

/** A regra vale para este valor calculado? Em top/bottom, `threshold` é o limite já calculado no intervalo. */
export function matchesRule(rule, value, threshold) {
  if (value === null || value === undefined || value === "") return false;
  const first = ruleNumber(rule.value);
  const numeric = typeof value === "number";
  if (rule.op === ">") return numeric && first !== null && value > first;
  if (rule.op === "<") return numeric && first !== null && value < first;
  if (rule.op === "between") {
    const second = ruleNumber(rule.value2);
    return numeric && first !== null && second !== null && value >= Math.min(first, second) && value <= Math.max(first, second);
  }
  const wanted = String(rule.value).trim().toLocaleLowerCase("pt-BR");
  if (rule.op === "=") return numeric && first !== null ? value === first : ruleText(value) === wanted;
  if (rule.op === "contains") return wanted !== "" && ruleText(value).includes(wanted);
  if (!numeric || typeof threshold !== "number") return false;
  return rule.op === "top" ? value >= threshold : value <= threshold;
}

/** Cores das regras da planilha por célula ({ B2: { fill, color } }), avaliadas sobre os valores calculados. A última regra vale por cima. */
export function conditionalFormats(sheet, valueOf) {
  const styles = {};
  const positions = Object.keys(sheet.cells || {}).map((key) => [key, parseCellKey(key)]).filter(([, pos]) => pos);
  (sheet.rules || []).forEach((rule) => {
    const range = parseCellRange(rule.range);
    if (!range) return;
    const inside = positions.filter(([, pos]) => inRange(range, pos)).map(([key]) => [key, valueOf(key)]);
    let threshold;
    if (rule.op === "top" || rule.op === "bottom") {
      const numbers = inside.map(([, value]) => value).filter((value) => typeof value === "number").sort((a, b) => (rule.op === "top" ? b - a : a - b));
      const wanted = Math.floor(ruleNumber(rule.value) ?? 0);
      if (wanted >= 1 && numbers.length) threshold = numbers[Math.min(wanted, numbers.length) - 1];
    }
    inside.forEach(([key, value]) => {
      if (matchesRule(rule, value, threshold)) styles[key] = { ...styles[key], ...(rule.fill && { fill: rule.fill }), ...(rule.color && { color: rule.color }) };
    });
  });
  return styles;
}

/** Estilo da célula: negrito/itálico e cores manuais; a formatação condicional vale por cima das cores manuais. */
export function gridCellStyle(format, conditional) {
  if (!format && !conditional) return undefined;
  return {
    fontWeight: format?.bold ? 700 : undefined,
    fontStyle: format?.italic ? "italic" : undefined,
    backgroundColor: conditional?.fill || (isHexColor(format?.fill) ? format.fill : undefined),
    color: conditional?.color || (isHexColor(format?.color) ? format.color : undefined),
  };
}

/** Dados do gráfico a partir do intervalo: rótulos na 1ª coluna, uma série por coluna seguinte (só números contam). */
export function chartData(chart, valueOf) {
  const range = parseCellRange(chart.range);
  const show = (value) => (value === null ? "" : formatCellValue(value));
  const first = chart.header ? range.r1 + 1 : range.r1;
  const series = [];
  for (let col = range.c1 + 1; col <= range.c2 && series.length < CHART_COLORS.length; col += 1) {
    const letter = indexToColumn(col);
    series.push({ name: (chart.header && show(valueOf(`${letter}${range.r1}`))) || `Coluna ${letter}`, color: CHART_COLORS[series.length], values: [] });
  }
  const labels = [];
  for (let row = first; row <= range.r2 && labels.length < MAX_CHART_POINTS; row += 1) {
    labels.push(show(valueOf(`${indexToColumn(range.c1)}${row}`)) || String(row));
    series.forEach((item, index) => { const value = valueOf(`${indexToColumn(range.c1 + 1 + index)}${row}`); item.values.push(typeof value === "number" ? value : null); });
  }
  return { labels, series };
}

const round2 = (value) => Math.round(value * 100) / 100;

/** Geometria do gráfico (barras agrupadas ou linhas) em coordenadas de SVG; null quando não há números. */
export function chartGeometry(data, type, { width = 480, height = 240 } = {}) {
  const numbers = data.series.flatMap((item) => item.values).filter((value) => value !== null);
  if (!numbers.length) return null;
  const min = Math.min(0, ...numbers);
  const top = Math.max(0, ...numbers);
  const max = top === min ? min + 1 : top;
  const plot = { left: 48, top: 12, right: width - 12, bottom: height - 32 };
  const y = (value) => round2(plot.bottom - ((value - min) / (max - min)) * (plot.bottom - plot.top));
  const slot = (plot.right - plot.left) / data.labels.length;
  const center = (index) => round2(plot.left + slot * (index + 0.5));
  const zero = y(0);
  const bars = [];
  const lines = [];
  if (type === "line") data.series.forEach((item) => lines.push({ name: item.name, color: item.color, points: item.values.flatMap((value, index) => (value === null ? [] : [{ x: center(index), y: y(value), value, label: data.labels[index] }])) }));
  else {
    const barWidth = (slot * 0.8) / data.series.length;
    data.series.forEach((item, seriesIndex) => item.values.forEach((value, index) => {
      if (value === null) return;
      bars.push({ x: round2(plot.left + slot * index + slot * 0.1 + barWidth * seriesIndex), y: Math.min(y(value), zero), width: round2(barWidth), height: round2(Math.abs(y(value) - zero)), color: item.color, name: item.name, label: data.labels[index], value });
    }));
  }
  const step = Math.ceil(data.labels.length / 12);
  return {
    width, height, plot, zero,
    ticks: [...new Set([min, 0, max])].map((value) => ({ value, y: y(value) })),
    labels: data.labels.flatMap((text, index) => (index % step ? [] : [{ text: text.length > 12 ? `${text.slice(0, 11)}…` : text, x: center(index) }])),
    bars, lines,
  };
}

let sheetSeed = 0;
const newSheet = (name) => ({ id: `sheet-${Date.now().toString(36)}-${(sheetSeed += 1)}`, name, cells: {}, formats: {}, rules: [], charts: [] });

/** Accepts the legacy {A1: "x"} cell map and returns the multi-sheet workbook shape. */
export function normalizeWorkbook(value) {
  if (value && Array.isArray(value.sheets) && value.sheets.length) {
    const sheets = value.sheets.map((sheet, index) => ({ id: String(sheet.id || `sheet-${index + 1}`), name: String(sheet.name || `Planilha${index + 1}`), cells: sheet.cells && typeof sheet.cells === "object" ? sheet.cells : {}, formats: sheet.formats && typeof sheet.formats === "object" ? sheet.formats : {}, rules: listOf(sheet.rules, normalizeRule, MAX_CONDITIONAL_RULES), charts: listOf(sheet.charts, normalizeChart, MAX_SHEET_CHARTS) }));
    return { sheets, active: sheets.some((sheet) => sheet.id === value.active) ? value.active : sheets[0].id };
  }
  const cells = {};
  if (value && typeof value === "object") Object.entries(value).forEach(([key, raw]) => { if (parseCellKey(key) && typeof raw === "string") cells[key.toUpperCase()] = raw; });
  return { sheets: [{ id: "sheet-1", name: "Planilha1", cells, formats: {}, rules: [], charts: [] }], active: "sheet-1" };
}

export function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const source = String(text).replace(/^﻿/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') { if (source[index + 1] === '"') { field += '"'; index += 1; } else quoted = false; }
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") { if (char === "\r" && source[index + 1] === "\n") index += 1; row.push(field); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function parseClipboardTable(text) {
  return String(text).replace(/\r?\n$/, "").split(/\r?\n/).map((line) => line.split("\t"));
}

export function sheetToCsv(sheet, evaluator) {
  const positions = Object.keys(sheet.cells).map(parseCellKey).filter(Boolean);
  if (!positions.length) return "";
  const maxCol = Math.max(...positions.map((pos) => pos.col));
  const maxRow = Math.max(...positions.map((pos) => pos.row));
  const quote = (text) => /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  const lines = [];
  for (let row = 1; row <= maxRow; row += 1) {
    const values = [];
    for (let col = 0; col <= maxCol; col += 1) {
      const value = evaluator.value(sheet.id, `${indexToColumn(col)}${row}`);
      values.push(quote(isFormulaError(value) ? value.error : typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : toText(value)));
    }
    lines.push(values.join(","));
  }
  return lines.join("\r\n");
}

/* ------------------------------------------------------------------ Excel */

const gridTabs = ["Arquivo", "Página Inicial", "Inserir", "Layout da Página", "Fórmulas", "Dados", "Revisão", "Exibir"];

/** Gráfico da planilha em SVG próprio; relê o intervalo a cada desenho, então acompanha as mudanças das células. */
function SheetChart({ chart, valueOf, onRemove }) {
  const data = chartData(chart, valueOf);
  const geometry = chartGeometry(data, chart.type);
  const name = chart.title || `Gráfico de ${chart.range}`;
  const kind = chart.type === "line" ? "linhas" : "barras";
  return <figure aria-label={name} className="w-[500px] max-w-full rounded border bg-white p-2 text-[#202020]">
    <figcaption className="flex items-center gap-2 text-xs"><b>{name}</b><span className="text-slate-500">{chart.range} · {kind}</span><button className="ml-auto rounded p-1 hover:bg-slate-100" aria-label={`Remover gráfico ${name}`} title="Remover gráfico" onClick={onRemove}><Trash2 size={13}/></button></figcaption>
    {geometry ? <svg role="img" aria-label={`Gráfico de ${kind}: ${data.series.map((item) => item.name).join(", ")}`} viewBox={`0 0 ${geometry.width} ${geometry.height}`} className="h-auto w-full">
      {geometry.ticks.map((tick) => <g key={tick.value}><line x1={geometry.plot.left} x2={geometry.plot.right} y1={tick.y} y2={tick.y} stroke={tick.value === 0 ? "#9ca3af" : "#e5e7eb"}/><text x={geometry.plot.left - 4} y={tick.y + 3} textAnchor="end" fontSize="9" fill="#6b7280">{formatCellValue(tick.value)}</text></g>)}
      {geometry.bars.map((bar) => <rect key={`${bar.name}-${bar.x}`} data-testid="chart-bar" x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.color}><title>{`${bar.label} · ${bar.name}: ${formatCellValue(bar.value)}`}</title></rect>)}
      {geometry.lines.map((line) => <g key={line.name} data-testid="chart-line"><polyline fill="none" stroke={line.color} strokeWidth="2" points={line.points.map((point) => `${point.x},${point.y}`).join(" ")}/>{line.points.map((point) => <circle key={point.x} cx={point.x} cy={point.y} r="3" fill={line.color}><title>{`${point.label} · ${line.name}: ${formatCellValue(point.value)}`}</title></circle>)}</g>)}
      {geometry.labels.map((label) => <text key={label.x} x={label.x} y={geometry.plot.bottom + 14} textAnchor="middle" fontSize="9" fill="#374151">{label.text}</text>)}
    </svg> : <p className="p-4 text-xs text-slate-500">Sem números nas colunas de valores de {chart.range}.</p>}
    <div className="flex flex-wrap gap-3 text-[10px]">{data.series.map((item) => <span key={item.name} className="flex items-center gap-1"><span className="inline-block h-2 w-3" style={{ backgroundColor: item.color }}/>{item.name}</span>)}</div>
  </figure>;
}

function GridCraft({ active = true }) {
  const storageKey = useWorkStorageKey("mm-office-grid");
  const [stored, setStored] = useWorkDraftState("pages/OfficeCraft.jsx:cells", () => normalizeWorkbook(readLocal(storageKey, {})));
  const [selected, setSelected] = useWorkDraftState("pages/OfficeCraft.jsx:selected", "A1");
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState("Página Inicial");
  const [showFormulas, setShowFormulas] = useState(false);
  const [status, setStatus] = useState("Pasta de trabalho local");
  const csvRef = useRef(null);
  const book = useMemo(() => normalizeWorkbook(stored), [stored]);
  const sheet = book.sheets.find((item) => item.id === book.active) || book.sheets[0];
  const evaluator = useMemo(() => createWorkbookEvaluator(book), [book]);
  useEffect(() => { if (!writeLocal(storageKey, book)) setStatus("Falha ao salvar neste dispositivo — baixe o CSV"); }, [book, storageKey]);
  const { columns: gridColumns, rows } = useMemo(() => gridExtent(sheet), [sheet]);
  // Ferramentas de um clique do MCP. O GridCraft não tem histórico próprio: o MCP guarda a pasta anterior
  // a cada aplicação e só desfaz se ninguém mexeu nela depois (refs: a fila roda antes do React redesenhar).
  const storedRef = useRef(stored); storedRef.current = stored;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const mcpHistory = useRef([]);
  useEffect(() => {
    if (!active) return undefined;
    const read = () => ({ book: storedRef.current, selected: selectedRef.current });
    const strip = ({ book: _book, ...result }) => result;
    return registerMCPActions({
      source: "excel",
      label: "Excel",
      catalogue: () => excelCatalogue(read()),
      analyze: async (toolId, params) => {
        const result = runExcelTool(toolId, read(), params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const result = runExcelTool(toolId, read(), params);
        if (result.ok && result.book) {
          mcpHistory.current.push({ before: storedRef.current, after: result.book });
          storedRef.current = result.book;
          setStored(result.book);
          setStatus(`MCP · ${result.summary}`);
        }
        return strip(result);
      },
      undo: () => {
        const last = mcpHistory.current.at(-1);
        if (!last) return false;
        if (storedRef.current !== last.after) {
          mcpHistory.current = [];
          setStatus("A planilha mudou depois da ação do MCP: desfazer cancelado para não perder suas alterações.");
          return false;
        }
        mcpHistory.current.pop();
        storedRef.current = last.before;
        setStored(last.before);
        setStatus("MCP · Última ação desfeita.");
        return true;
      },
      canUndo: () => mcpHistory.current.length > 0,
    });
  }, [active]);
  const update = (change) => setStored((current) => change(normalizeWorkbook(current)));
  const updateSheet = (change) => update((current) => ({ ...current, sheets: current.sheets.map((item) => item.id === current.active ? change(item) : item) }));
  const setCell = (key, raw) => updateSheet((item) => { const cells = { ...item.cells }; if (raw === "") delete cells[key]; else cells[key] = raw; return { ...item, cells }; });
  const format = sheet.formats[selected] || {};
  const toggleFormat = (name, value) => updateSheet((item) => {
    const current = item.formats[selected] || {};
    const next = name === "numFmt" ? { ...current, numFmt: current.numFmt === value ? undefined : value } : { ...current, [name]: !current[name] };
    return { ...item, formats: { ...item.formats, [selected]: next } };
  });
  function pasteTable(text, origin = selected) {
    const table = parseClipboardTable(text);
    const start = parseCellKey(origin);
    if (!start) return;
    updateSheet((item) => {
      const cells = { ...item.cells };
      table.forEach((line, r) => line.forEach((raw, c) => { const key = `${indexToColumn(start.col + c)}${start.row + r}`; if (raw === "") delete cells[key]; else cells[key] = raw; }));
      return { ...item, cells };
    });
    setStatus(`${table.length} linha(s) coladas a partir de ${origin}`);
  }
  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.readText) throw new Error("indisponível");
      pasteTable(await navigator.clipboard.readText());
    } catch { setStatus("Sem acesso à área de transferência: use Ctrl+V na célula"); }
  }
  function save() {
    try {
      downloadFile(`${sheet.name}.csv`, `﻿${sheetToCsv(sheet, evaluator)}`, "text/csv;charset=utf-8");
      setStatus(`${sheet.name}.csv baixado · cópia salva neste dispositivo`);
    } catch { setStatus("Não foi possível gerar o CSV neste navegador"); }
  }
  function newWorkbook() {
    if (book.sheets.some((item) => Object.keys(item.cells).length) && !window.confirm("Criar uma pasta de trabalho nova? Os dados atuais serão apagados deste dispositivo.")) return;
    setStored(normalizeWorkbook({})); setSelected("A1"); setStatus("Nova pasta de trabalho");
  }
  function addSheet() {
    update((current) => {
      let number = current.sheets.length + 1;
      while (current.sheets.some((item) => item.name.toUpperCase() === `PLANILHA${number}`)) number += 1;
      const created = newSheet(`Planilha${number}`);
      return { sheets: [...current.sheets, created], active: created.id };
    });
  }
  function renameSheet(target) {
    const name = window.prompt("Nome da planilha", target.name)?.trim();
    if (!name || name === target.name) return;
    if (/[!'[\]*?/\\:]/.test(name) || book.sheets.some((item) => item.id !== target.id && item.name.toUpperCase() === name.toUpperCase())) { setStatus("Nome de planilha inválido ou repetido"); return; }
    update((current) => ({ ...current, sheets: current.sheets.map((item) => item.id === target.id ? { ...item, name } : item) }));
  }
  function deleteSheet() {
    if (book.sheets.length === 1) { setStatus("A pasta de trabalho precisa de ao menos uma planilha"); return; }
    if (!window.confirm(`Excluir ${sheet.name}? Fórmulas que apontam para ela passarão a mostrar #REF!.`)) return;
    update((current) => { const sheets = current.sheets.filter((item) => item.id !== current.active); return { sheets, active: sheets[0].id }; });
  }
  async function importCsv(file) {
    if (!file) return;
    try {
      const text = await readFileText(file);
      const firstLine = text.split(/\r?\n/)[0] || "";
      const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
      const cells = {};
      parseDelimited(text, delimiter).forEach((line, r) => line.forEach((raw, c) => { if (raw !== "") cells[`${indexToColumn(c)}${r + 1}`] = raw; }));
      update((current) => {
        let name = file.name.replace(/\.[^.]+$/, "").replace(/[!'[\]*?/\\:]/g, "").slice(0, 31) || "Importada";
        const base = name; let number = 2;
        while (current.sheets.some((item) => item.name.toUpperCase() === name.toUpperCase())) name = `${base} ${number++}`;
        const created = { ...newSheet(name), cells };
        return { sheets: [...current.sheets, created], active: created.id };
      });
      setStatus(`CSV importado: ${file.name}`);
    } catch { setStatus("Não foi possível ler o CSV"); }
  }
  function autoSum() {
    const pos = parseCellKey(selected);
    if (!pos) return;
    let first = pos.row - 1;
    while (first >= 1 && typeof evaluator.value(sheet.id, `${indexToColumn(pos.col)}${first}`) === "number") first -= 1;
    if (first === pos.row - 1) { setStatus("AutoSoma: nenhuma célula numérica acima da seleção"); return; }
    const column = indexToColumn(pos.col);
    setCell(selected, `=SUM(${column}${first + 1}:${column}${pos.row - 1})`);
  }
  function moveFrom(key, rowStep) {
    const pos = parseCellKey(key);
    const next = `${indexToColumn(pos.col)}${Math.min(rows.length, Math.max(1, pos.row + rowStep))}`;
    window.document.querySelector(`[aria-label="Célula ${next}"]`)?.focus();
  }
  const display = (key) => {
    const raw = sheet.cells[key] || "";
    if (editing === key || showFormulas) return raw;
    return formatCellValue(evaluator.value(sheet.id, key), sheet.formats[key]);
  };
  const valueOf = (key) => evaluator.value(sheet.id, key);
  const conditional = useMemo(() => conditionalFormats(sheet, (key) => evaluator.value(sheet.id, key)), [sheet, evaluator]);
  const cellStyle = (key) => gridCellStyle(sheet.formats[key], conditional[key]);
  const setColor = (name, value) => updateSheet((item) => {
    const { [name]: _old, ...rest } = item.formats[selected] || {};
    return { ...item, formats: { ...item.formats, [selected]: value ? { ...rest, [name]: value } : rest } };
  });
  const removeRule = (index) => updateSheet((item) => ({ ...item, rules: item.rules.filter((_, position) => position !== index) }));
  const removeChart = (id) => updateSheet((item) => ({ ...item, charts: item.charts.filter((chart) => chart.id !== id) }));
  const ribbon = {
    Arquivo: <><button className={ribbonButton} onClick={newWorkbook}>Nova pasta de trabalho</button><button className={ribbonButton} onClick={() => csvRef.current?.click()}>Abrir CSV</button><button className={ribbonButton} onClick={save}>Baixar CSV</button></>,
    "Página Inicial": <><button className="rounded border px-3 py-2 text-xs" onClick={pasteFromClipboard}>Colar</button><button className="p-2" aria-label="Negrito" aria-pressed={Boolean(format.bold)} onClick={() => toggleFormat("bold")}><Bold size={16}/></button><button className="p-2" aria-label="Itálico" aria-pressed={Boolean(format.italic)} onClick={() => toggleFormat("italic")}><Italic size={16}/></button><button className="rounded border px-3 py-2 text-xs" aria-pressed={format.numFmt === "currency"} onClick={() => toggleFormat("numFmt", "currency")}>Moeda</button><button className="rounded border px-3 py-2 text-xs" aria-label="Porcentagem" aria-pressed={format.numFmt === "percent"} onClick={() => toggleFormat("numFmt", "percent")}>%</button><span className="h-10 w-px bg-slate-300"/><label className="flex items-center gap-1 text-xs" title="Cor de preenchimento da célula"><PaintBucket size={15}/><input type="color" aria-label="Cor de preenchimento" value={isHexColor(format.fill) ? format.fill : "#ffffff"} onChange={(e) => setColor("fill", e.target.value)} className="h-6 w-8"/></label><label className="flex items-center gap-1 text-xs" title="Cor do texto da célula"><Baseline size={15}/><input type="color" aria-label="Cor do texto" value={isHexColor(format.color) ? format.color : "#202020"} onChange={(e) => setColor("color", e.target.value)} className="h-6 w-8"/></label><button className={ribbonButton} disabled={!format.fill && !format.color} onClick={() => { setColor("fill", ""); setColor("color", ""); }}>Sem cor</button></>,
    Inserir: <><button className={ribbonButton} onClick={addSheet}>Nova planilha</button><button className={ribbonButton} onClick={() => renameSheet(sheet)}>Renomear planilha</button><button className={ribbonButton} onClick={deleteSheet}>Excluir planilha</button></>,
    Fórmulas: <><button className={ribbonButton} onClick={autoSum}>AutoSoma</button><button className={ribbonButton} aria-pressed={showFormulas} onClick={() => setShowFormulas(!showFormulas)}>Mostrar fórmulas</button><span className="text-xs text-slate-500">SUM, AVERAGE, MIN, MAX, COUNT, IF, ROUND (ou SOMA, MÉDIA, SE, ARRED…)</span></>,
  };
  return <div className="min-h-[680px] bg-white text-[#202020]">
    <div className="flex h-10 items-center gap-3 bg-[#217346] px-4 text-xs text-white"><b>GridCraft</b><button aria-label="Nova pasta de trabalho" title="Nova pasta de trabalho" onClick={newWorkbook}><FilePlus2 size={15}/></button><button aria-label="Salvar CSV" title="Salvar (baixar CSV da planilha ativa)" onClick={save}><Save size={15}/></button><span role="status" className="ml-auto">{status}</span></div>
    <div className="border-b"><div className="flex gap-6 px-5 pt-2 text-xs">{gridTabs.map((x)=><button key={x} aria-pressed={tab===x} onClick={()=>setTab(x)} className={tab===x?"border-b-2 border-[#217346] pb-2":"pb-2"}>{x}</button>)}</div><div className="flex h-16 items-center gap-2 border-t px-4">{ribbon[tab] || <span className="text-xs text-slate-500">{unavailableTab}</span>}</div></div>
    <div className="flex h-9 items-center border-b bg-[#fafafa] px-3 text-xs"><span className="w-16 font-semibold">{selected}</span><span className="mr-2 text-slate-400">ƒx</span><input aria-label="Barra de fórmulas" value={sheet.cells[selected]||""} onChange={(e)=>setCell(selected, e.target.value)} className="flex-1 border-l bg-transparent px-3 outline-none"/></div>
    <div className="overflow-auto"><table className="border-collapse text-xs"><thead><tr><th className="sticky left-0 h-7 w-10 border bg-[#f1f1f1]"/>{gridColumns.map(c=><th key={c} className="h-7 min-w-36 border bg-[#f1f1f1] font-normal">{c}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row}><th className="sticky left-0 border bg-[#f1f1f1] font-normal">{row}</th>{gridColumns.map(col=>{const key=`${col}${row}`;return <td key={key} className={`border ${selected===key?"outline outline-2 outline-[#217346]":""}`}><input aria-label={`Célula ${key}`} value={display(key)} style={cellStyle(key)} onFocus={()=>{setSelected(key); setEditing(key);}} onBlur={()=>setEditing((current)=>current===key?null:current)} onChange={(e)=>setCell(key, e.target.value)} onPaste={(e)=>{const text=e.clipboardData?.getData("text/plain")||""; if (/[\t\n]/.test(text.replace(/\r?\n$/, ""))) { e.preventDefault(); pasteTable(text, key); }}} onKeyDown={(e)=>{ if (e.key==="Enter") { e.preventDefault(); moveFrom(key, e.shiftKey?-1:1); } }} className="h-7 w-36 bg-transparent px-2 outline-none"/></td>;})}</tr>)}</tbody></table></div>
    {(sheet.rules.length > 0 || sheet.charts.length > 0) && <div className="flex flex-wrap items-start gap-3 border-t bg-[#fafafa] p-3">
      {sheet.rules.length > 0 && <ul aria-label="Formatação condicional" className="min-w-56 space-y-1 rounded border bg-white p-2 text-xs"><li className="font-semibold">Formatação condicional</li>{sheet.rules.map((rule, index) => <li key={`${index}-${describeRule(rule)}`} className="flex items-center gap-2"><span className="inline-flex h-4 w-6 items-center justify-center rounded border text-[9px] font-bold" style={{ backgroundColor: rule.fill || undefined, color: rule.color || undefined }}>A</span><span>{describeRule(rule)}</span><button className="ml-auto rounded p-1 hover:bg-slate-100" aria-label={`Remover regra ${describeRule(rule)}`} title="Remover regra" onClick={() => removeRule(index)}><Trash2 size={12}/></button></li>)}</ul>}
      {sheet.charts.map((chart) => <SheetChart key={chart.id} chart={chart} valueOf={valueOf} onRemove={() => removeChart(chart.id)}/>)}
    </div>}
    <div className="flex h-8 items-center border-t bg-[#f4f4f4] px-3 text-xs"><button className="mr-3 text-lg" aria-label="Nova planilha" title="Nova planilha" onClick={addSheet}>＋</button>{book.sheets.map((item)=><button key={item.id} aria-pressed={item.id===sheet.id} title="Clique duas vezes para renomear" onClick={()=>update((current)=>({...current, active:item.id}))} onDoubleClick={()=>renameSheet(item)} className={item.id===sheet.id?"h-full border-b-2 border-[#217346] px-5":"h-full px-5"}>{item.name}</button>)}</div>
    <input ref={csvRef} className="hidden" type="file" accept=".csv,text/csv" aria-label="Abrir CSV" onChange={(event) => { importCsv(event.target.files?.[0]); event.target.value = ""; }}/>
  </div>;
}

/* ------------------------------------------------------------------ PowerPoint */

const deckTabs = ["Arquivo", "Início", "Inserir", "Design", "Transições", "Animações", "Apresentação", "Revisão", "Exibir"];
export const slideLayouts = [{ id: "title", label: "Slide de título" }, { id: "title-content", label: "Título e conteúdo" }, { id: "title-only", label: "Somente título" }];

export function moveItem(list, from, to) {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const slideThemes = [
  { id: "classic", label: "Clássico", background: "#ffffff", color: "#252525" },
  { id: "dark", label: "Escuro", background: "#1f2937", color: "#f9fafb" },
  { id: "ocean", label: "Oceano", background: "#0c4a6e", color: "#e0f2fe" },
  { id: "forest", label: "Floresta", background: "#14532d", color: "#ecfdf5" },
  { id: "sunset", label: "Pôr do sol", background: "#9a3412", color: "#fff7ed" },
  { id: "sand", label: "Areia", background: "#fef3c7", color: "#78350f" },
];
export const slideAligns = [["auto", "Pelo layout"], ["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"], ["justify", "Justificado"]];

/** Fundo e cor do texto do slide (apresentações antigas não têm tema: ficam no Clássico, branco). */
export function slideThemeOf(slide) {
  return { background: isHexColor(slide?.theme?.background) ? slide.theme.background : slideThemes[0].background, color: isHexColor(slide?.theme?.color) ? slide.theme.color : slideThemes[0].color };
}

export const sameTheme = (a, b) => a.background.toLowerCase() === b.background.toLowerCase() && a.color.toLowerCase() === b.color.toLowerCase();

/** Alinhamento efetivo: o escolhido no slide ou, em "auto", o do layout (Título e conteúdo = esquerda; os outros = centro). */
export function slideAlignOf(slide) {
  return slide.align && slide.align !== "auto" ? slide.align : slide.layout === "title-content" ? "left" : "center";
}

export function normalizeDeck(value) {
  const slides = Array.isArray(value) ? value : Array.isArray(value?.slides) ? value.slides : null;
  if (!slides) return null;
  const clean = slides.filter((slide) => slide && typeof slide === "object").map((slide, index) => ({
    id: slide.id ?? `${Date.now()}-${index}`,
    title: String(slide.title ?? ""), body: String(slide.body ?? ""),
    layout: slideLayouts.some((layout) => layout.id === slide.layout) ? slide.layout : "title",
    titleStyle: { bold: Boolean(slide.titleStyle?.bold), italic: Boolean(slide.titleStyle?.italic) },
    bodyStyle: { bold: Boolean(slide.bodyStyle?.bold), italic: Boolean(slide.bodyStyle?.italic) },
    notes: String(slide.notes ?? ""),
    align: slideAligns.some(([align]) => align === slide.align) ? slide.align : "auto",
    theme: slideThemeOf(slide),
  }));
  return clean.length ? clean : null;
}

const textStyle = (style, base) => ({ fontWeight: style?.bold ? 800 : base, fontStyle: style?.italic ? "italic" : undefined });

function SlidePresenter({ slides, start, onClose }) {
  const [index, setIndex] = useState(start);
  const [showNotes, setShowNotes] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    element?.focus();
    let entered = false;
    try { const request = element?.requestFullscreen?.(); entered = Boolean(request); request?.catch?.(() => {}); } catch { /* tela cheia opcional */ }
    const onFullscreen = () => { if (entered && !window.document.fullscreenElement) onClose(); };
    window.document.addEventListener("fullscreenchange", onFullscreen);
    return () => { window.document.removeEventListener("fullscreenchange", onFullscreen); if (window.document.fullscreenElement) window.document.exitFullscreen?.().catch?.(() => {}); };
  }, [onClose]);
  useEffect(() => {
    const onKey = (event) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.min(slides.length - 1, value + 1)); }
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
      else if (event.key === "Home") setIndex(0);
      else if (event.key === "End") setIndex(slides.length - 1);
      else if (event.key === "Escape") onClose();
      else if (event.key === "n" || event.key === "N") setShowNotes((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, onClose]);
  const slide = slides[index];
  const theme = slideThemeOf(slide);
  const align = slideAlignOf(slide);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label="Apresentação de slides" tabIndex={-1} onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))} className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black outline-none">
    <div className="flex aspect-video w-full max-w-[min(100vw,177vh)] flex-col justify-center bg-white p-20 text-[#252525]" style={{ backgroundColor: theme.background, color: theme.color }}>
      <h2 className="text-5xl font-semibold" style={{ ...textStyle(slide.titleStyle), textAlign: align }}>{slide.title}</h2>
      {slide.layout !== "title-only" && <p className="mt-10 whitespace-pre-wrap text-2xl" style={{ ...textStyle(slide.bodyStyle), textAlign: align }}>{slide.body}</p>}
    </div>
    {showNotes && <aside aria-label="Anotações do apresentador" onClick={(event) => event.stopPropagation()} className="mt-3 max-h-40 w-full max-w-3xl overflow-auto whitespace-pre-wrap rounded bg-white/10 p-3 text-sm text-white">{slide.notes || "Este slide não tem anotações."}</aside>}
    <p className="mt-3 text-xs text-slate-400">Slide {index + 1} de {slides.length} · ← → navegam · N mostra/oculta as anotações · Esc encerra</p>
  </div>;
}

function DeckCraft({ active: mcpActive = true }) {
  const storageKey = useWorkStorageKey("mm-office-deck");
  const [stored, setSlides] = useWorkDraftState("pages/OfficeCraft.jsx:slides", () => readLocal(storageKey, [{id:1,title:"Título da apresentação",body:"Clique para adicionar um subtítulo"}]));
  const slides = useMemo(() => normalizeDeck(stored) || normalizeDeck([{ id: 1, title: "Título da apresentação", body: "Clique para adicionar um subtítulo" }]), [stored]);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState("Início");
  const [field, setField] = useState("title");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [presenting, setPresenting] = useState(null);
  const [status, setStatus] = useState("Apresentação local");
  const fileRef = useRef(null);
  const index = Math.min(active, slides.length - 1);
  const current = slides[index];
  useEffect(() => { if (!writeLocal(storageKey, slides)) setStatus("Falha ao salvar neste dispositivo — baixe o arquivo"); }, [slides, storageKey]);
  // Ferramentas de um clique do MCP. O DeckCraft não tem histórico próprio: o MCP guarda os slides anteriores
  // a cada aplicação e só desfaz se ninguém mexeu neles depois (refs: a fila roda antes do React redesenhar).
  const deckRef = useRef(null);
  deckRef.current = { stored, slides, index };
  const mcpHistory = useRef([]);
  useEffect(() => {
    if (!mcpActive) return undefined;
    const read = () => ({ slides: deckRef.current.slides, index: deckRef.current.index });
    const strip = ({ slides: _slides, index: _index, ...result }) => result;
    return registerMCPActions({
      source: "powerpoint",
      label: "PowerPoint",
      catalogue: () => powerpointCatalogue(read()),
      analyze: async (toolId, params) => {
        const result = runPowerPointTool(toolId, read(), params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const result = runPowerPointTool(toolId, read(), params);
        if (result.ok && result.slides) {
          const before = deckRef.current;
          mcpHistory.current.push({ before: before.stored, index: before.index, after: result.slides });
          deckRef.current = { stored: result.slides, slides: result.slides, index: result.index };
          setSlides(result.slides); setActive(result.index);
          setStatus(`MCP · ${result.summary}`);
        }
        return strip(result);
      },
      undo: () => {
        const last = mcpHistory.current.at(-1);
        if (!last) return false;
        if (deckRef.current.stored !== last.after) {
          mcpHistory.current = [];
          setStatus("Os slides mudaram depois da ação do MCP: desfazer cancelado para não perder suas alterações.");
          return false;
        }
        mcpHistory.current.pop();
        const slides = normalizeDeck(last.before) || deckRef.current.slides;
        deckRef.current = { stored: last.before, slides, index: last.index };
        setSlides(last.before); setActive(last.index);
        setStatus("MCP · Última ação desfeita.");
        return true;
      },
      canUndo: () => mcpHistory.current.length > 0,
    });
  }, [mcpActive]);
  const patch = (data) => setSlides(slides.map((s,i)=>i===index?{...s,...data}:s));
  const add = () => { setSlides([...slides,{id:Date.now(),title:"Novo slide",body:"Adicione seu conteúdo",layout:"title",titleStyle:{},bodyStyle:{}}]); setActive(slides.length); };
  const duplicate = () => { setSlides([...slides.slice(0, index + 1), { ...current, id: Date.now(), titleStyle: { ...current.titleStyle }, bodyStyle: { ...current.bodyStyle } }, ...slides.slice(index + 1)]); setActive(index + 1); };
  const remove = (target = index) => {
    if (slides.length === 1) { setStatus("A apresentação precisa de ao menos um slide"); return; }
    if (!window.confirm(`Excluir o slide ${target + 1}?`)) return;
    setSlides(slides.filter((_, i) => i !== target)); setActive(Math.max(0, Math.min(target, slides.length - 2)));
  };
  const move = (step) => { const to = index + step; if (to < 0 || to >= slides.length) return; setSlides(moveItem(slides, index, to)); setActive(to); };
  const toggleStyle = (name) => { const key = field === "body" ? "bodyStyle" : "titleStyle"; patch({ [key]: { ...current[key], [name]: !current[key]?.[name] } }); };
  const closePresenter = useCallback(() => setPresenting(null), []);
  const currentTheme = slideThemeOf(current);
  const align = slideAlignOf(current);
  function save() {
    try { downloadFile("apresentacao-deckcraft.json", JSON.stringify({ schema: "mm-deckcraft/v1", savedAt: new Date().toISOString(), slides }, null, 2), "application/json"); setStatus("apresentacao-deckcraft.json baixado · cópia salva neste dispositivo"); }
    catch { setStatus("Não foi possível gerar o arquivo neste navegador"); }
  }
  async function open(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await readFileText(file));
      const deck = normalizeDeck(parsed);
      if (!deck || (parsed.schema && parsed.schema !== "mm-deckcraft/v1")) throw new Error("inválido");
      setSlides(deck); setActive(0); setStatus(`Aberto: ${file.name}`);
    } catch { setStatus("Arquivo de apresentação inválido"); }
  }
  const ribbon = {
    Arquivo: <><button className={ribbonButton} onClick={() => fileRef.current?.click()}>Abrir .json</button><button className={ribbonButton} onClick={save}>Baixar .json</button></>,
    Início: <><button aria-label="Novo slide" onClick={add} className="flex items-center gap-2 rounded border px-3 py-2 text-xs"><Plus size={16}/>Novo slide</button><span className="relative"><button aria-haspopup="menu" aria-expanded={layoutOpen} onClick={() => setLayoutOpen(!layoutOpen)} className="flex items-center gap-2 rounded border px-3 py-2 text-xs"><LayoutTemplate size={16}/>Layout</button>{layoutOpen && <span role="menu" aria-label="Layouts de slide" className="absolute left-0 top-full z-20 mt-1 flex w-44 flex-col rounded border bg-white py-1 text-xs shadow-lg">{slideLayouts.map((layout) => <button key={layout.id} role="menuitemradio" aria-checked={current.layout === layout.id} onClick={() => { patch({ layout: layout.id }); setLayoutOpen(false); }} className={`px-3 py-2 text-left hover:bg-orange-50 ${current.layout === layout.id ? "font-semibold text-[#b7472a]" : ""}`}>{layout.label}</button>)}</span>}</span><span className="h-10 w-px bg-slate-300"/><button aria-label="Negrito" aria-pressed={Boolean((field === "body" ? current.bodyStyle : current.titleStyle)?.bold)} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleStyle("bold")}><Bold size={17}/></button><button aria-label="Itálico" aria-pressed={Boolean((field === "body" ? current.bodyStyle : current.titleStyle)?.italic)} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleStyle("italic")}><Italic size={17}/></button></>,
    Inserir: <><button className={ribbonButton} onClick={add}>Novo slide</button><button className={ribbonButton} onClick={duplicate}>Duplicar slide</button><button className={ribbonButton} onClick={() => remove()}>Excluir slide</button><button className={ribbonButton} disabled={index === 0} onClick={() => move(-1)}>Mover para cima</button><button className={ribbonButton} disabled={index === slides.length - 1} onClick={() => move(1)}>Mover para baixo</button></>,
    Design: <><span className="text-xs text-slate-500">Tema</span>{slideThemes.map((theme) => <button key={theme.id} aria-label={`Tema ${theme.label}`} title={`Tema ${theme.label}`} aria-pressed={sameTheme(currentTheme, theme)} onClick={() => patch({ theme: { background: theme.background, color: theme.color } })} className={`h-9 w-12 rounded border text-xs font-semibold ${sameTheme(currentTheme, theme) ? "outline outline-2 outline-[#b7472a]" : ""}`} style={{ backgroundColor: theme.background, color: theme.color }}>Aa</button>)}<button className={ribbonButton} onClick={() => setSlides(slides.map((slide) => ({ ...slide, theme: { ...currentTheme } })))}>Tema em todos</button><span className="h-10 w-px bg-slate-300"/>{[["left", "Alinhar à esquerda", AlignLeft], ["center", "Centralizar", AlignCenter], ["right", "Alinhar à direita", AlignRight], ["justify", "Justificar", AlignJustify]].map(([value, label, Icon]) => <button key={value} className="p-2" aria-label={label} title={label} aria-pressed={current.align === value} onClick={() => patch({ align: value })}><Icon size={17}/></button>)}<button className={ribbonButton} aria-pressed={current.align === "auto"} onClick={() => patch({ align: "auto" })}>Alinhar pelo layout</button></>,
    Apresentação: <><button className={ribbonButton} onClick={() => setPresenting(0)}>Apresentar do início</button><button className={ribbonButton} onClick={() => setPresenting(index)}>Apresentar do slide atual</button></>,
  };
  const left = current.layout === "title-content";
  return <div className="flex min-h-[680px] flex-col bg-[#e9e9e9] text-[#252525]">
    <div className="flex h-10 items-center gap-3 bg-[#b7472a] px-4 text-xs text-white"><b>DeckCraft</b><button aria-label="Salvar apresentação" title="Salvar (baixar .json)" onClick={save}><Save size={15}/></button><span role="status" className="ml-auto">{status}</span></div>
    <div className="border-b bg-white"><div className="flex gap-6 px-5 pt-2 text-xs">{deckTabs.map((x)=><button key={x} aria-pressed={tab===x} onClick={()=>{setTab(x); setLayoutOpen(false);}} className={tab===x?"border-b-2 border-[#b7472a] pb-2":"pb-2"}>{x}</button>)}</div><div className="flex h-20 items-center gap-3 border-t px-4">{ribbon[tab] || <span className="text-xs text-slate-500">{unavailableTab}</span>}</div></div>
    <div className="grid flex-1 grid-cols-[190px_1fr]"><aside className="overflow-auto border-r bg-white p-3">{slides.map((slide,i)=><button key={slide.id} aria-label={`Slide ${i+1}`} title="Delete exclui · Alt+↑/↓ reordena" onClick={()=>setActive(i)} onKeyDown={(event)=>{ if (event.key==="Delete") { event.preventDefault(); remove(i); } else if (event.altKey && (event.key==="ArrowUp"||event.key==="ArrowDown")) { event.preventDefault(); const to=i+(event.key==="ArrowUp"?-1:1); if (to>=0&&to<slides.length) { setSlides(moveItem(slides,i,to)); setActive(to); } } }} className={`mb-3 block w-full rounded p-2 text-left ${i===index?"bg-orange-100 outline outline-2 outline-[#b7472a]":""}`}><span className="mr-2 text-[10px]">{i+1}</span><span className="inline-flex aspect-video w-32 items-center border bg-white p-2 text-center text-[9px]" style={{ backgroundColor: slideThemeOf(slide).background, color: slideThemeOf(slide).color, justifyContent: { left: "flex-start", right: "flex-end" }[slideAlignOf(slide)] || "center", textAlign: slideAlignOf(slide) }}>{slide.title}</span>{slide.notes.trim() && <span className="ml-6 block text-[9px] text-slate-500" title={slide.notes}>Com anotações</span>}</button>)}</aside>
      <main className="flex flex-col items-center justify-center gap-4 p-8"><div data-testid="slide-canvas" className="aspect-video w-full max-w-4xl bg-white p-20 shadow-xl" style={{ backgroundColor: currentTheme.background, color: currentTheme.color }}><input aria-label="Título do slide" value={current.title} onFocus={()=>setField("title")} onChange={(e)=>patch({title:e.target.value})} style={{...textStyle(current.titleStyle), textAlign: align, color: "inherit"}} className="w-full border border-dashed border-slate-300 bg-transparent p-4 text-center text-4xl font-semibold outline-none"/>{current.layout !== "title-only" && <textarea aria-label="Conteúdo do slide" value={current.body} onFocus={()=>setField("body")} onChange={(e)=>patch({body:e.target.value})} style={{...textStyle(current.bodyStyle), textAlign: align, color: "inherit", height: left ? "14rem" : undefined}} className="mt-10 h-28 w-full resize-none border border-dashed border-slate-300 bg-transparent p-4 text-center text-xl outline-none"/>}</div><textarea aria-label="Anotações do slide" value={current.notes} onChange={(e)=>patch({notes:e.target.value})} placeholder="Clique para adicionar anotações do apresentador (aparecem com N no modo apresentação)" className="h-20 w-full max-w-4xl resize-y rounded border border-slate-300 bg-white p-3 text-sm text-[#252525] outline-none"/></main></div>
    <div className="h-7 bg-white px-4 py-1 text-[11px] text-slate-500">Slide {index+1} de {slides.length}<span className="float-right">100%</span></div>
    <input ref={fileRef} className="hidden" type="file" accept=".json,application/json" aria-label="Abrir apresentação" onChange={(event) => { open(event.target.files?.[0]); event.target.value = ""; }}/>
    {presenting !== null && <SlidePresenter slides={slides} start={Math.min(presenting, slides.length - 1)} onClose={closePresenter}/>}
  </div>;
}

// showAppSwitcher: nas Ferramentas Gráficas o menu principal já escolhe Word/Excel/PowerPoint,
// então o submenu repetido fica oculto; a página própria (/ferramentas-office) mantém o seletor.
export default function OfficeCraft({ initialApp = "Word", active = true, showAppSwitcher = true }) {
  const [app, setApp] = useState(initialApp);
  useEffect(() => setApp(initialApp), [initialApp]);
  return <section className="overflow-hidden rounded-xl border border-slate-300 shadow-2xl">{showAppSwitcher&&<header className="flex h-12 items-center bg-[#24262a] px-4 text-white"><b className="mr-8">Ferramentas de documentos</b><div role="tablist" aria-label="Aplicativos de documentos" className="flex h-full">{apps.map(name=><button key={name} role="tab" aria-selected={app===name} onClick={()=>setApp(name)} className={`px-6 text-sm ${app===name?"border-b-2 border-white bg-white/10":"text-slate-300"}`}>{name}</button>)}</div></header>}{app==="Word"?<WordCraft active={active}/>:app==="Excel"?<GridCraft active={active}/>:<DeckCraft active={active}/>}</section>;
}
