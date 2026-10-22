import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import OfficeCraft, { gridExtent } from "./OfficeCraft";

beforeEach(() => localStorage.clear());

describe("Excel · área mostrada da planilha", () => {
  it("mantém A–F e 1–18 sem dados e cresce até a área usada com uma de folga", () => {
    const empty = gridExtent({ cells: {}, formats: {} });
    expect(empty.columns).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(empty.rows).toHaveLength(18);
    const used = gridExtent({ cells: { H30: "1", B2: "x", "??": "ignorado" }, formats: { J3: { bold: true } } });
    expect(used.columns.at(-1)).toBe("K");
    expect(used.rows.at(-1)).toBe(31);
    expect(gridExtent(undefined).rows).toHaveLength(18);
  });

  it("respeita os limites de tela (52 colunas, 500 linhas)", () => {
    const huge = gridExtent({ cells: { ZZ9000: "1" } });
    expect(huge.columns).toHaveLength(52);
    expect(huge.columns.at(-1)).toBe("AZ");
    expect(huge.rows).toHaveLength(500);
  });

  it("a grade mostra a célula preenchida fora de A–F e a navegação por Enter vai até a última linha", () => {
    render(<OfficeCraft initialApp="Excel" />);
    expect(screen.queryByLabelText("Célula H20")).toBeNull();
    fireEvent.change(screen.getByLabelText("Célula F18"), { target: { value: "x" } });
    expect(screen.getByLabelText("Célula G19")).toBeInTheDocument();
    fireEvent.focus(screen.getByLabelText("Célula A19"));
    fireEvent.keyDown(screen.getByLabelText("Célula A19"), { key: "Enter" });
    expect(document.activeElement).toBe(screen.getByLabelText("Célula A19"));
  });
});
