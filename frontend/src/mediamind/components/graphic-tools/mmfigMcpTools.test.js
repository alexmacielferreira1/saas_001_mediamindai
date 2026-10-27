import { describe, expect, it } from "vitest";
import { baseNode, createDocument } from "./FigCraftWorkspace";
import { MMFIG_TABS, mmfigCatalogue, runMMFigTool, usedColors } from "./mmfigMcpTools";

// Documento de teste: camadas soltas na página ou dentro de frames/grupos (coordenadas locais ao pai).
function setup() {
  const doc = createDocument();
  const pageId = doc.pages[0].id;
  const add = (type, props = {}, parentId = null) => {
    const node = baseNode(type, props);
    doc.nodes[node.id] = node;
    node.parentId = parentId;
    if (parentId) doc.nodes[parentId].children.push(node.id);
    else doc.roots[pageId].push(node.id);
    return node.id;
  };
  const state = (selection = []) => ({ doc, pageId, selection });
  return { doc, pageId, add, state };
}
const run = (id, state, params) => runMMFigTool(id, state, params);
const node = (result, id) => result.doc.nodes[id];

describe("catálogo do MMFig", () => {
  it("lista guias e ferramentas com ícone e descrição, ids únicos", () => {
    const catalogue = mmfigCatalogue();
    expect(catalogue.tabs).toBe(MMFIG_TABS);
    expect(new Set(catalogue.tools.map((tool) => tool.tab))).toEqual(new Set(MMFIG_TABS.map((tab) => tab.id)));
    for (const tool of catalogue.tools) expect(tool.icon && tool.description && tool.label).toBeTruthy();
    expect(new Set(catalogue.tools.map((tool) => tool.id)).size).toBe(catalogue.tools.length);
    expect(new Set(catalogue.tools.map((tool) => tool.icon)).size).toBe(catalogue.tools.length);
    expect(catalogue.tools.length).toBe(15);
    const shared = catalogue.tools.find((tool) => tool.id === "style.shared");
    expect(shared).toMatchObject({ status: "soon" });
    expect(shared.soonReason).toMatch(/mmfig\/v1/);
    expect(run("style.shared", setup().state())).toEqual({ ok: false, summary: "Estilos compartilhados ainda não estão disponíveis no MMFig." });
  });

  it("as opções de Trocar cor vêm das cores usadas na página", () => {
    const empty = setup();
    const swap = (state) => mmfigCatalogue(state).tools.find((tool) => tool.id === "style.swapColor").params[0];
    expect(swap(undefined)).toMatchObject({ default: "", options: [["", "Nenhuma cor na página"]] });
    expect(swap(empty.state())).toMatchObject({ default: "" });
    const { add, state, doc, pageId } = setup();
    const frame = add("frame");
    add("rect", { fill: { on: true, color: "#ff0000" } }, frame);
    add("rect", { fill: { on: true, color: "#FF0000" } });
    add("line");
    expect(usedColors(doc, pageId)).toEqual([
      ["#FF0000", 2],
      ["#FFFFFF", 1],
      ["#000000", 1],
    ]);
    expect(swap(state())).toMatchObject({ default: "#FF0000", options: [["#FF0000", "#FF0000 · 2 uso(s)"], ["#FFFFFF", "#FFFFFF · 1 uso(s)"], ["#000000", "#000000 · 1 uso(s)"]] });
  });

  it("ferramenta desconhecida, seleção vazia, bloqueada ou de outra página e erros inesperados", () => {
    const { add, state, doc } = setup();
    const locked = add("rect", { locked: true });
    const otherPage = "p-outra";
    doc.pages.push({ id: otherPage, name: "Página 2", background: "#1E1E1E" });
    doc.roots[otherPage] = [];
    const elsewhere = baseNode("rect");
    doc.nodes[elsewhere.id] = elsewhere;
    doc.roots[otherPage].push(elsewhere.id);
    expect(run("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    const empty = { ok: false, summary: "Selecione camadas desbloqueadas no canvas ou na lista de Camadas." };
    expect(run("align.edges", state())).toEqual(empty);
    expect(run("align.edges", state([locked, elsewhere.id, "sumiu"]))).toEqual(empty);
    expect(run("align.distribute", state([add("rect")]))).toEqual({ ok: false, summary: "Esta ferramenta precisa de 3 ou mais camadas selecionadas." });
    expect(() => run("align.edges", { ...state(), selection: null })).toThrow(TypeError);
  });
});

describe("alinhar, distribuir e grade", () => {
  it("alinha à seleção em todas as bordas", () => {
    const { add, state } = setup();
    const a = add("rect", { x: 10, y: 20, w: 100, h: 50 });
    const b = add("rect", { x: 200, y: 100, w: 50, h: 50 });
    const left = run("align.edges", state([a, b]), { edge: "left" });
    expect(left).toMatchObject({ ok: true, count: 2, summary: "2 camada(s) alinhada(s) à esquerda da seleção" });
    expect(node(left, b).x).toBe(10);
    expect(node(left, b).y).toBe(100);
    expect(node(run("align.edges", state([a, b]), { edge: "hcenter" }), a).x).toBe(80);
    expect(node(run("align.edges", state([a, b]), { edge: "right" }), a).x).toBe(150);
    const top = run("align.edges", state([a, b]), { edge: "top" });
    expect([node(top, b).x, node(top, b).y]).toEqual([200, 20]);
    expect(node(run("align.edges", state([a, b]), { edge: "vcenter" }), a).y).toBe(60);
    expect(node(run("align.edges", state([a, b]), { edge: "bottom" }), a).y).toBe(100);
  });

  it("com uma camada (ou alvo frame) alinha ao frame pai, inclusive dentro de grupo", () => {
    const { add, state } = setup();
    const frame = add("frame", { x: 0, y: 0, w: 400, h: 300 });
    const child = add("rect", { x: 10, y: 10, w: 100, h: 40 }, frame);
    const other = add("rect", { x: 30, y: 60, w: 20, h: 20 }, frame);
    const right = run("align.edges", state([child]), { edge: "right" });
    expect(right.summary).toBe("1 camada(s) alinhada(s) à direita do frame");
    expect(node(right, child).x).toBe(300);
    expect(node(run("align.edges", state([child, other]), { edge: "bottom", target: "parent" }), other).y).toBe(280);
    const group = add("group", { x: 500, y: 0, w: 100, h: 100 });
    const inGroup = add("rect", { x: 0, y: 0, w: 10, h: 10 }, group);
    add("rect", { x: 90, y: 90, w: 10, h: 10 }, group);
    const grouped = run("align.edges", state([inGroup]), { edge: "right" });
    // O grupo se reajusta ao conteúdo: vale a posição na página (grupo + camada).
    expect(node(grouped, group).x + node(grouped, inGroup).x).toBe(590);
    const loose = add("rect");
    expect(run("align.edges", state([loose])).summary).toMatch(/^Para alinhar ao frame/);
  });

  it("ignora camadas controladas pelo auto layout, mas não as absolutas", () => {
    const { add, state, doc } = setup();
    const frame = add("frame", { w: 300, h: 100 });
    doc.nodes[frame].autoLayout.on = true;
    const flow = add("rect", {}, frame);
    const absolute = add("rect", { absolute: true, x: 5 }, frame);
    expect(run("align.edges", state([flow])).summary).toMatch(/auto layout do frame pai/);
    const result = run("align.edges", state([flow, absolute]), { edge: "right" });
    expect(result.count).toBe(1);
  });

  it("distribui pelo espaço e pelos centros, na horizontal e na vertical", () => {
    const { add, state } = setup();
    const a = add("rect", { x: 0, y: 0, w: 100, h: 100 });
    const b = add("rect", { x: 120, y: 50, w: 20, h: 20 });
    const c = add("rect", { x: 300, y: 300, w: 100, h: 100 });
    const gap = run("align.distribute", state([c, a, b]));
    expect(gap.summary).toBe("3 camada(s) distribuída(s) na horizontal com 90 px entre elas");
    expect(node(gap, b).x).toBe(190);
    expect(node(gap, b).y).toBe(50);
    const centers = run("align.distribute", state([a, b, c]), { axis: "v", mode: "centers" });
    expect(centers.summary).toBe("3 camada(s) distribuída(s) na vertical pelos centros");
    expect(node(centers, b).y).toBe(190);
    expect(node(centers, b).x).toBe(120);
  });

  it("organiza em grade na ordem de leitura", () => {
    const { add, state } = setup();
    const a = add("rect", { x: 0, y: 0, w: 100, h: 50 });
    const b = add("rect", { x: 300, y: 0, w: 60, h: 80 });
    const c = add("rect", { x: 50, y: 400, w: 40, h: 40 });
    const result = run("align.grid", state([c, b, a]), { columns: 2, gap: 10 });
    expect(result.summary).toBe("3 camada(s) organizada(s) em grade 2×2 com 10 px de espaço");
    expect([node(result, b).x, node(result, b).y]).toEqual([110, 0]);
    expect([node(result, c).x, node(result, c).y]).toEqual([0, 90]);
    expect(run("align.grid", state([a, b]), { columns: 5 }).summary).toBe("2 camada(s) organizada(s) em grade 1×2 com 24 px de espaço");
  });
});

describe("layout", () => {
  it("liga auto layout num frame (direção automática) e atualiza parâmetros", () => {
    const { add, state } = setup();
    const frame = add("frame", { w: 400, h: 400 });
    add("rect", { x: 0, y: 200, w: 50, h: 50 }, frame);
    add("rect", { x: 0, y: 0, w: 50, h: 50 }, frame);
    const result = run("layout.auto", state([frame]));
    expect(result).toMatchObject({ ok: true, selection: [frame], summary: "Auto layout vertical aplicado em Frame (espaço 12 px, margem 16 px)" });
    expect(node(result, frame).autoLayout).toMatchObject({ on: true, direction: "vertical", gap: 12, align: "center", hugW: true });
    expect(node(result, frame).h).toBe(16 + 50 + 12 + 50 + 16);
    const wide = setup();
    const row = wide.add("frame", { w: 400, h: 100 });
    wide.add("rect", { x: 200, y: 0 }, row);
    expect(run("layout.auto", wide.state([row])).summary).toMatch(/^Auto layout horizontal/);
    const empty = wide.add("frame");
    expect(run("layout.auto", wide.state([empty])).summary).toMatch(/^Auto layout horizontal aplicado/);
    const none = run("layout.auto", wide.state([empty]), { direction: "vertical", gap: 0, padding: 0 });
    expect(node(none, empty).autoLayout).toMatchObject({ direction: "vertical", hugW: false, hugH: false });
  });

  it("cria um frame com auto layout em volta das camadas e recusa níveis diferentes", () => {
    const { add, state } = setup();
    const a = add("rect", { x: 100, y: 0 });
    const b = add("rect", { x: 0, y: 0 });
    const result = run("layout.auto", state([a, b]), { direction: "horizontal", gap: 8, padding: 4 });
    const [id] = result.selection;
    expect(result.summary).toBe(`Auto layout horizontal criado em ${node(result, id).name}, em volta da seleção (espaço 8 px, margem 4 px)`);
    expect(node(result, id).children).toEqual([b, a]);
    expect(node(result, a).x).toBe(112);
    const frame = add("frame");
    const inside = add("rect", {}, frame);
    expect(run("layout.auto", state([inside, a]))).toEqual({ ok: false, summary: "Selecione camadas do mesmo nível para agrupar." });
  });

  it("duplica em grade, transformando componentes em instâncias", () => {
    const { add, state } = setup();
    const card = add("frame", { x: 0, y: 0, w: 100, h: 60, isComponent: true });
    const rect = add("rect", { x: 0, y: 70, w: 100, h: 30 });
    expect(run("layout.repeat", state([card]), { rows: 1, columns: 1 })).toEqual({ ok: false, summary: "Escolha ao menos 2 células (linhas × colunas)." });
    const result = run("layout.repeat", state([card, rect]), { rows: 2, columns: 2, gap: 10 });
    expect(result.summary).toBe("6 cópia(s) em grade 2×2 (10 px entre as células)");
    expect(result.selection).toHaveLength(8);
    const copies = result.selection.slice(2).map((id) => node(result, id));
    expect(copies.map((n) => n.type)).toEqual(["instance", "rect", "instance", "rect", "instance", "rect"]);
    expect([copies[0].x, copies[0].y]).toEqual([110, 0]);
    expect([copies[5].x, copies[5].y]).toEqual([110, 180]);
  });

  it("cria telas de dispositivo ao lado do conteúdo ou redimensiona frames", () => {
    const empty = setup();
    const first = run("layout.device", empty.state());
    expect(first.summary).toBe("1 frame(s) iPhone 14 (390×844) adicionado(s) na página");
    expect(node(first, first.selection[0])).toMatchObject({ x: 0, y: 0, w: 390, h: 844, name: "iPhone 14 1" });
    const { add, state } = setup();
    const frame = add("frame", { x: 10, y: 20, w: 100, h: 100 });
    const more = run("layout.device", state(), { preset: "android", count: 2 });
    expect(more.selection.map((id) => [node(more, id).x, node(more, id).y, node(more, id).name])).toEqual([
      [210, 20, "Android 2"],
      [670, 20, "Android 3"],
    ]);
    const resized = run("layout.device", state([frame]), { preset: "desktop", mode: "resize" });
    expect(resized.summary).toBe("1 frame(s) no tamanho Desktop (1440×1024)");
    expect([node(resized, frame).w, node(resized, frame).h]).toEqual([1440, 1024]);
    expect(run("layout.device", state([add("rect")]), { mode: "resize" })).toEqual({ ok: false, summary: "Selecione um ou mais frames para mudar de tamanho." });
    expect(run("layout.device", state(), { preset: "relógio" })).toEqual({ ok: false, summary: "Dispositivo desconhecido: relógio" });
  });
});

describe("estilo", () => {
  it("aplica estilo de texto dentro de frames, com ou sem trocar a fonte", () => {
    const { add, state } = setup();
    const frame = add("frame");
    const title = add("text", { text: "Olá" }, frame);
    const blocked = add("text", { locked: true }, frame);
    const result = run("style.text", state([frame]));
    expect(result.summary).toBe("Estilo Título 1 (32 px) aplicado em 1 texto(s)");
    expect(node(result, title)).toMatchObject({ fontSize: 32, fontWeight: 700, lineHeight: 1.2, fontFamily: "Inter" });
    expect(node(result, blocked).fontSize).toBe(16);
    const loose = add("text");
    const body = run("style.text", state([loose]), { style: "caption", font: "Georgia", inside: false });
    expect(body.summary).toBe("Estilo Legenda (12 px, Georgia) aplicado em 1 texto(s)");
    expect(node(body, loose).fontFamily).toBe("Georgia");
    expect(run("style.text", state([frame]), { inside: false }).summary).toMatch(/^Nenhum texto desbloqueado/);
  });

  it("troca uma cor na página ou na seleção, sem mexer em camadas bloqueadas", () => {
    const { add, state } = setup();
    const a = add("rect", { fill: { on: true, color: "#ff0000" } });
    const b = add("ellipse", { fill: { on: true, color: "#FF0000" }, stroke: { on: true, color: "#ff0000", width: 1 } });
    const locked = add("rect", { locked: true, fill: { on: true, color: "#FF0000" } });
    const page = run("style.swapColor", state(), { from: "#FF0000", to: "#00ff00" });
    expect(page.summary).toBe("3 preenchimento(s)/traço(s) trocado(s) de #FF0000 para #00FF00");
    expect(node(page, a).fill.color).toBe("#00FF00");
    expect(node(page, b).stroke.color).toBe("#00FF00");
    expect(node(page, locked).fill.color).toBe("#FF0000");
    const sel = run("style.swapColor", state([a]), { from: "#FF0000", to: "#0000ff", scope: "selection" });
    expect(sel.count).toBe(1);
    expect(node(sel, b).fill.color).toBe("#FF0000");
    expect(run("style.swapColor", state(), { from: "", to: "#000000" }).summary).toMatch(/^Não há cores/);
    expect(run("style.swapColor", state(), { from: "#FF0000", to: "" })).toEqual({ ok: false, summary: "Escolha a nova cor." });
    expect(run("style.swapColor", state(), { from: "#123456" }).summary).toBe("A cor #123456 não aparece em camadas desbloqueadas da página.");
    expect(run("style.swapColor", state([a]), { from: "#123456", scope: "selection" }).summary).toBe("A cor #123456 não aparece em camadas desbloqueadas da seleção.");
  });

  it("arredonda cantos e aplica ou remove sombra", () => {
    const { add, state } = setup();
    const rect = add("rect");
    const text = add("text");
    const soft = run("style.corners", state([rect, text]));
    expect(soft.summary).toBe("Cantos de 1 camada(s) em 12 px · sombra suave em 2 camada(s)");
    expect(node(soft, rect).radius).toBe(12);
    expect(node(soft, text).shadow).toMatchObject({ on: true, blur: 12 });
    expect(run("style.corners", state([text]), { shadow: "strong" }).summary).toBe("Sombra forte em 1 camada(s)");
    expect(node(run("style.corners", state([text]), { shadow: "none" }), text).shadow.on).toBe(false);
    expect(run("style.corners", state([rect]), { radius: 4, shadow: "keep" }).summary).toBe("Cantos de 1 camada(s) em 4 px");
    expect(run("style.corners", state([text]), { shadow: "keep" }).summary).toMatch(/^Cantos arredondados valem/);
  });
});

describe("camadas", () => {
  it("renomeia em lote na ordem da posição, opcionalmente pelo texto", () => {
    const { add, state } = setup();
    const frame = add("frame", { w: 500, h: 500 });
    const a = add("rect", { x: 0, y: 100 }, frame);
    const b = add("text", { x: 0, y: 0, text: "Entrar\nsegunda linha" }, frame);
    const c = add("text", { x: 200, y: 100, text: "  " }, frame);
    const kids = run("layers.rename", state([frame]), { base: " Card ", start: 0, scope: "children" });
    expect(kids.summary).toBe("3 camada(s) renomeada(s): Card 0 … Card 2");
    expect([node(kids, b).name, node(kids, a).name, node(kids, c).name]).toEqual(["Card 0", "Card 1", "Card 2"]);
    const byText = run("layers.rename", state([a, b]), { useText: true });
    expect(byText.summary).toBe("2 camada(s) renomeada(s): Entrar, Item 2");
    expect(node(run("layers.rename", state([c]), { useText: true }), c).name).toBe("Item 1");
    expect(run("layers.rename", state([a]), { base: "   " })).toEqual({ ok: false, summary: "Digite o nome base (ex.: Card, Botão, Tela)." });
    expect(run("layers.rename", state([a]), { scope: "children" }).summary).toMatch(/^As camadas selecionadas não têm nada dentro/);
  });

  it("ordena camadas da página, de um frame, de irmãos e no auto layout", () => {
    const { add, state, pageId, doc } = setup();
    const a = add("rect", { name: "B 9", x: 0, y: 0 });
    const b = add("rect", { name: "B 10", x: 0, y: 300 });
    const page = run("layers.sort", state(), { by: "name" });
    expect(page.summary).toBe("2 camada(s) ordenada(s) por nome (A–Z) na página");
    expect(page.doc.roots[pageId]).toEqual([b, a]);
    expect(run("layers.sort", state([a])).doc.roots[pageId]).toEqual([b, a]);
    // Já ordenado: não finge sucesso nem cria passo de desfazer.
    expect(run("layers.sort", { ...state(), doc: page.doc }, { by: "name" })).toEqual({ ok: false, summary: "Ordenar camadas: nada a alterar, o resultado seria igual ao estado atual." });

    const group = add("group", { name: "Lista" });
    const g1 = add("rect", { x: 0, y: 50 }, group);
    const g2 = add("rect", { x: 0, y: 0 }, group);
    const inGroup = run("layers.sort", state([group]));
    expect(inGroup.summary).toBe("2 camada(s) ordenada(s) por posição (de cima para baixo) em Lista");
    expect(inGroup.doc.nodes[group].children).toEqual([g1, g2]);
    expect(run("layers.sort", state([g1, g2])).doc.nodes[group].children).toEqual([g1, g2]);
    expect(run("layers.sort", state([g1, a]))).toEqual({ ok: false, summary: "Selecione camadas do mesmo nível (mesmo frame ou grupo) para ordenar." });

    const flow = add("frame", { name: "Menu" });
    const f1 = add("text", { name: "Sobre" }, flow);
    const f2 = add("text", { name: "Início" }, flow);
    doc.nodes[flow].autoLayout.on = true;
    const sorted = run("layers.sort", state([f1]), { by: "name" });
    expect(sorted.summary).toBe("2 camada(s) ordenada(s) por nome (A–Z) em Menu (a ordem do auto layout mudou)");
    expect(sorted.doc.nodes[flow].children).toEqual([f2, f1]);

    const single = setup();
    single.add("rect");
    expect(run("layers.sort", single.state())).toEqual({ ok: false, summary: "Não há duas ou mais camadas nesse nível para ordenar." });
  });

  it("cria componente de frame, grupo ou várias camadas, com instâncias ao lado", () => {
    const { add, state } = setup();
    const frame = add("frame", { name: "Botão", x: 0, y: 0, w: 120, h: 40 });
    const made = run("layers.component", state([frame]));
    expect(made.summary).toBe("Componente Botão criado + 2 instância(s) ao lado");
    const instances = Object.values(made.doc.nodes).filter((n) => n.type === "instance");
    expect(instances.map((n) => [n.mainId, n.x, n.y])).toEqual([
      [frame, 160, 0],
      [frame, 160, 60],
    ]);
    const again = run("layers.component", { ...state([frame]), doc: made.doc }, { instances: 1 });
    expect(again.summary).toBe("Botão já era componente + 1 instância(s) ao lado");
    expect(Object.values(again.doc.nodes).filter((n) => n.type === "instance").at(-1).y).toBe(120);
    expect(run("layers.component", { ...state([frame]), doc: made.doc }, { instances: 0 }).summary).toMatch(/já é um componente principal/);
    expect(run("layers.component", { ...state([instances[0].id]), doc: made.doc })).toEqual({ ok: false, summary: "Desanexe a instância antes de transformá-la em componente." });

    const group = add("group", { name: "Ícone" });
    add("rect", {}, group);
    const fromGroup = run("layers.component", state([group]), { instances: 0 });
    expect(fromGroup.summary).toBe("Componente Ícone criado");
    expect(node(fromGroup, group)).toMatchObject({ type: "frame", isComponent: true, clip: false });

    const a = add("rect");
    const b = add("ellipse");
    const wrapped = run("layers.component", state([a, b]), { instances: 0 });
    expect(wrapped.summary).toBe("Componente Componente 1 criado");
    expect(node(wrapped, wrapped.selection[0]).children).toEqual([a, b]);
    const inside = add("rect", {}, frame);
    expect(run("layers.component", state([inside, a])).summary).toBe("Selecione camadas do mesmo nível para agrupar.");
  });
});

describe("protótipo e exportação", () => {
  it("liga as telas da esquerda para a direita e marca o início do fluxo", () => {
    const { add, state, pageId } = setup();
    const second = add("frame", { name: "Tela 2", x: 500, y: 0 });
    const first = add("frame", { name: "Tela 1", x: 0, y: 0 });
    const below = add("frame", { name: "Tela 1b", x: 0, y: 900 });
    add("frame", { name: "Oculta", x: 900, visible: false });
    add("rect", { x: 2000 });
    const all = run("proto.link", state());
    expect(all.summary).toBe("2 ligação(ões) de clique: Tela 1 → Tela 1b → Tela 2 · início do fluxo em Tela 1");
    expect(node(all, first).proto).toEqual({ trigger: "click", action: "navigate", targetId: below, transition: "dissolve", url: "" });
    expect(node(all, below).proto.targetId).toBe(second);
    expect(node(all, second).proto).toBeNull();
    expect(all.doc.flowStart[pageId]).toBe(first);
    const picked = run("proto.link", state([second, first]), { transition: "slide-left", start: false });
    expect(picked.summary).toBe("1 ligação(ões) de clique: Tela 1 → Tela 2");
    expect(picked.doc.flowStart[pageId]).toBeUndefined();
    expect(run("proto.link", state([first])).summary).toMatch(/^Selecione duas ou mais telas/);
  });

  it("planeja a exportação da seleção ou da página sem alterar o documento", () => {
    const { add, state, doc, pageId } = setup();
    expect(run("export.file", state())).toEqual({ ok: false, summary: "Nada visível para exportar nesta página." });
    const a = add("rect", { name: "Logo", x: 0, y: 0, w: 100, h: 50 });
    const b = add("rect", { x: 100, y: 0, w: 100, h: 50 });
    add("rect", { visible: false });
    const page = run("export.file", state());
    expect(page).toEqual({
      ok: true,
      count: 2,
      summary: "Exportar 2 camada(s) (página Página 1) em PNG · 400×100 px",
      exportJob: { ids: [a, b], name: "Página 1", format: "png", scale: 2 },
    });
    expect(run("export.file", state([a]), { format: "svg" })).toMatchObject({ summary: "Exportar 1 camada(s) (seleção) em SVG · 100×50 px", exportJob: { name: "Logo", scale: 1 } });
    expect(run("export.file", state([a, b]), { scale: "3" }).exportJob).toMatchObject({ name: "2-camadas", scale: 3 });
    expect(doc.roots[pageId]).toHaveLength(3);
  });
});
