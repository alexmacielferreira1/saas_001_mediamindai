import { describe, expect, it } from "vitest";
import { DEFAULT_ADJUST } from "./lightcraftPipeline";
import { MMLIGHT_TABS, mmlightCatalogue, runMMLightTool } from "./mmlightMcpTools";

const BASE = { ...DEFAULT_ADJUST, realces: -18, sombras: 24 };
const state = (extra = {}) => ({
  sourceId: "a",
  sourceName: "Praia.jpg",
  photos: {},
  albums: {},
  baseAdjust: BASE,
  image: null,
  pickedIds: [],
  newId: (type) => `${type}-1`,
  ...extra,
});
const image = (value) => ({ width: 2, height: 1, data: new Uint8ClampedArray([value, value, value, 255, value, value, value, 255]) });

describe("catálogo do MMLight", () => {
  it("tem guias próprias, 15 ferramentas com ícones distintos e a de IA marcada como em breve", () => {
    const { tabs, tools } = mmlightCatalogue();
    expect(tabs).toBe(MMLIGHT_TABS);
    expect(tools).toHaveLength(15);
    expect(new Set(tools.map((tool) => tool.icon)).size).toBe(15);
    expect(tools.every((tool) => tabs.some((tab) => tab.id === tool.tab))).toBe(true);
    expect(tools.filter((tool) => tool.status === "soon").map((tool) => [tool.id, Boolean(tool.soonReason)])).toEqual([["mask.ai", true]]);
    expect(runMMLightTool("mask.ai", state())).toEqual({ ok: false, summary: "Máscaras por IA ainda não estão disponíveis no MMLight." });
  });

  it("explica ferramentas desconhecidas, falta de foto e deixa subir erros inesperados", () => {
    expect(runMMLightTool("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(runMMLightTool("tone.light", { sourceId: "" })).toEqual({ ok: false, summary: "Importe ou selecione uma fotografia primeiro." });
    expect(() => runMMLightTool("tone.light", state({ photos: null }))).toThrow(TypeError);
  });
});

describe("Tom", () => {
  it("ajuste automático exige a foto carregada e grava ajustes calculados", () => {
    expect(runMMLightTool("tone.auto", state()).summary).toBe("Aguarde a foto carregar para o ajuste automático.");
    const dark = runMMLightTool("tone.auto", state({ image: image(20) }));
    expect(dark.ok).toBe(true);
    expect(dark.photos.a.adjust.exposição).toBeGreaterThan(0);
    expect(dark.summary).toMatch(/^Ajuste automático em Praia.jpg: exposição \+\d+, contraste/);
    const bright = runMMLightTool("tone.auto", state({ image: image(250) }));
    expect(bright.summary).toMatch(/exposição -\d+/);
  });

  it("luz, recuperação e presença partem dos ajustes da foto (ou dos globais) e não mexem nas outras fotos", () => {
    const light = runMMLightTool("tone.light", state({ photos: { b: { rating: 3 } } }), { exposure: 30, contrast: -5 });
    expect(light).toMatchObject({ ok: true, count: 1, summary: "Luz em Praia.jpg: exposição +30, contraste -5" });
    expect(light.photos.a.adjust).toEqual({ ...BASE, exposição: 30, contraste: -5 });
    expect(light.photos.b).toEqual({ rating: 3 });
    const own = { a: { rating: 4, adjust: { ...DEFAULT_ADJUST, saturação: 50 } } };
    const recovered = runMMLightTool("tone.recover", state({ photos: own }), {});
    expect(recovered.photos.a).toEqual({ rating: 4, adjust: { ...DEFAULT_ADJUST, saturação: 50, realces: -40, sombras: 40, brancos: 10, pretos: -10 } });
    expect(recovered.summary).toBe("Tons recuperados em Praia.jpg: realces -40, sombras +40, brancos +10, pretos -10");
    expect(runMMLightTool("tone.presence", state()).photos.a.adjust).toMatchObject({ textura: 15, claridade: 20, saturação: 10 });
  });

  it("redefinir zera ajustes e perfil, opcionalmente as máscaras, e avisa quando não há o que zerar", () => {
    const masks = [{ id: "m", type: "linear", adjust: DEFAULT_ADJUST }];
    const edited = { a: { adjust: { ...DEFAULT_ADJUST, contraste: 9 }, profile: "Monocromático", masks } };
    const keep = runMMLightTool("tone.reset", state({ photos: edited }));
    expect(keep.summary).toBe("Ajustes de Praia.jpg redefinidos");
    expect(keep.photos.a).toEqual({ adjust: DEFAULT_ADJUST, profile: "Adobe Color", masks });
    const neutral = { a: { adjust: { ...DEFAULT_ADJUST } } };
    expect(runMMLightTool("tone.reset", state({ photos: neutral }))).toEqual({ ok: false, summary: "A foto já está sem ajustes para redefinir." });
    expect(runMMLightTool("tone.reset", state({ photos: neutral }), { masks: true }).summary).toBe("A foto já está sem ajustes para redefinir.");
    const onlyMasks = runMMLightTool("tone.reset", state({ photos: { a: { ...neutral.a, masks } } }), { masks: true });
    expect(onlyMasks).toMatchObject({ ok: true, summary: "Ajustes de Praia.jpg redefinidos (máscaras removidas)" });
    expect(onlyMasks.photos.a.masks).toEqual([]);
  });
});

describe("Cor e perfil", () => {
  it("troca o perfil e recusa repetir o mesmo", () => {
    const result = runMMLightTool("color.profile", state(), { profile: "Monocromático" });
    expect(result).toMatchObject({ ok: true, summary: "Perfil de Praia.jpg: Monocromático" });
    expect(result.photos.a.profile).toBe("Monocromático");
    expect(runMMLightTool("color.profile", state(), { profile: "Adobe Color" }).summary).toBe("A foto já usa o perfil Adobe Color.");
    expect(runMMLightTool("color.profile", state({ photos: { a: { profile: "Camera Standard" } } })).summary).toBe("A foto já usa o perfil Camera Standard.");
  });

  it("looks substituem os ajustes globais e definem o perfil", () => {
    const bw = runMMLightTool("color.look", state({ photos: { a: { adjust: { ...DEFAULT_ADJUST, exposição: 80 } } } }), { look: "bw" });
    expect(bw.summary).toBe("Look P&B contrastado aplicado em Praia.jpg (perfil Monocromático)");
    expect(bw.photos.a).toEqual({ adjust: { ...DEFAULT_ADJUST, contraste: 30, brancos: 10, pretos: -15, claridade: 20 }, profile: "Monocromático" });
    expect(runMMLightTool("color.look", state()).photos.a.profile).toBe("Camera Standard");
  });
});

describe("Máscaras", () => {
  it("cria e atualiza o realce radial preservando as outras máscaras", () => {
    const created = runMMLightTool("mask.radial", state(), { cx: 30, cy: 40, size: 50, exposure: 10, clarity: 5 });
    expect(created.summary).toBe("Realce radial criado em Praia.jpg");
    expect(created.photos.a.masks).toEqual([{ id: "radial-1", type: "radial", cx: 0.3, cy: 0.4, rx: 0.5, ry: 0.6, adjust: { ...DEFAULT_ADJUST, exposição: 10, claridade: 5 } }]);
    const brush = { id: "b", type: "brush", grid: [], adjust: DEFAULT_ADJUST };
    const updated = runMMLightTool("mask.radial", state({ photos: { a: { masks: [brush, ...created.photos.a.masks] } } }), { exposure: -20 });
    expect(updated.summary).toBe("Realce radial atualizado em Praia.jpg");
    expect(updated.photos.a.masks).toHaveLength(2);
    expect(updated.photos.a.masks[0]).toBe(brush);
    expect(updated.photos.a.masks[1]).toMatchObject({ id: "radial-1", cx: 0.5, adjust: { exposição: -20 } });
  });

  it("gradiente céu valida início e fim", () => {
    expect(runMMLightTool("mask.linear", state(), { start: 60, end: 40 }).summary).toBe("O fim do gradiente precisa ficar abaixo do início.");
    const sky = runMMLightTool("mask.linear", state());
    expect(sky.photos.a.masks[0]).toEqual({ id: "linear-1", type: "linear", start: 0.1, end: 0.55, adjust: { ...DEFAULT_ADJUST, exposição: -30, realces: -20 } });
  });

  it("limpa as máscaras ou avisa que não há", () => {
    expect(runMMLightTool("mask.clear", state()).summary).toBe("Esta foto não tem máscaras.");
    const result = runMMLightTool("mask.clear", state({ photos: { a: { masks: [{ id: 1 }, { id: 2 }] } } }));
    expect(result).toMatchObject({ ok: true, count: 2, summary: "2 máscara(s) removida(s) de Praia.jpg" });
    expect(result.photos.a.masks).toEqual([]);
  });

  it("gera id de máscara pelo padrão quando o estado não traz newId", () => {
    const result = runMMLightTool("mask.radial", { sourceId: "a", sourceName: "x" });
    expect(result.photos.a.masks[0].id).toMatch(/^radial-\d+$/);
  });
});

describe("Catálogo", () => {
  const picked = state({ pickedIds: ["a", "b", "c"], photos: { b: { rating: 2 } } });

  it("avalia a foto atual ou também as selecionadas, e exige seleção quando pedida", () => {
    expect(runMMLightTool("catalog.rate", state(), { stars: 3 })).toMatchObject({ ok: true, count: 1, summary: "1 foto(s) com 3 estrela(s)" });
    const many = runMMLightTool("catalog.rate", picked, { scope: "picked" });
    expect(many).toMatchObject({ count: 3, summary: "3 foto(s) com 5 estrela(s)" });
    expect([many.photos.a.rating, many.photos.b.rating, many.photos.c.rating]).toEqual([5, 5, 5]);
    expect(runMMLightTool("catalog.rate", state({ pickedIds: ["a"] }), { scope: "picked" }).summary).toBe("Selecione outras fotos na tira (Ctrl+clique ou Shift+clique) primeiro.");
  });

  it("sinaliza, tira bandeira e rotula cor", () => {
    expect(runMMLightTool("catalog.mark", state(), { flag: "keep", color: "keep" }).summary).toBe("Escolha uma bandeira ou um rótulo de cor para aplicar.");
    const flagged = runMMLightTool("catalog.mark", state());
    expect(flagged.summary).toBe("1 foto(s): sinalizada(s)");
    expect(flagged.photos.a).toEqual({ flag: true });
    const off = runMMLightTool("catalog.mark", picked, { flag: "off", color: "Azul", scope: "picked" });
    expect(off.summary).toBe("3 foto(s): sem bandeira, rótulo Azul");
    expect(off.photos.b).toEqual({ rating: 2, flag: false, color: "Azul" });
    const noColor = runMMLightTool("catalog.mark", state(), { flag: "keep", color: "" });
    expect(noColor.summary).toBe("1 foto(s): sem rótulo de cor");
    expect(noColor.photos.a).toEqual({ color: "" });
  });

  it("adiciona a pastas e coleções sem repetir fotos", () => {
    const first = runMMLightTool("catalog.collection", state());
    expect(first).toMatchObject({ count: 1, summary: "1 foto(s) adicionada(s) a \"Selecionadas\"", albums: { Selecionadas: ["a"] } });
    const more = runMMLightTool("catalog.collection", { ...picked, albums: first.albums }, { scope: "picked" });
    expect(more.albums.Selecionadas).toEqual(["a", "b", "c"]);
    expect(more.count).toBe(2);
    expect(runMMLightTool("catalog.collection", { ...state(), albums: first.albums }).summary).toBe("Já está(ão) em \"Selecionadas\".");
    expect(mmlightCatalogue().tools.find((tool) => tool.id === "catalog.collection").params[0].options).toContainEqual(["Eventos", "Pasta Eventos"]);
  });

  it("sincroniza ajustes, perfil e máscaras com as selecionadas", () => {
    expect(runMMLightTool("catalog.sync", state()).summary).toBe("Selecione outras fotos na tira (Ctrl+clique ou Shift+clique) para sincronizar.");
    const mask = { id: "m", type: "radial", adjust: { ...DEFAULT_ADJUST, exposição: 4 } };
    const source = { a: { adjust: { ...DEFAULT_ADJUST, contraste: 7 }, profile: "Monocromático", masks: [mask] }, b: { rating: 2 } };
    const result = runMMLightTool("catalog.sync", state({ photos: source, pickedIds: ["b", "c"] }));
    expect(result).toMatchObject({ ok: true, count: 2, summary: "Ajustes de Praia.jpg sincronizados com 2 foto(s)" });
    expect(result.photos.b).toEqual({ rating: 2, adjust: source.a.adjust, profile: "Monocromático", masks: [mask] });
    expect(result.photos.c.masks[0]).not.toBe(mask);
    const plain = runMMLightTool("catalog.sync", state({ pickedIds: ["b"] }));
    expect(plain.photos.b).toEqual({ adjust: BASE, profile: "Adobe Color", masks: [] });
  });
});
