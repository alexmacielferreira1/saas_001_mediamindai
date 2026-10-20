import { describe, expect, it } from "vitest";
import {
  columnToIndex, createWorkbookEvaluator, evaluateFormula, formatCellValue, indexToColumn, normalizeWorkbook,
  parseClipboardTable, parseDelimited, parseFormula, parseLiteral, sheetToCsv,
} from "./OfficeCraft";

const err = (code) => ({ error: code });

describe("GridCraft formula engine", () => {
  it("converts column letters", () => {
    expect(columnToIndex("A")).toBe(0);
    expect(columnToIndex("Z")).toBe(25);
    expect(columnToIndex("AA")).toBe(26);
    expect(indexToColumn(27)).toBe("AB");
    expect(indexToColumn(16383)).toBe("XFD");
  });

  it("evaluates arithmetic with Excel precedence", () => {
    expect(evaluateFormula("=1+2*3")).toBe(7);
    expect(evaluateFormula("=(1+2)*3")).toBe(9);
    expect(evaluateFormula("=2^3^2")).toBe(64);
    expect(evaluateFormula("=-2^2")).toBe(4);
    expect(evaluateFormula("=10/4")).toBe(2.5);
    expect(evaluateFormula("=50%")).toBe(0.5);
    expect(evaluateFormula("=1.5e2-0.5")).toBe(149.5);
    expect(evaluateFormula('="a"&"b"&1')).toBe("ab1");
    expect(evaluateFormula("=3>2")).toBe(true);
    expect(evaluateFormula("=3<>3")).toBe(false);
  });

  it("resolves cell references and coerces values", () => {
    const cells = { A1: "10", A2: "5", A3: "texto", B1: "=A1*2", C1: "1,5", D1: "20%" };
    expect(evaluateFormula("=A1+A2", cells)).toBe(15);
    expect(evaluateFormula("=B1+1", cells)).toBe(21);
    expect(evaluateFormula("=$A$1+a2", cells)).toBe(15);
    expect(evaluateFormula("=Z99+1", cells)).toBe(1);
    expect(evaluateFormula("=C1*2", cells)).toBe(3);
    expect(evaluateFormula("=D1*100", cells)).toBe(20);
    expect(evaluateFormula("=A3+1", cells)).toEqual(err("#VALUE!"));
  });

  it("evaluates SUM, AVERAGE, MIN, MAX, COUNT over ranges", () => {
    const cells = { A1: "1", A2: "2", A3: "3", A4: "x", B1: "10", B2: "" };
    expect(evaluateFormula("=SUM(A1:A4)", cells)).toBe(6);
    expect(evaluateFormula("=SUM(A1:B3, 4)", cells)).toBe(20);
    expect(evaluateFormula("=SOMA(A1:A3;1)", cells)).toBe(7);
    expect(evaluateFormula("=AVERAGE(A1:A4)", cells)).toBe(2);
    expect(evaluateFormula("=MIN(A1:B1)", cells)).toBe(1);
    expect(evaluateFormula("=MAX(A1:B1)", cells)).toBe(10);
    expect(evaluateFormula("=MAX(C1:C9)", cells)).toBe(0);
    expect(evaluateFormula("=COUNT(A1:B4)", cells)).toBe(4);
    expect(evaluateFormula('=COUNT(1,"2","x")', cells)).toBe(2);
    expect(evaluateFormula("=AVERAGE(C1:C3)", cells)).toEqual(err("#DIV/0!"));
    expect(evaluateFormula("=SUM(A3:A1)", cells)).toBe(6);
  });

  it("evaluates IF and ROUND", () => {
    const cells = { A1: "7" };
    expect(evaluateFormula('=IF(A1>5,"alto","baixo")', cells)).toBe("alto");
    expect(evaluateFormula('=SE(A1>50;"alto";"baixo")', cells)).toBe("baixo");
    expect(evaluateFormula("=IF(0,1)", cells)).toBe(false);
    expect(evaluateFormula("=IF(1,1/0,2)", cells)).toEqual(err("#DIV/0!"));
    expect(evaluateFormula("=IF(0,1/0,2)", cells)).toBe(2);
    expect(evaluateFormula("=ROUND(2.345,2)", cells)).toBe(2.35);
    expect(evaluateFormula("=ROUND(-2.5)", cells)).toBe(-3);
    expect(evaluateFormula("=ROUND(1234,-2)", cells)).toBe(1200);
    expect(evaluateFormula("=ARRED(1.005;2)", cells)).toBe(1.01);
  });

  it("returns spreadsheet errors", () => {
    expect(evaluateFormula("=1/0")).toEqual(err("#DIV/0!"));
    expect(evaluateFormula("=A0")).toEqual(err("#REF!"));
    expect(evaluateFormula("=Outra!A1")).toEqual(err("#REF!"));
    expect(evaluateFormula("=NOPE(1)")).toEqual(err("#NAME?"));
    expect(evaluateFormula("=foo")).toEqual(err("#NAME?"));
    expect(evaluateFormula("=1+")).toEqual(err("#ERROR!"));
    expect(evaluateFormula("=(1")).toEqual(err("#ERROR!"));
    expect(evaluateFormula('="abc')).toEqual(err("#ERROR!"));
    expect(evaluateFormula("=A1:A2+1")).toEqual(err("#VALUE!"));
    expect(evaluateFormula("=SUM(A1:A2)", { A1: "=1/0" })).toEqual(err("#DIV/0!"));
    expect(evaluateFormula("=10^400")).toEqual(err("#NUM!"));
  });

  it("never executes JavaScript in formulas", () => {
    expect(evaluateFormula("=alert(1)")).toEqual(err("#NAME?"));
    expect(evaluateFormula("=constructor")).toEqual(err("#NAME?"));
    expect(evaluateFormula("=1;2")).toEqual(err("#ERROR!"));
    expect(() => parseFormula("`x`")).toThrow();
  });

  it("detects circular references", () => {
    const book = { sheets: [{ id: "s", name: "Planilha1", cells: { A1: "=B1", B1: "=A1+1", C1: "=C1", D1: "=A1" } }] };
    const evaluator = createWorkbookEvaluator(book);
    expect(evaluator.value("s", "A1")).toEqual(err("#CIRC!"));
    expect(evaluator.value("s", "B1")).toEqual(err("#CIRC!"));
    expect(evaluator.value("s", "C1")).toEqual(err("#CIRC!"));
    expect(evaluator.value("s", "D1")).toEqual(err("#CIRC!"));
  });

  it("recalculates dependents and follows cross-sheet references", () => {
    const sheets = [{ id: "a", name: "Planilha1", cells: { A1: "2" } }, { id: "b", name: "Vendas 2", cells: { A1: "=Planilha1!A1*10", B1: "=SUM('Vendas 2'!A1, planilha1!A1)" } }];
    expect(createWorkbookEvaluator({ sheets }).value("b", "B1")).toBe(22);
    sheets[0].cells.A1 = "3";
    expect(createWorkbookEvaluator({ sheets }).value("b", "B1")).toBe(33);
  });

  it("parses literals", () => {
    expect(parseLiteral("")).toBeNull();
    expect(parseLiteral(" 42 ")).toBe(42);
    expect(parseLiteral("12,5")).toBe(12.5);
    expect(parseLiteral("15%")).toBe(0.15);
    expect(parseLiteral("VERDADEIRO")).toBe(true);
    expect(parseLiteral("Receita")).toBe("Receita");
  });

  it("formats values per cell", () => {
    expect(formatCellValue(0.1 + 0.2)).toBe("0.3");
    expect(formatCellValue(1234.5, { numFmt: "currency" })).toMatch(/R\$\s*1\.234,50/);
    expect(formatCellValue(0.256, { numFmt: "percent" })).toMatch(/25,6\s*%/);
    expect(formatCellValue(err("#REF!"))).toBe("#REF!");
    expect(formatCellValue(true)).toBe("VERDADEIRO");
    expect(formatCellValue(null)).toBe("");
  });

  it("migrates the legacy single-sheet storage", () => {
    const book = normalizeWorkbook({ A1: "Receita", b2: "=1+1", junk: "x" });
    expect(book.sheets).toHaveLength(1);
    expect(book.sheets[0].cells).toEqual({ A1: "Receita", B2: "=1+1" });
    expect(normalizeWorkbook(book)).toEqual(book);
  });

  it("parses clipboard TSV and CSV", () => {
    expect(parseClipboardTable("a\tb\n1\t2\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseDelimited('x,"y, z","a ""b"""\r\n1,2,3', ",")).toEqual([["x", "y, z", 'a "b"'], ["1", "2", "3"]]);
    expect(parseDelimited("a;b\n1;2", ";")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("exports computed values to CSV", () => {
    const sheet = { id: "s", name: "Planilha1", cells: { A1: "Item", B1: "Valor", A2: "a, b", B2: "=2*3", A3: "x", B3: "=1/0" } };
    const evaluator = createWorkbookEvaluator({ sheets: [sheet] });
    expect(sheetToCsv(sheet, evaluator)).toBe('Item,Valor\r\n"a, b",6\r\nx,#DIV/0!');
  });
});
