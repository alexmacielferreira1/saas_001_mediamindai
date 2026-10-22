import { describe, expect, it } from "vitest";
import { MMPHOTO_TABS, applyMaskResampled, autoContrast, autoLevels, grayWorld, mmphotoCatalogue, planVariants, removeFlatBackground, runMMPhotoTool } from "./mmphotoMcpTools";

const layer = (id, extra = {}) => ({ id, name: id, kind: "▧", visible: true, locked: false, opacity: 100, blendMode: "normal", transform: { x: 0, y: 0, scale: 100, rotation: 0 }, ...extra });
const state = (extra = {}) => ({
  layers: [layer("adjust", { name: "Curvas 1", kind: "◐" }), layer("subject", { name: "Pessoa" }), layer("background", { name: "Plano de fundo", locked: true })],
  activeLayer: "subject",
  docSize: { w: 1200, h: 800 },
  selection: null,
  colors: { fg: "#ff0000", bg: "#0000ff" },
  ...extra,
});
const env = { newId: () => "novo" };
const run = (id, current, params) => runMMPhotoTool(id, current, params, env);
const pixels = (count) => new Uint8ClampedArray(count * 4).fill(100);

describe("catálogo do MMPhoto", () => {
  it("lista as abas e ferramentas com ícone, descrição e parâmetros", () => {
    const catalogue = mmphotoCatalogue();
    expect(catalogue.tabs).toBe(MMPHOTO_TABS);
    expect(catalogue.tools.map((tool) => tool.tab)).toEqual(expect.arrayContaining(MMPHOTO_TABS.map((tab) => tab.id)));
    for (const tool of catalogue.tools) {
      expect(tool).toMatchObject({ id: expect.any(String), label: expect.any(String), description: expect.any(String), params: expect.any(Array) });
      expect(tool.icon).toBeTruthy();
    }
    expect(new Set(catalogue.tools.map((tool) => tool.id)).size).toBe(catalogue.tools.length);
  });

  it("ferramenta desconhecida não executa nada", () => {
    expect(run("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
  });

  it("erros inesperados sobem para quem chamou", () => {
    expect(() => run("layer.opacity", { ...state(), layers: null })).toThrow(TypeError);
  });

  it("usa crypto.randomUUID quando o ambiente não informa o gerador de id", () => {
    const result = runMMPhotoTool("adjust.bw", state());
    expect(result.activeLayer).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("ajustes", () => {
  it("cria camada de ajuste acima da ativa com a intensidade como opacidade", () => {
    const result = run("adjust.bw", state(), { intensity: 40 });
    expect(result).toMatchObject({ ok: true, count: 1, label: "Camada de ajuste P&B", activeLayer: "novo" });
    expect(result.layers.map((item) => item.id)).toEqual(["adjust", "novo", "subject", "background"]);
    expect(result.layers[1]).toMatchObject({ name: "P&B 1", type: "adjustment", opacity: 40, adjustment: { name: "P&B", ops: [["grayscale", 1]] } });
    expect(result.summary).toBe('Camada de ajuste "P&B 1" (40%) criada: afeta todas as camadas abaixo');
  });

  it("numera ajustes repetidos e vai para o topo sem camada ativa", () => {
    const current = state({ activeLayer: "sumiu", layers: [layer("x", { adjustment: { name: "Inverter" } }), layer("subject")] });
    const result = run("adjust.invert", current);
    expect(result.layers[0]).toMatchObject({ id: "novo", name: "Inverter 2", opacity: 100 });
  });

  it("remove todas as camadas de ajuste e troca a ativa se ela saiu", () => {
    const withAdjust = run("adjust.vintage", state());
    const result = run("adjust.clear", { ...state(), layers: withAdjust.layers, activeLayer: "novo" });
    expect(result).toMatchObject({ ok: true, count: 2, activeLayer: "subject", details: ["Curvas 1", "Mapa grad. 1"] });
    expect(result.layers.map((item) => item.id)).toEqual(["subject", "background"]);
    expect(run("adjust.clear", state()).activeLayer).toBeUndefined();
    expect(run("adjust.clear", { ...state(), layers: [layer("adjust", { type: "adjustment" })], activeLayer: "adjust" }).activeLayer).toBe("");
  });

  it("sem camadas de ajuste não finge remover", () => {
    expect(run("adjust.clear", { ...state(), layers: [layer("subject")] })).toEqual({ ok: false, summary: "O documento não tem camadas de ajuste para remover." });
  });
});

describe("filtros de pixels", () => {
  it("planejam a operação na camada ativa com a área da seleção", () => {
    const blur = run("filter.blur", state(), { radius: 2 });
    expect(blur).toMatchObject({ ok: true, label: "Desfoque", summary: 'Desfoque (raio 2 px) em "Pessoa" · camada inteira' });
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
    blur.pixels(data, 3, 1);
    expect(data[4]).toBeLessThan(255);

    const selection = { type: "rect", rect: { x: 0, y: 0, w: 10.4, h: 20 } };
    expect(run("filter.sharpen", state({ selection })).summary).toBe('Nitidez (quantidade 0,6) em "Pessoa" · seleção 10 × 20 px');
    const sharp = pixels(9);
    run("filter.sharpen", state(), { amount: 1 }).pixels(sharp, 3, 3);
    expect(sharp[0]).toBe(100);

    const noisy = pixels(4);
    run("filter.noise", state(), { amount: 80 }).pixels(noisy, 2, 2);
    expect([...noisy].some((value, index) => index % 4 !== 3 && value !== 100)).toBe(true);

    const mosaic = new Uint8ClampedArray([0, 0, 0, 255, 200, 200, 200, 255]);
    run("filter.pixelate", state(), { size: 2 }).pixels(mosaic, 2, 1);
    expect(mosaic[0]).toBe(mosaic[4]);

    const clouds = pixels(4);
    const cloudPlan = run("filter.clouds", state());
    expect(cloudPlan.summary).toContain("primeiro plano e fundo");
    cloudPlan.pixels(clouds, 2, 2);
    expect(clouds[1]).toBe(0);
  });

  it("recusam camada de ajuste, oculta ou inexistente", () => {
    expect(run("filter.blur", state({ activeLayer: "adjust" }))).toEqual({ ok: false, summary: "Camadas de ajuste não têm pixels. Selecione uma camada de imagem." });
    expect(run("filter.blur", { ...state(), layers: [layer("subject", { visible: false })] }).summary).toBe("A camada está oculta. Mostre a camada para editá-la.");
    expect(run("filter.blur", state({ activeLayer: "" })).summary).toMatch(/Nenhuma camada ativa/);
  });
});

describe("seleção", () => {
  const selection = { type: "polygon", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }] };

  it("preenche com a cor escolhida e a opacidade", () => {
    const fg = run("selection.fill", state({ selection }), { opacity: 50 });
    expect(fg.summary).toBe('Preencher (#ff0000 · 50%) em "Pessoa" · seleção 4 × 3 px');
    const data = pixels(1);
    fg.pixels(data, 1, 1);
    expect([...data]).toEqual([255, 0, 0, 128]);
    const bg = pixels(1);
    run("selection.fill", state({ selection }), { color: "bg" }).pixels(bg, 1, 1);
    expect([...bg]).toEqual([0, 0, 255, 255]);
  });

  it("limpa os pixels da seleção (fica transparente)", () => {
    const data = pixels(2);
    run("selection.clear", state({ selection: { type: "mask", bounds: { x: 1, y: 1, w: 2, h: 2 } } })).pixels(data, 2, 1);
    expect([...data]).toEqual([100, 100, 100, 0, 100, 100, 100, 0]);
  });

  it("sem seleção explica o que falta", () => {
    expect(run("selection.fill", state()).summary).toMatch(/Faça uma seleção/);
    expect(run("selection.clear", state()).summary).toBe("Faça uma seleção para limpar os pixels.");
  });

  it("seleção por máscara sem limites usa a camada inteira no resumo", () => {
    expect(run("selection.clear", state({ selection: { type: "mask" } })).summary).toContain("camada inteira");
  });
});

describe("camadas", () => {
  it("liga e desliga a sombra projetada sem repetir o estado atual", () => {
    const on = run("layer.shadow", state());
    expect(on).toMatchObject({ ok: true, label: "Estilo: sombra projetada", summary: 'Sombra projetada aplicada em "Pessoa"' });
    expect(on.layers[1].fx).toEqual({ shadow: true });
    const shadowed = { ...state(), layers: on.layers };
    expect(run("layer.shadow", shadowed)).toEqual({ ok: false, summary: '"Pessoa" já tem sombra projetada.' });
    const off = run("layer.shadow", shadowed, { mode: "off" });
    expect(off).toMatchObject({ ok: true, label: "Remover estilo", summary: 'Sombra projetada removida de "Pessoa"' });
    expect(off.layers[1].fx).toEqual({ shadow: false });
    expect(run("layer.shadow", state(), { mode: "off" })).toEqual({ ok: false, summary: '"Pessoa" não tem sombra projetada.' });
    expect(run("layer.shadow", state({ activeLayer: "adjust" })).summary).toMatch(/camadas de ajuste não recebem estilo/);
  });

  it("muda opacidade e mesclagem da camada ativa", () => {
    const fade = run("layer.opacity", state(), { opacity: 35 });
    expect(fade.summary).toBe('Opacidade de "Pessoa": 100% → 35%');
    expect(fade.layers[1].opacity).toBe(35);
    expect(run("layer.opacity", { ...state(), layers: [layer("subject", { opacity: undefined })] }).summary).toBe('Opacidade de "subject": 100% → 50%');
    const mix = run("layer.blend", state(), { mode: "screen" });
    expect(mix).toMatchObject({ summary: 'Mesclagem de "Pessoa": Tela' });
    expect(mix.layers[1].blendMode).toBe("screen");
    expect(run("layer.blend", state(), { mode: "lighten" }).summary).toBe('Mesclagem de "Pessoa": lighten');
  });

  it("mostra camadas ocultas ou avisa que já estão visíveis", () => {
    const hidden = { ...state(), layers: [layer("a", { visible: false }), layer("b")] };
    const result = run("layer.showall", hidden);
    expect(result).toMatchObject({ ok: true, count: 1, details: ["a"] });
    expect(result.layers.every((item) => item.visible)).toBe(true);
    expect(run("layer.showall", state())).toEqual({ ok: false, summary: "Todas as camadas já estão visíveis." });
  });
});

describe("documento", () => {
  it("gira trocando largura e altura (exceto 180°)", () => {
    expect(run("doc.rotate", state())).toMatchObject({ summary: "Rotação da imagem 90°: 1200 × 800 → 800 × 1200 px", document: { kind: "rotate", angle: 90 } });
    expect(run("doc.rotate", state(), { angle: "180" }).summary).toBe("Rotação da imagem 180°: 1200 × 800 → 1200 × 800 px");
  });

  it("redimensiona em porcentagem dentro dos limites", () => {
    expect(run("doc.resize", state())).toMatchObject({ summary: "Tamanho da imagem 50%: 1200 × 800 → 600 × 400 px", document: { kind: "resize", width: 600 } });
    expect(run("doc.resize", state(), { percent: 100 })).toEqual({ ok: false, summary: "100% mantém o tamanho atual: escolha outra porcentagem." });
    expect(run("doc.resize", state({ docSize: { w: 5000, h: 10 } }), { percent: 400 }).summary).toMatch(/fora do limite/);
    expect(run("doc.resize", state({ docSize: { w: 1, h: 1 } }), { percent: 10 }).summary).toMatch(/fora do limite/);
  });

  it("recorta no retângulo da seleção limitado ao documento", () => {
    const selection = { type: "rect", rect: { x: -10, y: 100, w: 300, h: 200 } };
    expect(run("doc.crop", state({ selection }))).toMatchObject({ summary: "Recortar na seleção: 1200 × 800 → 290 × 200 px", document: { kind: "crop", rect: { x: 0, y: 100, w: 290, h: 200 } } });
    expect(run("doc.crop", state()).summary).toBe("Faça uma seleção para recortar o documento nela.");
    expect(run("doc.crop", state({ selection: { type: "rect", rect: { x: 5000, y: 0, w: 10, h: 10 } } })).summary).toMatch(/fora do documento/);
  });
});

const rgba = (...pixels) => new Uint8ClampedArray(pixels.flat());

describe("ajustes automáticos", () => {
  it("auto contraste estica a luminância igual nos três canais e ignora transparentes", () => {
    const data = rgba([100, 100, 100, 255], [150, 150, 150, 255], [0, 0, 0, 0]);
    expect(autoContrast(data, 0)).toBe(true);
    expect([...data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0]);
    expect(autoContrast(rgba([0, 0, 0, 255], [255, 255, 255, 255]), 0)).toBe(false);
    expect(autoContrast(rgba([90, 90, 90, 255], [91, 91, 91, 255]), 0)).toBe(false);
    expect(autoContrast(rgba([9, 9, 9, 0]))).toBe(false);
    const clipped = rgba(...Array.from({ length: 200 }, (_, i) => [100 + (i % 50), 100 + (i % 50), 100 + (i % 50), 255]));
    expect(autoContrast(clipped)).toBe(true);
  });

  it("auto nível estica cada canal separadamente", () => {
    const data = rgba([50, 0, 10, 255], [100, 255, 20, 255]);
    expect(autoLevels(data, 0)).toBe(true);
    expect([...data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
    expect(autoLevels(rgba([0, 0, 0, 255], [255, 255, 255, 255]), 0)).toBe(false);
    expect(autoLevels(rgba([1, 1, 1, 0]))).toBe(false);
  });

  it("balanço de branco iguala as médias dos canais, com intensidade", () => {
    const warm = rgba([200, 100, 100, 255]);
    expect(grayWorld(warm)).toBe(true);
    expect([...warm]).toEqual([133, 133, 133, 255]);
    const half = rgba([200, 100, 100, 255]);
    grayWorld(half, 0.5);
    expect(half[0]).toBe(167);
    expect(grayWorld(rgba([80, 80, 80, 255]))).toBe(false);
    expect(grayWorld(rgba([0, 50, 50, 255]))).toBe(false);
    expect(grayWorld(rgba([5, 5, 5, 0]))).toBe(false);
  });

  it("ferramentas automáticas planejam na camada ativa e avisam quando não há o que corrigir", () => {
    for (const id of ["auto.contrast", "auto.levels", "auto.white", "auto.fix"]) {
      const plan = run(id, state());
      expect(plan).toMatchObject({ ok: true, count: 1 });
      const flat = rgba([90, 90, 90, 255]);
      expect(() => plan.pixels(flat, 1, 1)).toThrow(/nada a corrigir/);
    }
    const data = rgba([200, 100, 100, 255], [100, 50, 50, 255]);
    run("auto.fix", state()).pixels(data, 2, 1);
    expect(data[0]).toBe(data[1]);
    const levels = rgba([50, 0, 10, 255], [100, 255, 20, 255]);
    run("auto.levels", state()).pixels(levels, 2, 1);
    expect(levels[0]).toBe(0);
    const contrast = rgba([100, 100, 100, 255], [150, 150, 150, 255]);
    run("auto.contrast", state()).pixels(contrast, 2, 1);
    expect(contrast[4]).toBe(255);
    const white = rgba([200, 100, 100, 255]);
    run("auto.white", state(), { strength: 100 }).pixels(white, 1, 1);
    expect(white[0]).toBe(133);
    expect(run("auto.white", state()).summary).toBe('Balanço de branco (100%) em "Pessoa" · camada inteira');
  });
});

describe("camadas · duplicar e centralizar", () => {
  it("duplica a camada ativa acima dela; o fundo sem pixels vai para o app rasterizar", () => {
    const result = run("layer.duplicate", state());
    expect(result).toMatchObject({ ok: true, activeLayer: "novo", summary: '"Pessoa" duplicado' });
    expect(result.layers.map((item) => item.id)).toEqual(["adjust", "novo", "subject", "background"]);
    expect(result.layers[1]).toMatchObject({ name: "Pessoa cópia", locked: false });
    expect(run("layer.duplicate", state({ activeLayer: "background" }))).toMatchObject({ ok: true, duplicateBackground: true });
    const withPixels = { ...state({ activeLayer: "background" }), layers: [layer("background", { name: "Fundo", bitmap: "data:x", locked: true })] };
    expect(run("layer.duplicate", withPixels).layers[0]).toMatchObject({ id: "novo", type: "raster", bitmap: "data:x", locked: false });
  });

  it("centraliza ou redefine a transformação, sem repetir", () => {
    const moved = { ...state(), layers: [layer("subject", { name: "Pessoa", transform: { x: 30, y: -5, scale: 150, rotation: 10 } })] };
    expect(run("layer.center", moved).layers[0].transform).toEqual({ x: 0, y: 0, scale: 150, rotation: 10 });
    const reset = run("layer.center", moved, { mode: "reset" });
    expect(reset).toMatchObject({ label: "Redefinir transformação", summary: 'Transformação de "Pessoa" redefinida' });
    expect(reset.layers[0].transform).toEqual({ x: 0, y: 0, scale: 100, rotation: 0 });
    expect(run("layer.center", state())).toEqual({ ok: false, summary: '"Pessoa" já está centralizada.' });
    expect(run("layer.center", state(), { mode: "reset" })).toEqual({ ok: false, summary: '"Pessoa" já está sem transformação.' });
    expect(run("layer.center", { ...state(), layers: [layer("subject", { transform: undefined })] }).ok).toBe(false);
  });
});

describe("documento · formato de redes sociais", () => {
  it("recorta no maior retângulo do formato, no centro, início ou fim", () => {
    expect(run("doc.social", state())).toMatchObject({ summary: "Quadrado 1:1 (feed): 1200 × 800 → 800 × 800 px", document: { kind: "crop", rect: { x: 200, y: 0, w: 800, h: 800 } } });
    expect(run("doc.social", state(), { format: "9:16", anchor: "start" }).document.rect).toEqual({ x: 0, y: 0, w: 450, h: 800 });
    expect(run("doc.social", state(), { format: "3:1", anchor: "end" }).document.rect).toEqual({ x: 0, y: 400, w: 1200, h: 400 });
    expect(run("doc.social", state({ docSize: { w: 1600, h: 900 } }), { format: "16:9" })).toEqual({ ok: false, summary: "O documento já está no formato 16:9." });
  });
});

// Imagem w×h com fundo (bg) e um quadrado central (fg) de lado `size`.
function scene(w, h, bg, fg, size) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const inside = Math.abs(x - (w - 1) / 2) < size / 2 && Math.abs(y - (h - 1) / 2) < size / 2;
      data.set([...(inside ? fg : bg), 255], (y * w + x) * 4);
    }
  return data;
}
const alpha = (data) => [...data].filter((_, i) => i % 4 === 3);

describe("remover fundo", () => {
  it("fundo liso: apaga a cor da borda conectada e mantém o objeto", () => {
    const data = scene(10, 10, [250, 250, 250], [200, 20, 20], 4);
    expect(removeFlatBackground(data, 10, 10, 30, 0)).toBe(84);
    const a = alpha(data);
    expect(a[0]).toBe(0);
    expect(a[55]).toBe(255);
  });

  it("fundo liso: contorno suave em tons intermediários e não atravessa o objeto", () => {
    // Linha: fundo branco, pixel de transição, objeto escuro, fundo branco do outro lado do objeto (ilha fechada).
    const data = new Uint8ClampedArray([255, 255, 255, 255, 240, 240, 240, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
    expect(removeFlatBackground(data, 4, 1, 20, 1)).toBe(2);
    expect(alpha(data)).toEqual([0, 76, 255, 0]);
    const hollow = scene(5, 5, [255, 255, 255], [0, 0, 0], 3);
    hollow.set([255, 255, 255, 255], 12 * 4);
    removeFlatBackground(hollow, 5, 5, 10, 0);
    expect(alpha(hollow)[12]).toBe(255);
  });

  it("fundo liso: borda transparente ou cor diferente não apaga nada", () => {
    expect(removeFlatBackground(new Uint8ClampedArray(4 * 4), 2, 2)).toBe(0);
    const mixed = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 128, 0, 0, 0]);
    expect(removeFlatBackground(mixed, 2, 2, 10)).toBe(2);
  });

  it("aplica máscara de outro tamanho ao alfa (vizinho mais próximo)", () => {
    const data = new Uint8ClampedArray(4 * 4).fill(255);
    applyMaskResampled(data, 4, 1, { width: 2, height: 1, values: new Float32Array([0, 1]) });
    expect(alpha(data)).toEqual([0, 0, 255, 255]);
    const half = new Uint8ClampedArray([9, 9, 9, 200]);
    expect(alpha(applyMaskResampled(half, 1, 1, { width: 1, height: 1, values: [0.5] }))).toEqual([100]);
  });

  it("ferramentas de fundo planejam na camada ativa e explicam quando não dá", () => {
    const person = run("bg.person", state());
    expect(person).toMatchObject({ ok: true, segmentPerson: true, summary: 'Remover fundo (pessoa, IA local) em "Pessoa" · camada inteira' });
    expect(person.pixels).toBeUndefined();
    expect(run("bg.person", state({ activeLayer: "adjust" })).ok).toBe(false);

    const flat = run("bg.flat", state());
    expect(flat.summary).toBe('Remover fundo liso (tolerância 40) em "Pessoa" · camada inteira');
    const photo = scene(20, 20, [255, 255, 255], [10, 120, 10], 8);
    flat.pixels(photo, 20, 20);
    expect(alpha(photo)[0]).toBe(0);
    // Textura sem cor de fundo única: cada pixel muda bastante do vizinho.
    const noisy = new Uint8ClampedArray(40 * 40 * 4).map((_, i) => (i % 4 === 3 ? 255 : ((i >> 2) * 37) % 256));
    expect(() => run("bg.flat", state(), { tolerance: 5 }).pixels(noisy, 40, 40)).toThrow(/não achei um fundo/);
    expect(() => flat.pixels(scene(4, 4, [255, 255, 255], [255, 255, 255], 2), 4, 4)).toThrow(/imagem inteira parece ser fundo/);
  });
});

describe("exportar variações", () => {
  it("planeja recortes por formato, reduzindo até a largura máxima (nunca amplia)", () => {
    const files = planVariants({ w: 2000, h: 1000 }, { variants: ["original", "1:1", "9:16"], format: "jpg", maxWidth: 1080, anchor: "start" });
    expect(files).toEqual([
      { name: "original-1080x540.jpg", rect: { x: 0, y: 0, w: 2000, h: 1000 }, width: 1080, height: 540 },
      { name: "1x1-1000x1000.jpg", rect: { x: 0, y: 0, w: 1000, h: 1000 }, width: 1000, height: 1000 },
      { name: "9x16-562x999.jpg", rect: { x: 0, y: 0, w: 562, h: 999 }, width: 562, height: 999 },
    ]);
    expect(planVariants({ w: 100, h: 100 }, { variants: ["16:9"], format: "png", maxWidth: 400 })[0]).toMatchObject({ name: "16x9-100x56.png", rect: { x: 0, y: 22 } });
  });

  it("ferramenta lista os arquivos e exige ao menos uma variação", () => {
    const result = run("doc.export", state());
    expect(result).toMatchObject({ ok: true, count: 4, summary: "4 variação(ões) em JPG num arquivo .zip", exportZip: { format: "jpg" } });
    expect(result.details[0]).toBe("original-1080x720.jpg");
    expect(run("doc.export", state(), { variants: [] })).toEqual({ ok: false, summary: "Escolha ao menos uma variação para exportar." });
    expect(run("doc.export", state(), { variants: undefined }).ok).toBe(false);
  });
});

describe("recortar objeto (IA por ponto)", () => {
  it("usa o centro da seleção ou o ponto dos controles e explica o que vai manter", () => {
    const selection = { type: "rect", rect: { x: 300, y: 200, w: 600, h: 400 } };
    expect(run("bg.object", state({ selection }))).toMatchObject({
      ok: true,
      label: "Recortar objeto",
      summary: 'Recortar objeto (fundo transparente) em "Pessoa" · IA local · centro da seleção',
      segmentObject: { x: 0.5, y: 0.5, keepObject: true },
    });
    const manual = run("bg.object", state({ selection }), { useSelection: false, x: 25, y: 100, keep: "background" });
    expect(manual).toMatchObject({ label: "Apagar objeto", summary: 'Apagar objeto em "Pessoa" · IA local · ponto 25% × 100%', segmentObject: { x: 0.25, y: 0.999, keepObject: false } });
    expect(run("bg.object", state()).segmentObject).toEqual({ x: 0.5, y: 0.5, keepObject: true });
    expect(run("bg.object", state(), { x: -5 }).segmentObject.x).toBe(0);
    expect(run("bg.object", state({ activeLayer: "adjust" })).ok).toBe(false);
  });
});
