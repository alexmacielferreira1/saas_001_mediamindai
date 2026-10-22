import { describe, expect, it } from "vitest";
import { interpolate, MM3D_TABS, mm3dCatalogue, runMM3DTool } from "./mm3dMcpTools";

const obj = (id, type, extra = {}) => ({ id, name: id, type, x: 40, y: 30, z: 5, rotate: 10, scale: 120, color: "#111111", visible: true, ...extra });
const state = (extra = {}) => {
  let next = 0;
  return {
    objects: [obj("cam", "camera"), obj("cubo", "cube"), obj("bola", "sphere"), obj("luz", "light")],
    selectedId: "cubo",
    keyframes: {},
    world: { exposure: 1, grid: true, aspect: "16:9", background: "#111526" },
    time: 0,
    newId: () => `n${next++}`,
    ...extra,
  };
};
const run = (id, current, params) => runMM3DTool(id, current, params);
const byId = (result, id) => result.objects.find((object) => object.id === id);

describe("catálogo do MM3D", () => {
  it("lista guias e ferramentas únicas com ícone e descrição", () => {
    const catalogue = mm3dCatalogue();
    expect(catalogue.tabs).toBe(MM3D_TABS);
    expect(new Set(catalogue.tools.map((tool) => tool.tab))).toEqual(new Set(MM3D_TABS.map((tab) => tab.id)));
    for (const tool of catalogue.tools) expect(tool.icon && tool.description).toBeTruthy();
    expect(new Set(catalogue.tools.map((tool) => tool.id)).size).toBe(catalogue.tools.length);
    expect(new Set(catalogue.tools.map((tool) => tool.icon)).size).toBe(catalogue.tools.length);
    expect(catalogue.tools.length).toBeGreaterThanOrEqual(10);
    expect(catalogue.tools.length).toBeLessThanOrEqual(15);
  });

  it("ferramenta desconhecida, sem seleção e erros inesperados", () => {
    expect(run("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(run("transform.center", state({ selectedId: "sumiu" }))).toEqual({ ok: false, summary: "Selecione um objeto na cena (Outliner) primeiro." });
    expect(() => run("transform.center", { ...state(), objects: null })).toThrow(TypeError);
  });

  it("ferramentas em breve explicam o motivo e não alteram nada", () => {
    for (const id of ["objects.import", "world.render"]) {
      const tool = mm3dCatalogue().tools.find((item) => item.id === id);
      expect(tool.status).toBe("soon");
      expect(run(id, state())).toEqual({ ok: false, summary: `Em breve: ${tool.soonReason}` });
    }
  });

  it("usa padrões de keyframes/tempo e crypto.randomUUID quando o estado não traz", () => {
    const { newId: _n, keyframes: _k, time: _t, ...current } = state();
    const result = run("objects.add", current);
    expect(result.selectedId).toMatch(/^cube-[0-9a-f-]{36}$/);
    expect(run("anim.turntable", current).keyframes.cubo.rotate).toEqual([
      { time: 0, value: 10 },
      { time: 10, value: 370 },
    ]);
  });
});

describe("interpolate", () => {
  const frames = [
    { time: 4, value: 40 },
    { time: 0, value: 0 },
  ];
  it("sem quadros usa o valor base; antes, entre e depois dos quadros", () => {
    expect(interpolate(undefined, 1, 7)).toBe(7);
    expect(interpolate([], 1, 7)).toBe(7);
    expect(interpolate(frames, -1, 7)).toBe(0);
    expect(interpolate(frames, 2, 7)).toBe(20);
    expect(interpolate(frames, 9, 7)).toBe(40);
  });
});

describe("objetos", () => {
  it("adiciona primitivas numeradas, lado a lado, e seleciona a última", () => {
    const one = run("objects.add", state());
    expect(one).toMatchObject({ ok: true, count: 1, summary: "1 cubo(s) adicionado(s) à cena", selectedId: "cube-n0" });
    expect(byId(one, "cube-n0")).toMatchObject({ name: "Cubo 2", x: 50, color: "#34d399", visible: true });
    const three = run("objects.add", state(), { type: "sphere", count: 3 });
    expect(three.objects.slice(-3).map((item) => [item.name, item.x, item.color])).toEqual([
      ["Esfera 2", 38, "#38bdf8"],
      ["Esfera 3", 50, "#38bdf8"],
      ["Esfera 4", 62, "#38bdf8"],
    ]);
  });

  it("série duplica o selecionado a partir da posição exibida", () => {
    const result = run("objects.array", state({ time: 2, keyframes: { cubo: { x: [{ time: 0, value: 0 }, { time: 4, value: 40 }] } } }), { copies: 2, dx: 5, dy: -3 });
    expect(result).toMatchObject({ ok: true, count: 2, summary: "2 cópia(s) de cubo em série (5, -3 %)", selectedId: "n1" });
    expect(result.objects.slice(-2).map((item) => [item.name, item.x, item.y])).toEqual([
      ["cubo cópia 1", 25, 27],
      ["cubo cópia 2", 30, 24],
    ]);
  });

  it("isola o objeto selecionado e mostra todos de novo", () => {
    const current = state({ objects: [...state().objects, obj("plano", "plane"), obj("oculto", "cube", { visible: false })] });
    const isolated = run("objects.isolate", current);
    expect(isolated).toMatchObject({ ok: true, count: 2, summary: "cubo isolado (2 objeto(s) ocultado(s))" });
    expect(isolated.objects.filter((item) => item.visible).map((item) => item.id)).toEqual(["cam", "cubo", "luz"]);
    expect(run("objects.isolate", { ...current, objects: isolated.objects })).toEqual({ ok: false, summary: "Nada a ocultar: cubo já está isolado." });
    const hiddenSelected = isolated.objects.map((item) => (item.id === "cubo" ? { ...item, visible: false } : item));
    expect(byId(run("objects.isolate", { ...current, objects: hiddenSelected }), "cubo").visible).toBe(true);
    expect(run("objects.isolate", state({ selectedId: "cam" }))).toEqual({ ok: false, summary: "Isolar funciona com cubo, esfera ou plano (câmeras e luzes não aparecem no viewport)." });

    const shown = run("objects.isolate", { ...current, objects: isolated.objects }, { mode: "show" });
    expect(shown).toMatchObject({ ok: true, count: 3, summary: "3 objeto(s) voltaram a aparecer" });
    expect(shown.objects.every((item) => item.visible)).toBe(true);
    expect(byId(shown, "cubo")).toBe(byId(isolated, "cubo"));
    expect(run("objects.isolate", state(), { mode: "show" })).toEqual({ ok: false, summary: "Todos os objetos já estão visíveis." });
  });
});

describe("transformar", () => {
  it("centraliza, mantendo a animação no instante atual", () => {
    const current = state({ time: 3, keyframes: { cubo: { x: [{ time: 0, value: 10 }, { time: 3, value: 20 }], y: [{ time: 0, value: 5 }] } } });
    const result = run("transform.center", current);
    expect(result).toMatchObject({ ok: true, count: 1, summary: "cubo centralizado no viewport" });
    expect(byId(result, "cubo")).toMatchObject({ x: 50, y: 50 });
    expect(result.keyframes.cubo.x).toEqual([
      { time: 0, value: 10 },
      { time: 3, value: 50 },
    ]);
    expect(result.keyframes.cubo.y).toEqual([
      { time: 0, value: 5 },
      { time: 3, value: 50 },
    ]);
    expect(byId(result, "bola")).toBe(current.objects[2]);
  });

  it("gira somando ao valor exibido", () => {
    expect(run("transform.rotate", state())).toMatchObject({ summary: "cubo girado 45° (rotação 55°)" });
    expect(byId(run("transform.rotate", state(), { angle: -90 }), "cubo").rotate).toBe(-80);
  });

  it("redefine rotação, escala e profundidade (e opcionalmente a posição)", () => {
    const result = run("transform.reset", state());
    expect(result.summary).toBe("Transformações de cubo redefinidas");
    expect(byId(result, "cubo")).toMatchObject({ rotate: 0, scale: 100, z: 0, x: 40, y: 30 });
    const withPosition = run("transform.reset", state(), { position: true });
    expect(withPosition.summary).toBe("Transformações de cubo redefinidas (com posição)");
    expect(byId(withPosition, "cubo")).toMatchObject({ x: 50, y: 50 });
  });

  it("organiza objetos visíveis em linha ou círculo", () => {
    const row = run("transform.arrange", state(), { spacing: 10 });
    expect(row).toMatchObject({ ok: true, count: 2, summary: "2 objeto(s) organizados em linha" });
    expect([byId(row, "cubo").x, byId(row, "bola").x, byId(row, "bola").y]).toEqual([45, 55, 50]);
    const scene = state();
    const circle = run("transform.arrange", scene, { mode: "circle", spacing: 20 });
    expect(circle.summary).toBe("2 objeto(s) organizados em círculo");
    expect([byId(circle, "cubo").x, byId(circle, "cubo").y, byId(circle, "bola").y]).toEqual([50, 30, 70]);
    expect(byId(circle, "cam")).toBe(scene.objects[0]);
    expect(run("transform.arrange", state({ objects: [obj("cubo", "cube"), obj("b", "sphere", { visible: false })] }))).toEqual({
      ok: false,
      summary: "Organizar precisa de 2 ou mais objetos visíveis (cubo, esfera ou plano).",
    });
  });
});

describe("material e mundo", () => {
  it("pinta o selecionado ou todos os objetos", () => {
    const one = run("material.color", state(), { color: "#ff0000" });
    expect(one).toMatchObject({ ok: true, count: 1, summary: "Cor #ff0000 aplicada a 1 objeto(s)" });
    expect(byId(one, "cubo").color).toBe("#ff0000");
    expect(byId(one, "bola").color).toBe("#111111");
    const all = run("material.color", state(), { scope: "all" });
    expect(all.count).toBe(2);
    expect(byId(all, "bola").color).toBe("#38bdf8");
    expect(byId(all, "luz").color).toBe("#111111");
    expect(run("material.color", state(), { color: "" })).toEqual({ ok: false, summary: "Escolha uma cor para aplicar." });
    expect(run("material.color", state({ objects: [obj("cam", "camera")] }), { scope: "all" })).toEqual({ ok: false, summary: "Não há cubos, esferas ou planos na cena." });
  });

  it("aplica paleta alternando as cores", () => {
    const result = run("material.palette", state({ objects: [...state().objects, obj("p1", "plane"), obj("p2", "plane"), obj("p3", "plane")] }), { palette: "mono" });
    expect(result).toMatchObject({ ok: true, count: 5, summary: "Paleta aplicada a 5 objeto(s)" });
    expect(result.objects.filter((item) => item.type !== "camera" && item.type !== "light").map((item) => item.color)).toEqual(["#f8fafc", "#cbd5e1", "#64748b", "#334155", "#f8fafc"]);
    expect(byId(run("material.palette", state()), "cubo").color).toBe("#7c5cff");
    expect(run("material.palette", state({ objects: [] }))).toEqual({ ok: false, summary: "Não há cubos, esferas ou planos na cena." });
  });

  it("ajusta exposição, fundo e grade do mundo", () => {
    const result = run("world.lighting", state(), { preset: "night", grid: false });
    expect(result).toEqual({
      ok: true,
      count: 1,
      summary: "Mundo ajustado: Noite (exposição 0.6, grade desligada)",
      world: { exposure: 0.6, grid: false, aspect: "16:9", background: "#0b1030" },
    });
    expect(run("world.lighting", state()).summary).toBe("Mundo ajustado: Estúdio (exposição 1.0, grade ligada)");
  });
});

describe("animação", () => {
  it("giro 360° parte da rotação exibida e preserva outras propriedades animadas", () => {
    const current = state({ keyframes: { cubo: { x: [{ time: 0, value: 1 }] } } });
    const result = run("anim.turntable", current, { turns: 2, duration: 5 });
    expect(result).toEqual({
      ok: true,
      count: 2,
      summary: "Giro 360° em cubo: 2 volta(s) em 5 s",
      keyframes: {
        cubo: {
          x: [{ time: 0, value: 1 }],
          rotate: [
            { time: 0, value: 10 },
            { time: 5, value: 730 },
          ],
        },
      },
    });
  });

  it("entrada desliza até a posição atual em cada direção", () => {
    expect(run("anim.entrance", state())).toMatchObject({
      summary: "Entrada de cubo de 0 s a 1.5 s",
      keyframes: { cubo: { x: [{ time: 0, value: 0 }, { time: 1.5, value: 40 }] } },
    });
    expect(run("anim.entrance", state(), { direction: "right" }).keyframes.cubo.x[0].value).toBe(80);
    expect(run("anim.entrance", state(), { direction: "top" }).keyframes.cubo.y[0].value).toBe(-10);
    const bottom = run("anim.entrance", state(), { direction: "bottom", start: 9, duration: 3 });
    expect(bottom.summary).toBe("Entrada de cubo de 9 s a 10 s");
    expect(bottom.keyframes.cubo.y).toEqual([
      { time: 9, value: 70 },
      { time: 10, value: 30 },
    ]);
  });

  it("limpa quadros-chave do selecionado ou explica que não há", () => {
    const current = state({ keyframes: { cubo: { x: [{ time: 0, value: 1 }, { time: 2, value: 3 }], y: [{ time: 1, value: 2 }] }, bola: { x: [{ time: 0, value: 1 }] } } });
    expect(run("anim.clear", current)).toEqual({ ok: true, count: 3, summary: "3 quadro(s)-chave removido(s) de cubo", keyframes: { bola: current.keyframes.bola } });
    expect(run("anim.clear", state())).toEqual({ ok: false, summary: "cubo não tem quadros-chave." });
    expect(run("anim.clear", state({ keyframes: { cubo: { x: [] } } }))).toEqual({ ok: false, summary: "cubo não tem quadros-chave." });
  });
});
