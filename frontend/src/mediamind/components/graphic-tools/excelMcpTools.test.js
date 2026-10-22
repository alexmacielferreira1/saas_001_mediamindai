import { describe, expect, it } from "vitest";
import { EXCEL_TABS, excelCatalogue, parseRange, runExcelTool, shiftFormula } from "./excelMcpTools";

const book = (cells = {}, formats = {}) => ({ sheets: [{ id: "s1", name: "Planilha1", cells, formats }], active: "s1" });
const state = (cells, formats, selected = "A1") => ({ book: book(cells, formats), selected });
const env = { newId: () => "novo" };
const run = (id, current, params) => runExcelTool(id, current, params, env);
const sheetOf = (result, id = "s1") => result.book.sheets.find((item) => item.id === id);
const table = {
  A1: "Nome", B1: "Valor", C1: "Cidade",
  A2: "Bia", B2: "30", C2: "Rio",
  A3: "Ana", B3: "10", C3: "SP",
  A4: "Caio", B4: "20", C4: "Rio",
};

describe("catálogo do Excel", () => {
  it("lista guias e ferramentas, com o intervalo preenchido e a célula selecionada como padrão", () => {
    const catalogue = excelCatalogue(state(table, {}, "C7"));
    expect(catalogue.tabs).toBe(EXCEL_TABS);
    expect(catalogue.tools.length).toBeGreaterThanOrEqual(10);
    expect(new Set(catalogue.tools.map((tool) => tool.tab))).toEqual(new Set(EXCEL_TABS.map((tab) => tab.id)));
    expect(new Set(catalogue.tools.map((tool) => tool.icon)).size).toBe(catalogue.tools.length);
    const params = (id) => Object.fromEntries(catalogue.tools.find((tool) => tool.id === id).params.map((param) => [param.key, param]));
    expect(params("dados.ordenar").range.default).toBe("A1:C4");
    expect(params("dados.ordenar").column).toMatchObject({ default: "A", options: [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"]] });
    expect(params("preencher.serie").start.default).toBe("C7");
    const wide = excelCatalogue(state({ B2: "1", H9: "x" }, {}, ""));
    expect(wide.tools[0].params[0].default).toBe("B2:H9");
    expect(wide.tools[0].params[1].options.at(-1)).toEqual(["H", "H"]);
    expect(wide.tools.find((tool) => tool.id === "preencher.serie").params[0].default).toBe("A1");
    expect(excelCatalogue().tools[0].params[0].default).toBe("A1");
    expect(catalogue.tools.filter((tool) => tool.status === "soon")).toEqual([]);
  });

  it("valida intervalos e ferramentas desconhecidas", () => {
    expect(parseRange(" c3 : a1 ")).toEqual({ c1: 0, c2: 2, r1: 1, r2: 3 });
    expect(parseRange("B2")).toEqual({ c1: 1, c2: 1, r1: 2, r2: 2 });
    for (const bad of ["", "A0", "1A", "A1:", "XFE1", "A1048577", undefined]) expect(() => parseRange(bad)).toThrow("Intervalo inválido");
    expect(() => parseRange("A1:Z5000")).toThrow("grande demais");
    expect(run("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(run("dados.ordenar", state(table), { range: "A1:Z" }).summary).toMatch(/Intervalo inválido/);
    expect(() => run("dados.espacos", state({ A1: 5 }), { range: "A1" })).toThrow(TypeError);
    expect(runExcelTool("dados.filtrar", state(table), { range: "A1:C4", column: "C", value: "Rio" }).book.active).toMatch(/^sheet-/);
  });
});

describe("dados", () => {
  it("ordena linhas inteiras (com formatos), números antes de texto e vazios no fim", () => {
    const result = run("dados.ordenar", state(table, { B3: { bold: true } }), { range: "A1:C4", column: "B" });
    expect(result).toMatchObject({ ok: true, count: 3, summary: "3 linha(s) de A1:C4 ordenadas pela coluna B (crescente)" });
    const sheet = sheetOf(result);
    expect([sheet.cells.A2, sheet.cells.A3, sheet.cells.A4]).toEqual(["Ana", "Caio", "Bia"]);
    expect(sheet.formats).toEqual({ B2: { bold: true } });
    expect(sheet.cells.A1).toBe("Nome");
    const desc = sheetOf(run("dados.ordenar", state(table), { range: "A1:C4", column: "A", order: "desc" }));
    expect([desc.cells.A2, desc.cells.A3, desc.cells.A4]).toEqual(["Caio", "Bia", "Ana"]);
    const mixed = sheetOf(run("dados.ordenar", state({ A1: "b", A2: "TRUE", A4: "3", A5: "a", A6: "1" }), { range: "A1:A6", column: "A", header: false }));
    expect([1, 2, 3, 4, 5, 6].map((row) => mixed.cells[`A${row}`])).toEqual(["1", "3", "a", "b", "TRUE", undefined]);
    const empties = sheetOf(run("dados.ordenar", state({ A2: "2", A4: "1" }), { range: "A1:A4", column: "A", header: false }));
    expect([1, 2, 3, 4].map((row) => empties.cells[`A${row}`])).toEqual(["1", "2", undefined, undefined]);
    expect(run("dados.ordenar", state(table), { range: "A1:C4", column: "A", header: true, order: "asc", }).summary).toMatch(/ordenadas/);
    expect(run("dados.ordenar", state({ A1: "1", A2: "2" }), { range: "A1:A2", column: "A", header: false })).toEqual({ ok: false, summary: "O intervalo já está nessa ordem." });
    expect(run("dados.ordenar", state(table), { range: "A1:C4", column: "F" }).summary).toBe("A coluna F está fora do intervalo A1:C4.");
    expect(run("dados.ordenar", state(table), { range: "A1:C2", column: "A" }).summary).toBe("Precisa de ao menos duas linhas de dados.");
    expect(run("dados.ordenar", state({ ...table, B5: "=SUM(B2:B4)" }), { range: "A1:C5", column: "A" }).summary).toMatch(/tem fórmulas: ordenar/);
  });

  it("filtra para uma planilha nova com valores calculados", () => {
    const cells = { ...table, D1: "Dobro", D2: "=B2*2", D3: "=B3*2", D4: '="="&A4', E3: "=1/0" };
    const result = run("dados.filtrar", state(cells), { range: "A1:E4", column: "C", operator: "eq", value: " rio " });
    expect(result).toMatchObject({ ok: true, count: 2, summary: "2 de 3 linha(s) com C igual a “ rio ” copiadas para a planilha “Filtro”" });
    expect(result.book.active).toBe("novo");
    expect(sheetOf(result, "novo").cells).toEqual({ A1: "Nome", B1: "Valor", C1: "Cidade", D1: "Dobro", A2: "Bia", B2: "30", C2: "Rio", D2: "60", A3: "Caio", B3: "20", C3: "Rio", D3: " =Caio" });
    const numbers = (operator, value) => run("dados.filtrar", state(cells), { range: "A1:E4", column: "B", operator, value });
    expect(numbers("gt", "15").count).toBe(2);
    expect(numbers("lt", "15").count).toBe(1);
    expect(numbers("ge", "20").count).toBe(2);
    expect(numbers("le", "20,0").count).toBe(2);
    expect(numbers("eq", "30").count).toBe(1);
    expect(numbers("ne", "30").count).toBe(2);
    expect(numbers("gt", "abc")).toEqual({ ok: false, summary: "Para maior/menor, digite um número no valor." });
    expect(run("dados.filtrar", state(cells), { range: "A1:E4", column: "A", operator: "gt", value: "1" })).toEqual({ ok: false, summary: "Nenhuma linha atende ao filtro." });
    const errors = run("dados.filtrar", state(cells), { range: "A2:E4", column: "A", operator: "contains", value: "A", header: false });
    expect(sheetOf(errors, "novo").cells).toMatchObject({ A1: "Bia", A2: "Ana", E2: "#DIV/0!" });
    const taken = { sheets: [...book(cells).sheets, { id: "f", name: "filtro", cells: {} }, { id: "f2", name: "Filtro 2", cells: {} }], active: "s1" };
    expect(run("dados.filtrar", { book: taken }, { range: "A1:C4", column: "C", value: "SP" }).summary).toMatch(/planilha “Filtro 3”/);
    expect(run("dados.filtrar", state(cells), { range: "A1:C4", column: "C", value: undefined, operator: "contains" }).count).toBe(3);
    expect(run("dados.filtrar", state(cells), { range: "A1:C1", column: "C" }).summary).toBe("O intervalo precisa de ao menos uma linha de dados.");
  });

  it("remove linhas duplicadas e limpa espaços", () => {
    const cells = { A1: "Nome", A2: "Ana", B2: "1", A3: " ana ", B3: "1", A4: "Bia", B4: "2", A5: "Ana", B5: "1" };
    const result = run("dados.duplicadas", state(cells, { A4: { bold: true } }), { range: "A1:B5" });
    expect(result).toMatchObject({ ok: true, count: 2, summary: "2 linha(s) duplicada(s) removida(s); 2 linha(s) única(s) mantida(s) em A1:B5" });
    const sheet = sheetOf(result);
    expect(sheet.cells).toEqual({ A1: "Nome", A2: "Ana", B2: "1", A3: "Bia", B3: "2" });
    expect(sheet.formats).toEqual({ A3: { bold: true } });
    expect(sheetOf(run("dados.duplicadas", state({ A1: "a", A3: "a" }), { range: "A1:A4", header: false })).cells).toEqual({ A1: "a" });
    const two = { sheets: [...book({ A1: " x " }).sheets, { id: "s2", name: "Outra", cells: { A1: " y " }, formats: {} }], active: "s1" };
    expect(run("dados.espacos", { book: two }, { range: "A1" }).book.sheets[1].cells).toEqual({ A1: " y " });
    expect(sheetOf(run("dados.ordenar", state({ A1: "2", A2: "1", A3: "1" }), { range: "A1:A3", column: "A", header: false })).cells).toEqual({ A1: "1", A2: "1", A3: "2" });
    expect(run("dados.duplicadas", state({ A1: "a", A2: "b" }), { range: "A1:A2", header: false })).toEqual({ ok: false, summary: "Nenhuma linha duplicada no intervalo." });
    const trimmed = run("dados.espacos", state({ A1: "  a   b ", A2: "ok", A3: "=A1", A4: "   " }), { range: "A1:A5" });
    expect(trimmed).toMatchObject({ ok: true, count: 2, summary: "Espaços limpos em 2 célula(s)" });
    expect(sheetOf(trimmed).cells).toEqual({ A1: "a b", A2: "ok", A3: "=A1" });
    expect(run("dados.espacos", state({ A1: "ok" }), { range: "A1" })).toEqual({ ok: false, summary: "Nenhuma célula com espaços sobrando no intervalo." });
  });
});

describe("fórmulas", () => {
  it("cria a linha de totais com fórmulas reais e rótulo", () => {
    const result = run("formulas.totais", state(table), { range: "A1:C4" });
    expect(result).toMatchObject({ ok: true, count: 1, summary: "Linha de total na linha 5 (1 coluna(s))" });
    const sheet = sheetOf(result);
    expect(sheet.cells).toMatchObject({ A5: "Total", B5: "=SUM(B2:B4)" });
    expect(sheet.formats).toEqual({ A5: { bold: true }, B5: { bold: true } });
    const average = sheetOf(run("formulas.totais", state({ A1: "1", B1: "2" }), { range: "A1:B1", fn: "AVERAGE", header: false }));
    expect(average.cells).toMatchObject({ A2: "=AVERAGE(A1:A1)", B2: "=AVERAGE(B1:B1)" });
    expect(run("formulas.totais", state({ ...table, B5: "x" }), { range: "A1:C4" }).summary).toBe("B5 já tem(têm) dados. Escolha outro intervalo para não sobrescrever.");
    expect(run("formulas.totais", state({ A1: "a", A2: "b" }), { range: "A1:A2" }).summary).toBe("O intervalo não tem números para totalizar.");
    expect(run("formulas.totais", state({}), { range: "A1048576" , header: false }).summary).toBe("Não há linha abaixo do intervalo.");
  });

  it("cria a coluna de total por linha", () => {
    const result = run("formulas.linhas", state({ A1: "Jan", B1: "Fev", A2: "1", B2: "2", A3: "x" }), { range: "A1:B3" });
    expect(result).toMatchObject({ ok: true, count: 1, summary: "Coluna C com o total de 1 linha(s)" });
    expect(sheetOf(result).cells).toMatchObject({ C1: "Total", C2: "=SUM(A2:B2)" });
    expect(sheetOf(run("formulas.linhas", state({ A1: "1" }), { range: "A1", header: false })).cells).toEqual({ A1: "1", B1: "=SUM(A1:A1)" });
    expect(run("formulas.linhas", state({ A1: "a" }), { range: "A1", header: false }).summary).toBe("Nenhuma linha com números no intervalo.");
    expect(run("formulas.linhas", state({ A1: "1", B1: "x" }), { range: "A1", header: false }).summary).toMatch(/^B1 já tem/);
    expect(run("formulas.linhas", state({}), { range: "XFD1", header: false }).summary).toBe("Não há coluna à direita do intervalo.");
  });

  it("converte fórmulas em valores e mantém as com erro", () => {
    const result = run("formulas.valores", state({ A1: "2", A2: "=A1*3", A3: "=1/0", A4: "=A9", A5: '="x"' }), { range: "A1:A6" });
    expect(result).toMatchObject({ ok: true, count: 3, summary: "3 fórmula(s) convertida(s) em valor; 1 com erro mantida(s)" });
    expect(sheetOf(result).cells).toEqual({ A1: "2", A2: "6", A3: "=1/0", A5: "x" });
    expect(run("formulas.valores", state({ A1: "=TRUE" }), { range: "A1" })).toMatchObject({ summary: "1 fórmula(s) convertida(s) em valor" });
    expect(sheetOf(run("formulas.valores", state({ A1: "=1=2" }), { range: "A1" })).cells.A1).toBe("FALSE");
    expect(run("formulas.valores", state({ A1: "1" }), { range: "A1" }).summary).toBe("O intervalo não tem fórmulas.");
    expect(run("formulas.valores", state({ A1: "=1/0" }), { range: "A1" }).summary).toBe("Todas as fórmulas do intervalo dão erro; nada foi convertido.");
  });

  it("resume o intervalo sem alterar nada", () => {
    const result = run("formulas.resumo", state({ ...table, B5: "=B2+0.5" }), { range: "A1:C5" });
    expect(result).toEqual({
      ok: true,
      count: 0,
      summary: "Soma 90,5 · média 22,63 em A1:C5",
      headline: { count: "90,5", text: "soma", aside: "A1:C5" },
      details: ["Média: 22,63", "Mínimo: 10", "Máximo: 30,5", "Números: 4", "Células preenchidas: 13"],
    });
    expect(run("formulas.resumo", state(table), { range: "A1:A4" }).summary).toBe("O intervalo não tem números.");
  });
});

describe("formatar", () => {
  it("aplica formato de número nas células preenchidas", () => {
    const result = run("formatar.numero", state(table, { B2: { bold: true } }), { range: "B2:B9" });
    expect(result).toMatchObject({ ok: true, count: 3, summary: "Formato Moeda (R$) em 3 célula(s)" });
    expect(sheetOf(result).formats).toEqual({ B2: { bold: true, numFmt: "currency" }, B3: { numFmt: "currency" }, B4: { numFmt: "currency" } });
    const general = sheetOf(run("formatar.numero", { book: result.book }, { range: "B2:B4", format: "general" }));
    expect(general.formats).toEqual({ B2: { bold: true }, B3: {}, B4: {} });
    expect(run("formatar.numero", state(table), { range: "E1:E3" }).summary).toBe("O intervalo está vazio.");
  });

  it("define negrito/itálico no cabeçalho ou no intervalo e limpa formatos", () => {
    const header = run("formatar.estilo", state(table), { range: "A1:C4" });
    expect(header).toMatchObject({ ok: true, count: 3, summary: "Negrito em 3 célula(s) do cabeçalho" });
    expect(sheetOf(header).formats.A1).toEqual({ bold: true, italic: false });
    expect(run("formatar.estilo", state(table), { range: "A1:A4", target: "all", bold: false, italic: true }).summary).toBe("Itálico em 4 célula(s)");
    expect(run("formatar.estilo", state(table), { range: "A1", bold: true, italic: true }).summary).toBe("Negrito e itálico em 1 célula(s) do cabeçalho");
    expect(run("formatar.estilo", state(table), { range: "A1", bold: false }).summary).toBe("Texto normal em 1 célula(s) do cabeçalho");
    const cleared = run("formatar.limpar", { book: header.book }, { range: "A1:B9" });
    expect(cleared).toMatchObject({ ok: true, count: 2, summary: "Formatação removida de 2 célula(s)" });
    expect(sheetOf(cleared).formats).toEqual({ C1: { bold: true, italic: false } });
    expect(run("formatar.limpar", state(table), { range: "A1:C4" }).summary).toBe("O intervalo não tem formatação.");
  });
});

describe("preencher", () => {
  it("preenche séries de números, texto, meses e dias", () => {
    const numbers = run("preencher.serie", state({}), { start: "b2", count: 3, from: 0, step: 0.5 });
    expect(numbers).toMatchObject({ ok: true, count: 3, summary: "Série de 3 valor(es) em B2:B4 (0 … 1)" });
    expect(sheetOf(numbers).cells).toEqual({ B2: "0", B3: "0.5", B4: "1" });
    expect(sheetOf(run("preencher.serie", state({}), { start: "A1", direction: "right", kind: "text", count: 2 })).cells).toEqual({ A1: "Item 1", B1: "Item 2" });
    expect(sheetOf(run("preencher.serie", state({}), { kind: "month", count: 3, from: 11 })).cells).toEqual({ A1: "Novembro", A2: "Dezembro", A3: "Janeiro" });
    expect(sheetOf(run("preencher.serie", state({}), { kind: "weekday", count: 2, from: 1, step: -1 })).cells).toEqual({ A1: "Segunda", A2: "Domingo" });
    expect(run("preencher.serie", state({ A2: "x" }), { count: 3 }).summary).toBe("A2 já tem(têm) dados. Escolha outro intervalo para não sobrescrever.");
    expect(sheetOf(run("preencher.serie", state({ A2: "x" }), { count: 2, overwrite: true })).cells).toEqual({ A1: "1", A2: "2" });
    expect(run("preencher.serie", state({}), { start: "A0" }).summary).toBe("Célula inicial inválida (ex.: A1).");
    expect(run("preencher.serie", state({}), { start: "nada" }).summary).toBe("Célula inicial inválida (ex.: A1).");
    expect(run("preencher.serie", state({}), { start: undefined }).summary).toBe("Célula inicial inválida (ex.: A1).");
    expect(run("preencher.serie", state({}), { kind: "text", prefix: "=CMD" }).summary).toBe("O prefixo não pode começar com “=”.");
    expect(run("preencher.serie", state({}), { start: "A1048570" }).summary).toBe("A série passa do limite da planilha.");
    expect(run("preencher.serie", state({}), { start: "XFC1", direction: "right" }).summary).toBe("A série passa do limite da planilha.");
  });

  it("preenche para baixo ajustando as referências relativas", () => {
    const cells = { A1: "1", B1: '=A1*2&"A1"', C1: "=$A$1+A$1", A3: "x" };
    const result = run("preencher.baixo", state(cells, { B1: { bold: true }, D2: { italic: true } }), { range: "A1:D3" });
    expect(result).toMatchObject({ ok: true, count: 2, summary: "Linha 1 copiada para 2 linha(s) abaixo (fórmulas com referências ajustadas)" });
    const sheet = sheetOf(result);
    expect(sheet.cells).toEqual({ A1: "1", B1: '=A1*2&"A1"', C1: "=$A$1+A$1", A2: "1", B2: '=A2*2&"A1"', C2: "=$A$1+A$1", A3: "1", B3: '=A3*2&"A1"', C3: "=$A$1+A$1" });
    expect(sheet.formats).toEqual({ B1: { bold: true }, B2: { bold: true }, B3: { bold: true } });
    expect(run("preencher.baixo", state(cells), { range: "A1:B1" }).summary).toMatch(/duas ou mais linhas/);
    expect(run("preencher.baixo", state(cells), { range: "E1:E3" }).summary).toBe("A primeira linha do intervalo está vazia.");
    expect(excelCatalogue().tools.find((tool) => tool.id === "preencher.baixo").confirm).toMatch(/Substituir/);
  });

  it("desloca só referências de verdade", () => {
    expect(shiftFormula("=SUM(A1:B2)+LOG10(C3)+Planilha2!D4+'Plan A1'!E5+$F6+G$7+ABCD1+x.A1", 2)).toBe("=SUM(A3:B4)+LOG10(C5)+Planilha2!D6+'Plan A1'!E7+$F8+G$7+ABCD1+x.A1");
  });
});

describe("cores e formatação condicional", () => {
  it("pinta e tira as cores das células", () => {
    const painted = run("formatar.cores", state(table, { A1: { bold: true } }), { range: "A1:B1", fill: "#FFEEAA", color: "#112233" });
    expect(painted).toMatchObject({ ok: true, count: 2, summary: "Cores (fundo #ffeeaa e texto #112233) em 2 célula(s)" });
    expect(sheetOf(painted).formats).toEqual({ A1: { bold: true, fill: "#ffeeaa", color: "#112233" }, B1: { fill: "#ffeeaa", color: "#112233" } });
    const again = { book: painted.book, selected: "A1" };
    expect(run("formatar.cores", again, { range: "A1:B1", fill: "#ffeeaa", color: "#112233" }).summary).toBe("O intervalo já está com essas cores.");
    const text = run("formatar.cores", again, { range: "A1", fill: "", color: "#000000" });
    expect(text.summary).toBe("Cores (texto #000000) em 1 célula(s)");
    expect(sheetOf(text).formats.A1).toEqual({ bold: true, color: "#000000" });
    const cleared = run("formatar.cores", again, { range: "A1:B1", fill: "", color: "inválida" });
    expect(cleared.summary).toBe("Cores removidas de 2 célula(s)");
    expect(sheetOf(cleared).formats).toEqual({ A1: { bold: true } });
    expect(run("formatar.cores", state(table), { range: "A1", fill: "", color: "" }).summary).toBe("O intervalo não tem cores.");
    expect(sheetOf(run("formatar.cores", state(table), { range: "C9" })).formats).toEqual({ C9: { fill: "#fff2cc" } });
  });

  it("cria regras dinâmicas sobre o valor calculado, valida e limpa", () => {
    const data = { A1: "Valor", A2: "5", A3: "15", A4: "=A2*5", A5: "texto" };
    const created = run("formatar.condicional", state(data), { range: "A2:A5", value: " 10 " });
    expect(created).toMatchObject({ ok: true, count: 2, summary: "Regra criada: A2:A5 · maior que “10” (2 célula(s) pintada(s) agora; a cor acompanha os valores)" });
    expect(sheetOf(created).rules).toEqual([{ range: "A2:A5", op: ">", value: "10", value2: "", fill: "#c6efce", color: "#006100" }]);
    const between = run("formatar.condicional", state(data), { range: "A2:A5", op: "between", value: "1", value2: "6", fill: "", color: "#FF0000" });
    expect(between.count).toBe(1);
    expect(sheetOf(between).rules[0]).toMatchObject({ value2: "6", fill: "", color: "#ff0000" });
    expect(run("formatar.condicional", state(data), { range: "A2:A5", op: "contains", value: "TEX" }).count).toBe(1);
    expect(run("formatar.condicional", state(data), { range: "A2:A5", op: "top", value: "2" }).count).toBe(2);
    expect(run("formatar.condicional", state(data), { range: "A2:A5", op: "<", value: "1" }).count).toBe(0);

    const fail = (params) => run("formatar.condicional", state(data), { range: "A2:A5", ...params }).summary;
    expect(fail({ fill: "", color: "" })).toBe("Escolha a cor de fundo, a cor do texto ou as duas.");
    expect(fail({ value: "abc" })).toBe("Para maior/menor/entre, digite um número no valor.");
    expect(fail({ op: "between", value: "1", value2: "" })).toBe("Para “entre”, digite também o segundo número.");
    expect(fail({ op: "top", value: "0" })).toMatch(/^Para N maiores/);
    expect(fail({ op: "bottom", value: "1,5" })).toMatch(/^Para N maiores/);
    expect(fail({ op: "=", value: "  " })).toBe("Digite o valor a comparar.");
    expect(fail({ value: null })).toBe("Para maior/menor/entre, digite um número no valor.");
    expect(run("formatar.condicional", state(data), { range: "A2:A5", op: "between", value: "1", value2: null }).summary).toBe("Para “entre”, digite também o segundo número.");
    const rules = Array.from({ length: 50 }, () => ({ range: "A1", op: "=", value: "x", fill: "#000000" }));
    const full = { book: { sheets: [{ id: "s1", name: "P", cells: data, rules }], active: "s1" }, selected: "A1" };
    expect(run("formatar.condicional", full, { range: "A2", value: "1" }).summary).toBe("A planilha já tem 50 regras: limpe alguma antes.");

    const withRule = { book: created.book, selected: "A1" };
    const clear = excelCatalogue(withRule).tools.find((tool) => tool.id === "formatar.condicional_limpar").params[0];
    expect(clear).toMatchObject({ default: ["0"], options: [["0", "A2:A5 · maior que “10”"]] });
    const cleaned = run("formatar.condicional_limpar", withRule, {});
    expect(cleaned).toMatchObject({ ok: true, count: 1, summary: "1 regra(s) de formatação condicional removida(s)" });
    expect(sheetOf(cleaned).rules).toEqual([]);
    expect(run("formatar.condicional_limpar", withRule, { rules: null }).summary).toBe("Escolha uma ou mais regras.");
    expect(run("formatar.condicional_limpar", state(data)).summary).toBe("A planilha ativa não tem regras de formatação condicional.");
  });
});

describe("gráficos", () => {
  const sales = { A1: "Mês", B1: "Vendas", C1: "Meta", A2: "Jan", B2: "10", C2: "12", A3: "Fev", B3: "=B2*2", C3: "x" };

  it("cria gráficos de linhas e barras a partir do intervalo e valida", () => {
    const line = run("dados.grafico", state(sales), { range: "A1:C3", type: "line", title: " Vendas " });
    expect(line).toMatchObject({ ok: true, count: 1, summary: "Gráfico de linhas de A1:C3 criado com 2 categoria(s) e 2 série(s)", details: ["Vendas", "Meta"] });
    expect(sheetOf(line).charts).toEqual([{ id: "chart-novo", range: "A1:C3", type: "line", title: "Vendas", header: true }]);
    const bar = run("dados.grafico", state(sales), { range: "A2:B3", header: false, title: null });
    expect(bar.summary).toBe("Gráfico de barras de A2:B3 criado com 2 categoria(s) e 1 série(s)");
    expect(sheetOf(bar).charts[0]).toMatchObject({ title: "", header: false, type: "bar" });

    const fail = (params, cells = sales) => run("dados.grafico", state(cells), params).summary;
    expect(fail({ range: "A1:A3" })).toMatch(/^O gráfico precisa de duas colunas/);
    expect(fail({ range: "A1:H3" })).toBe("No máximo 6 colunas de valores por gráfico.");
    expect(fail({ range: "A1:B1" })).toBe("O intervalo precisa de ao menos uma linha de dados.");
    expect(fail({ range: "A1:B102" })).toBe("No máximo 100 linhas de dados por gráfico.");
    expect(fail({ range: "A1:B2" }, { A1: "a", B1: "b", A2: "x", B2: "y" })).toBe("As colunas de valores não têm números.");
    const charts = Array.from({ length: 10 }, (_, index) => ({ id: `c${index}`, range: "A1:B3" }));
    expect(run("dados.grafico", { book: { sheets: [{ id: "s1", name: "P", cells: sales, charts }], active: "s1" } }, { range: "A1:B3" }).summary).toBe("A planilha já tem 10 gráficos: remova algum antes.");
  });

  it("remove os gráficos escolhidos", () => {
    const withCharts = { book: { sheets: [{ id: "s1", name: "P", cells: sales, charts: [{ id: "g1", range: "A1:B3", title: "Vendas" }, { id: "g2", range: "A1:C3" }] }], active: "s1" } };
    expect(excelCatalogue(withCharts).tools.find((tool) => tool.id === "dados.grafico_remover").params[0]).toMatchObject({ default: ["g1", "g2"], options: [["g1", "Vendas"], ["g2", "Gráfico de A1:C3"]] });
    const removed = run("dados.grafico_remover", withCharts, { charts: ["g2"] });
    expect(removed).toMatchObject({ ok: true, count: 1, summary: "1 gráfico(s) removido(s)" });
    expect(sheetOf(removed).charts.map((chart) => chart.id)).toEqual(["g1"]);
    expect(run("dados.grafico_remover", withCharts, { charts: ["zz"] }).summary).toBe("Escolha um ou mais gráficos.");
    expect(run("dados.grafico_remover", state(sales)).summary).toBe("A planilha ativa não tem gráficos.");
  });
});
