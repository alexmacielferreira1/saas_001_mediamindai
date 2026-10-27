import { describe, expect, it, vi } from "vitest";
import { LOOKS, TRANSITIONS } from "../../lib/mmfilmLooks";
import { MOTION_CATEGORIES, MOTION_PRESETS } from "../../lib/mmfilmMotionPresets";
import { TEXT_ANIMATIONS, TEXT_ANIMATION_GROUPS } from "../../lib/mmfilmTextAnimation";
import { TEXT_ANIMATION_OPTIONS } from "./mmfilmMcpMotionTools";
import { mmfilmCatalogue, runMMFilmTool } from "./mmfilmMcpTools";

const clip = (id, track, start, duration, extra = {}) => ({
  id,
  name: id,
  track,
  type: track.startsWith("A") ? "audio/wav" : "video/mp4",
  url: id,
  start,
  duration,
  sourceIn: 0,
  speed: 100,
  volume: 100,
  keyframes: [],
  ...extra,
});
const title = (id, track, start, duration, extra = {}) => clip(id, track, start, duration, { type: "text/title", text: id, ...extra });
const state = (clips, extra = {}) => ({ clips, markers: [], selectedIds: [], trackState: {}, media: [], ...extra });
const run = (id, current, params) => runMMFilmTool(id, current, params, {});
const byId = (result, id) => result.clips.find((item) => item.id === id);
const slug = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
const NO_SELECTION = "Selecione um ou mais clipes de vídeo, imagem ou título (faixas V desbloqueadas) na timeline.";

describe("catálogo de movimento", () => {
  it("cria uma ferramenta por categoria de motion preset e por grupo de animação de texto", () => {
    const ids = mmfilmCatalogue({}).tools.map((tool) => tool.id);
    MOTION_CATEGORIES.forEach((category) => expect(ids).toContain(`motionpreset.${slug(category)}`));
    TEXT_ANIMATION_GROUPS.forEach((group) => expect(ids).toContain(`textanim.${slug(group)}`));
    ["motion.motionblur", "motion.escala", "motion.centralizar", "motion.clonestyle", "textanim.remove", "packs.transition", "packs.notransition", "packs.look", "packs.nolook", "packs.opening", "packs.credits"].forEach((id) =>
      expect(ids).toContain(id),
    );
    expect(TEXT_ANIMATION_OPTIONS).toHaveLength(TEXT_ANIMATIONS.length);
    expect(TEXT_ANIMATION_OPTIONS[0]).toEqual([TEXT_ANIMATIONS[0].id, `${TEXT_ANIMATIONS[0].group} · ${TEXT_ANIMATIONS[0].name}`]);
  });

  it("categoria e grupo sem ícone próprio recebem o ícone padrão", async () => {
    vi.resetModules();
    vi.doMock("../../lib/mmfilmMotionPresets", async (importOriginal) => {
      const original = await importOriginal();
      return { ...original, MOTION_PRESETS: [...original.MOTION_PRESETS, { id: "novo", name: "Novo", category: "Nova", kinds: ["in"], curves: {} }], MOTION_CATEGORIES: [...original.MOTION_CATEGORIES, "Nova"] };
    });
    vi.doMock("../../lib/mmfilmTextAnimation", async (importOriginal) => {
      const original = await importOriginal();
      return { ...original, TEXT_ANIMATIONS: [...original.TEXT_ANIMATIONS, { ...original.TEXT_ANIMATIONS[0], id: "extra", group: "Extra" }], TEXT_ANIMATION_GROUPS: [...original.TEXT_ANIMATION_GROUPS, "Extra"] };
    });
    const { mmfilmMotionTools } = await import("./mmfilmMcpMotionTools");
    const { Box, Sparkle } = await import("lucide-react");
    const tools = mmfilmMotionTools({ VIDEO_TRACKS: [], captionTemplateOptions: () => [] });
    expect(tools.find((tool) => tool.id === "motionpreset.nova").icon).toBe(Box);
    expect(tools.find((tool) => tool.id === "textanim.extra").icon).toBe(Sparkle);
    vi.doUnmock("../../lib/mmfilmMotionPresets");
    vi.doUnmock("../../lib/mmfilmTextAnimation");
    vi.resetModules();
  });
});

describe("movimentos rápidos", () => {
  it("sem seleção visual explica o erro (áudio, faixa bloqueada e nada selecionado)", async () => {
    const current = state([clip("a", "A1", 0, 2), clip("v", "V1", 0, 2)], { selectedIds: ["a", "v"], trackState: { V1: { locked: true } } });
    expect(await run("motion.motionblur", current)).toEqual({ ok: false, summary: NO_SELECTION });
    expect(await run("motion.escala", state([clip("v", "V1", 0, 2)]))).toEqual({ ok: false, summary: NO_SELECTION });
  });

  it("motion blur, pulso de escala e centralizar gravam motion no clipe e somam ao movimento existente", async () => {
    const current = state([clip("v", "V1", 0, 2, { x: 100, y: -50, motion: { scale: [[0, 1], [2, 1.2]] } }), clip("w", "V2", 0, 2)], { selectedIds: ["v"] });
    const blur = await run("motion.motionblur", current, { intensity: 5 });
    expect(blur).toMatchObject({ ok: true, count: 1, summary: "Motion blur aplicado em 1 clipe(s)" });
    expect(byId(blur, "v").motion.blur.length).toBeGreaterThan(0);
    expect(byId(blur, "v").motion.scale).toEqual([[0, 1], [2, 1.2]]);
    expect(byId(blur, "w")).toBe(current.clips[1]);

    const pulse = await run("motion.escala", current);
    expect(byId(pulse, "v").motion.scale.length).toBeGreaterThan(2);

    const center = await run("motion.centralizar", current);
    expect(center.summary).toBe("Centralizar aplicado em 1 clipe(s)");
    expect(byId(center, "v").motion.x.at(-1)[1]).toBe(-100);
    expect(byId(center, "v").motion.y.at(-1)[1]).toBe(50);
  });

  it("clipe sem duração não recebe movimento e não vira sucesso falso", async () => {
    const original = clip("v", "V1", 0, 0);
    const result = await run("motion.escala", state([original], { selectedIds: ["v"] }));
    expect(result).toEqual({ ok: false, summary: "Pulso de escala: nenhum dos clipes selecionados pode receber o movimento (sem duração ou já centralizado)." });
  });
});

describe("clonar estilo", () => {
  it("copia o estilo do clipe principal para os demais selecionados, ignorando faixas bloqueadas", async () => {
    const source = clip("ref", "V1", 0, 2, { name: "", opacity: 40, scale: 120, motion: { x: [[0, 0], [2, 100]] } });
    const current = state([source, clip("t1", "V2", 0, 4), clip("t2", "V3", 0, 4), clip("fora", "V1", 2, 2)], {
      selectedIds: ["t1", "ref", "t2"],
      primaryId: "ref",
      trackState: { V3: { locked: true } },
    });
    const result = await run("motion.clonestyle", current, { parts: ["opacity", "transform", "motion"], timing: "relative" });
    expect(result).toMatchObject({ ok: true, count: 1, summary: "Estilo de “clipe” clonado em 1 clipe(s)" });
    expect(byId(result, "t1")).toMatchObject({ opacity: 40, scale: 120, motion: { x: [[0, 0], [4, 100]] } });
    expect(byId(result, "t2")).toBe(current.clips[2]);
    expect(byId(result, "fora")).toBe(current.clips[3]);
  });

  it("sem primaryId usa o primeiro selecionado como referência", async () => {
    const current = state([clip("a", "V1", 0, 2, { name: "Ref", opacity: 10 }), clip("b", "V2", 0, 2)], { selectedIds: ["a", "b"] });
    const result = await run("motion.clonestyle", current);
    expect(result.summary).toBe("Estilo de “Ref” clonado em 1 clipe(s)");
    expect(byId(result, "b").opacity).toBe(10);
  });

  it("sem referência ou sem destinos explica o que selecionar", async () => {
    const message = "Selecione o clipe de referência e pelo menos mais um clipe para receber o estilo.";
    expect(await run("motion.clonestyle", state([clip("a", "V1", 0, 2)], { selectedIds: ["a"] }))).toEqual({ ok: false, summary: message });
    expect(await run("motion.clonestyle", state([clip("a", "V1", 0, 2)], { selectedIds: ["x", "a"] }))).toEqual({ ok: false, summary: message });
  });
});

describe("motion presets por categoria", () => {
  it("todas as categorias aplicam o primeiro preset por padrão", async () => {
    for (const category of MOTION_CATEGORIES) {
      const first = MOTION_PRESETS.find((item) => item.category === category);
      const result = await run(`motionpreset.${slug(category)}`, state([clip("v", "V1", 0, 3)], { selectedIds: ["v"] }));
      expect(result.ok).toBe(true);
      expect(result.summary).toBe(`“${first.name}” (entrada) em 1 clipe(s)`);
      expect(byId(result, "v").motion).toBeTruthy();
    }
  });

  it("entrada, saída e ambos; somar ou substituir o movimento; preset desconhecido cai no primeiro", async () => {
    const tool = `motionpreset.${slug("Zoom")}`;
    const base = clip("v", "V1", 0, 4, { motion: { scale: [[0, 1], [4, 1.5]], glitch: [[0, 1], [4, 0]] } });
    const current = state([base], { selectedIds: ["v"] });

    const out = await run(tool, current, { preset: "zoom-afastar", kind: "out", length: 1, keep: true });
    expect(out.summary).toBe("“Zoom recuando” (saída) em 1 clipe(s)");
    expect(byId(out, "v").motion.glitch).toEqual([[0, 1], [4, 0]]);

    const both = await run(tool, current, { preset: "zoom-entrar", kind: "both", length: 1, keep: false });
    expect(both.summary).toBe("“Zoom chegando” (entrada e saída) em 1 clipe(s)");
    expect(byId(both, "v").motion.glitch).toBeUndefined();
    expect(byId(both, "v").motion.scale[0][0]).toBe(0);
    expect(byId(both, "v").motion.scale.at(-1)[0]).toBe(4);

    const fallback = await run(tool, current, { preset: "nao-existe", kind: "in" });
    expect(fallback.summary).toBe("“Zoom chegando” (entrada) em 1 clipe(s)");
  });

  it("sem seleção visual devolve o erro", async () => {
    expect(await run(`motionpreset.${slug(MOTION_CATEGORIES[0])}`, state([title("t", "A1", 0, 2)], { selectedIds: ["t"] }))).toEqual({ ok: false, summary: NO_SELECTION });
  });
});

describe("animação de texto", () => {
  it("cada grupo grava o primeiro preset nos títulos selecionados e desbloqueados", async () => {
    for (const group of TEXT_ANIMATION_GROUPS) {
      const first = TEXT_ANIMATIONS.find((item) => item.group === group);
      const current = state([title("t", "V2", 0, 2), title("preso", "V3", 0, 2), clip("v", "V1", 0, 2)], { selectedIds: ["t", "preso", "v"], trackState: { V3: { locked: true } } });
      const result = await run(`textanim.${slug(group)}`, current);
      expect(result).toMatchObject({ ok: true, count: 1, summary: `Animação “${first.name}” em 1 texto(s)` });
      expect(byId(result, "t").textAnimation).toBe(first.id);
      expect(byId(result, "preso").textAnimation).toBeUndefined();
      expect(byId(result, "v").textAnimation).toBeUndefined();
    }
  });

  it("preset escolhido é usado e desconhecido cai no primeiro do grupo", async () => {
    const group = TEXT_ANIMATION_GROUPS[0];
    const presets = TEXT_ANIMATIONS.filter((item) => item.group === group);
    const current = state([title("t", "V2", 0, 2)], { selectedIds: ["t"] });
    expect(byId(await run(`textanim.${slug(group)}`, current, { preset: presets[1].id }), "t").textAnimation).toBe(presets[1].id);
    expect(byId(await run(`textanim.${slug(group)}`, current, { preset: "x" }), "t").textAnimation).toBe(presets[0].id);
  });

  it("sem título selecionado explica o erro", async () => {
    expect(await run(`textanim.${slug(TEXT_ANIMATION_GROUPS[0])}`, state([clip("v", "V1", 0, 2)], { selectedIds: ["v"] }))).toEqual({
      ok: false,
      summary: "Selecione na timeline um ou mais títulos ou legendas.",
    });
  });

  it("remover animação tira só dos textos selecionados e desbloqueados", async () => {
    const current = state([title("a", "V2", 0, 2, { textAnimation: "aparecer" }), title("b", "V3", 0, 2, { textAnimation: "aparecer" }), title("c", "V2", 2, 2)], {
      selectedIds: ["a", "b", "c"],
      trackState: { V3: { locked: true } },
    });
    const result = await run("textanim.remove", current);
    expect(result).toMatchObject({ ok: true, count: 1, summary: "Animação removida de 1 texto(s)" });
    expect(byId(result, "a").textAnimation).toBeUndefined();
    expect(byId(result, "b").textAnimation).toBe("aparecer");
    expect(await run("textanim.remove", state([title("c", "V2", 0, 2)], { selectedIds: ["c"] }))).toEqual({ ok: true, count: 0, summary: "Os textos selecionados não têm animação." });
  });
});

describe("packs: transições", () => {
  const cuts = (extra) =>
    state([clip("a", "V1", 0, 2), clip("b", "V1", 2, 2), clip("c", "V1", 4, 2), clip("off", "V1", 6, 2, { enabled: false }), clip("gap", "V1", 9, 1), clip("v2", "V2", 2, 2)], extra);

  it("aplica em todos os cortes encostados da faixa (clipes desligados e com espaço ficam de fora)", async () => {
    const result = await run("packs.transition", cuts(), { transition: "mergulho-preto", duration: 0.8 });
    const name = TRANSITIONS.find((item) => item.id === "mergulho-preto").name;
    expect(result).toMatchObject({ ok: true, count: 2, summary: `“${name}” em 2 corte(s) de V1` });
    expect(byId(result, "b").transition).toEqual({ id: "mergulho-preto", duration: 0.8 });
    expect(byId(result, "c").transition).toEqual({ id: "mergulho-preto", duration: 0.8 });
    expect(byId(result, "a").transition).toBeUndefined();
    expect(byId(result, "gap").transition).toBeUndefined();
    expect(byId(result, "v2").transition).toBeUndefined();
  });

  it("só nos selecionados: o clipe que entra ou o que sai precisa estar selecionado", async () => {
    const result = await run("packs.transition", cuts({ selectedIds: ["c"] }), { onlySelected: true });
    expect(result.count).toBe(1);
    expect(byId(result, "c").transition.id).toBe("dissolver");
    const previous = await run("packs.transition", cuts({ selectedIds: ["a"] }), { onlySelected: true });
    expect(byId(previous, "b").transition.id).toBe("dissolver");
  });

  it("sem cortes, com só selecionados, ou faixa bloqueada explica o erro", async () => {
    expect(await run("packs.transition", state([clip("a", "V1", 0, 1)]))).toEqual({ ok: false, summary: "Nenhum corte (dois clipes encostados) em V1." });
    expect(await run("packs.transition", cuts({ selectedIds: ["v2"] }), { onlySelected: true })).toEqual({
      ok: false,
      summary: "Nenhum corte (dois clipes encostados) em V1 entre os selecionados.",
    });
    expect(await run("packs.transition", cuts({ trackState: { V1: { locked: true } } }))).toEqual({ ok: false, summary: "A faixa V1 está bloqueada." });
  });

  it("remover transições limpa a faixa; sem transições não muda nada", async () => {
    const current = state([clip("a", "V1", 0, 2), clip("b", "V1", 2, 2, { transition: { id: "dissolver", duration: 0.5 } }), clip("c", "V2", 2, 2, { transition: "Dissolver" })]);
    const result = await run("packs.notransition", current);
    expect(result).toMatchObject({ ok: true, count: 1, summary: "1 transição(ões) removida(s)" });
    expect(byId(result, "b").transition).toBeUndefined();
    expect(byId(result, "c").transition).toBe("Dissolver");
    expect(await run("packs.notransition", current, { track: "V3" })).toEqual({ ok: true, count: 0, summary: "Nenhuma transição em V3." });
    expect(await run("packs.notransition", { ...current, trackState: { V1: { locked: true } } })).toEqual({ ok: true, count: 0, summary: "Nenhuma transição em V1." });
  });
});

describe("packs: looks", () => {
  it("aplica o look nos selecionados com a intensidade escolhida", async () => {
    const current = state([clip("a", "V1", 0, 2), clip("b", "V2", 0, 2)], { selectedIds: ["b"] });
    const result = await run("packs.look", current, { intensity: 50 });
    expect(result).toMatchObject({ ok: true, count: 1, summary: `Look “${LOOKS[0].name}” (50%) em 1 clipe(s)` });
    expect(byId(result, "b").look).toMatchObject({ id: LOOKS[0].id, intensity: 50 });
    expect(byId(result, "a").look).toBeUndefined();
  });

  it("escopo faixa usa todos os vídeos de V1 (sem títulos e áudio)", async () => {
    const current = state([clip("a", "V1", 0, 2), clip("b", "V1", 2, 2), title("t", "V1", 4, 1), clip("s", "V1", 5, 1, { type: "audio/wav" }), clip("x", "V2", 0, 1)]);
    const result = await run("packs.look", current, { scope: "track", look: LOOKS[1].id });
    expect(result.count).toBe(2);
    expect(byId(result, "b").look.id).toBe(LOOKS[1].id);
    expect(byId(result, "t").look).toBeUndefined();
    expect(byId(result, "s").look).toBeUndefined();
    expect(byId(result, "x").look).toBeUndefined();
  });

  it("escopo faixa sem clipes (ou V1 bloqueada) e seleção vazia explicam o erro", async () => {
    expect(await run("packs.look", state([clip("x", "V2", 0, 1)]), { scope: "track" })).toEqual({ ok: false, summary: "Nenhum clipe de vídeo em V1." });
    expect(await run("packs.look", state([clip("a", "V1", 0, 1)], { trackState: { V1: { locked: true } } }), { scope: "track" })).toEqual({
      ok: false,
      summary: "Nenhum clipe de vídeo em V1.",
    });
    expect(await run("packs.look", state([clip("a", "V1", 0, 1)]))).toEqual({ ok: false, summary: NO_SELECTION });
  });

  it("remover look mantém os ajustes manuais; sem look não muda nada", async () => {
    const current = state([clip("a", "V1", 0, 2, { contrast: 5 }), clip("b", "V1", 2, 2)], { selectedIds: ["a", "b"] });
    const looked = await run("packs.look", current, { look: "cinema-quente" });
    const removed = await run("packs.nolook", { ...current, clips: looked.clips });
    expect(removed).toMatchObject({ ok: true, count: 2, summary: "Look removido de 2 clipe(s)" });
    expect(byId(removed, "a").look).toBeUndefined();
    expect(byId(removed, "a").contrast).toBe(5);
    expect(await run("packs.nolook", current)).toEqual({ ok: true, count: 0, summary: "Os clipes selecionados não têm look." });
    expect(await run("packs.nolook", state([clip("a", "V1", 0, 1)]))).toEqual({ ok: false, summary: NO_SELECTION });
  });
});

describe("packs: abertura e créditos", () => {
  it("abertura cria o título no começo, com animação e estilo centralizado", async () => {
    const current = state([clip("v", "V1", 0, 5)]);
    const result = await run("packs.opening", current);
    expect(result).toMatchObject({ ok: true, count: 1, summary: "Título de abertura criado em V2" });
    const created = result.clips.at(-1);
    expect(created).toMatchObject({ type: "text/title", track: "V2", start: 0, duration: 3, text: "TÍTULO DO VÍDEO", name: "TÍTULO DO VÍDEO", textAnimation: "espacamento-in" });
    expect(created.captionStyle.position).toBe("center");
    expect(created.id).toMatch(/^pack-/);
  });

  it("créditos vão para o fim da sequência; nome é a primeira linha e “nenhuma” tira a animação", async () => {
    const current = state([clip("v", "V1", 0, 5), clip("w", "V2", 1, 6)]);
    const result = await run("packs.credits", current, { text: "  Direção\nEdição  ", animation: "nenhuma", track: "V3" });
    expect(result.summary).toBe("Créditos criados no fim da sequência (V3)");
    const created = result.clips.at(-1);
    expect(created).toMatchObject({ start: 7, duration: 6, track: "V3", name: "Direção", text: "Direção\nEdição" });
    expect(created.textAnimation).toBeUndefined();
    const empty = await run("packs.credits", state([]));
    expect(empty.clips.at(-1)).toMatchObject({ start: 0, textAnimation: "subir-palavras" });
  });

  it("texto vazio, faixa bloqueada e faixa ocupada explicam o erro", async () => {
    const current = state([clip("v", "V1", 0, 5), title("t", "V2", 1, 2)]);
    expect(await run("packs.opening", current, { text: "   " })).toEqual({ ok: false, summary: "Escreva o texto." });
    expect(await run("packs.credits", current, { text: null })).toEqual({ ok: false, summary: "Escreva o texto." });
    expect(await run("packs.opening", { ...current, trackState: { V2: { locked: true } } })).toEqual({ ok: false, summary: "A faixa V2 está bloqueada." });
    expect(await run("packs.opening", current)).toEqual({ ok: false, summary: "A faixa V2 já tem conteúdo nesse trecho. Escolha outra faixa." });
    expect((await run("packs.opening", current, { track: "V3" })).ok).toBe(true);
  });
});
