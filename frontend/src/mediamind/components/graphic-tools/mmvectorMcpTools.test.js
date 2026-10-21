import { describe, expect, it } from "vitest";
import { MMVECTOR_TABS, mmvectorCatalogue, runMMVectorTool } from "./mmvectorMcpTools";

const obj = (id, x, y, w = 100, h = 50, extra = {}) => ({ id, name: id, x, y, w, h, color: "#ff0000", locked: false, ...extra });
const BG = obj("background", 0, 0, 820, 620, { locked: true });
const state = (selectedIds = ["a", "b"], extra = {}) => {
  let next = 0;
  return { objects: [obj("a", 10, 20), obj("b", 200, 100, 50, 50), obj("c", 500, 300, 20, 20), BG], selectedIds, newId: () => `n${next++}`, ...extra };
};
const run = (id, current, params) => runMMVectorTool(id, current, params);
const byId = (result, id) => result.objects.find((object) => object.id === id);

describe("catálogo do MMVector", () => {
  it("lista abas e ferramentas com ícone e descrição", () => {
    const catalogue = mmvectorCatalogue();
    expect(catalogue.tabs).toBe(MMVECTOR_TABS);
    expect(new Set(catalogue.tools.map((tool) => tool.tab))).toEqual(new Set(MMVECTOR_TABS.map((tab) => tab.id)));
    for (const tool of catalogue.tools) expect(tool.icon && tool.description).toBeTruthy();
    expect(new Set(catalogue.tools.map((tool) => tool.id)).size).toBe(catalogue.tools.length);
  });

  it("ferramenta desconhecida, seleção vazia/bloqueada e erros inesperados", () => {
    expect(run("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(run("align.left", state([]))).toEqual({ ok: false, summary: "Selecione objetos desbloqueados na prancheta (Shift+clique para vários)." });
    expect(run("align.left", state(["background", "sumiu"])).ok).toBe(false);
    expect(() => run("align.left", { ...state(), objects: null })).toThrow(TypeError);
  });

  it("gera ids com crypto.randomUUID quando o estado não traz gerador", () => {
    const { newId: _ignored, ...current } = state(["a"]);
    expect(run("transform.repeat", current, { copies: 1 }).objects[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("alinhar", () => {
  it("alinha à seleção em cada borda e centro", () => {
    expect(byId(run("align.left", state()), "b").x).toBe(10);
    expect(byId(run("align.right", state()), "a").x).toBe(150);
    expect(byId(run("align.hcenter", state()), "a").x).toBe(80);
    expect(byId(run("align.top", state()), "b").y).toBe(20);
    expect(byId(run("align.bottom", state()), "a").y).toBe(100);
    const current = state();
    const center = run("align.vcenter", current);
    expect(center).toMatchObject({ ok: true, count: 2, summary: "2 objeto(s) alinhado(s) ao centro (vertical) da seleção" });
    expect(byId(center, "a").y).toBe(60);
    expect(byId(center, "c")).toBe(current.objects[2]);
  });

  it("um objeto ou alvo prancheta usa a prancheta", () => {
    expect(run("align.right", state(["a"])).summary).toBe("1 objeto(s) alinhado(s) à direita da prancheta");
    expect(byId(run("align.right", state(["a"])), "a").x).toBe(720);
    expect(byId(run("align.bottom", state(), { target: "artboard" }), "b").y).toBe(570);
  });

  it("distribui centros com 3 ou mais objetos", () => {
    const result = run("align.distH", state(["c", "a", "b"]));
    expect(result.summary).toBe("3 objeto(s) distribuído(s) na horizontal");
    expect(byId(result, "b").x).toBe(260);
    expect(byId(run("align.distV", state(["a", "b", "c"])), "b").y).toBe(152.5);
    expect(run("align.distV", state())).toEqual({ ok: false, summary: "Esta ferramenta precisa de 3 ou mais objetos selecionados." });
  });

  it("centraliza a seleção na prancheta mantendo a disposição", () => {
    const result = run("align.center", state());
    expect(byId(result, "a")).toMatchObject({ x: 290, y: 245 });
    expect(byId(result, "b")).toMatchObject({ x: 480, y: 325 });
  });
});

describe("transformar e organizar", () => {
  it("espelha alternando o estado", () => {
    expect(byId(run("transform.flipX", state(["a"])), "a").flipX).toBe(true);
    expect(byId(run("transform.flipY", { ...state(["a"]), objects: [obj("a", 0, 0, 1, 1, { flipY: true })] }), "a").flipY).toBe(false);
  });

  it("gira somando ao ângulo atual", () => {
    expect(run("transform.rotate", state(["a"])).summary).toBe("1 objeto(s) girado(s) 45°");
    expect(byId(run("transform.rotate", { ...state(["a"]), objects: [obj("a", 0, 0, 1, 1, { rotation: 330 })] }, { angle: 90 }), "a").rotation).toBe(60);
  });

  it("repete com deslocamento, cópias na frente", () => {
    const result = run("transform.repeat", state(["a"]), { copies: 2, dx: 30, dy: 5 });
    expect(result).toMatchObject({ ok: true, count: 2, summary: "2 cópia(s) criada(s) a cada 30, 5 px" });
    expect(result.objects.slice(0, 2).map((o) => [o.id, o.name, o.x, o.y])).toEqual([
      ["n1", "a 3", 70, 30],
      ["n0", "a 2", 40, 25],
    ]);
  });

  it("traz para frente e envia para trás acima do fundo", () => {
    expect(run("arrange.front", state(["c"])).objects.map((o) => o.id)).toEqual(["c", "a", "b", "background"]);
    const back = run("arrange.back", state(["a"]));
    expect(back.summary).toBe("1 objeto(s) enviado(s) para trás (acima do fundo)");
    expect(back.objects.map((o) => o.id)).toEqual(["b", "c", "a", "background"]);
    expect(run("arrange.back", { ...state(["a"]), objects: [obj("a", 0, 0), obj("b", 0, 0)] }).objects.map((o) => o.id)).toEqual(["b", "a"]);
  });
});

describe("cor", () => {
  it("recolore preenchimento, traço, gradiente e partes", () => {
    const fancy = obj("a", 0, 0, 1, 1, { stroke: "#00ff00", gradient: { from: "#0000ff", to: "#ff0000" }, parts: [{ color: "#ff0000" }] });
    const result = byId(run("color.recolor", { ...state(["a"]), objects: [fancy] }, { degrees: 120 }), "a");
    expect(result).toMatchObject({ color: "#00ff00", stroke: "#0000ff", gradient: { from: "#ff0000", to: "#00ff00" }, parts: [{ color: "#00ff00" }] });
    const plain = byId(run("color.recolor", state(["a"])), "a");
    expect(plain.stroke).toBeUndefined();
    expect(plain.color).not.toBe("#ff0000");
  });

  it("define opacidade", () => {
    const result = run("color.opacity", state(), { opacity: 30 });
    expect(result.summary).toBe("Opacidade de 2 objeto(s): 30%");
    expect(byId(result, "b").opacity).toBe(30);
  });
});
