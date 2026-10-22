import { describe, expect, it } from "vitest";
import {
  CHART_COLORS,
  chartData,
  chartGeometry,
  conditionalFormats,
  describeRule,
  gridCellStyle,
  isHexColor,
  matchesRule,
  normalizeDeck,
  normalizeWorkbook,
  parseCellRange,
  rangeToText,
  sameTheme,
  slideAlignOf,
  slideThemeOf,
} from "./OfficeCraft";

const rule = (op, value = "", extra = {}) => ({ range: "A1:A9", op, value, value2: "", fill: "#ff0000", color: "", ...extra });
const valuesOf = (map) => (key) => (key in map ? map[key] : null);

describe("Excel · intervalos, cores e normalização", () => {
  it("lê intervalos e cores", () => {
    expect(parseCellRange(" c3 : a1 ")).toEqual({ c1: 0, c2: 2, r1: 1, r2: 3 });
    expect(parseCellRange("B2")).toEqual({ c1: 1, c2: 1, r1: 2, r2: 2 });
    for (const bad of ["", "A0", "XFE1", "A1048577", "A1:", null]) expect(parseCellRange(bad)).toBeNull();
    expect(rangeToText({ c1: 0, c2: 27, r1: 2, r2: 9 })).toBe("A2:AB9");
    expect(isHexColor("#A1b2C3")).toBe(true);
    for (const bad of ["#abc", "red", "url(x)", 123, undefined]) expect(isHexColor(bad)).toBe(false);
  });

  it("normaliza regras e gráficos guardados (e descarta os inválidos)", () => {
    const book = normalizeWorkbook({
      sheets: [{
        id: "s1",
        name: "Vendas",
        cells: { A1: "1" },
        rules: [
          { range: "b9:b2", op: ">", value: 10, fill: "#00FF00", color: "javascript:x" },
          { range: "B2", op: "maior", fill: "#000000" },
          { range: "B2", op: "=", value: "x" },
          { range: "zz", op: "=", fill: "#000000" },
          null,
        ],
        charts: [{ range: "A1:C5", type: "pizza", title: "x".repeat(90) }, { id: "g2", range: "A1:A5" }, { id: "g3", range: "A1:B2", type: "line", header: false }, "lixo"],
      }, { id: "s2", name: "Outra", rules: "não é lista" }],
      active: "s1",
    });
    const [sheet, other] = book.sheets;
    expect(sheet.rules).toEqual([{ range: "B2:B9", op: ">", value: "10", value2: "", fill: "#00FF00", color: "" }]);
    expect(sheet.charts).toEqual([{ id: "chart-1", range: "A1:C5", type: "bar", title: "x".repeat(80), header: true }, { id: "g3", range: "A1:B2", type: "line", title: "", header: false }]);
    expect(other).toMatchObject({ rules: [], charts: [] });
    expect(normalizeWorkbook(book)).toEqual(book);
    expect(normalizeWorkbook({ sheets: [{ rules: Array.from({ length: 60 }, () => rule(">", "1")) }] }).sheets[0].rules).toHaveLength(50);
    expect(normalizeWorkbook({}).sheets[0]).toMatchObject({ rules: [], charts: [] });
  });

  it("descreve regras", () => {
    expect(describeRule(rule(">", "10"))).toBe("A1:A9 · maior que “10”");
    expect(describeRule(rule("between", "1", { value2: "5" }))).toBe("A1:A9 · entre 1 e 5");
    expect(describeRule(rule("top", "3"))).toBe("A1:A9 · 3 maiores");
    expect(describeRule(rule("bottom", "2"))).toBe("A1:A9 · 2 menores");
    expect(describeRule(rule("contains", "ok"))).toBe("A1:A9 · contém “ok”");
  });
});

describe("Excel · avaliação da formatação condicional", () => {
  it("compara números, textos, erros e vazios", () => {
    expect(matchesRule(rule(">", "10"), 11)).toBe(true);
    expect(matchesRule(rule(">", "10"), 10)).toBe(false);
    expect(matchesRule(rule(">", "10"), "11")).toBe(false);
    expect(matchesRule(rule(">", "abc"), 11)).toBe(false);
    expect(matchesRule(rule("<", "2,5"), 2)).toBe(true);
    expect(matchesRule(rule("<", ""), 2)).toBe(false);
    expect(matchesRule(rule("between", "10", { value2: "1" }), 5)).toBe(true);
    expect(matchesRule(rule("between", "1", { value2: "4" }), 5)).toBe(false);
    expect(matchesRule(rule("between", "1", { value2: "x" }), 2)).toBe(false);
    expect(matchesRule(rule("=", "5"), 5)).toBe(true);
    expect(matchesRule(rule("=", "5"), "5 ")).toBe(true);
    expect(matchesRule(rule("=", " SIM "), "sim")).toBe(true);
    expect(matchesRule(rule("=", "verdadeiro"), true)).toBe(true);
    expect(matchesRule(rule("=", "falso"), false)).toBe(true);
    expect(matchesRule(rule("=", "#div/0!"), { error: "#DIV/0!" })).toBe(true);
    expect(matchesRule(rule("contains", "rio"), "Rio de Janeiro")).toBe(true);
    expect(matchesRule(rule("contains", ""), "Rio")).toBe(false);
    expect(matchesRule(rule("contains", "1"), 15)).toBe(true);
    for (const empty of [null, undefined, ""]) expect(matchesRule(rule("=", ""), empty)).toBe(false);
    expect(matchesRule(rule("top", "1"), 9, 9)).toBe(true);
    expect(matchesRule(rule("top", "1"), 8, 9)).toBe(false);
    expect(matchesRule(rule("bottom", "1"), 1, 2)).toBe(true);
    expect(matchesRule(rule("top", "1"), 9, undefined)).toBe(false);
    expect(matchesRule(rule("top", "1"), "9", 9)).toBe(false);
  });

  it("pinta só as células do intervalo, com N maiores/menores e a última regra por cima", () => {
    const sheet = {
      cells: { A1: "Nota", A2: "7", A3: "9", A4: "9", A5: "3", B2: "100", lixo: "x" },
      rules: [
        rule(">", "5", { fill: "#00ff00", color: "#003300" }),
        rule("top", "1", { fill: "#ff0000" }),
        rule("bottom", "10", { fill: "", color: "#0000ff", range: "A2:A5" }),
        rule(">", "1", { range: "inválido" }),
        rule("top", "0"),
      ],
    };
    const values = valuesOf({ A1: "Nota", A2: 7, A3: 9, A4: 9, A5: 3, B2: 100 });
    expect(conditionalFormats(sheet, values)).toEqual({
      A2: { fill: "#00ff00", color: "#0000ff" },
      A3: { fill: "#ff0000", color: "#0000ff" },
      A4: { fill: "#ff0000", color: "#0000ff" },
      A5: { color: "#0000ff" },
    });
    expect(conditionalFormats({ cells: { A1: "x" } }, values)).toEqual({});
    expect(conditionalFormats({ rules: [rule("top", "2")] }, values)).toEqual({});
  });

  it("monta o estilo da célula com cores manuais e condicionais", () => {
    expect(gridCellStyle(undefined, undefined)).toBeUndefined();
    expect(gridCellStyle({ bold: true, italic: true, fill: "#111111", color: "#222222" })).toEqual({ fontWeight: 700, fontStyle: "italic", backgroundColor: "#111111", color: "#222222" });
    expect(gridCellStyle({ fill: "url(x)", color: "red" }, { fill: "#ff0000" })).toEqual({ fontWeight: undefined, fontStyle: undefined, backgroundColor: "#ff0000", color: undefined });
    expect(gridCellStyle(undefined, { color: "#00ff00" })).toMatchObject({ backgroundColor: undefined, color: "#00ff00" });
  });
});

describe("Excel · gráficos", () => {
  const values = valuesOf({ A1: "Mês", B1: "Vendas", A2: "Jan", B2: 10, C2: -5, A3: "Fev", B3: 30, C3: "x", B4: 20, D1: { error: "#REF!" } });

  it("lê rótulos e séries do intervalo", () => {
    expect(chartData({ range: "A1:C4", header: true }, values)).toEqual({
      labels: ["Jan", "Fev", "4"],
      series: [{ name: "Vendas", color: CHART_COLORS[0], values: [10, 30, 20] }, { name: "Coluna C", color: CHART_COLORS[1], values: [-5, null, null] }],
    });
    expect(chartData({ range: "A2:B3", header: false }, values).series[0].name).toBe("Coluna B");
    expect(chartData({ range: "A1:D2", header: true }, values).series[2].name).toBe("#REF!");
    const wide = chartData({ range: "A1:J2", header: false }, values);
    expect(wide.series).toHaveLength(CHART_COLORS.length);
    expect(chartData({ range: "A1:B300", header: false }, values).labels).toHaveLength(100);
  });

  it("calcula barras com valores negativos e eixo no zero", () => {
    const geometry = chartGeometry({ labels: ["Jan", "Fev"], series: [{ name: "V", color: "#111111", values: [10, null] }, { name: "M", color: "#222222", values: [-10, 5] }] }, "bar");
    expect(geometry.plot).toEqual({ left: 48, top: 12, right: 468, bottom: 208 });
    expect(geometry.zero).toBe(110);
    expect(geometry.ticks).toEqual([{ value: -10, y: 208 }, { value: 0, y: 110 }, { value: 10, y: 12 }]);
    expect(geometry.bars).toEqual([
      { x: 69, y: 12, width: 84, height: 98, color: "#111111", name: "V", label: "Jan", value: 10 },
      { x: 153, y: 110, width: 84, height: 98, color: "#222222", name: "M", label: "Jan", value: -10 },
      { x: 363, y: 61, width: 84, height: 49, color: "#222222", name: "M", label: "Fev", value: 5 },
    ]);
    expect(geometry.lines).toEqual([]);
    expect(geometry.labels).toEqual([{ text: "Jan", x: 153 }, { text: "Fev", x: 363 }]);
  });

  it("calcula linhas pulando valores vazios, só zeros e rótulos longos", () => {
    const labels = Array.from({ length: 25 }, (_, index) => `Categoria número ${index + 1}`);
    const geometry = chartGeometry({ labels, series: [{ name: "Z", color: "#333333", values: labels.map((_, index) => (index === 1 ? null : 0)) }] }, "line", { width: 300, height: 100 });
    expect(geometry.ticks).toEqual([{ value: 0, y: 68 }, { value: 1, y: 12 }]);
    expect(geometry.lines[0].points).toHaveLength(24);
    expect(geometry.lines[0].points[1]).toMatchObject({ value: 0, label: "Categoria número 3", y: 68 });
    expect(geometry.labels.map((label) => label.text)).toEqual(["Categoria n…", "Categoria n…", "Categoria n…", "Categoria n…", "Categoria n…", "Categoria n…", "Categoria n…", "Categoria n…", "Categoria n…"]);
    expect(geometry.bars).toEqual([]);
    expect(chartGeometry({ labels: ["a"], series: [{ name: "x", color: "#000000", values: [null] }] }, "bar")).toBeNull();
  });
});

describe("PowerPoint · tema, alinhamento e anotações", () => {
  it("mantém apresentações antigas e normaliza os campos novos", () => {
    const [old, custom, invalid] = normalizeDeck([
      { id: 1, title: "Antigo", layout: "title-content" },
      { id: 2, title: "Novo", notes: "Falar devagar", align: "right", theme: { background: "#000000", color: "#FFFFFF" } },
      { id: 3, notes: 42, align: "diagonal", theme: { background: "red", color: "#123456" } },
    ]);
    expect(old).toMatchObject({ notes: "", align: "auto", theme: { background: "#ffffff", color: "#252525" } });
    expect(custom).toMatchObject({ notes: "Falar devagar", align: "right", theme: { background: "#000000", color: "#FFFFFF" } });
    expect(invalid).toMatchObject({ notes: "42", align: "auto", theme: { background: "#ffffff", color: "#123456" } });
    expect(slideAlignOf(old)).toBe("left");
    expect(slideAlignOf({ layout: "title" })).toBe("center");
    expect(slideAlignOf(custom)).toBe("right");
    expect(slideThemeOf(undefined)).toEqual({ background: "#ffffff", color: "#252525" });
    expect(sameTheme({ background: "#ABCDEF", color: "#000000" }, { background: "#abcdef", color: "#000000" })).toBe(true);
    expect(sameTheme({ background: "#abcdef", color: "#000000" }, { background: "#abcdef", color: "#000001" })).toBe(false);
  });
});
