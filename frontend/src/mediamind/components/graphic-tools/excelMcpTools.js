// Catálogo de ferramentas de um clique do Excel (GridCraft) para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { book, selected } (pasta de trabalho normalizada) e devolve { ok, summary, book };
// trabalha sempre na planilha ativa. Condições não atendidas viram { ok: false, summary }.
import { ArrowDownToLine, ArrowDownUp, Bold, ChartColumn, CircleSlash, CopyMinus, Eraser, Filter, Hash, ListOrdered, Paintbrush, PaintBucket, Palette, Sigma, SquareFunction, Calculator, TableColumnsSplit, Trash2 } from "lucide-react";
import {
  CHART_COLORS,
  CHART_TYPES,
  CONDITIONAL_OPS,
  MAX_CHART_POINTS,
  MAX_CONDITIONAL_RULES,
  MAX_SHEET_CHARTS,
  chartData,
  chartGeometry,
  columnToIndex,
  conditionalFormats,
  createWorkbookEvaluator,
  describeRule,
  indexToColumn,
  isFormulaError,
  isHexColor,
  normalizeWorkbook,
  parseCellKey,
  parseCellRange,
} from "../../pages/OfficeCraft";

export const EXCEL_TABS = [
  { id: "dados", label: "Dados" },
  { id: "formulas", label: "Fórmulas" },
  { id: "formatar", label: "Formatar" },
  { id: "preencher", label: "Preencher" },
];

class ToolError extends Error {}

const MAX_CELLS = 50000;
const MAX_COLUMN = 16383;
const MAX_ROW = 1048576;
const FUNCTIONS = [
  ["SUM", "Soma", "Total"],
  ["AVERAGE", "Média", "Média"],
  ["MIN", "Mínimo", "Mínimo"],
  ["MAX", "Máximo", "Máximo"],
  ["COUNT", "Contagem", "Contagem"],
];
const NUMBER_FORMATS = [
  ["general", "Geral"],
  ["number2", "Número (2 casas)"],
  ["currency", "Moeda (R$)"],
  ["percent", "Porcentagem"],
];
const OPERATORS = [
  ["eq", "igual a"],
  ["ne", "diferente de"],
  ["gt", "maior que"],
  ["lt", "menor que"],
  ["ge", "maior ou igual a"],
  ["le", "menor ou igual a"],
  ["contains", "contém"],
];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const keyOf = (col, row) => `${indexToColumn(col)}${row}`;
const rangeText = (range) => `${keyOf(range.c1, range.r1)}:${keyOf(range.c2, range.r2)}`;
const plain = (value) => String(Math.round(value * 1e10) / 1e10);
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function context(state) {
  const book = normalizeWorkbook(state.book);
  const sheet = book.sheets.find((item) => item.id === book.active);
  const evaluator = createWorkbookEvaluator(book);
  return { book, sheet, value: (col, row) => evaluator.value(sheet.id, keyOf(col, row)), valueOf: (key) => evaluator.value(sheet.id, key) };
}

const withSheet = (book, sheet) => ({ ...book, sheets: book.sheets.map((item) => (item.id === sheet.id ? sheet : item)) });

export function parseRange(text) {
  const range = parseCellRange(text);
  if (!range) throw new ToolError("Intervalo inválido: use o formato A1:C10.");
  if ((range.c2 - range.c1 + 1) * (range.r2 - range.r1 + 1) > MAX_CELLS) throw new ToolError("Intervalo grande demais (máximo de 50.000 células).");
  return range;
}

function usedRange(sheet) {
  const positions = Object.keys(sheet.cells).map(parseCellKey).filter(Boolean);
  if (!positions.length) return "A1";
  const cols = positions.map((pos) => pos.col);
  const rows = positions.map((pos) => pos.row);
  return rangeText({ c1: Math.min(...cols), c2: Math.max(...cols), r1: Math.min(...rows), r2: Math.max(...rows) });
}

function eachCell(range, visit) {
  for (let row = range.r1; row <= range.r2; row += 1) for (let col = range.c1; col <= range.c2; col += 1) visit(col, row, keyOf(col, row));
}

function rejectFormulas(sheet, range, action) {
  let found = false;
  eachCell(range, (_col, _row, key) => {
    if (String(sheet.cells[key] ?? "").startsWith("=")) found = true;
  });
  if (found) throw new ToolError(`O intervalo tem fórmulas: ${action} moveria as fórmulas sem ajustar as referências. Use “Fórmulas em valores” antes.`);
}

function dataStart(range, header, minimum = 1) {
  const start = range.r1 + (header ? 1 : 0);
  if (range.r2 - start + 1 < minimum) throw new ToolError(minimum > 1 ? "Precisa de ao menos duas linhas de dados." : "O intervalo precisa de ao menos uma linha de dados.");
  return start;
}

function columnIn(range, letter) {
  const col = columnToIndex(letter);
  if (col < range.c1 || col > range.c2) throw new ToolError(`A coluna ${letter} está fora do intervalo ${rangeText(range)}.`);
  return col;
}

/** Valor calculado como texto de célula (sem virar fórmula por acidente). */
function literal(value) {
  if (isFormulaError(value)) return value.error;
  if (typeof value === "number") return plain(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const text = String(value);
  return text.startsWith("=") ? ` ${text}` : text;
}

const textValue = (value) => (value === null ? "" : literal(value).trim().toLocaleLowerCase("pt-BR"));

function compareCells(a, b) {
  const rank = (value) => (typeof value === "number" ? 0 : typeof value === "string" ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === "string") return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
  return Number(a) - Number(b);
}

/** Regrava as linhas start..r2 do intervalo com as linhas de origem (undefined = linha vazia). */
function rewriteRows(sheet, range, start, sources) {
  const cells = { ...sheet.cells };
  const formats = { ...sheet.formats };
  for (let row = start; row <= range.r2; row += 1) {
    const from = sources[row - start];
    for (let col = range.c1; col <= range.c2; col += 1) {
      const key = keyOf(col, row);
      const source = from === undefined ? undefined : keyOf(col, from);
      if (source && sheet.cells[source] !== undefined) cells[key] = sheet.cells[source];
      else delete cells[key];
      if (source && sheet.formats[source]) formats[key] = sheet.formats[source];
      else delete formats[key];
    }
  }
  return { ...sheet, cells, formats };
}

// ---------- dados ----------
function sortRange(state, params) {
  const { book, sheet, value } = context(state);
  const range = parseRange(params.range);
  rejectFormulas(sheet, range, "ordenar");
  const col = columnIn(range, params.column);
  const start = dataStart(range, params.header, 2);
  const direction = params.order === "desc" ? -1 : 1;
  const rows = [];
  for (let row = start; row <= range.r2; row += 1) rows.push({ row, value: value(col, row) });
  const sorted = [...rows].sort((a, b) => {
    if (a.value === null || b.value === null) return (a.value === null) - (b.value === null) || a.row - b.row;
    return compareCells(a.value, b.value) * direction || a.row - b.row;
  });
  if (sorted.every((item, index) => item.row === rows[index].row)) throw new ToolError("O intervalo já está nessa ordem.");
  return {
    ok: true,
    count: rows.length,
    summary: `${rows.length} linha(s) de ${rangeText(range)} ordenadas pela coluna ${params.column} (${direction > 0 ? "crescente" : "decrescente"})`,
    book: withSheet(book, rewriteRows(sheet, range, start, sorted.map((item) => item.row))),
  };
}

function matches(cell, operator, wanted) {
  if (operator === "contains") return textValue(cell).includes(wanted.toLocaleLowerCase("pt-BR"));
  const number = Number(String(wanted).trim().replace(",", "."));
  const numeric = String(wanted).trim() !== "" && Number.isFinite(number);
  if (operator === "eq" || operator === "ne") {
    const equal = numeric && typeof cell === "number" ? cell === number : textValue(cell) === wanted.trim().toLocaleLowerCase("pt-BR");
    return operator === "eq" ? equal : !equal;
  }
  if (!numeric) throw new ToolError("Para maior/menor, digite um número no valor.");
  if (typeof cell !== "number") return false;
  return { gt: cell > number, lt: cell < number, ge: cell >= number, le: cell <= number }[operator];
}

function filterToSheet(state, params, env) {
  const { book, value } = context(state);
  const range = parseRange(params.range);
  const col = columnIn(range, params.column);
  const start = dataStart(range, params.header);
  const wanted = String(params.value ?? "");
  const rows = [];
  for (let row = start; row <= range.r2; row += 1) if (matches(value(col, row), params.operator, wanted)) rows.push(row);
  if (!rows.length) throw new ToolError("Nenhuma linha atende ao filtro.");
  const copy = params.header ? [range.r1, ...rows] : rows;
  const cells = {};
  copy.forEach((row, index) => {
    for (let c = range.c1; c <= range.c2; c += 1) {
      const result = value(c, row);
      if (result !== null) cells[keyOf(c - range.c1, index + 1)] = literal(result);
    }
  });
  let name = "Filtro";
  for (let number = 2; book.sheets.some((item) => item.name.toUpperCase() === name.toUpperCase()); number += 1) name = `Filtro ${number}`;
  const created = { id: env.newId(), name, cells, formats: {} };
  const label = OPERATORS.find(([key]) => key === params.operator)[1];
  return {
    ok: true,
    count: rows.length,
    summary: `${rows.length} de ${range.r2 - start + 1} linha(s) com ${params.column} ${label} “${wanted}” copiadas para a planilha “${name}”`,
    book: { sheets: [...book.sheets, created], active: created.id },
  };
}

function removeDuplicates(state, params) {
  const { book, sheet, value } = context(state);
  const range = parseRange(params.range);
  rejectFormulas(sheet, range, "remover duplicadas");
  const start = dataStart(range, params.header);
  const seen = new Set();
  const keep = [];
  for (let row = start; row <= range.r2; row += 1) {
    const signature = [];
    for (let col = range.c1; col <= range.c2; col += 1) signature.push(textValue(value(col, row)));
    const id = JSON.stringify(signature);
    if (!seen.has(id)) keep.push(row);
    seen.add(id);
  }
  const removed = range.r2 - start + 1 - keep.length;
  if (!removed) throw new ToolError("Nenhuma linha duplicada no intervalo.");
  return { ok: true, count: removed, summary: `${removed} linha(s) duplicada(s) removida(s); ${keep.length} linha(s) única(s) mantida(s) em ${rangeText(range)}`, book: withSheet(book, rewriteRows(sheet, range, start, keep)) };
}

function trimSpaces(state, params) {
  const { book, sheet } = context(state);
  const range = parseRange(params.range);
  const cells = { ...sheet.cells };
  let count = 0;
  eachCell(range, (_col, _row, key) => {
    const raw = sheet.cells[key];
    if (raw === undefined || raw.startsWith("=")) return;
    const next = raw.replace(/\s+/g, " ").trim();
    if (next === raw) return;
    if (next) cells[key] = next;
    else delete cells[key];
    count += 1;
  });
  if (!count) throw new ToolError("Nenhuma célula com espaços sobrando no intervalo.");
  return { ok: true, count, summary: `Espaços limpos em ${count} célula(s)`, book: withSheet(book, { ...sheet, cells }) };
}

// ---------- fórmulas ----------
function occupied(sheet, keys) {
  const taken = keys.filter((key) => sheet.cells[key] !== undefined);
  if (taken.length) throw new ToolError(`${taken.slice(0, 3).join(", ")} já tem(têm) dados. Escolha outro intervalo para não sobrescrever.`);
}

function columnTotals(state, params) {
  const { book, sheet, value } = context(state);
  const range = parseRange(params.range);
  const start = dataStart(range, params.header);
  const [fn, , label] = FUNCTIONS.find(([key]) => key === params.fn);
  const row = range.r2 + 1;
  if (row > MAX_ROW) throw new ToolError("Não há linha abaixo do intervalo.");
  const writes = {};
  for (let col = range.c1; col <= range.c2; col += 1) {
    let numeric = false;
    for (let r = start; r <= range.r2; r += 1) if (typeof value(col, r) === "number") numeric = true;
    if (numeric) writes[keyOf(col, row)] = `=${fn}(${keyOf(col, start)}:${keyOf(col, range.r2)})`;
  }
  const columns = Object.keys(writes).length;
  if (!columns) throw new ToolError("O intervalo não tem números para totalizar.");
  const labelKey = keyOf(range.c1, row);
  if (!writes[labelKey]) writes[labelKey] = label;
  occupied(sheet, Object.keys(writes));
  const formats = { ...sheet.formats };
  Object.keys(writes).forEach((key) => {
    formats[key] = { ...formats[key], bold: true };
  });
  return { ok: true, count: columns, summary: `Linha de ${label.toLowerCase()} na linha ${row} (${columns} coluna(s))`, book: withSheet(book, { ...sheet, cells: { ...sheet.cells, ...writes }, formats }) };
}

function rowTotals(state, params) {
  const { book, sheet, value } = context(state);
  const range = parseRange(params.range);
  const start = dataStart(range, params.header);
  const col = range.c2 + 1;
  if (col > MAX_COLUMN) throw new ToolError("Não há coluna à direita do intervalo.");
  const writes = {};
  for (let row = start; row <= range.r2; row += 1) {
    let numeric = false;
    for (let c = range.c1; c <= range.c2; c += 1) if (typeof value(c, row) === "number") numeric = true;
    if (numeric) writes[keyOf(col, row)] = `=SUM(${keyOf(range.c1, row)}:${keyOf(range.c2, row)})`;
  }
  const rows = Object.keys(writes).length;
  if (!rows) throw new ToolError("Nenhuma linha com números no intervalo.");
  if (params.header) writes[keyOf(col, range.r1)] = "Total";
  occupied(sheet, Object.keys(writes));
  return { ok: true, count: rows, summary: `Coluna ${indexToColumn(col)} com o total de ${rows} linha(s)`, book: withSheet(book, { ...sheet, cells: { ...sheet.cells, ...writes } }) };
}

function formulasToValues(state, params) {
  const { book, sheet, value } = context(state);
  const range = parseRange(params.range);
  const cells = { ...sheet.cells };
  let converted = 0;
  let failed = 0;
  eachCell(range, (col, row, key) => {
    if (!String(sheet.cells[key] ?? "").startsWith("=")) return;
    const result = value(col, row);
    if (isFormulaError(result)) {
      failed += 1;
      return;
    }
    if (result === null) delete cells[key];
    else cells[key] = literal(result);
    converted += 1;
  });
  if (!converted && !failed) throw new ToolError("O intervalo não tem fórmulas.");
  if (!converted) throw new ToolError("Todas as fórmulas do intervalo dão erro; nada foi convertido.");
  return {
    ok: true,
    count: converted,
    summary: `${converted} fórmula(s) convertida(s) em valor${failed ? `; ${failed} com erro mantida(s)` : ""}`,
    book: withSheet(book, { ...sheet, cells }),
  };
}

function rangeSummary(state, params) {
  const { sheet, value } = context(state);
  const range = parseRange(params.range);
  const numbers = [];
  let filled = 0;
  eachCell(range, (col, row, key) => {
    if (sheet.cells[key] !== undefined) filled += 1;
    const result = value(col, row);
    if (typeof result === "number") numbers.push(result);
  });
  if (!numbers.length) throw new ToolError("O intervalo não tem números.");
  const sum = numbers.reduce((total, item) => total + item, 0);
  return {
    ok: true,
    count: 0,
    summary: `Soma ${decimal.format(sum)} · média ${decimal.format(sum / numbers.length)} em ${rangeText(range)}`,
    headline: { count: decimal.format(sum), text: "soma", aside: rangeText(range) },
    details: [`Média: ${decimal.format(sum / numbers.length)}`, `Mínimo: ${decimal.format(Math.min(...numbers))}`, `Máximo: ${decimal.format(Math.max(...numbers))}`, `Números: ${numbers.length}`, `Células preenchidas: ${filled}`],
  };
}

// ---------- formatar ----------
function filledKeys(sheet, range) {
  const keys = [];
  eachCell(range, (_col, _row, key) => {
    if (sheet.cells[key] !== undefined) keys.push(key);
  });
  if (!keys.length) throw new ToolError("O intervalo está vazio.");
  return keys;
}

function numberFormat(state, params) {
  const { book, sheet } = context(state);
  const keys = filledKeys(sheet, parseRange(params.range));
  const formats = { ...sheet.formats };
  keys.forEach((key) => {
    const { numFmt: _old, ...rest } = formats[key] || {};
    formats[key] = params.format === "general" ? rest : { ...rest, numFmt: params.format };
  });
  const label = NUMBER_FORMATS.find(([key]) => key === params.format)[1];
  return { ok: true, count: keys.length, summary: `Formato ${label} em ${keys.length} célula(s)`, book: withSheet(book, { ...sheet, formats }) };
}

function textStyle(state, params) {
  const { book, sheet } = context(state);
  const range = parseRange(params.range);
  const keys = filledKeys(sheet, params.target === "header" ? { ...range, r2: range.r1 } : range);
  const formats = { ...sheet.formats };
  keys.forEach((key) => {
    formats[key] = { ...formats[key], bold: Boolean(params.bold), italic: Boolean(params.italic) };
  });
  const look = [params.bold && "negrito", params.italic && "itálico"].filter(Boolean).join(" e ") || "texto normal";
  return { ok: true, count: keys.length, summary: `${look[0].toUpperCase()}${look.slice(1)} em ${keys.length} célula(s)${params.target === "header" ? " do cabeçalho" : ""}`, book: withSheet(book, { ...sheet, formats }) };
}

function clearFormats(state, params) {
  const { book, sheet } = context(state);
  const range = parseRange(params.range);
  const formats = { ...sheet.formats };
  let count = 0;
  eachCell(range, (_col, _row, key) => {
    if (!formats[key]) return;
    delete formats[key];
    count += 1;
  });
  if (!count) throw new ToolError("O intervalo não tem formatação.");
  return { ok: true, count, summary: `Formatação removida de ${count} célula(s)`, book: withSheet(book, { ...sheet, formats }) };
}

// ---------- preencher ----------
/** Desloca as referências relativas de uma fórmula em `rows` linhas (referências com $ na linha ficam). */
export function shiftFormula(raw, rows) {
  return raw
    .split(/("(?:[^"]|"")*"|'(?:[^']|'')*')/)
    .map((part, index) =>
      index % 2
        ? part
        : part.replace(/(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_.(])/g, (match, colAnchor, col, rowAnchor, row, offset, whole) => {
            if (offset && /[A-Za-z0-9_.$À-ſ]/.test(whole[offset - 1])) return match;
            return rowAnchor ? match : `${colAnchor}${col}${Number(row) + rows}`;
          }),
    )
    .join("");
}

function seriesValue(params, index) {
  const position = params.from + index * params.step;
  const cycle = (list) => list[(((position - 1) % list.length) + list.length) % list.length];
  if (params.kind === "month") return cycle(MONTHS);
  if (params.kind === "weekday") return cycle(WEEKDAYS);
  return `${params.kind === "text" ? params.prefix : ""}${plain(position)}`;
}

function fillSeries(state, params) {
  const { book, sheet } = context(state);
  const start = /^[A-Za-z]{1,3}\d+$/.test(String(params.start ?? "").trim()) ? parseCellKey(params.start.trim()) : null;
  if (!start || !start.row) throw new ToolError("Célula inicial inválida (ex.: A1).");
  if (params.kind === "text" && String(params.prefix).startsWith("=")) throw new ToolError("O prefixo não pode começar com “=”.");
  const down = params.direction === "down";
  const last = down ? start.row + params.count - 1 : start.col + params.count - 1;
  if (last > (down ? MAX_ROW : MAX_COLUMN)) throw new ToolError("A série passa do limite da planilha.");
  const writes = {};
  for (let index = 0; index < params.count; index += 1) writes[down ? keyOf(start.col, start.row + index) : keyOf(start.col + index, start.row)] = seriesValue(params, index);
  if (!params.overwrite) occupied(sheet, Object.keys(writes));
  const keys = Object.keys(writes);
  return {
    ok: true,
    count: keys.length,
    summary: `Série de ${keys.length} valor(es) em ${keys[0]}:${keys.at(-1)} (${writes[keys[0]]} … ${writes[keys.at(-1)]})`,
    book: withSheet(book, { ...sheet, cells: { ...sheet.cells, ...writes } }),
  };
}

function fillDown(state, params) {
  const { book, sheet } = context(state);
  const range = parseRange(params.range);
  if (range.r1 === range.r2) throw new ToolError("Escolha um intervalo com duas ou mais linhas (a primeira é copiada para as de baixo).");
  const sources = [];
  for (let col = range.c1; col <= range.c2; col += 1) sources.push(sheet.cells[keyOf(col, range.r1)]);
  if (sources.every((raw) => raw === undefined)) throw new ToolError("A primeira linha do intervalo está vazia.");
  const cells = { ...sheet.cells };
  const formats = { ...sheet.formats };
  for (let row = range.r1 + 1; row <= range.r2; row += 1) {
    sources.forEach((raw, index) => {
      const col = range.c1 + index;
      const key = keyOf(col, row);
      const format = sheet.formats[keyOf(col, range.r1)];
      if (raw === undefined) delete cells[key];
      else cells[key] = raw.startsWith("=") ? shiftFormula(raw, row - range.r1) : raw;
      if (format) formats[key] = format;
      else delete formats[key];
    });
  }
  const rows = range.r2 - range.r1;
  return { ok: true, count: rows, summary: `Linha ${range.r1} copiada para ${rows} linha(s) abaixo (fórmulas com referências ajustadas)`, book: withSheet(book, { ...sheet, cells, formats }) };
}

// ---------- cores, formatação condicional e gráficos ----------
const colorOf = (value) => (isHexColor(value) ? value.toLowerCase() : "");
const ruleNumber = (text) => {
  const number = Number(text.replace(",", "."));
  return text !== "" && Number.isFinite(number) ? number : null;
};

function cellColors(state, params) {
  const { book, sheet } = context(state);
  const range = parseRange(params.range);
  const fill = colorOf(params.fill);
  const color = colorOf(params.color);
  const formats = { ...sheet.formats };
  let count = 0;
  eachCell(range, (_col, _row, key) => {
    const before = formats[key] || {};
    const { fill: _fill, color: _color, ...rest } = before;
    const next = { ...rest, ...(fill && { fill }), ...(color && { color }) };
    if (before.fill === next.fill && before.color === next.color) return;
    count += 1;
    if (Object.keys(next).length) formats[key] = next;
    else delete formats[key];
  });
  if (!count) throw new ToolError(fill || color ? "O intervalo já está com essas cores." : "O intervalo não tem cores.");
  const parts = [fill && `fundo ${fill}`, color && `texto ${color}`].filter(Boolean).join(" e ");
  return { ok: true, count, summary: parts ? `Cores (${parts}) em ${count} célula(s)` : `Cores removidas de ${count} célula(s)`, book: withSheet(book, { ...sheet, formats }) };
}

function addRule(state, params) {
  const { book, sheet, valueOf } = context(state);
  const range = parseRange(params.range);
  const fill = colorOf(params.fill);
  const color = colorOf(params.color);
  if (!fill && !color) throw new ToolError("Escolha a cor de fundo, a cor do texto ou as duas.");
  const first = String(params.value ?? "").trim();
  const second = String(params.value2 ?? "").trim();
  const op = params.op;
  if ([">", "<", "between"].includes(op) && ruleNumber(first) === null) throw new ToolError("Para maior/menor/entre, digite um número no valor.");
  if (op === "between" && ruleNumber(second) === null) throw new ToolError("Para “entre”, digite também o segundo número.");
  if ((op === "top" || op === "bottom") && !(Number.isInteger(ruleNumber(first)) && ruleNumber(first) >= 1)) throw new ToolError("Para N maiores/menores, digite quantos valores pintar (1, 2, 3…).");
  if ((op === "=" || op === "contains") && !first) throw new ToolError("Digite o valor a comparar.");
  if (sheet.rules.length >= MAX_CONDITIONAL_RULES) throw new ToolError(`A planilha já tem ${MAX_CONDITIONAL_RULES} regras: limpe alguma antes.`);
  const rule = { range: rangeText(range), op, value: first, value2: op === "between" ? second : "", fill, color };
  const painted = Object.keys(conditionalFormats({ ...sheet, rules: [rule] }, valueOf)).length;
  return {
    ok: true,
    count: painted,
    summary: `Regra criada: ${describeRule(rule)} (${painted} célula(s) pintada(s) agora; a cor acompanha os valores)`,
    book: withSheet(book, { ...sheet, rules: [...sheet.rules, rule] }),
  };
}

function chosenIds(list, ids, emptyMessage, pickMessage) {
  if (!list.length) throw new ToolError(emptyMessage);
  const wanted = new Set((ids || []).map(String));
  const picked = new Set(list.filter((id) => wanted.has(id)));
  if (!picked.size) throw new ToolError(pickMessage);
  return picked;
}

function clearRules(state, params) {
  const { book, sheet } = context(state);
  const picked = chosenIds(sheet.rules.map((_, index) => String(index)), params.rules, "A planilha ativa não tem regras de formatação condicional.", "Escolha uma ou mais regras.");
  return {
    ok: true,
    count: picked.size,
    summary: `${picked.size} regra(s) de formatação condicional removida(s)`,
    book: withSheet(book, { ...sheet, rules: sheet.rules.filter((_, index) => !picked.has(String(index))) }),
  };
}

function addChart(state, params, env) {
  const { book, sheet, valueOf } = context(state);
  const range = parseRange(params.range);
  if (range.c1 === range.c2) throw new ToolError("O gráfico precisa de duas colunas ou mais: rótulos na primeira e valores nas seguintes.");
  if (range.c2 - range.c1 > CHART_COLORS.length) throw new ToolError(`No máximo ${CHART_COLORS.length} colunas de valores por gráfico.`);
  const start = dataStart(range, params.header);
  if (range.r2 - start + 1 > MAX_CHART_POINTS) throw new ToolError(`No máximo ${MAX_CHART_POINTS} linhas de dados por gráfico.`);
  if (sheet.charts.length >= MAX_SHEET_CHARTS) throw new ToolError(`A planilha já tem ${MAX_SHEET_CHARTS} gráficos: remova algum antes.`);
  const chart = { id: `chart-${env.newId()}`, range: rangeText(range), type: params.type, title: String(params.title ?? "").trim().slice(0, 80), header: Boolean(params.header) };
  const data = chartData(chart, valueOf);
  if (!chartGeometry(data, chart.type)) throw new ToolError("As colunas de valores não têm números.");
  const kind = CHART_TYPES.find(([key]) => key === chart.type)[1].toLowerCase();
  return {
    ok: true,
    count: 1,
    summary: `Gráfico de ${kind} de ${chart.range} criado com ${data.labels.length} categoria(s) e ${data.series.length} série(s)`,
    details: data.series.map((item) => item.name),
    book: withSheet(book, { ...sheet, charts: [...sheet.charts, chart] }),
  };
}

function removeCharts(state, params) {
  const { book, sheet } = context(state);
  const picked = chosenIds(sheet.charts.map((chart) => chart.id), params.charts, "A planilha ativa não tem gráficos.", "Escolha um ou mais gráficos.");
  return { ok: true, count: picked.size, summary: `${picked.size} gráfico(s) removido(s)`, book: withSheet(book, { ...sheet, charts: sheet.charts.filter((chart) => !picked.has(chart.id)) }) };
}

// ---------- catálogo ----------
export function excelCatalogue(state = { book: null, selected: "A1" }) {
  const { sheet } = context(state);
  const used = usedRange(sheet);
  const usedEnd = parseRange(used).c2;
  const letters = Array.from({ length: Math.max(usedEnd, 5) + 1 }, (_, index) => indexToColumn(index));
  const range = { key: "range", label: "Intervalo", type: "text", default: used, rows: 1, help: "Ex.: A1:C10. Começa com a área preenchida da planilha ativa." };
  const header = { key: "header", label: "A primeira linha é cabeçalho", type: "toggle", default: true };
  const column = { key: "column", label: "Coluna", type: "select", default: indexToColumn(parseRange(used).c1), options: letters.map((letter) => [letter, letter]) };
  const tools = [
    { id: "dados.ordenar", tab: "dados", label: "Ordenar", icon: ArrowDownUp, description: "Ordena as linhas do intervalo por uma coluna.", how: "Números vêm antes de textos e células vazias vão para o fim. As linhas inteiras se movem juntas, com a formatação.", params: [range, column, { key: "order", label: "Ordem", type: "chips", default: "asc", options: [["asc", "Crescente (A→Z)"], ["desc", "Decrescente (Z→A)"]] }, header], run: sortRange },
    {
      id: "dados.filtrar",
      tab: "dados",
      label: "Filtrar",
      icon: Filter,
      description: "Copia para uma planilha nova só as linhas que atendem à condição.",
      how: "A planilha original não muda. A nova recebe o cabeçalho e os valores calculados das linhas filtradas.",
      params: [range, column, { key: "operator", label: "Condição", type: "select", default: "eq", options: OPERATORS }, { key: "value", label: "Valor", type: "text", default: "", rows: 1 }, header],
      run: filterToSheet,
    },
    { id: "dados.duplicadas", tab: "dados", label: "Remover duplicadas", icon: CopyMinus, description: "Remove linhas repetidas (todas as colunas iguais) e sobe as restantes.", how: "Compara textos sem diferenciar maiúsculas e espaços nas pontas; mantém a primeira ocorrência.", params: [range, header], run: removeDuplicates },
    { id: "dados.espacos", tab: "dados", label: "Limpar espaços", icon: Eraser, description: "Tira espaços duplos e espaços nas pontas dos textos do intervalo.", params: [range], run: trimSpaces },
    { id: "formulas.totais", tab: "formulas", label: "Totais da coluna", icon: Sigma, description: "Cria uma linha de totais abaixo do intervalo com fórmulas de verdade.", how: "Cada coluna com números ganha =SOMA (ou a função escolhida) logo abaixo; a primeira coluna recebe o rótulo.", params: [range, { key: "fn", label: "Função", type: "chips", default: "SUM", options: FUNCTIONS.map(([key, name]) => [key, name]) }, header], run: columnTotals },
    { id: "formulas.linhas", tab: "formulas", label: "Total por linha", icon: TableColumnsSplit, description: "Cria uma coluna à direita com a soma de cada linha.", params: [range, header], run: rowTotals },
    { id: "formulas.valores", tab: "formulas", label: "Fórmulas em valores", icon: SquareFunction, description: "Troca as fórmulas do intervalo pelo valor que elas mostram.", how: "Fórmulas com erro (#REF!, #DIV/0!…) são mantidas.", params: [range], run: formulasToValues },
    { id: "formulas.resumo", tab: "formulas", label: "Resumo do intervalo", icon: Calculator, description: "Mostra soma, média, mínimo e máximo dos números do intervalo.", analyze: false, applyLabel: "Calcular", params: [range], run: rangeSummary },
    { id: "formatar.numero", tab: "formatar", label: "Formato de número", icon: Hash, description: "Mostra os números como moeda, porcentagem, 2 casas ou geral.", params: [range, { key: "format", label: "Formato", type: "select", default: "currency", options: NUMBER_FORMATS }], run: numberFormat },
    {
      id: "formatar.estilo",
      tab: "formatar",
      label: "Negrito e itálico",
      icon: Bold,
      description: "Define negrito/itálico no cabeçalho ou no intervalo inteiro.",
      params: [range, { key: "target", label: "Aplicar em", type: "chips", default: "header", options: [["header", "Cabeçalho"], ["all", "Intervalo inteiro"]] }, { key: "bold", label: "Negrito", type: "toggle", default: true }, { key: "italic", label: "Itálico", type: "toggle", default: false }],
      run: textStyle,
    },
    { id: "formatar.limpar", tab: "formatar", label: "Limpar formatos", icon: Paintbrush, description: "Remove negrito, itálico, cores e formatos de número do intervalo.", params: [range], run: clearFormats },
    {
      id: "formatar.cores",
      tab: "formatar",
      label: "Cores das células",
      icon: Palette,
      description: "Pinta o fundo e/ou o texto das células do intervalo.",
      how: "Deixe uma cor vazia (“usar a do template”) para tirar aquela cor. As duas vazias removem as cores do intervalo.",
      params: [range, { key: "fill", label: "Cor de fundo", type: "color", default: "#fff2cc" }, { key: "color", label: "Cor do texto", type: "color", default: "" }],
      run: cellColors,
    },
    {
      id: "formatar.condicional",
      tab: "formatar",
      label: "Formatação condicional",
      icon: PaintBucket,
      description: "Pinta células conforme o valor (maior que, entre, igual, contém, N maiores…).",
      how: "A regra fica guardada na planilha e é reavaliada a cada mudança: se o valor mudar, a cor muda junto. Vale sobre o valor calculado (fórmulas incluídas); a regra mais nova vale por cima das cores manuais e das regras anteriores.",
      params: [
        range,
        { key: "op", label: "Condição", type: "select", default: ">", options: CONDITIONAL_OPS },
        { key: "value", label: "Valor", type: "text", default: "", rows: 1, help: "Número ou texto; em N maiores/menores, a quantidade." },
        { key: "value2", label: "E (segundo número)", type: "text", default: "", rows: 1, when: { key: "op", equals: "between" } },
        { key: "fill", label: "Cor de fundo", type: "color", default: "#c6efce" },
        { key: "color", label: "Cor do texto", type: "color", default: "#006100" },
      ],
      run: addRule,
    },
    {
      id: "formatar.condicional_limpar",
      tab: "formatar",
      label: "Limpar regras",
      icon: CircleSlash,
      description: "Remove regras de formatação condicional da planilha ativa.",
      params: [{ key: "rules", label: "Regras", type: "multi", default: sheet.rules.map((_, index) => String(index)), options: sheet.rules.map((rule, index) => [String(index), describeRule(rule)]), empty: "A planilha ativa não tem regras." }],
      run: clearRules,
    },
    {
      id: "preencher.serie",
      tab: "preencher",
      label: "Preencher série",
      icon: ListOrdered,
      description: "Preenche números, meses, dias da semana ou “Item 1, Item 2…”.",
      params: [
        { key: "start", label: "Começar na célula", type: "text", default: state.selected || "A1", rows: 1 },
        { key: "direction", label: "Direção", type: "chips", default: "down", options: [["down", "Para baixo"], ["right", "Para a direita"]] },
        { key: "kind", label: "Tipo", type: "chips", default: "number", options: [["number", "Números"], ["month", "Meses"], ["weekday", "Dias da semana"], ["text", "Texto + número"]] },
        { key: "prefix", label: "Texto antes do número", type: "text", default: "Item ", rows: 1, when: { key: "kind", equals: "text" } },
        { key: "count", label: "Quantidade", type: "stepper", min: 2, max: 500, step: 1, default: 10 },
        { key: "from", label: "Primeiro valor", type: "stepper", min: -100000, max: 100000, step: 1, default: 1, help: "Para meses e dias: 1 = janeiro / segunda." },
        { key: "step", label: "Incremento", type: "stepper", min: -1000, max: 1000, step: 1, default: 1 },
        { key: "overwrite", label: "Substituir dados existentes", type: "toggle", default: false },
      ],
      run: fillSeries,
    },
    { id: "preencher.baixo", tab: "preencher", label: "Preencher para baixo", icon: ArrowDownToLine, description: "Copia a primeira linha do intervalo para as linhas de baixo.", how: "Fórmulas são copiadas com as referências ajustadas (A1 vira A2, A3…); referências com $ na linha ficam fixas.", confirm: "Substituir o conteúdo das linhas abaixo da primeira?", params: [range], run: fillDown },
    {
      id: "dados.grafico",
      tab: "dados",
      label: "Gráfico",
      icon: ChartColumn,
      description: "Cria um gráfico de barras ou de linhas a partir do intervalo.",
      how: "Rótulos na primeira coluna e uma série por coluna seguinte (até 6). O gráfico aparece abaixo da grade e acompanha as mudanças das células.",
      params: [range, { key: "type", label: "Tipo", type: "chips", default: "bar", options: CHART_TYPES }, { key: "title", label: "Título", type: "text", default: "", rows: 1 }, header],
      run: addChart,
    },
    {
      id: "dados.grafico_remover",
      tab: "dados",
      label: "Remover gráfico",
      icon: Trash2,
      description: "Remove gráficos da planilha ativa (os dados ficam).",
      params: [{ key: "charts", label: "Gráficos", type: "multi", default: sheet.charts.map((chart) => chart.id), options: sheet.charts.map((chart) => [chart.id, chart.title || `Gráfico de ${chart.range}`]), empty: "A planilha ativa não tem gráficos." }],
      run: removeCharts,
    },
  ];
  return { tabs: EXCEL_TABS, tools };
}


const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));
const randomId = () => `sheet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runExcelTool(toolId, state, params, env = { newId: randomId }) {
  const tool = excelCatalogue(state).tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run(state, { ...defaultsOf(tool), ...(params || {}) }, env, tool);
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
