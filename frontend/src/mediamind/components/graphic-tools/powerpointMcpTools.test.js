import { describe, expect, it } from "vitest";
import { POWERPOINT_TABS, powerpointCatalogue, runPowerPointTool } from "./powerpointMcpTools";

const slide = (id, title, body = "", layout = "title", extra = {}) => ({ id, title, body, layout, titleStyle: { bold: false, italic: false }, bodyStyle: { bold: false, italic: false }, ...extra });
const deck = (index = 0) => ({
  slides: [slide(1, "Capa", "Subtítulo"), slide(2, "vendas do ano", "- Norte\n• Sul\n\n1. Leste", "title-content"), slide(3, "Fim")],
  index,
});
let seed = 0;
const env = { newId: () => `n${(seed += 1)}` };
const run = (id, state, params) => runPowerPointTool(id, state, params, env);
const titles = (result) => result.slides.map((item) => item.title);

describe("catálogo do PowerPoint", () => {
  it("lista guias, ferramentas e os slides atuais como opções", () => {
    const catalogue = powerpointCatalogue(deck(1));
    expect(catalogue.tabs).toBe(POWERPOINT_TABS);
    expect(catalogue.tools.length).toBeGreaterThanOrEqual(10);
    expect(new Set(catalogue.tools.map((tool) => tool.tab))).toEqual(new Set(POWERPOINT_TABS.map((tab) => tab.id)));
    expect(new Set(catalogue.tools.map((tool) => tool.icon)).size).toBe(catalogue.tools.length);
    const params = (id) => Object.fromEntries(catalogue.tools.find((tool) => tool.id === id).params.map((param) => [param.key, param]));
    expect(params("slides.duplicar").slide).toMatchObject({ default: "1", options: [["0", "1 · Capa"], ["1", "2 · vendas do ano"], ["2", "3 · Fim"]] });
    expect(params("slides.mover").to.options).toEqual([["0", "1"], ["1", "2"], ["2", "3"]]);
    expect(params("texto.caixa").slides.default).toEqual(["0", "1", "2"]);
    expect(params("layout.aplicar").layout.options).toEqual([["title", "Slide de título"], ["title-content", "Título e conteúdo"], ["title-only", "Somente título"]]);
    expect(powerpointCatalogue({ slides: [slide(1, " ")], index: 0 }).tools[1].params[0].options).toEqual([["0", "1 · (sem título)"]]);
    expect(powerpointCatalogue().tools.find((tool) => tool.id === "slides.excluir").params[0].options).toEqual([]);
    expect(catalogue.tools.filter((tool) => tool.status === "soon")).toEqual([]);
  });

  it("ferramenta desconhecida e ids padrão", () => {
    expect(run("nada", deck())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(runPowerPointTool("slides.novo", deck()).slides[1].id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect(() => run("slides.topicos", { slides: [slide(1, "a", null)], index: 0 })).toThrow(TypeError);
  });
});

describe("slides", () => {
  it("cria slide com layout e texto, depois do atual ou no fim", () => {
    const after = run("slides.novo", deck(0), { title: "<b>Oi</b>", body: "Texto" });
    expect(after).toMatchObject({ ok: true, count: 1, summary: "Slide 2 criado (Título e conteúdo)", index: 1 });
    expect(after.slides[1]).toMatchObject({ title: "<b>Oi</b>", body: "Texto", layout: "title-content" });
    const end = run("slides.novo", deck(0), { layout: "title-only", body: "ignorado", position: "end", title: undefined });
    expect(end).toMatchObject({ index: 3, summary: "Slide 4 criado (Somente título)" });
    expect(end.slides[3]).toMatchObject({ title: "", body: "" });
    expect(run("slides.novo", deck(0), { layout: "title", body: undefined }).slides[1].body).toBe("");
  });

  it("duplica, reordena e exclui", () => {
    const copies = run("slides.duplicar", deck(), { slide: "1", copies: 2 });
    expect(copies).toMatchObject({ ok: true, count: 2, summary: "Slide 2 duplicado 2 vez(es)", index: 2 });
    expect(titles(copies)).toEqual(["Capa", "vendas do ano", "vendas do ano", "vendas do ano", "Fim"]);
    expect(copies.slides[2].titleStyle).not.toBe(deck().slides[1].titleStyle);
    expect(run("slides.duplicar", deck(), { slide: "9" })).toEqual({ ok: false, summary: "Escolha um slide." });
    expect(run("slides.duplicar", deck(), { slide: "x" })).toEqual({ ok: false, summary: "Escolha um slide." });
    const moved = run("slides.mover", deck(), { slide: "2", to: "0" });
    expect(moved).toMatchObject({ summary: "Slide 3 movido para a posição 1", index: 0 });
    expect(titles(moved)).toEqual(["Fim", "Capa", "vendas do ano"]);
    expect(run("slides.mover", deck(), { slide: "0", to: "0" })).toEqual({ ok: false, summary: "O slide já está nessa posição." });
    const removed = run("slides.excluir", deck(2), { slides: ["0", "2"] });
    expect(removed).toMatchObject({ ok: true, count: 2, summary: "2 slide(s) excluído(s): 1, 3", index: 0 });
    expect(titles(removed)).toEqual(["vendas do ano"]);
    expect(run("slides.excluir", deck(), { slides: ["0", "1", "2"] })).toEqual({ ok: false, summary: "A apresentação precisa de ao menos um slide." });
    expect(run("slides.excluir", deck())).toEqual({ ok: false, summary: "Escolha um ou mais slides." });
    expect(run("slides.excluir", deck(), { slides: undefined })).toEqual({ ok: false, summary: "Escolha um ou mais slides." });
    expect(powerpointCatalogue(deck()).tools.find((tool) => tool.id === "slides.excluir").confirm).toMatch(/desfazer/);
  });

  it("transforma tópicos em slides e monta a agenda", () => {
    const topics = run("slides.topicos", deck(), { slide: "1" });
    expect(topics).toMatchObject({ ok: true, count: 3, details: ["Norte", "Sul", "Leste"], index: 2, summary: "3 slide(s) criado(s) a partir dos tópicos do slide 2" });
    expect(titles(topics)).toEqual(["Capa", "vendas do ano", "Norte", "Sul", "Leste", "Fim"]);
    expect(topics.slides[2].layout).toBe("title-only");
    expect(run("slides.topicos", deck(), { slide: "2" }).summary).toMatch(/não tem tópicos/);
    const agenda = run("slides.agenda", deck());
    expect(agenda).toMatchObject({ ok: true, count: 2, summary: "Agenda criada no slide 2 com 2 tópico(s)", index: 1 });
    expect(agenda.slides[1]).toMatchObject({ title: "Agenda", body: "• vendas do ano\n• Fim", layout: "title-content" });
    const renamed = { slides: agenda.slides.map((item, index) => (index === 3 ? { ...item, title: "Encerramento" } : item)), index: 0 };
    const updated = run("slides.agenda", renamed, { title: "  " });
    expect(updated.summary).toBe("Agenda atualizada no slide 2 com 2 tópico(s)");
    expect(updated.slides).toHaveLength(4);
    expect(updated.slides[1].body).toBe("• vendas do ano\n• Encerramento");
    expect(run("slides.agenda", { slides: [slide(1, "Só")], index: 0 }, { title: undefined })).toEqual({ ok: false, summary: "Crie mais slides com título antes de montar a agenda." });
    expect(run("slides.agenda", { slides: [slide(1, "Capa"), slide(2, "Agenda", "", "title")], index: 0 }).slides).toHaveLength(3);
  });
});

describe("layout", () => {
  it("aplica layout aos slides escolhidos e padroniza", () => {
    const applied = run("layout.aplicar", deck(), { slides: ["0", "1"], layout: "title-only" });
    expect(applied).toMatchObject({ ok: true, count: 2, summary: "Somente título em 2 slide(s)", index: 0 });
    expect(applied.slides.map((item) => item.layout)).toEqual(["title-only", "title-only", "title"]);
    expect(run("layout.aplicar", deck(), { slides: ["1"] })).toEqual({ ok: false, summary: "Os slides escolhidos já usam esse layout." });
    const standard = run("layout.padronizar", { slides: [slide(1, "a", "", "title-content"), slide(2, "b", "x"), slide(3, "c", " ")], index: 0 });
    expect(standard).toMatchObject({ count: 3, slides: [{ layout: "title" }, { layout: "title-content" }, { layout: "title-only" }] });
    expect(run("layout.padronizar", { slides: standard.slides, index: 0 })).toEqual({ ok: false, summary: "Os layouts já estão padronizados." });
  });
});

describe("texto", () => {
  it("define negrito e itálico no título, no conteúdo ou nos dois", () => {
    const bold = run("texto.estilo", deck(), {});
    expect(bold).toMatchObject({ ok: true, count: 3, summary: "Negrito em 3 texto(s)" });
    expect(bold.slides[0].titleStyle).toEqual({ bold: true, italic: false });
    expect(bold.slides[0].bodyStyle).toEqual({ bold: false, italic: false });
    expect(run("texto.estilo", deck(), { slides: ["0"], target: "body", bold: false, italic: true }).summary).toBe("Itálico em 1 texto(s)");
    expect(run("texto.estilo", deck(), { slides: ["0"], target: "both", italic: true }).summary).toBe("Negrito e itálico em 2 texto(s)");
    expect(run("texto.estilo", deck(), { slides: ["0"], bold: false }).summary).toBe("Os textos escolhidos já estão com esse estilo.");
    const partial = { slides: [slide(1, "a", "", "title", { titleStyle: { bold: true, italic: true } })], index: 0 };
    expect(run("texto.estilo", partial, { bold: false, italic: true }).summary).toBe("Itálico em 1 texto(s)");
    expect(run("texto.estilo", partial, { bold: true, italic: false }).summary).toBe("Negrito em 1 texto(s)");
    expect(run("texto.estilo", partial, { bold: false, italic: false }).summary).toBe("Texto normal em 1 texto(s)");
  });

  it("muda a caixa dos títulos, substitui texto e põe marcadores", () => {
    const title = run("texto.caixa", deck(), {});
    expect(title).toMatchObject({ ok: true, count: 1, summary: "Primeira Letra De Cada Palavra em 1 título(s)" });
    expect(titles(title)).toEqual(["Capa", "Vendas Do Ano", "Fim"]);
    expect(titles(run("texto.caixa", deck(), { mode: "upper" }))).toEqual(["CAPA", "VENDAS DO ANO", "FIM"]);
    expect(run("texto.caixa", deck(), { slides: ["0"], mode: "sentence" })).toEqual({ ok: false, summary: "Os títulos escolhidos já estão assim." });
    const replaced = run("texto.substituir", deck(), { find: "N", replace: "<x>" });
    expect(replaced).toMatchObject({ ok: true, count: 3, summary: "3 ocorrência(s) de “N” trocada(s) por “<x>”" });
    expect(replaced.slides[1].title).toBe("ve<x>das do a<x>o");
    expect(run("texto.substituir", deck(), { find: "N", caseSensitive: true, replace: undefined }).count).toBe(1);
    expect(run("texto.substituir", deck(), { find: "zz" })).toEqual({ ok: false, summary: "“zz” não aparece em nenhum slide." });
    expect(run("texto.substituir", deck(), { find: undefined })).toEqual({ ok: false, summary: "Digite o texto a localizar." });
    const plain = { slides: [slide(1, "a", "Um\n  Dois\n\n- Três")], index: 0 };
    const added = run("texto.marcadores", plain, {});
    expect(added).toMatchObject({ ok: true, count: 1, summary: "Marcadores adicionados em 1 slide(s)" });
    expect(added.slides[0].body).toBe("• Um\n• Dois\n\n- Três");
    expect(run("texto.marcadores", { slides: added.slides, index: 0 }, { mode: "remove" }).slides[0].body).toBe("Um\nDois\n\nTrês");
    expect(run("texto.marcadores", { slides: added.slides, index: 0 }, {}).summary).toMatch(/já têm marcadores/);
    expect(run("texto.marcadores", plain, { mode: "remove", slides: ["0"] }).count).toBe(1);
    expect(run("texto.marcadores", deck(), { slides: ["0"] }).slides.map((item) => item.body)).toEqual(["• Subtítulo", deck().slides[1].body, ""]);
    expect(run("texto.marcadores", { slides: [slide(1, "a", "x")], index: 0 }, { mode: "remove" }).summary).toBe("Os slides escolhidos não têm marcadores.");
  });
});

describe("design", () => {
  it("aplica tema pronto ou personalizado", () => {
    const dark = run("design.tema", deck(), {});
    expect(dark).toMatchObject({ ok: true, count: 3, summary: "Tema Escuro (fundo #1f2937, texto #f9fafb) em 3 slide(s)", index: 0 });
    expect(dark.slides[2].theme).toEqual({ background: "#1f2937", color: "#f9fafb" });
    expect(run("design.tema", { slides: dark.slides, index: 0 }, {}).summary).toBe("Os slides escolhidos já usam esse tema.");
    const custom = run("design.tema", deck(), { preset: "custom", slides: ["1"], background: "#000000", color: "#FFFFFF" });
    expect(custom.summary).toBe("Tema personalizado (fundo #000000, texto #FFFFFF) em 1 slide(s)");
    expect(custom.slides.map((item) => item.theme)).toEqual([undefined, { background: "#000000", color: "#FFFFFF" }, undefined]);
    // Personalizado com as cores padrão = Clássico, que é o que os slides antigos já mostram.
    expect(run("design.tema", deck(), { preset: "custom" }).summary).toBe("Os slides escolhidos já usam esse tema.");
    expect(run("design.tema", deck(), { preset: "custom", background: "#abcdef", color: "#ABCDEF" }).summary).toBe("O fundo e o texto têm a mesma cor: o texto ficaria invisível.");
    expect(run("design.tema", deck(), { preset: "custom", background: "" }).summary).toBe("Escolha a cor de fundo e a cor do texto.");
    expect(run("design.tema", deck(), { preset: "custom", color: "azul" }).summary).toBe("Escolha a cor de fundo e a cor do texto.");
    expect(run("design.tema", deck(), { slides: [] }).summary).toBe("Escolha um ou mais slides.");
  });

  it("alinha título e conteúdo", () => {
    const left = run("design.alinhar", deck(1), {});
    expect(left).toMatchObject({ ok: true, count: 1, summary: "Alinhamento esquerda no título e no conteúdo de 1 slide(s)", index: 1 });
    expect(left.slides.map((item) => item.align)).toEqual([undefined, "left", undefined]);
    expect(run("design.alinhar", { slides: left.slides, index: 1 }, { align: "auto" }).summary).toBe("Alinhamento pelo layout no título e no conteúdo de 1 slide(s)");
    expect(run("design.alinhar", deck(), { align: "auto", slides: ["0", "1", "2"] }).summary).toBe("Os slides escolhidos já estão com esse alinhamento.");
  });

  it("escreve, acrescenta e limpa anotações", () => {
    const withNotes = { slides: [slide(1, "Capa", "", "title", { notes: "Boas-vindas" }), slide(2, "Fim")], index: 0 };
    const field = (state) => Object.fromEntries(powerpointCatalogue(state).tools.find((tool) => tool.id === "design.notas").params.map((param) => [param.key, param]));
    expect(field(withNotes).text.default).toBe("Boas-vindas");
    expect(field({ ...withNotes, index: 1 }).text.default).toBe("");
    const set = run("design.notas", deck(), { text: "Falar devagar" });
    expect(set).toMatchObject({ ok: true, count: 1, summary: "Anotações do slide 1 atualizadas", index: 0 });
    expect(set.slides[0].notes).toBe("Falar devagar");
    const append = run("design.notas", withNotes, { action: "append", text: "Sorrir" });
    expect(append.summary).toBe("Anotações do slide 1 acrescentadas");
    expect(append.slides[0].notes).toBe("Boas-vindas\nSorrir");
    expect(append.slides[1]).toBe(withNotes.slides[1]);
    expect(run("design.notas", withNotes, { action: "append", slide: "1", text: "Obrigado" }).slides[1].notes).toBe("Obrigado");
    expect(run("design.notas", withNotes, {}).summary).toBe("As anotações já estão assim.");
    expect(run("design.notas", withNotes, { text: " " }).summary).toBe("Digite o texto das anotações (ou escolha Limpar).");
    expect(run("design.notas", withNotes, { text: null }).summary).toBe("Digite o texto das anotações (ou escolha Limpar).");
    const cleared = run("design.notas", withNotes, { action: "clear" });
    expect(cleared.summary).toBe("Anotações do slide 1 apagadas");
    expect(cleared.slides[0].notes).toBe("");
    expect(run("design.notas", withNotes, { action: "clear", slide: "1" }).summary).toBe("O slide 2 não tem anotações.");
  });
});
