// Varredura de TODAS as ferramentas MCP de MMSom, Word, Excel, PowerPoint, PDF, 3D e Bibliotecas.
// Cada ferramenta roda com estado vazio/mínimo e com estado realista, nos parâmetros padrão e em cada opção
// de select/chips/toggle (e listas múltiplas vazias/completas). Regras verificadas em cada execução:
// - não lança exceção e não altera o estado recebido (entrada congelada);
// - devolve { ok: boolean, summary: texto não vazio };
// - ok:false não traz campos de estado; ferramenta "em breve" nunca executa;
// - ok:true que devolve campos de estado precisa de fato mudar algum deles (sem sucesso falso).
import { describe, expect, it } from "vitest";
import { normalizeWorkbook, sanitizeDocumentHtml } from "../../pages/OfficeCraft";
import { excelCatalogue, runExcelTool } from "./excelMcpTools";
import { mm3dCatalogue, runMM3DTool } from "./mm3dMcpTools";
import { ALL_ASSETS, FOLDERS_SECTION, mmlibsCatalogue, runMMLibsTool } from "./mmlibsMcpTools";
import { mmpdfCatalogue, runMMPdfTool } from "./mmpdfMcpTools";
import { mmsomCatalogue, runMMSomTool } from "./mmsomMcpTools";
import { powerpointCatalogue, runPowerPointTool } from "./powerpointMcpTools";
import { runWordTool, wordCatalogue } from "./wordMcpTools";
import { canonicalData, refuseIfUnchanged } from "./mcpResultGuard";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** Comparação independente do catálogo: chaves em ordem, campos undefined/funções ignorados. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined && typeof value[key] !== "function")
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const counter = () => {
  let next = 0;
  return () => `id${(next += 1)}`;
};

/** Variações de parâmetros: padrão + cada opção de select/chips, toggle invertido e multi vazio/completo. */
function variations(tool) {
  const base = Object.fromEntries(tool.params.map((param) => [param.key, param.default]));
  const list = [{ label: "padrão", params: base }];
  for (const param of tool.params) {
    if (param.type === "select" || param.type === "chips")
      param.options.filter(([value]) => value !== param.default).forEach(([value]) => list.push({ label: `${param.key}=${value}`, params: { ...base, [param.key]: value } }));
    if (param.type === "toggle") list.push({ label: `${param.key}=${!param.default}`, params: { ...base, [param.key]: !param.default } });
    if (param.type === "multi") {
      list.push({ label: `${param.key}=[]`, params: { ...base, [param.key]: [] } });
      list.push({ label: `${param.key}=todos`, params: { ...base, [param.key]: param.options.map(([value]) => value) } });
    }
  }
  return list;
}

/**
 * Percorre o catálogo em cada estado. `make(stateName)` cria um estado novo (com newId próprio) a cada execução.
 * Devolve { exercised, runs, failures, okCount }.
 */
function sweep({ states, catalogue, run, keys, normalize = (_key, value) => stable(value), samples = {} }) {
  const failures = [];
  const exercised = new Set();
  let runs = 0;
  let okCount = 0;
  for (const [stateName, make] of Object.entries(states)) {
    const tools = catalogue(make()).tools;
    for (const tool of tools) {
      exercised.add(tool.id);
      const extra = (samples[tool.id] || []).map((params, index) => ({ label: `amostra ${index + 1}`, params: { ...Object.fromEntries(tool.params.map((param) => [param.key, param.default])), ...params } }));
      for (const variant of [...variations(tool), ...extra]) {
        const where = `${tool.id} [${stateName} · ${variant.label}]`;
        const state = deepFreeze(make());
        const before = JSON.stringify(state);
        let result;
        runs += 1;
        try {
          result = run(tool.id, state, variant.params);
        } catch (error) {
          failures.push(`${where}: lançou ${error.name}: ${error.message}`);
          continue;
        }
        if (JSON.stringify(state) !== before) failures.push(`${where}: alterou o estado recebido`);
        if (!result || typeof result.ok !== "boolean") {
          failures.push(`${where}: resultado sem ok booleano`);
          continue;
        }
        if (typeof result.summary !== "string" || !result.summary.trim()) failures.push(`${where}: summary vazio`);
        const returned = keys.filter((key) => key in result);
        if (tool.status === "soon" && result.ok) failures.push(`${where}: ferramenta "em breve" executou`);
        if (!result.ok) {
          if (returned.length) failures.push(`${where}: ok:false devolveu estado (${returned.join(", ")})`);
          continue;
        }
        okCount += 1;
        if (returned.length && returned.every((key) => normalize(key, result[key]) === normalize(key, state[key]))) failures.push(`${where}: sucesso falso, nada mudou (${result.summary})`);
      }
    }
  }
  return { exercised, runs, failures, okCount };
}

function expectSweep(result, total, minimumOk) {
  expect(result.failures).toEqual([]);
  expect(result.exercised.size).toBe(total);
  expect(result.okCount).toBeGreaterThanOrEqual(minimumOk);
}

// ---------------------------------------------------------------- MMSom
const track = (id, name, extra = {}) => ({ id, name, volume: 100, pan: 0, mute: false, solo: false, ...extra });
const SOM = {
  vazio: () => ({ tracks: [] }),
  "sem áudio": () => ({ tracks: [track(1, "Voz 1"), track(2, "Música")] }),
  realista: () => ({
    tracks: [
      track(1, "Locução", { src: "blob:voz", duration: 12, start: 2, peaks: [0.2, 0.8], volume: 90 }),
      track(2, "Trilha musical", { src: "blob:musica", duration: 30, start: 0, peaks: [0.5], pan: -20, eq: "grave", compressor: true }),
      track(3, "Efeitos", { src: "blob:fx", duration: 4, start: 15, peaks: [0.3], mute: true }),
      track(4, "Narração extra", { solo: true }),
    ],
  }),
  // Tudo já no estado que as ferramentas padrão produziriam (volume -3 dB = 85, EQ Voz, compressor, mute, solo, início 0, em sequência).
  "já aplicado": () => ({
    tracks: [
      track(1, "Voz", { src: "blob:voz", duration: 5, start: 0, peaks: [0.5], volume: 85, eq: "voz", compressor: true, solo: true }),
      track(2, "Música", { src: "blob:m", duration: 10, start: 5.5, peaks: [0.5], volume: 85, eq: "voz", compressor: true, mute: true }),
    ],
  }),
};

describe("varredura MCP — MMSom", () => {
  it("todas as ferramentas, sem exceção nem sucesso falso", () => {
    const result = sweep({ states: SOM, catalogue: mmsomCatalogue, run: runMMSomTool, keys: ["tracks"] });
    expectSweep(result, mmsomCatalogue().tools.length, 20);
  });

  it("sem áudio decodificado, Equilibrar recusa com motivo claro", () => {
    expect(runMMSomTool("mix.balance", SOM["sem áudio"]())).toEqual({ ok: false, summary: expect.stringMatching(/áudio carregado/) });
    expect(runMMSomTool("clips.sequence", SOM["sem áudio"](), { tracks: ["1", "2"] })).toEqual({ ok: false, summary: expect.stringMatching(/áudio carregado/) });
  });
});

// ---------------------------------------------------------------- Word
/** Mesma leitura do catálogo: saneia e embrulha textos soltos em parágrafo. */
function wordNormalize(_key, html) {
  const body = new DOMParser().parseFromString(`<!doctype html><body>${sanitizeDocumentHtml(html)}`, "text/html").body;
  return body.innerHTML.replace(/\s+/g, " ");
}
const WORD = {
  vazio: () => ({ html: "" }),
  realista: () => ({
    html: [
      "<h1>Relatório anual</h1>",
      "<p>Introdução</p>",
      '<p style="font-family: Arial">O ano de de 2026 trouxe   resultados.  </p>',
      "<p>- Norte</p>",
      "<p>- Sul</p>",
      "<p>1. Primeiro passo</p>",
      "<h2>Resultados</h2>",
      "<ul><li>Receita</li><li>Custos</li></ul>",
      "<blockquote>Uma frase marcante.</blockquote>",
      "<p><br></p>",
      "<h3>detalhes finais</h3>",
    ].join(""),
  }),
  "já formatado": () => ({ html: '<h1 style="font-family: Aptos, Calibri, sans-serif; text-align: justify">Título</h1><p style="font-family: Aptos, Calibri, sans-serif; text-align: justify">Texto corrido, já limpo.</p>' }),
};

describe("varredura MCP — Word", () => {
  it("todas as ferramentas, sem exceção nem sucesso falso", () => {
    const result = sweep({
      states: WORD,
      catalogue: wordCatalogue,
      run: runWordTool,
      keys: ["html"],
      normalize: wordNormalize,
      samples: {
        "texto.substituir": [{ find: "Norte", replace: "Nordeste" }, { find: "de", replace: "" }],
        "texto.inserir": [{ text: "Linha nova\nOutra linha" }],
        "estilos.aplicar": [{ paragraphs: ["0", "1", "2"] }],
        "estrutura.lista": [{ paragraphs: ["1", "2"] }],
        "texto.caixa": [{ paragraphs: ["0", "1", "2"], mode: "upper" }],
      },
    });
    expectSweep(result, wordCatalogue().tools.length, 25);
  });
});

// ---------------------------------------------------------------- Excel
const sheet = (id, name, cells, extra = {}) => ({ id, name, cells, formats: {}, rules: [], charts: [], ...extra });
const EXCEL = {
  vazio: () => ({ book: null, selected: "A1" }),
  realista: () => ({
    selected: "E2",
    book: {
      active: "s1",
      sheets: [
        sheet(
          "s1",
          "Vendas",
          {
            A1: "Cidade", B1: "Jan", C1: "Fev", D1: "Total",
            A2: "Rio", B2: "30", C2: "12", D2: "=B2+C2",
            A3: " São  Paulo ", B3: "10", C3: "40", D3: "=B3+C3",
            A4: "Rio", B4: "30", C4: "12", D4: "=B4+C4",
            A5: "Belém", B5: "5", C5: "=1/0",
          },
          { formats: { A1: { bold: true }, B2: { numFmt: "currency", fill: "#fff2cc" } }, rules: [{ range: "B2:B5", op: ">", value: "20", value2: "", fill: "#c6efce", color: "#006100" }], charts: [{ id: "chart-1", range: "A1:C5", type: "bar", title: "Vendas", header: true }] },
        ),
        sheet("s2", "Resumo", { A1: "x" }),
      ],
    },
  }),
  "já formatado": () => ({
    selected: "A1",
    book: { active: "s1", sheets: [sheet("s1", "Pronta", { A1: "Nome", B1: "Valor", A2: "Ana", B2: "1", A3: "Ana", B3: "1" }, { formats: { A1: { bold: true, italic: false, numFmt: "currency", fill: "#fff2cc" }, B1: { bold: true, italic: false, numFmt: "currency", fill: "#fff2cc" }, A2: { numFmt: "currency", fill: "#fff2cc" }, B2: { numFmt: "currency", fill: "#fff2cc" }, A3: { numFmt: "currency", fill: "#fff2cc" }, B3: { numFmt: "currency", fill: "#fff2cc" } } })] },
  }),
  "planilha larga": () => ({ selected: "A1", book: { active: "s1", sheets: [sheet("s1", "Grande", { A1: "1", Z5000: "2" })] } }),
};

describe("varredura MCP — Excel", () => {
  it("todas as ferramentas, sem exceção nem sucesso falso", () => {
    const result = sweep({
      states: EXCEL,
      catalogue: excelCatalogue,
      run: (id, state, params) => runExcelTool(id, state, params, { newId: counter() }),
      keys: ["book"],
      normalize: (_key, book) => stable(normalizeWorkbook(book)),
      samples: {
        "dados.ordenar": [{ range: "A1:C5", column: "B" }],
        "dados.filtrar": [{ range: "A1:C5", column: "A", value: "Rio" }, { range: "A1:C5", column: "B", operator: "gt", value: "abc" }],
        "dados.duplicadas": [{ range: "A1:C5" }],
        "formulas.totais": [{ range: "A1:C5" }],
        "formulas.linhas": [{ range: "A1:C5" }, { range: "B2:C4" }],
        "formatar.condicional": [{ value: "10" }, { op: "between", value: "1", value2: "20" }],
        "preencher.serie": [{ start: "H1", kind: "text" }, { start: "H1", kind: "text", prefix: "=X" }],
        "preencher.baixo": [{ range: "D2:D5" }],
      },
    });
    expectSweep(result, excelCatalogue().tools.length, 25);
  });
});

// ---------------------------------------------------------------- PowerPoint
const slide = (id, title, body = "", layout = "title", extra = {}) => ({ id, title, body, layout, titleStyle: { bold: false, italic: false }, bodyStyle: { bold: false, italic: false }, ...extra });
const PPT = {
  vazio: () => ({ slides: [], index: 0 }),
  "um slide": () => ({ slides: [slide("s1", "")], index: 0 }),
  realista: () => ({
    index: 1,
    slides: [
      slide("s1", "Plano 2026", "Equipe MediaMind"),
      slide("s2", "vendas do ano", "- Norte\n• Sul\n\n1. Leste", "title-content", { notes: "Falar devagar" }),
      slide("s3", "Próximos passos", "Contratar\nLançar", "title-content", { theme: { background: "#111111", color: "#ffffff" }, align: "center" }),
      slide("s4", "Obrigado", "", "title-only", { titleStyle: { bold: true, italic: false } }),
    ],
  }),
  "já aplicado": () => ({
    index: 0,
    slides: [
      slide("s1", "Capa Da Apresentação", "• Tópico", "title-content", { titleStyle: { bold: true, italic: false }, theme: { background: "#1f2937", color: "#f9fafb" }, align: "left", notes: "x" }),
      slide("s2", "Agenda", "", "title-content", { titleStyle: { bold: true, italic: false }, theme: { background: "#1f2937", color: "#f9fafb" } }),
    ],
  }),
};

describe("varredura MCP — PowerPoint", () => {
  it("todas as ferramentas, sem exceção nem sucesso falso", () => {
    const result = sweep({
      states: PPT,
      catalogue: powerpointCatalogue,
      run: (id, state, params) => runPowerPointTool(id, state, params, { newId: counter() }),
      keys: ["slides", "index"],
      samples: {
        "texto.substituir": [{ find: "norte", replace: "Nordeste" }],
        "design.notas": [{ text: "Nova anotação" }, { action: "append", text: "mais" }],
        "slides.excluir": [{ slides: ["0"] }],
        "design.tema": [{ preset: "custom", background: "#000000", color: "#000000" }],
      },
    });
    expectSweep(result, powerpointCatalogue().tools.length, 25);
  });
});

// ---------------------------------------------------------------- PDF
const PDF = {
  vazio: () => ({}),
  "pdf sem anotações": () => ({ docKey: "doc", docName: "Contrato.pdf", page: 1, annotations: {}, newId: counter() }),
  realista: () => ({
    docKey: "doc",
    docName: "Relatório.pdf",
    page: 2,
    newId: counter(),
    annotations: {
      doc: [
        { id: "a1", type: "text", text: "Olá", page: 2, x: 10, y: 10 },
        { id: "a2", type: "watermark", text: "RASCUNHO", page: 0 },
        { id: "a3", type: "note", text: "Rever", page: 1, x: 70, y: 10 },
      ],
      outro: [{ id: "b1", type: "text", text: "Outro", page: 1 }],
    },
  }),
};

describe("varredura MCP — PDF", () => {
  it("todas as ferramentas, sem exceção nem sucesso falso", () => {
    const result = sweep({
      states: PDF,
      catalogue: mmpdfCatalogue,
      run: runMMPdfTool,
      keys: ["annotations"],
      samples: {
        "edit.text": [{ text: "Aprovado" }, { text: "Todas", where: "all" }],
        "edit.link": [{ url: "https://mediamind.ai", text: "Site" }, { url: "javascript:alert(1)" }],
        "edit.headerfooter": [{ text: "Relatório 2026" }],
        "comment.note": [{ text: "Conferir valores" }],
        "comment.mark": [{ x: 95, w: 80 }, { x: 99.6 }],
        "sign.signature": [{ name: "Alex Maciel" }, { name: "  alex   maciel ferreira ", kind: "initials" }],
      },
    });
    expectSweep(result, mmpdfCatalogue().tools.length, 20);
  });
});

// ---------------------------------------------------------------- 3D
const obj = (id, type, extra = {}) => ({ id, name: id, type, x: 40, y: 30, z: 5, rotate: 10, scale: 120, color: "#111111", visible: true, ...extra });
const world = () => ({ exposure: 1, grid: true, aspect: "16:9", background: "#111526" });
const THREE = {
  vazio: () => ({ objects: [], selectedId: null, keyframes: {}, world: world(), time: 0, newId: counter() }),
  realista: () => ({
    objects: [obj("cam", "camera"), obj("cubo", "cube"), obj("bola", "sphere", { visible: false }), obj("chao", "plane"), obj("luz", "light")],
    selectedId: "cubo",
    keyframes: { cubo: { rotate: [{ time: 0, value: 0 }, { time: 4, value: 90 }], x: [{ time: 2, value: 40 }] } },
    world: world(),
    time: 2,
    newId: counter(),
  }),
  "já aplicado": () => ({
    objects: [obj("cubo", "cube", { x: 50, y: 50, z: 0, rotate: 0, scale: 100, color: "#38bdf8" }), obj("bola", "sphere", { x: 57.5, y: 50, color: "#22d3ee", visible: false })],
    selectedId: "cubo",
    keyframes: { cubo: { rotate: [{ time: 0, value: 0 }, { time: 10, value: 360 }] } },
    world: { exposure: 1, grid: true, aspect: "16:9", background: "#111526" },
    time: 0,
    newId: counter(),
  }),
  "câmera selecionada": () => ({ objects: [obj("cam", "camera"), obj("cubo", "cube")], selectedId: "cam", keyframes: {}, world: world(), time: 0, newId: counter() }),
};

describe("varredura MCP — 3D", () => {
  it("todas as ferramentas, sem exceção nem sucesso falso", () => {
    const result = sweep({
      states: THREE,
      catalogue: mm3dCatalogue,
      run: runMM3DTool,
      keys: ["objects", "selectedId", "keyframes", "world"],
      samples: { "material.color": [{ color: "#111111" }, { color: "vermelho" }], "transform.rotate": [{ angle: 0 }] },
    });
    expectSweep(result, mm3dCatalogue().tools.length, 25);
  });
});

// ---------------------------------------------------------------- Bibliotecas
const asset = (id, name, type) => ({ id, name, type, url: `blob:${id}` });
const libsBase = () => ({ category: "Todos", section: ALL_ASSETS, view: "grade", query: "", favorites: [], folders: [], openFolder: "", folderAssets: {}, assetTags: {}, trashed: [], newId: counter() });
const LIBS = {
  vazio: () => ({ ...libsBase(), assets: [] }),
  realista: () => ({
    ...libsBase(),
    assets: [asset("a1", "Logo.png", "image/png"), asset("a2", "Entrevista.mp4", "video/mp4"), asset("a3", "Trilha.mp3", "audio/mpeg"), asset("a4", "Roteiro.pdf", "application/pdf"), asset("a5", "logo.png", "image/png")],
    favorites: ["a1"],
    folders: [
      { id: "f2", name: "Projetos" },
      { id: "f1", name: "Identidade" },
    ],
    folderAssets: { f1: ["a1"] },
    assetTags: { a2: ["cliente"] },
    trashed: ["a4"],
  }),
  "já filtrado": () => ({ ...LIBS.realista(), category: "Imagens", query: "logo", view: "lista", folders: [{ id: "f1", name: "Identidade" }] }),
  "pasta aberta com filtro": () => ({ ...LIBS.realista(), category: "Imagens", section: FOLDERS_SECTION, openFolder: "f1", query: "logo", view: "lista" }),
};

describe("varredura MCP — Bibliotecas", () => {
  it("todas as ferramentas, sem exceção nem sucesso falso", () => {
    const result = sweep({
      states: LIBS,
      catalogue: mmlibsCatalogue,
      run: runMMLibsTool,
      keys: ["category", "section", "view", "query", "favorites", "folders", "openFolder", "folderAssets", "assetTags", "trashed"],
      samples: {
        "filter.search": [{ query: "logo" }, { query: "cliente" }],
        "folder.rename": [{ name: "Marca" }, { name: "projetos" }],
        "folder.create": [{ name: "Identidade" }],
        "assets.tags": [{ tag: "aprovado" }, { tag: "cliente", action: "remove" }, { tag: "x".repeat(31) }],
        "assets.move": [{ selectedItems: ["zz"] }],
      },
    });
    expectSweep(result, mmlibsCatalogue().tools.length, 25);
  });
});

// ---------------------------------------------------------------- regressões encontradas pela varredura
describe("regressões da varredura", () => {
  it("Excel: planilha larga (A1 e Z5000) não derruba o catálogo; a ferramenta recusa o intervalo grande", () => {
    const state = EXCEL["planilha larga"]();
    const catalogue = excelCatalogue(state);
    expect(catalogue.tools.find((tool) => tool.id === "dados.ordenar").params[0].default).toBe("A1:Z5000");
    expect(runExcelTool("dados.espacos", state)).toEqual({ ok: false, summary: "Intervalo grande demais (máximo de 50.000 células)." });
  });

  it("Excel: linhas em branco não contam como duplicadas", () => {
    expect(runExcelTool("dados.duplicadas", EXCEL.vazio(), { range: "A1:C5" })).toEqual({ ok: false, summary: "Nenhuma linha duplicada no intervalo." });
    const state = { book: { active: "s1", sheets: [sheet("s1", "P", { A1: "Nome", A2: "Ana", A4: "Ana", A6: "Bia" })] } };
    const result = runExcelTool("dados.duplicadas", state, { range: "A1:A6" });
    expect(result).toMatchObject({ ok: true, count: 1 });
    const cells = result.book.sheets[0].cells;
    expect([2, 3, 4, 5, 6].map((row) => cells[`A${row}`])).toEqual(["Ana", undefined, undefined, "Bia", undefined]);
  });

  it("nenhum catálogo anuncia sucesso quando nada muda", () => {
    const refused = (result) => expect(result).toEqual({ ok: false, summary: expect.stringMatching(/^Nada a aplicar/) });
    refused(runMMSomTool("mix.mute", SOM["sem áudio"](), { tracks: ["2"], mode: "off" }));
    refused(runMMSomTool("inserts.eq", SOM["sem áudio"](), { tracks: ["1"], preset: "off" }));
    refused(runMMSomTool("mix.volume", SOM["já aplicado"]()));
    refused(runWordTool("estilos.fonte", WORD["já formatado"]()));
    refused(runExcelTool("formatar.estilo", EXCEL["já formatado"](), { range: "A1:B3" }));
    refused(runMM3DTool("world.lighting", THREE.realista()));
    refused(runMM3DTool("transform.center", THREE["já aplicado"]()));
    refused(runMM3DTool("material.color", THREE.realista(), { color: "#111111" }));
    refused(runMMLibsTool("filter.category", LIBS.realista(), { category: "Todos" }));
    refused(runMMLibsTool("filter.search", LIBS["já filtrado"](), { query: "logo" }));
    // Mudanças reais continuam passando.
    expect(runMMSomTool("mix.mute", SOM["sem áudio"](), { tracks: ["2"], mode: "on" })).toMatchObject({ ok: true });
    expect(runMM3DTool("world.lighting", THREE.realista(), { preset: "night" })).toMatchObject({ ok: true, world: { exposure: 0.6 } });
  });

  it("mcpResultGuard compara sem depender da ordem das chaves e deixa passar análises e recusas", () => {
    expect(canonicalData({ b: 1, a: { d: undefined, c: 2 } })).toBe(canonicalData({ a: { c: 2 }, b: 1 }));
    const state = { tracks: [{ id: 1, eq: "voz" }] };
    expect(refuseIfUnchanged({ ok: true, summary: "x", tracks: [{ eq: "voz", id: 1 }] }, state, ["tracks"], "Nada")).toEqual({ ok: false, summary: "Nada" });
    const analysis = { ok: true, summary: "12 palavras", count: 0 };
    expect(refuseIfUnchanged(analysis, state, ["tracks"], "Nada")).toBe(analysis);
    const refusal = { ok: false, summary: "Escolha" };
    expect(refuseIfUnchanged(refusal, state, ["tracks"], "Nada")).toBe(refusal);
    expect(refuseIfUnchanged(undefined, state, ["tracks"], "Nada")).toBeUndefined();
  });
});
