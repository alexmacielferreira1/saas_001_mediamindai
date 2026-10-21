import { describe, expect, it } from "vitest";
import { MMEFFECTS_TABS, mmeffectsCatalogue, runMMEffectsTool } from "./mmeffectsMcpTools";

const BASE = { x: 960, y: 540, scale: 100, rotation: 0, opacity: 100 };
const layer = (id, extra = {}) => ({ id, name: id, visible: true, locked: false, start: 0, duration: 10, ...extra });
const state = (extra = {}) => ({
  layers: [layer("titulo", { name: "Título", start: 2, duration: 4 }), layer("fundo", { locked: true })],
  selectedLayer: "titulo",
  transform: { ...BASE },
  propertyKeyframes: {},
  markers: [],
  appliedEffects: [],
  effectParams: {},
  ...extra,
});
const run = (id, current, params) => runMMEffectsTool(id, current, params);
const frames = (result, property, id = "titulo") => result.patch.propertyKeyframes[id][property];

describe("catálogo do MMEffects", () => {
  it("lista abas e ferramentas com ícone, descrição e parâmetros", () => {
    const catalogue = mmeffectsCatalogue();
    expect(catalogue.tabs).toBe(MMEFFECTS_TABS);
    expect(new Set(catalogue.tools.map((tool) => tool.tab))).toEqual(new Set(MMEFFECTS_TABS.map((tab) => tab.id)));
    for (const tool of catalogue.tools) {
      expect(tool.icon).toBeTruthy();
      expect(tool.description).toEqual(expect.any(String));
    }
    expect(new Set(catalogue.tools.map((tool) => tool.id)).size).toBe(catalogue.tools.length);
  });

  it("ferramenta desconhecida e erros inesperados", () => {
    expect(run("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(() => run("fx.clear", { ...state(), appliedEffects: null })).toThrow(TypeError);
  });
});

describe("animações", () => {
  it("fade in e fade out nos limites da camada com a opacidade atual", () => {
    const fadeIn = run("anim.fadein", state({ transform: { ...BASE, opacity: 80 } }), { duration: 0.5 });
    expect(fadeIn).toMatchObject({ ok: true, count: 2, summary: 'Fade in em "Título" (2 s → 2,5 s) · 2 quadro(s)-chave' });
    expect(frames(fadeIn, "opacity")).toEqual([
      { time: 2, value: 0, interpolation: "easy-ease" },
      { time: 2.5, value: 80, interpolation: "easy-ease" },
    ]);
    const fadeOut = run("anim.fadeout", state(), { duration: 10 });
    expect(frames(fadeOut, "opacity").map((frame) => [frame.time, frame.value])).toEqual([[2, 100], [6, 0]]);
  });

  it("substitui só os quadros-chave dentro do trecho", () => {
    const current = state({ propertyKeyframes: { titulo: { opacity: [{ time: 2.2, value: 50 }, { time: 5, value: 30 }], x: [{ time: 1, value: 0 }] } } });
    const result = run("anim.fadein", current, { duration: 0.6 });
    expect(frames(result, "opacity").map((frame) => frame.time)).toEqual([2, 2.6, 5]);
    expect(frames(result, "x")).toEqual([{ time: 1, value: 0 }]);
  });

  it("pop in passa do tamanho e assenta", () => {
    const result = run("anim.pop", state(), { duration: 1, overshoot: 20 });
    expect(frames(result, "scale").map((frame) => [frame.time, frame.value])).toEqual([[2, 0], [2.7, 120], [3, 100]]);
  });

  it("desliza de cada lado", () => {
    expect(frames(run("anim.slide", state()), "x").map((frame) => frame.value)).toEqual([-960, 960]);
    expect(frames(run("anim.slide", state(), { from: "right" }), "x")[0].value).toBe(2880);
    expect(frames(run("anim.slide", state(), { from: "top" }), "y")[0].value).toBe(-540);
    expect(frames(run("anim.slide", state(), { from: "bottom" }), "y")[0].value).toBe(1620);
  });

  it("gira no sentido escolhido durante a camada inteira", () => {
    const cw = run("anim.spin", state(), { turns: 2 });
    expect(frames(cw, "rotation")).toEqual([
      { time: 2, value: 0, interpolation: "linear" },
      { time: 6, value: 720, interpolation: "linear" },
    ]);
    expect(frames(run("anim.spin", state(), { direction: "ccw" }), "rotation")[1].value).toBe(-360);
  });

  it("quica caindo de cima até parar", () => {
    const result = run("anim.bounce", state(), { duration: 1, height: 100 });
    expect(frames(result, "y").map((frame) => frame.value)).toEqual([440, 540, 505, 540, 530, 540]);
  });

  it("tremor determinístico que começa e termina na posição original", () => {
    const result = run("anim.shake", state(), { at: 3, duration: 0.5, frequency: 10, amplitude: 50 });
    const x = frames(result, "x");
    expect(x).toHaveLength(6);
    expect([x[0].time, x.at(-1).time]).toEqual([3, 3.5]);
    expect([x[0].value, x.at(-1).value]).toEqual([960, 960]);
    expect(x.some((frame) => frame.value !== 960)).toBe(true);
    expect(frames(result, "y")[1].value).not.toBe(540);
    expect(run("anim.shake", state(), { at: 6 }).summary).toMatch(/precisa de ao menos 0,1 s/);
    expect(run("anim.shake", state(), { at: 0, duration: 0.1, frequency: 4 }).count).toBe(6);
  });

  it("limpa os quadros-chave de transformação e mantém os outros", () => {
    const current = state({ propertyKeyframes: { titulo: { opacity: [{ time: 1, value: 0 }], scale: [{ time: 2, value: 1 }, { time: 3, value: 2 }], custom: [{ time: 1, value: 1 }] } } });
    const result = run("anim.clear", current);
    expect(result).toMatchObject({ ok: true, count: 3, summary: '3 quadro(s)-chave removido(s) de "Título"' });
    expect(result.patch.propertyKeyframes.titulo).toEqual({ custom: [{ time: 1, value: 1 }] });
    expect(run("anim.clear", state())).toEqual({ ok: false, summary: '"Título" não tem quadros-chave de transformação.' });
  });

  it("exige camada selecionada, desbloqueada e com duração", () => {
    expect(run("anim.fadein", state({ selectedLayer: null })).summary).toBe("Selecione uma camada na timeline do MMEffects.");
    expect(run("anim.fadein", state({ selectedLayer: "fundo" })).summary).toBe('A camada "fundo" está bloqueada: desbloqueie para animar.');
    expect(run("anim.fadein", state({ layers: [layer("titulo", { name: "Título", start: 10 })] })).summary).toMatch(/curta demais/);
    const defaults = run("anim.fadein", state({ layers: [{ id: "titulo", name: "Título" }] }));
    expect(frames(defaults, "opacity").map((frame) => frame.time)).toEqual([0, 0.6]);
  });
});

describe("efeitos", () => {
  it("aplica e depois ajusta um efeito real com os parâmetros", () => {
    const first = run("fx.blur", state(), { amount: 12 });
    expect(first).toMatchObject({ ok: true, summary: "Desfoque gaussiano aplicado: Desfoque 12" });
    expect(first.patch).toEqual({ appliedEffects: ["Desfoque gaussiano"], effectParams: { "Desfoque gaussiano": { Desfoque: 12 } } });
    const again = run("fx.blur", state({ ...first.patch, effectParams: { "Desfoque gaussiano": { Desfoque: 12, Outro: "x" } } }), { amount: 3 });
    expect(again.summary).toBe("Desfoque gaussiano ajustado: Desfoque 3");
    expect(again.patch.appliedEffects).toEqual(["Desfoque gaussiano"]);
    expect(again.patch.effectParams["Desfoque gaussiano"]).toEqual({ Desfoque: 3, Outro: "x" });
    expect(run("fx.blur", state(first.patch), { amount: 12 })).toEqual({ ok: false, summary: "Desfoque gaussiano já está com esses valores (Desfoque 12)." });
    expect(run("fx.blur", state({ appliedEffects: ["Desfoque gaussiano"] }), { amount: 12 }).ok).toBe(true);
  });

  it("cada efeito grava os campos que o motor de efeitos lê", () => {
    expect(run("fx.color", state()).patch.effectParams).toEqual({ "Brilho e contraste": { Brilho: 15, Contraste: 20 } });
    expect(run("fx.hue", state()).patch.effectParams).toEqual({ "Tonalidade/Saturação": { Matiz: 30, Saturação: 20 } });
    expect(run("fx.glow", state()).summary).toBe("Glow aplicado: Raio do brilho 12 · Intensidade do brilho 1");
    expect(run("fx.shadow", state()).patch.effectParams).toEqual({ "Drop Shadow": { "Opacidade da sombra": 50, Distância: 6, Suavidade: 4 } });
    expect(run("fx.particles", state(), { birth: 1.5 }).patch.effectParams).toEqual({ "CC Particle World": { "Birth Rate": 1.5, Velocity: 1, Gravity: 0.5 } });
  });

  it("remove todos os efeitos ou avisa que não há", () => {
    expect(run("fx.clear", state({ appliedEffects: ["Glow", "Transformar"] }))).toMatchObject({ ok: true, count: 2, details: ["Glow", "Transformar"], patch: { appliedEffects: [] } });
    expect(run("fx.clear", state())).toEqual({ ok: false, summary: "A composição não tem efeitos aplicados." });
  });
});

describe("camada", () => {
  it("liga e desliga motion blur e 3D sem repetir o estado", () => {
    const blur = run("layer.motionblur", state());
    expect(blur.summary).toBe('Motion blur ligado em "Título"');
    expect(blur.patch.layers[0].motionBlur).toBe(true);
    expect(run("layer.motionblur", state(blur.patch))).toEqual({ ok: false, summary: '"Título" já está com Motion blur ligado.' });
    expect(run("layer.motionblur", state(blur.patch), { mode: "off" }).patch.layers[0].motionBlur).toBe(false);
    expect(run("layer.3d", state(), { mode: "off" })).toEqual({ ok: false, summary: '"Título" já está com Modo 3D desligado.' });
    expect(run("layer.3d", state()).patch.layers[0].threeD).toBe(true);
  });

  it("estica a camada para a composição inteira", () => {
    const result = run("layer.fit", state());
    expect(result.summary).toBe('"Título" agora vai de 0 s a 10 s');
    expect(result.patch.layers[0]).toMatchObject({ start: 0, duration: 10 });
    expect(run("layer.fit", state({ layers: [{ id: "titulo", name: "Título" }] })).summary).toBe('"Título" já ocupa a composição inteira.');
  });

  it("redefine transformação, quadros-chave e âncora", () => {
    const current = state({
      transform: { ...BASE, x: 10, scale: 300 },
      propertyKeyframes: { titulo: { x: [{ time: 1, value: 2 }], custom: [] } },
      layers: [layer("titulo", { name: "Título", anchor: { x: 1, y: 2 } }), layer("outra")],
    });
    const result = run("layer.reset", current);
    expect(result.patch.transform).toEqual(BASE);
    expect(result.patch.propertyKeyframes.titulo).toEqual({ custom: [] });
    expect(result.patch.layers[0].anchor).toBeNull();
    expect(result.patch.layers[1]).toBe(current.layers[1]);
    expect(run("layer.reset", state()).patch.propertyKeyframes).toEqual({ titulo: {} });
  });
});

describe("marcadores", () => {
  it("cria marcadores ritmados sem duplicar os existentes", () => {
    const result = run("markers.rhythm", state({ markers: [2] }), { interval: 2.5, offset: 0 });
    expect(result).toMatchObject({ ok: true, count: 5, summary: "5 marcador(es) a cada 2,5 s (as camadas encaixam neles ao arrastar)" });
    expect(result.patch.markers).toEqual([0, 2, 2.5, 5, 7.5, 10]);
    expect(run("markers.rhythm", state({ markers: [0, 5, 10] }), { interval: 5 })).toEqual({ ok: false, summary: "Esses marcadores já existem na composição." });
  });

  it("limpa os marcadores ou avisa que não há", () => {
    expect(run("markers.clear", state({ markers: [1, 2] }))).toMatchObject({ ok: true, count: 2, patch: { markers: [] } });
    expect(run("markers.clear", state())).toEqual({ ok: false, summary: "A composição não tem marcadores." });
  });
});

describe("saídas, suavização e sequência", () => {
  it("sai deslizando e encolhe no fim da camada", () => {
    const out = run("anim.slideout", state());
    expect(out.summary).toBe('Sair deslizando em "Título" (5,2 s → 6 s) · 2 quadro(s)-chave');
    expect(frames(out, "x").map((item) => item.value)).toEqual([960, 2880]);
    expect(frames(run("anim.slideout", state(), { to: "top", duration: 10 }), "y").map((item) => [item.time, item.value])).toEqual([[2, 540], [6, -540]]);
    const shrink = run("anim.shrinkout", state());
    expect(shrink.count).toBe(4);
    expect(frames(shrink, "scale").map((item) => [item.time, item.value])).toEqual([[5.5, 100], [6, 0]]);
    expect(frames(shrink, "opacity").at(-1).value).toBe(0);
  });

  it("troca a interpolação de todos os quadros-chave da camada", () => {
    const current = state({ propertyKeyframes: { titulo: { x: [{ time: 1, value: 0, interpolation: "linear" }], opacity: [], custom: [{ time: 1, value: 1 }] } } });
    const result = run("anim.easing", current, { mode: "hold" });
    expect(result.summary).toBe('Interpolação Congelar (hold) em 1 quadro(s)-chave de "Título"');
    expect(frames(result, "x")[0].interpolation).toBe("hold");
    expect(frames(result, "custom")).toEqual([{ time: 1, value: 1 }]);
    expect(run("anim.easing", state()).summary).toBe('"Título" não tem quadros-chave: crie uma animação primeiro.');
  });

  it("sequencia as camadas em cascata, pulando bloqueadas, ocultas e o fundo", () => {
    const current = state({
      layers: [layer("a", { name: "Topo", start: 1, duration: 3 }), layer("b", { name: "Meio" }), layer("h", { visible: false }), layer("l", { locked: true }), layer("background", { name: "Background" })],
    });
    const result = run("layer.sequence", current, { interval: 0.5, offset: 1 });
    expect(result).toMatchObject({ ok: true, count: 2, summary: "2 camadas em cascata a cada 0,5 s (Meio primeiro)" });
    expect(result.details).toEqual(["Meio: entra em 1 s", "Topo: entra em 1,5 s"]);
    const byLayer = Object.fromEntries(result.patch.layers.map((item) => [item.id, item]));
    expect(byLayer.b).toMatchObject({ start: 1, duration: 9 });
    expect(byLayer.a).toMatchObject({ start: 1.5, duration: 8.5 });
    expect(byLayer.background).toBe(current.layers[4]);

    const top = run("layer.sequence", current, { order: "top", keepEnd: true, skipBackground: false, interval: 3 });
    const byTop = Object.fromEntries(top.patch.layers.map((item) => [item.id, item]));
    expect(byTop.a).toMatchObject({ start: 0, duration: 4 });
    expect(byTop.b).toMatchObject({ start: 3, duration: 7 });
    expect(byTop.background).toMatchObject({ start: 6, duration: 4 });
    const late = run("layer.sequence", state({ layers: [layer("x", { start: 0, duration: 1 }), layer("y")] }), { offset: 5, interval: 3, order: "top", keepEnd: true });
    expect(late.patch.layers[0]).toMatchObject({ start: 5, duration: 0.1 });
    expect(late.patch.layers[1]).toMatchObject({ start: 8, duration: 2 });
    const noTiming = run("layer.sequence", state({ layers: [{ id: "p", name: "P" }, { id: "q", name: "Q" }] }), { keepEnd: true, offset: 5, interval: 5, order: "top" });
    expect(noTiming.patch.layers[1]).toMatchObject({ start: 9.9, duration: 0.1 });
    expect(run("layer.sequence", state())).toEqual({ ok: false, summary: "Precisa de duas ou mais camadas visíveis e desbloqueadas para sequenciar." });
  });
});
