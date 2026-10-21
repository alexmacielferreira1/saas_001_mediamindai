import { describe, expect, it } from "vitest";
import { MMDESIGN_TABS, mmdesignCatalogue, runMMDesignTool } from "./mmdesignMcpTools";

const text = { id: "t", type: "text", x: 10, y: 20, w: 80, h: 20, text: "Manchete do dia\nlinha 2", font: "Inter", size: 12, weight: 400, leading: 1.2 };
const box = { id: "r", type: "rect", x: 0, y: 0, w: 50, h: 40 };
const state = (selectedId = "t", extra = {}) => {
  let next = 0;
  return { doc: { pageCount: 3, frames: { 2: [text, box], 3: [] } }, selectedId, pageKey: "2", newId: () => `n${next++}`, ...extra };
};
const run = (id, current, params) => runMMDesignTool(id, current, params);
const frame = (result, id, key = "2") => result.doc.frames[key].find((item) => item.id === id);

describe("catálogo do MMDesign", () => {
  it("lista abas e ferramentas com ícone e descrição", () => {
    const catalogue = mmdesignCatalogue();
    expect(catalogue.tabs).toBe(MMDESIGN_TABS);
    expect(new Set(catalogue.tools.map((tool) => tool.tab))).toEqual(new Set(MMDESIGN_TABS.map((tab) => tab.id)));
    for (const tool of catalogue.tools) expect(tool.icon && tool.description).toBeTruthy();
    expect(new Set(catalogue.tools.map((tool) => tool.id)).size).toBe(catalogue.tools.length);
    expect(catalogue.tools.find((tool) => tool.id === "text.caption").how).toBe("Inter 9 pt, entrelinha 1,3, itálico.");
    expect(catalogue.tools.find((tool) => tool.id === "text.credit").how).toContain("caixa-alta");
  });

  it("ferramenta desconhecida, sem seleção e erros inesperados", () => {
    expect(run("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(run("layout.centerX", state(null))).toEqual({ ok: false, summary: "Selecione um quadro na página (ferramenta Seleção)." });
    expect(run("text.title", state("r"))).toEqual({ ok: false, summary: "Selecione um quadro de texto primeiro." });
    expect(() => run("pages.add", { ...state(), doc: null })).toThrow(TypeError);
  });

  it("gera ids com crypto quando o estado não traz gerador", () => {
    const { newId: _ignored, ...current } = state();
    expect(frame(run("layout.duplicate", current), text.id).id).toBe("t");
    expect(run("layout.duplicate", current).selectedId).toMatch(/^f-[0-9a-f-]{36}$/);
  });
});

describe("texto", () => {
  it("aplica estilo de parágrafo e não repete", () => {
    const result = run("text.title", state());
    expect(result).toMatchObject({ ok: true, summary: 'Estilo "Título principal" aplicado em "Manchete do dia"' });
    expect(frame(result, "t")).toMatchObject({ font: "Montserrat", size: 48, weight: 900, style: "Título principal", italic: false });
    expect(run("text.title", { ...state(), doc: result.doc })).toEqual({ ok: false, summary: 'O texto já está no estilo "Título principal".' });
    expect(frame(run("text.quote", state()), "t")).toMatchObject({ font: "Source Serif", italic: true });
  });

  it("muda tamanho e caixa-alta", () => {
    const size = run("text.size", state(), { size: 30 });
    expect(size.summary).toBe('Tamanho de "Manchete do dia": 12 → 30 pt');
    expect(frame(size, "t").size).toBe(30);
    const noSize = { ...state(), doc: { pageCount: 1, frames: { 2: [{ id: "t", type: "text" }] } } };
    expect(run("text.size", noSize).summary).toBe('Tamanho de "Texto": 12 → 18 pt');
    const upper = run("text.upper", state());
    expect(frame(upper, "t").upper).toBe(true);
    expect(run("text.upper", { ...state(), doc: upper.doc })).toEqual({ ok: false, summary: "O texto já está em caixa-alta." });
    expect(run("text.upper", state(), { mode: "off" })).toEqual({ ok: false, summary: "O texto já não está em caixa-alta." });
    expect(run("text.upper", { ...state(), doc: upper.doc }, { mode: "off" }).summary).toBe('Caixa-alta removida em "Manchete do dia"');
  });
});

describe("layout", () => {
  it("centraliza na página", () => {
    expect(frame(run("layout.centerX", state()), "t").x).toBe(65);
    const y = run("layout.centerY", state("r"));
    expect(y.summary).toBe("o quadro centralizado na vertical da página");
    expect(frame(y, "r").y).toBe(128.5);
  });

  it("ocupa a página com margem ou sangria", () => {
    expect(frame(run("layout.fill", state("r"), { margin: 10 }), "r")).toMatchObject({ x: 10, y: 10, w: 190, h: 277 });
    const bleed = run("layout.fill", state("r"), { bleed: "bleed" });
    expect(bleed.summary).toBe("o quadro ocupa a página com sangria de 3 mm");
    expect(frame(bleed, "r")).toMatchObject({ x: -3, y: -3, w: 216, h: 303 });
  });

  it("duplica em sequência e seleciona a última cópia", () => {
    const result = run("layout.duplicate", state("r"), { copies: 2, dx: 10, dy: 0.5 });
    expect(result).toMatchObject({ ok: true, count: 2, selectedId: "n1", summary: "2 cópia(s) de o quadro a cada 10 mm, 0,5 mm" });
    expect(result.doc.frames[2].map((item) => [item.id, item.x, item.y])).toEqual([["t", 10, 20], ["r", 0, 0], ["n0", 10, 0.5], ["n1", 20, 1]]);
  });

  it("organiza na frente ou atrás", () => {
    expect(run("layout.front", state()).doc.frames[2].map((item) => item.id)).toEqual(["r", "t"]);
    expect(run("layout.back", state("r")).doc.frames[2].map((item) => item.id)).toEqual(["r", "t"]);
  });
});

describe("páginas", () => {
  it("cria colunas de texto na página aberta", () => {
    const result = run("pages.columns", state(null, { pageKey: "3" }), { count: 2, margin: 10, gutter: 10 });
    expect(result).toMatchObject({ ok: true, count: 2, selectedId: "n0", summary: "2 coluna(s) de texto de 90 mm na página 3" });
    expect(result.doc.frames[3].map((item) => [item.x, item.w, item.h, item.text])).toEqual([[10, 90, 277, "Coluna 1"], [110, 90, 277, "Coluna 2"]]);
    expect(run("pages.columns", state(null, { pageKey: "5" })).doc.frames[5]).toHaveLength(3);
    expect(run("pages.columns", state(null, { pageKey: "" })).summary).toBe("Abra uma página para criar as colunas.");
    expect(run("pages.columns", state(), { count: 6, margin: 40, gutter: 20 }).summary).toMatch(/menos de 10 mm/);
  });

  it("adiciona páginas até o limite", () => {
    expect(run("pages.add", state())).toMatchObject({ ok: true, count: 2, summary: "2 página(s) adicionada(s): agora são 5", doc: { pageCount: 5 } });
    expect(run("pages.add", { ...state(), doc: { pageCount: 499, frames: {} } }).summary).toBe("A publicação pode ter no máximo 500 páginas.");
  });
});
