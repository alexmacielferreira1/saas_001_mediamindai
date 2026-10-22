import { describe, expect, it } from "vitest";
import { WORD_TABS, createCaseTransformer, runWordTool, wordCatalogue } from "./wordMcpTools";

const run = (id, html, params) => runWordTool(id, { html }, params);
const tool = (id, html = "") => wordCatalogue({ html }).tools.find((item) => item.id === id);

describe("catálogo do Word", () => {
  it("lista guias, ferramentas com ícone e os parágrafos atuais como opções", () => {
    const catalogue = wordCatalogue({ html: "<h1>Capa</h1><p>Texto</p><blockquote>Frase</blockquote><ul><li>item</li></ul><p></p>" });
    expect(catalogue.tabs).toBe(WORD_TABS);
    expect(catalogue.tools.length).toBeGreaterThanOrEqual(10);
    expect(new Set(catalogue.tools.map((item) => item.tab))).toEqual(new Set(WORD_TABS.map((tab) => tab.id)));
    expect(new Set(catalogue.tools.map((item) => item.icon)).size).toBe(catalogue.tools.length);
    for (const item of catalogue.tools) expect(item.label && item.description && item.run).toBeTruthy();
    const pick = catalogue.tools.find((item) => item.id === "estilos.aplicar").params[0];
    expect(pick.options).toEqual([
      ["0", "1 · [Título 1] Capa"],
      ["1", "2 · Texto"],
      ["2", "3 · [Citação] Frase"],
      ["3", "4 · (vazio)"],
    ]);
    expect(catalogue.tools.find((item) => item.id === "texto.caixa").params[0].default).toEqual(["0"]);
    expect(wordCatalogue().tools.find((item) => item.id === "estrutura.lista").params[0].options).toEqual([]);
    expect(catalogue.tools.filter((item) => item.status === "soon").map((item) => item.id)).toEqual(["revisao.ortografia", "revisao.notas"]);
  });

  it("ferramenta desconhecida, em breve e erros inesperados", () => {
    expect(run("nada", "<p>a</p>")).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(run("revisao.ortografia", "<p>a</p>").summary).toMatch(/^Em breve: o navegador sublinha/);
    expect(run("revisao.notas", "<p>a</p>").summary).toMatch(/notas de rodapé/);
    expect(() => run("texto.substituir", "<p>a</p>", { find: { toString: null, valueOf: null } })).toThrow(TypeError);
  });

  it("embrulha textos soltos em parágrafos e descarta espaços entre blocos", () => {
    const result = run("texto.limpar", "Solto  <b>negrito</b><br><p>A</p>   <p>B</p>\n", { removeEmpty: false });
    expect(result.html).toBe("<p>Solto <b>negrito</b><br></p><p>A</p><p>B</p>");
    expect(run("estilos.aplicar", "<br><p>x</p>", { paragraphs: ["0"], style: "h3" }).html).toBe("<h3><br></h3><p>x</p>");
    expect(run("estilos.aplicar", '<p>a</p><span>  </span><img src="x" onerror="alert(1)"><p>b</p>', { paragraphs: ["1"], style: "h2" }).html).toBe("<p>a</p><h2>b</h2>");
  });
});

describe("estilos", () => {
  it("aplica estilo de parágrafo preservando o alinhamento", () => {
    const result = run("estilos.aplicar", '<p style="text-align: center">Capa</p><p>Corpo</p>', { paragraphs: ["0", "1"], style: "h1" });
    expect(result).toMatchObject({ ok: true, count: 2, summary: "Título 1 aplicado em 2 parágrafo(s)" });
    expect(result.html).toBe('<h1 style="text-align: center">Capa</h1><h1>Corpo</h1>');
    expect(run("estilos.aplicar", "<h1>Capa</h1>", { paragraphs: [0], style: "h1" })).toEqual({ ok: false, summary: "Os parágrafos escolhidos já estão como Título 1." });
    expect(run("estilos.aplicar", "<p>a</p>")).toEqual({ ok: false, summary: "Escolha um ou mais parágrafos." });
    expect(run("estilos.aplicar", "<p>a</p>", { paragraphs: undefined })).toEqual({ ok: false, summary: "Escolha um ou mais parágrafos." });
  });

  it("detecta títulos curtos sem pontuação final", () => {
    const html = "<p>Relatório anual</p><p>Este é um parágrafo longo de verdade.</p><p>Resultados</p><p>Conclusão:</p><p></p><h2>Já título</h2>";
    const result = run("estilos.titulos", html);
    expect(result).toMatchObject({ ok: true, count: 2, details: ["Título 1: Relatório anual", "Título 2: Resultados"] });
    expect(result.html).toContain("<h1>Relatório anual</h1>");
    expect(result.html).toContain("<h2>Resultados</h2>");
    expect(result.html).toContain("<p>Conclusão:</p>");
    expect(run("estilos.titulos", "<h1>X</h1><p>Capa</p>").html).toBe("<h1>X</h1><h2>Capa</h2>");
    expect(run("estilos.titulos", "<p>Capa</p>", { firstAsTitle: false }).html).toBe("<h2>Capa</h2>");
    expect(run("estilos.titulos", "<p>um dois três</p>", { maxWords: 2 })).toEqual({ ok: false, summary: "Nenhum parágrafo curto (até 2 palavras) sem pontuação final foi encontrado." });
  });

  it("padroniza a fonte e o tamanho do corpo", () => {
    const html = '<h1>T</h1><p>a <span style="font-family: Georgia, serif; font-size: 18pt">b</span></p><hr><ul><li>i</li></ul>';
    const result = run("estilos.fonte", html, { font: "Arial", size: "12" });
    expect(result).toMatchObject({ ok: true, count: 3, summary: "Fonte Arial 12 pt em todo o documento (3 bloco(s))" });
    expect(result.html).toBe('<h1 style="font-family: Arial, Helvetica, sans-serif;">T</h1><p style="font-family: Arial, Helvetica, sans-serif; font-size: 12pt;">a <span style="">b</span></p><hr><ul style="font-family: Arial, Helvetica, sans-serif; font-size: 12pt;"><li>i</li></ul>');
    const keep = run("estilos.fonte", '<h1><span style="font-size: 18pt; font-family: Georgia">T</span></h1>');
    expect(keep.summary).toBe("Fonte Aptos em todo o documento (1 bloco(s))");
    expect(keep.html).toContain('<span style="font-size: 18pt;">T</span>');
    expect(run("estilos.fonte", "<hr>")).toEqual({ ok: false, summary: "O documento está vazio." });
  });

  it("alinha corpo, títulos ou tudo", () => {
    const html = "<h1>T</h1><p>a</p><hr><p>b</p>";
    const body = run("estilos.alinhar", html);
    expect(body).toMatchObject({ ok: true, count: 2, summary: "2 parágrafo(s) justificado" });
    expect(body.html).toBe('<h1>T</h1><p style="text-align: justify;">a</p><hr><p style="text-align: justify;">b</p>');
    expect(run("estilos.alinhar", html, { align: "center", target: "headings" }).html).toBe('<h1 style="text-align: center;">T</h1><p>a</p><hr><p>b</p>');
    expect(run("estilos.alinhar", html, { align: "right", target: "all" }).summary).toBe("3 parágrafo(s) à direita");
    expect(run("estilos.alinhar", '<p style="text-align: left">a</p>', { align: "left" })).toEqual({ ok: false, summary: "Os parágrafos escolhidos já estão com esse alinhamento." });
    expect(run("estilos.alinhar", "<p>a</p>", { target: "headings" })).toEqual({ ok: false, summary: "Nenhum parágrafo do tipo escolhido." });
  });
});

describe("estrutura", () => {
  it("cria listas a partir de marcadores digitados", () => {
    const html = "<p>Compras:</p><p>- pão</p><p>* <b>leite</b></p><p>1. primeiro</p><p>2) segundo</p><p>fim</p><p>• solto</p><h2>- título fica</h2>";
    const result = run("estrutura.listasAuto", html);
    expect(result).toMatchObject({ ok: true, count: 5 });
    expect(result.html).toBe("<p>Compras:</p><ul><li>pão</li><li><b>leite</b></li></ul><ol><li>primeiro</li><li>segundo</li></ol><p>fim</p><ul><li>solto</li></ul><h2>- título fica</h2>");
    expect(run("estrutura.listasAuto", "<p><b>-</b> a</p>").html).toBe("<ul><li><b></b>a</li></ul>");
    expect(run("estrutura.listasAuto", "<p>sem marcador</p>").summary).toMatch(/Nenhum parágrafo começa com marcador/);
  });

  it("transforma parágrafos escolhidos em lista e desfaz listas", () => {
    const html = "<p>a</p><p>b</p><p>c</p><p>d</p>";
    const numbered = run("estrutura.lista", html, { paragraphs: ["0", "1", "3"], kind: "ol" });
    expect(numbered).toMatchObject({ ok: true, count: 3, summary: "3 parágrafo(s) em lista numerada" });
    expect(numbered.html).toBe("<ol><li>a</li><li>b</li></ol><p>c</p><ol><li>d</li></ol>");
    expect(run("estrutura.lista", html, { paragraphs: ["2"] }).summary).toBe("1 parágrafo(s) em lista com marcadores");
    expect(run("estrutura.lista", html).summary).toBe("Escolha um ou mais parágrafos.");
    const removed = run("estrutura.removerListas", numbered.html);
    expect(removed).toMatchObject({ ok: true, count: 3, summary: "2 lista(s) desfeitas (3 parágrafo(s))" });
    expect(removed.html).toBe("<p>a</p><p>b</p><p>c</p><p>d</p>");
    expect(run("estrutura.removerListas", "<p>a</p>")).toEqual({ ok: false, summary: "O documento não tem listas." });
  });

  it("cria e atualiza o sumário com os títulos", () => {
    const html = "<h1>Relatório</h1><p>intro</p><h2>Vendas</h2><h3>Norte</h3><h2> </h2>";
    const created = run("estrutura.sumario", html);
    expect(created).toMatchObject({ ok: true, count: 3, summary: "Sumário criado com 3 título(s)", details: ["Relatório", "Vendas", "Norte"] });
    expect(created.html).toBe("<h1>Relatório</h1><h2>Sumário</h2><ul><li>Relatório</li><li>Vendas</li><li>— Norte</li></ul><p>intro</p><h2>Vendas</h2><h3>Norte</h3><h2> </h2>");
    const updated = run("estrutura.sumario", `${created.html}<h2>Custos</h2>`, { position: "start" });
    expect(updated.summary).toBe("Sumário atualizado com 4 título(s)");
    expect(updated.html.startsWith("<h2>Sumário</h2><ul><li>Relatório</li><li>Vendas</li><li>— Norte</li><li>Custos</li></ul><h1>Relatório</h1><p>intro</p>")).toBe(true);
    expect(run("estrutura.sumario", "<h2>Só</h2>").html).toBe("<h2>Sumário</h2><ul><li>Só</li></ul><h2>Só</h2>");
    expect(run("estrutura.sumario", "<h1>Único</h1>").html).toBe("<h1>Único</h1><h2>Sumário</h2><ul><li>Único</li></ul>");
    expect(run("estrutura.sumario", "<p>sem títulos</p>")).toEqual({ ok: false, summary: "Crie títulos (Título 1, 2 ou 3) antes de gerar o sumário." });
  });
});

describe("texto", () => {
  it("localiza e substitui só como texto (sem interpretar HTML)", () => {
    const html = "<p>O gato e o Gato. gatos</p><p><b>gato</b></p>";
    const result = run("texto.substituir", html, { find: "gato", replace: "<img src=x onerror=alert(1)>" });
    expect(result).toMatchObject({ ok: true, count: 3 });
    expect(result.html).toBe("<p>O &lt;img src=x onerror=alert(1)&gt; e o &lt;img src=x onerror=alert(1)&gt;. gatos</p><p><b>&lt;img src=x onerror=alert(1)&gt;</b></p>");
    expect(run("texto.substituir", html, { find: "gato", replace: "cão", caseSensitive: true, wholeWord: false })).toMatchObject({ count: 3, summary: "3 ocorrência(s) de “gato” trocada(s) por “cão”" });
    expect(run("texto.substituir", "<p>a.b a.b</p>", { find: "a.b" })).toMatchObject({ count: 2, summary: "2 ocorrência(s) de “a.b” removida(s)", html: "<p> </p>" });
    expect(run("texto.substituir", "<p>x gato</p>", { find: "gato", replace: undefined }).html).toBe("<p>x </p>");
    expect(run("texto.substituir", html, { find: "" })).toEqual({ ok: false, summary: "Digite o texto a localizar." });
    expect(run("texto.substituir", html, { find: undefined, replace: undefined })).toEqual({ ok: false, summary: "Digite o texto a localizar." });
    expect(run("texto.substituir", html, { find: "cão" })).toEqual({ ok: false, summary: "“cão” não foi encontrado no documento." });
  });

  it("muda maiúsculas e minúsculas entre trechos formatados", () => {
    const html = "<h1>relatório <b>ANUAL</b> de vendas</h1><p>olá. tudo BEM? sim!</p><p>d'água 2a vez</p>";
    expect(run("texto.caixa", html, { paragraphs: ["0"], mode: "upper" }).html).toContain("<h1>RELATÓRIO <b>ANUAL</b> DE VENDAS</h1>");
    expect(run("texto.caixa", html, { paragraphs: ["0"], mode: "lower" }).html).toContain("<h1>relatório <b>anual</b> de vendas</h1>");
    const title = run("texto.caixa", html, { paragraphs: ["0", "2"] });
    expect(title).toMatchObject({ ok: true, count: 2, summary: "Primeira Letra De Cada Palavra em 2 parágrafo(s)" });
    expect(title.html).toContain("<h1>Relatório <b>Anual</b> De Vendas</h1>");
    expect(title.html).toContain("<p>D'água 2a Vez</p>");
    expect(run("texto.caixa", html, { paragraphs: ["1"], mode: "sentence" }).html).toContain("<p>Olá. Tudo bem? Sim!</p>");
    expect(run("texto.caixa", "<p>ABC</p>", { paragraphs: ["0"], mode: "upper" })).toEqual({ ok: false, summary: "O texto escolhido já está assim." });
    expect(createCaseTransformer("upper")("ação")).toBe("AÇÃO");
  });

  it("limpa espaços e parágrafos vazios", () => {
    const html = "<p>  a    b​  </p><p> </p><p><br></p><ul><li>x</li></ul>";
    const result = run("texto.limpar", html);
    expect(result).toMatchObject({ ok: true, count: 2, summary: "Espaços limpos · 2 parágrafo(s) vazio(s) removido(s)" });
    expect(result.html).toBe("<p>a b</p><ul><li>x</li></ul>");
    expect(run("texto.limpar", "<p> </p>").html).toBe("<p><br></p>");
    expect(run("texto.limpar", "<p>a  b</p>")).toMatchObject({ count: 1, summary: "Espaços limpos", html: "<p>a b</p>" });
    expect(run("texto.limpar", "<p>a b</p><p><br></p>", { removeEmpty: false })).toEqual({ ok: false, summary: "Nada para limpar: sem espaços sobrando nem parágrafos vazios." });
  });

  it("corrige palavras repetidas em sequência", () => {
    const result = run("texto.repetidas", "<p>Isso é de de verdade, que que é é isso. Ok ok.</p><p>nada nadar</p>");
    expect(result).toMatchObject({ ok: true, count: 4, details: ["“de de”", "“que que”", "“é é”", "“Ok ok”"] });
    expect(result.html).toBe("<p>Isso é de verdade, que é isso. Ok.</p><p>nada nadar</p>");
    expect(run("texto.repetidas", "<p>tudo certo</p>").summary).toMatch(/Nenhuma palavra repetida/);
  });

  it("insere parágrafos como texto puro no início ou no fim", () => {
    const end = run("texto.inserir", "<p>a</p>", { text: "Linha <b>1</b>\n\n  \nLinha 2" });
    expect(end).toMatchObject({ ok: true, count: 2, summary: "2 parágrafo(s) (Normal) inserido(s) no fim" });
    expect(end.html).toBe("<p>a</p><p>Linha &lt;b&gt;1&lt;/b&gt;</p><p>Linha 2</p>");
    expect(run("texto.inserir", "<p>a</p>", { text: "Capa", style: "h1", position: "start" }).html).toBe("<h1>Capa</h1><p>a</p>");
    expect(run("texto.inserir", "<p><br></p>", { text: "Primeiro" }).html).toBe("<p>Primeiro</p>");
    expect(run("texto.inserir", "<hr>", { text: "Depois" }).html).toBe("<hr><p>Depois</p>");
    expect(run("texto.inserir", "<p>a</p>", { text: " \n " })).toEqual({ ok: false, summary: "Digite o texto do parágrafo." });
    expect(run("texto.inserir", "<p>a</p>", { text: undefined })).toEqual({ ok: false, summary: "Digite o texto do parágrafo." });
  });
});

describe("revisão", () => {
  it("conta palavras, caracteres, títulos, listas e frases sem alterar o documento", () => {
    const result = run("revisao.estatisticas", "<h1>Título</h1><p>Uma frase. Outra frase!</p><ul><li>item</li></ul><p></p>");
    expect(result).toEqual({
      ok: true,
      count: 0,
      summary: "6 palavras · 30 caracteres sem espaços",
      headline: { count: "6", text: "palavras", aside: "~1 min de leitura" },
      details: ["Caracteres com espaços: 33", "Caracteres sem espaços: 30", "Parágrafos: 2", "Títulos: 1", "Itens de lista: 1", "Frases: 2"],
    });
    expect(run("revisao.estatisticas", `<p>${"palavra ".repeat(450)}</p>`).headline.aside).toBe("~3 min de leitura");
    expect(run("revisao.estatisticas", "").details.at(-1)).toBe("Frases: 0");
    expect(tool("revisao.estatisticas")).toMatchObject({ analyze: false, applyLabel: "Contar" });
  });
});
