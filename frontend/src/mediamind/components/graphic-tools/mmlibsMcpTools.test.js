import { describe, expect, it } from "vitest";
import { filterAssets, MMLIBS_TABS, mmlibsCatalogue, runMMLibsTool, tagCounts, visibleAssets } from "./mmlibsMcpTools";

const asset = (id, name, type) => ({ id, name, type, url: `blob:${id}` });
const ASSETS = [
  asset("a1", "Logo.png", "image/png"),
  asset("a2", "Entrevista.mp4", "video/mp4"),
  asset("a3", "Trilha.mp3", "audio/mpeg"),
  asset("a4", "Roteiro.pdf", "application/pdf"),
  asset("a5", "logo.png", "image/png"),
];
const FOLDERS = [
  { id: "projetos", name: "Projetos" },
  { id: "identidade", name: "Identidade visual" },
  { id: "referencias", name: "Referências" },
];
const state = (extra = {}) => {
  let next = 0;
  return { assets: ASSETS, category: "Todos", section: "Todos os ativos", view: "grade", query: "", favorites: [], folders: FOLDERS, newId: () => `n${next++}`, ...extra };
};
const run = (id, current, params) => runMMLibsTool(id, current, params);

describe("catálogo das Bibliotecas", () => {
  it("lista guias e ferramentas únicas com ícone e descrição", () => {
    const catalogue = mmlibsCatalogue(state());
    expect(catalogue.tabs).toBe(MMLIBS_TABS);
    expect(new Set(catalogue.tools.map((tool) => tool.tab))).toEqual(new Set(MMLIBS_TABS.map((tab) => tab.id)));
    for (const tool of catalogue.tools) expect(tool.icon && tool.description).toBeTruthy();
    expect(new Set(catalogue.tools.map((tool) => tool.id)).size).toBe(catalogue.tools.length);
    expect(new Set(catalogue.tools.map((tool) => tool.icon)).size).toBe(catalogue.tools.length);
    expect(catalogue.tools.length).toBeGreaterThanOrEqual(10);
    expect(catalogue.tools.length).toBeLessThanOrEqual(18);
    expect(catalogue.tools.filter((tool) => tool.status === "soon")).toEqual([]);
    const rename = catalogue.tools.find((tool) => tool.id === "folder.rename");
    expect(rename.params[0]).toMatchObject({ default: "projetos", options: [["projetos", "Projetos"], ["identidade", "Identidade visual"], ["referencias", "Referências"]] });
  });

  it("sem estado ou sem pastas, o seletor de pasta fica vazio", () => {
    expect(mmlibsCatalogue().tools.find((tool) => tool.id === "folder.remove").params[0]).toMatchObject({ default: "", options: [] });
    expect(run("folder.remove", state({ folders: [] }))).toEqual({ ok: false, summary: "Escolha uma pasta existente." });
  });

  it("ações destrutivas pedem confirmação; o resto não", () => {
    const confirmed = mmlibsCatalogue(state()).tools.filter((tool) => tool.confirm).map((tool) => tool.id);
    expect(confirmed).toEqual(["fav.clear", "folder.remove", "assets.delete"]);
  });

  it("ferramenta desconhecida e erros inesperados", () => {
    expect(run("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(() => run("filter.clear", { ...state(), category: "Imagens", assets: null })).toThrow(TypeError);
  });

  it("gera ids com crypto.randomUUID quando o estado não traz gerador", () => {
    const { newId: _ignored, ...current } = state();
    expect(run("folder.create", current, { name: "Clientes" }).folders.at(-1).id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("filtrar", () => {
  it("filterAssets segue as categorias da grade e a busca sem diferenciar maiúsculas", () => {
    expect(filterAssets(ASSETS, "Imagens", "LOGO").map((item) => item.id)).toEqual(["a1", "a5"]);
    expect(filterAssets(ASSETS, "Vídeos", "").map((item) => item.id)).toEqual(["a2"]);
    expect(filterAssets(ASSETS, "Áudio", "").map((item) => item.id)).toEqual(["a3"]);
    expect(filterAssets(ASSETS, "Documentos", "").map((item) => item.id)).toEqual(["a4"]);
    expect(filterAssets(ASSETS, "Todos", "")).toHaveLength(5);
  });

  it("categoria mantém a busca e volta para todos os ativos", () => {
    expect(run("filter.category", state({ section: "Tags" }))).toEqual({ ok: true, count: 2, summary: "Mostrando 2 ativo(s) em Imagens", category: "Imagens", section: "Todos os ativos" });
    expect(run("filter.category", state({ query: "trilha" }), { category: "Áudio" }).summary).toBe("Mostrando 1 ativo(s) em Áudio com a busca “trilha”");
  });

  it("pesquisa pelo nome e exige texto", () => {
    expect(run("filter.search", state(), { query: "  logo " })).toEqual({ ok: true, count: 2, summary: "2 ativo(s) encontrado(s) para “logo”", query: "logo", section: "Todos os ativos" });
    expect(run("filter.search", state())).toEqual({ ok: false, summary: "Digite o que procurar (nome do arquivo)." });
    expect(run("filter.search", state(), { query: undefined }).ok).toBe(false);
  });

  it("limpa filtros só quando há algo a limpar", () => {
    expect(run("filter.clear", state())).toEqual({ ok: false, summary: "Os filtros já estão limpos: todos os ativos aparecem." });
    const cleared = { ok: true, count: 5, summary: "Filtros limpos: 5 ativo(s) à vista", category: "Todos", query: "", section: "Todos os ativos" };
    expect(run("filter.clear", state({ category: "Imagens" }))).toEqual(cleared);
    expect(run("filter.clear", state({ query: "x" }))).toEqual(cleared);
    expect(run("filter.clear", state({ section: "Pastas" }))).toEqual(cleared);
  });

  it("alterna grade e lista", () => {
    expect(run("filter.view", state())).toEqual({ ok: true, count: 1, summary: "Visualização em lista", view: "lista" });
    expect(run("filter.view", state({ view: "lista" }), { view: "grade" }).summary).toBe("Visualização em grade");
    expect(run("filter.view", state())).toMatchObject({ ok: true });
    expect(run("filter.view", state({ view: "lista" }))).toEqual({ ok: false, summary: "A biblioteca já está em lista." });
    expect(run("filter.view", state(), { view: "grade" })).toEqual({ ok: false, summary: "A biblioteca já está em grade." });
  });
});

describe("favoritos", () => {
  it("favorita os visíveis ainda não favoritos, com lista para marcar", () => {
    const result = run("fav.visible", state({ category: "Imagens", favorites: ["a1"] }));
    expect(result).toEqual({
      ok: true,
      count: 1,
      summary: "1 ativo(s) adicionado(s) aos favoritos",
      items: [{ id: "a5", label: "logo.png", badge: "Imagens" }],
      favorites: ["a1", "a5"],
    });
    const chosen = run("fav.visible", state(), { selectedItems: ["a3", "a4"] });
    expect(chosen.favorites).toEqual(["a3", "a4"]);
    expect(chosen.items.map((item) => item.badge)).toEqual(["Imagens", "Vídeos", "Áudio", "Documentos", "Imagens"]);
    expect(run("fav.visible", state(), { selectedItems: [] })).toEqual({ ok: false, summary: "Marque ao menos um ativo da lista para favoritar." });
    expect(run("fav.visible", state({ query: "nada" })).ok).toBe(false);
  });

  it("limpa favoritos sem apagar arquivos", () => {
    expect(run("fav.clear", state({ favorites: ["a1", "a2"] }))).toEqual({ ok: true, count: 2, summary: "2 favorito(s) removido(s) (os arquivos continuam na biblioteca)", favorites: [] });
    expect(run("fav.clear", state())).toEqual({ ok: false, summary: "Não há favoritos para remover." });
  });
});

describe("pastas", () => {
  it("cria pasta com nome válido e único", () => {
    expect(run("folder.create", state())).toEqual({ ok: true, count: 1, summary: "Pasta “Nova pasta” criada", folders: [...FOLDERS, { id: "n0", name: "Nova pasta" }] });
    expect(run("folder.create", state(), { name: "  " })).toEqual({ ok: false, summary: "Digite um nome para a pasta." });
    expect(run("folder.create", state(), { name: undefined }).ok).toBe(false);
    expect(run("folder.create", state(), { name: "projetos" })).toEqual({ ok: false, summary: "Já existe uma pasta chamada “projetos”." });
  });

  it("renomeia pasta existente", () => {
    const result = run("folder.rename", state(), { folder: "identidade", name: "Marca" });
    expect(result.summary).toBe("Pasta “Identidade visual” renomeada para “Marca”");
    expect(result.folders[1]).toEqual({ id: "identidade", name: "Marca" });
    expect(result.folders[0]).toBe(FOLDERS[0]);
    expect(run("folder.rename", state(), { name: "PROJETOS 2" }).ok).toBe(true);
    expect(run("folder.rename", state(), { folder: "projetos", name: "Projetos" })).toEqual({ ok: false, summary: "O novo nome é igual ao atual." });
    expect(run("folder.rename", state(), { folder: "projetos", name: "PROJETOS" }).ok).toBe(true);
    expect(run("folder.rename", state(), { folder: "projetos", name: "referências" })).toEqual({ ok: false, summary: "Já existe uma pasta chamada “referências”." });
    expect(run("folder.rename", state(), { folder: "sumiu", name: "X" })).toEqual({ ok: false, summary: "Escolha uma pasta existente." });
  });

  it("ordena de A a Z e avisa quando já está em ordem", () => {
    const result = run("folder.sort", state());
    expect(result).toMatchObject({ ok: true, count: 3, summary: "3 pasta(s) em ordem alfabética" });
    expect(result.folders.map((folder) => folder.id)).toEqual(["identidade", "projetos", "referencias"]);
    expect(run("folder.sort", state({ folders: result.folders }))).toEqual({ ok: false, summary: "As pastas já estão em ordem alfabética." });
  });

  it("remove a pasta da lista sem apagar arquivos", () => {
    expect(run("folder.remove", state(), { folder: "referencias" })).toEqual({
      ok: true,
      count: 1,
      summary: "Pasta “Referências” removida da lista (os ativos dela voltam para Sem pasta; nenhum arquivo foi apagado)",
      folders: FOLDERS.slice(0, 2),
    });
    // Pasta com ativos e aberta: solta os ativos e fecha a pasta.
    const result = run("folder.remove", state({ folderAssets: { referencias: ["a1"], projetos: ["a2"] }, openFolder: "referencias", section: "Pastas" }), { folder: "referencias" });
    expect(result).toMatchObject({ ok: true, folderAssets: { projetos: ["a2"] }, openFolder: "" });
  });

  it("move os ativos visíveis (marcados) para a pasta; cada ativo fica em uma pasta só", () => {
    const result = run("assets.move", state({ category: "Imagens", folderAssets: { projetos: ["a1"] } }), { folder: "identidade" });
    expect(result).toEqual({
      ok: true,
      count: 2,
      summary: "2 ativo(s) guardado(s) em “Identidade visual” (o arquivo não muda de lugar no computador)",
      items: [
        { id: "a1", label: "Logo.png", badge: "Imagens" },
        { id: "a5", label: "logo.png", badge: "Imagens" },
      ],
      folderAssets: { projetos: [], identidade: ["a1", "a5"] },
    });
    // Só os marcados; quem já está na pasta não aparece de novo.
    const chosen = run("assets.move", state({ folderAssets: { projetos: ["a1"] } }), { folder: "projetos", selectedItems: ["a3"] });
    expect(chosen.folderAssets).toEqual({ projetos: ["a1", "a3"] });
    expect(chosen.items.map((item) => item.id)).toEqual(["a2", "a3", "a4", "a5"]);
    expect(run("assets.move", state(), { selectedItems: ["a4"] }).folderAssets).toEqual({ projetos: ["a4"] });
    expect(run("assets.move", state(), { selectedItems: [] })).toEqual({ ok: false, summary: "Marque ao menos um ativo da lista para mover." });
    expect(run("assets.move", state({ query: "nada" }))).toEqual({ ok: false, summary: "Todos os ativos visíveis já estão em “Projetos” (ou não há ativos com os filtros atuais)." });
    expect(run("assets.move", state({ folders: [] }))).toEqual({ ok: false, summary: "Escolha uma pasta existente." });
  });

  it("esvazia a pasta sem apagar arquivos", () => {
    expect(run("folder.empty", state({ folderAssets: { projetos: ["a1", "a2"], identidade: ["a3"] } }))).toEqual({
      ok: true,
      count: 2,
      summary: "Pasta “Projetos” esvaziada: 2 ativo(s) voltaram para Sem pasta (nenhum arquivo foi apagado)",
      folderAssets: { identidade: ["a3"] },
    });
    expect(run("folder.empty", state(), { folder: "identidade" })).toEqual({ ok: false, summary: "A pasta “Identidade visual” já está vazia." });
  });
});

describe("visão da grade", () => {
  const organized = (extra) => state({ folderAssets: { projetos: ["a1", "a2"], antiga: ["a3"] }, trashed: ["a2"], ...extra });
  const ids = (current) => visibleAssets(current).map((item) => item.id);

  it("Lixeira oculta os ativos fora dela e mostra só eles dentro", () => {
    expect(ids(organized())).toEqual(["a1", "a3", "a4", "a5"]);
    expect(ids(organized({ section: "Lixeira" }))).toEqual(["a2"]);
  });

  it("pasta aberta mostra só os ativos dela; Sem pasta ignora pastas que não existem mais", () => {
    expect(ids(organized({ section: "Pastas", openFolder: "projetos" }))).toEqual(["a1"]);
    expect(ids(organized({ section: "Pastas", openFolder: "vazia" }))).toEqual([]);
    expect(ids(organized({ section: "Pastas" }))).toEqual(["a1", "a3", "a4", "a5"]);
    expect(ids(organized({ section: "Sem pasta" }))).toEqual(["a3", "a4", "a5"]);
    expect(ids(state({ section: "Sem pasta" }))).toHaveLength(5);
    expect(ids(state({ section: "Pastas", openFolder: "projetos" }))).toEqual([]);
  });

  it("a busca também encontra pela etiqueta", () => {
    expect(ids(state({ query: "CLIENTE", assetTags: { a3: ["cliente x"] } }))).toEqual(["a3"]);
    expect(filterAssets(ASSETS, "Todos", "", { a3: ["x"] })).toHaveLength(5);
  });

  it("tagCounts conta etiquetas de ativos fora da Lixeira, em ordem alfabética", () => {
    expect(tagCounts(state({ assetTags: { a1: ["vinheta", "aprovado"], a2: ["aprovado"], a3: ["lixo"] }, trashed: ["a3"] }))).toEqual([
      ["aprovado", 2],
      ["vinheta", 1],
    ]);
    expect(tagCounts({ assets: ASSETS })).toEqual([]);
  });
});

describe("organizar", () => {
  it("adiciona etiqueta normalizada aos visíveis que ainda não têm", () => {
    const result = run("assets.tags", state({ category: "Imagens", assetTags: { a1: ["cliente x"] } }), { tag: "  Cliente   X " });
    expect(result).toEqual({
      ok: true,
      count: 1,
      summary: "Etiqueta “cliente x” adicionada a 1 ativo(s)",
      items: [{ id: "a5", label: "logo.png", badge: "Imagens" }],
      assetTags: { a1: ["cliente x"], a5: ["cliente x"] },
    });
    expect(run("assets.tags", state(), { tag: "nova", selectedItems: ["a2"] }).assetTags).toEqual({ a2: ["nova"] });
    expect(run("assets.tags", state({ assetTags: { a2: ["b"] } }), { tag: "a", selectedItems: ["a2"] }).assetTags).toEqual({ a2: ["b", "a"] });
    expect(run("assets.tags", state(), { tag: "nova", selectedItems: [] })).toEqual({ ok: false, summary: "Marque ao menos um ativo da lista para etiquetar." });
    expect(run("assets.tags", state({ query: "nada" }), { tag: "x" })).toEqual({ ok: false, summary: "Todos os ativos visíveis já têm a etiqueta “x” (ou não há ativos com os filtros atuais)." });
  });

  it("retira a etiqueta só de quem tem e valida o texto", () => {
    const tags = { a1: ["aprovado", "logo"], a2: ["aprovado"], a3: ["outra"] };
    const result = run("assets.tags", state({ assetTags: tags }), { action: "remove", tag: "Aprovado" });
    expect(result).toMatchObject({ ok: true, count: 2, summary: "Etiqueta “aprovado” retirada de 2 ativo(s)", assetTags: { a1: ["logo"], a3: ["outra"] } });
    expect(result.items.map((item) => item.id)).toEqual(["a1", "a2"]);
    expect(run("assets.tags", state({ assetTags: tags }), { action: "remove", tag: "aprovado", selectedItems: [] })).toEqual({ ok: false, summary: "Marque ao menos um ativo da lista para retirar a etiqueta." });
    expect(run("assets.tags", state(), { action: "remove", tag: "x" })).toEqual({ ok: false, summary: "Nenhum ativo visível tem a etiqueta “x”." });
    expect(run("assets.tags", state())).toEqual({ ok: false, summary: "Digite a etiqueta." });
    expect(run("assets.tags", state(), { tag: undefined }).ok).toBe(false);
    expect(run("assets.tags", state(), { tag: "x".repeat(31) })).toEqual({ ok: false, summary: "Use uma etiqueta de até 30 caracteres." });
  });

  it("excluir manda os visíveis (marcados) para a Lixeira sem apagar arquivos", () => {
    const result = run("assets.delete", state({ category: "Áudio", trashed: ["a1"] }));
    expect(result).toEqual({
      ok: true,
      count: 1,
      summary: "1 ativo(s) na Lixeira da biblioteca (nenhum arquivo foi apagado; restaure pela seção Lixeira)",
      items: [{ id: "a3", label: "Trilha.mp3", badge: "Áudio" }],
      trashed: ["a1", "a3"],
    });
    expect(run("assets.delete", state(), { selectedItems: ["a4"] }).trashed).toEqual(["a4"]);
    expect(run("assets.delete", state(), { selectedItems: [] })).toEqual({ ok: false, summary: "Marque ao menos um ativo da lista para excluir." });
    expect(run("assets.delete", state({ query: "nada" }))).toEqual({ ok: false, summary: "Não há ativos visíveis para mover para a Lixeira." });
    expect(run("assets.delete", state({ section: "Lixeira", trashed: ["a1"] }))).toEqual({ ok: false, summary: "Você está na Lixeira: volte para Todos os ativos para escolher o que excluir." });
  });

  it("restaura da Lixeira os marcados", () => {
    expect(run("assets.restore", state({ trashed: ["a2", "a4", "sumiu"] }))).toEqual({
      ok: true,
      count: 2,
      summary: "2 ativo(s) restaurado(s) da Lixeira",
      items: [
        { id: "a2", label: "Entrevista.mp4", badge: "Vídeos" },
        { id: "a4", label: "Roteiro.pdf", badge: "Documentos" },
      ],
      trashed: ["sumiu"],
    });
    expect(run("assets.restore", state({ trashed: ["a2", "a4"] }), { selectedItems: ["a4"] }).trashed).toEqual(["a2"]);
    expect(run("assets.restore", state({ trashed: ["a2"] }), { selectedItems: [] })).toEqual({ ok: false, summary: "Marque ao menos um ativo da lista para restaurar." });
    expect(run("assets.restore", state())).toEqual({ ok: false, summary: "A Lixeira está vazia." });
  });

  it("filtros e favoritos ignoram os ativos da Lixeira", () => {
    const current = state({ trashed: ["a1", "a5"] });
    expect(run("filter.category", current).count).toBe(0);
    expect(run("filter.search", current, { query: "logo" }).count).toBe(0);
    expect(run("filter.clear", { ...current, section: "Lixeira" })).toMatchObject({ count: 3, summary: "Filtros limpos: 3 ativo(s) à vista" });
    expect(run("fav.visible", current).favorites).toEqual(["a2", "a3", "a4"]);
  });
});

describe("relatórios", () => {
  it("inventário conta por categoria, favoritos e pastas sem alterar nada", () => {
    expect(run("report.inventory", state({ favorites: ["a1", "sumiu"], assets: ASSETS.slice(0, 2) }))).toEqual({
      ok: true,
      count: 0,
      headline: { count: 2, text: "ativo(s) na biblioteca", aside: "1 favorito(s)" },
      summary: "Imagens: 1 · Vídeos: 1 · Áudio: 0 · Documentos: 0",
      details: ["Imagens: 1", "Vídeos: 1", "Pastas: 3"],
    });
    expect(run("report.inventory", state({ assets: [] }))).toEqual({ ok: false, summary: "A biblioteca ainda não tem ativos." });
    // Etiquetas e Lixeira entram no relatório; ativos da Lixeira não contam como ativos nem favoritos.
    expect(run("report.inventory", state({ favorites: ["a2"], trashed: ["a2"], assetTags: { a1: ["x"], a3: ["y"] }, assets: ASSETS.slice(0, 3) }))).toMatchObject({
      headline: { count: 2, aside: "0 favorito(s)" },
      details: ["Imagens: 1", "Áudio: 1", "Pastas: 3", "Etiquetas: 2", "Na Lixeira: 1"],
    });
  });

  it("encontra repetidos por nome e tipo", () => {
    const result = run("report.duplicates", state({ assets: [...ASSETS, asset("a6", "LOGO.PNG", "image/png"), asset("a7", "Trilha.mp3", "audio/mpeg")] }));
    expect(result).toEqual({
      ok: true,
      count: 0,
      headline: { count: 3, text: "cópia(s) com o mesmo nome e tipo" },
      summary: "2 nome(s) repetido(s); revise antes de usar nos editores (nada foi apagado).",
      details: ["Logo.png × 3", "Trilha.mp3 × 2"],
    });
    expect(run("report.duplicates", state({ assets: ASSETS.slice(1) }))).toMatchObject({ ok: true, headline: { count: 0 }, summary: "Nenhum ativo repetido encontrado.", details: [] });
  });
});
