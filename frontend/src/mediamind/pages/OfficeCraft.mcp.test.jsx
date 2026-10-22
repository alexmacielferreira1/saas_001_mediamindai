import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import OfficeCraft from "./OfficeCraft";
import { currentMCPActions } from "../lib/mcpActions";

beforeEach(() => localStorage.clear());

const editor = () => screen.getByRole("textbox", { name: "Documento WordCraft" });
const status = () => screen.getAllByRole("status")[0];

describe("Word · ferramentas de um clique do MCP", () => {
  it("registra o Word ativo, prevê sem alterar, aplica pelo histórico e desfaz", async () => {
    const { rerender } = render(<OfficeCraft active />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "word", label: "Word" });
    expect(provider.catalogue().tools.find((tool) => tool.id === "estilos.aplicar").params[0].options[0]).toEqual(["0", "1 · Título do documento"]);
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);

    const before = editor().innerHTML;
    const preview = await act(() => provider.analyze("estilos.aplicar", { paragraphs: ["0"], style: "h1" }));
    expect(preview).toEqual({ ok: true, count: 1, summary: "Prévia (nada foi alterado): Título 1 aplicado em 1 parágrafo(s)" });
    expect(editor().innerHTML).toBe(before);
    expect(await act(() => provider.analyze("estilos.aplicar", {}))).toEqual({ ok: false, summary: "Escolha um ou mais parágrafos." });

    const result = await act(() => provider.apply("estilos.aplicar", { paragraphs: ["0"], style: "h1" }));
    expect(result).toEqual({ ok: true, count: 1, summary: "Título 1 aplicado em 1 parágrafo(s)" });
    expect(editor().querySelector("h1")).toHaveTextContent("Título do documento");
    expect(status()).toHaveTextContent("MCP · Título 1 aplicado");

    // Texto de parâmetro entra como texto, nunca como HTML.
    await act(() => provider.apply("texto.inserir", { text: '<img src=x onerror="alert(1)">' }));
    expect(editor().querySelector("img")).toBeNull();
    expect(editor().lastElementChild).toHaveTextContent('<img src=x onerror="alert(1)">');
    expect(provider.canUndo()).toBe(true);

    // Informativo: não altera o documento nem entra no desfazer.
    const stats = await act(() => provider.apply("revisao.estatisticas", {}));
    expect(stats).toMatchObject({ ok: true, count: 0, headline: { text: "palavras" } });
    expect(stats.html).toBeUndefined();

    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(editor().querySelector("img, p:last-child")?.textContent).toBe("Comece a escrever aqui.");
    expect(status()).toHaveTextContent("MCP · Última ação desfeita.");
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(editor().querySelector("h1")).toBeNull();
    expect(provider.canUndo()).toBe(false);

    rerender(<OfficeCraft active={false} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("não desfaz por cima de uma edição feita depois e o Desfazer do Word também volta a ação", async () => {
    render(<OfficeCraft />);
    const provider = currentMCPActions();
    await act(() => provider.apply("estilos.alinhar", { align: "center", target: "all" }));
    expect(editor().firstElementChild.style.textAlign).toBe("center");
    fireEvent.click(screen.getByTitle("Desfazer"));
    expect(editor().firstElementChild.style.textAlign).toBe("");

    await act(() => provider.apply("texto.inserir", { text: "Novo" }));
    editor().innerHTML += "<p>digitado</p>";
    fireEvent.input(editor());
    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(editor()).toHaveTextContent("digitado");
    expect(provider.canUndo()).toBe(false);
    expect(status()).toHaveTextContent("desfazer cancelado");
  });
});

describe("Excel · ferramentas de um clique do MCP", () => {
  it("troca o provedor com o app e aplica várias ações seguidas antes de redesenhar", async () => {
    render(<OfficeCraft initialApp="Word" />);
    expect(currentMCPActions().source).toBe("word");
    fireEvent.click(screen.getByRole("tab", { name: "Excel" }));
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "excel", label: "Excel" });

    const preview = await act(() => provider.analyze("preencher.serie", { start: "A1", count: 3 }));
    expect(preview.summary).toBe("Prévia (nada foi alterado): Série de 3 valor(es) em A1:A3 (1 … 3)");
    expect(screen.getByLabelText("Célula A1")).toHaveValue("");

    await act(async () => {
      await provider.apply("preencher.serie", { start: "A1", count: 3 });
      await provider.apply("formulas.totais", { range: "A1:A3", header: false });
    });
    expect(screen.getByLabelText("Célula A3")).toHaveValue("3");
    expect(screen.getByLabelText("Célula A4")).toHaveValue("6");
    expect(screen.getByText("MCP · Linha de total na linha 4 (1 coluna(s))")).toBeInTheDocument();
    expect(provider.catalogue().tools[0].params[0].default).toBe("A1:A4");

    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.getByLabelText("Célula A4")).toHaveValue("");
    expect(screen.getByLabelText("Célula A3")).toHaveValue("3");

    fireEvent.change(screen.getByLabelText("Célula B1"), { target: { value: "manual" } });
    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(screen.getByLabelText("Célula A1")).toHaveValue("1");
    expect(screen.getByText(/A planilha mudou depois da ação do MCP/)).toBeInTheDocument();
    expect(await act(() => provider.apply("formulas.valores", { range: "A1:A3" }))).toEqual({ ok: false, summary: "O intervalo não tem fórmulas." });
  });
});

describe("PowerPoint · ferramentas de um clique do MCP", () => {
  it("cria slide de verdade, desfaz e some quando a aba fica inativa", async () => {
    const { rerender } = render(<OfficeCraft initialApp="PowerPoint" />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "powerpoint", label: "PowerPoint" });
    expect(screen.queryByLabelText("Slide 2")).toBeNull();

    const result = await act(() => provider.apply("slides.novo", { title: "Resultados", body: "Linha 1" }));
    expect(result).toEqual({ ok: true, count: 1, summary: "Slide 2 criado (Título e conteúdo)" });
    expect(screen.getByLabelText("Slide 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Título do slide")).toHaveValue("Resultados");
    expect(screen.getByText("MCP · Slide 2 criado (Título e conteúdo)")).toBeInTheDocument();

    await act(() => provider.apply("texto.caixa", { mode: "upper" }));
    expect(screen.getByLabelText("Título do slide")).toHaveValue("RESULTADOS");
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.getByLabelText("Título do slide")).toHaveValue("Resultados");
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.queryByLabelText("Slide 2")).toBeNull();
    expect(screen.getByText("MCP · Última ação desfeita.")).toBeInTheDocument();

    await act(() => provider.apply("slides.duplicar", {}));
    fireEvent.change(screen.getByLabelText("Título do slide"), { target: { value: "Editado" } });
    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(screen.getByLabelText("Slide 2")).toBeInTheDocument();
    expect(screen.getByText(/Os slides mudaram depois da ação do MCP/)).toBeInTheDocument();

    rerender(<OfficeCraft initialApp="PowerPoint" active={false} />);
    expect(currentMCPActions()).toBeNull();
  });
});

describe("Excel · cores, formatação condicional e gráfico de verdade", () => {
  const cell = (key) => screen.getByLabelText(`Célula ${key}`);

  it("pinta as células, reavalia a regra quando o valor muda, desenha e remove o gráfico", async () => {
    render(<OfficeCraft initialApp="Excel" />);
    const provider = currentMCPActions();
    fireEvent.change(cell("A1"), { target: { value: "Mês" } });
    fireEvent.change(cell("B1"), { target: { value: "Vendas" } });
    fireEvent.change(cell("A2"), { target: { value: "Jan" } });
    fireEvent.change(cell("B2"), { target: { value: "5" } });
    fireEvent.change(cell("A3"), { target: { value: "Fev" } });
    fireEvent.change(cell("B3"), { target: { value: "=B2*4" } });

    await act(() => provider.apply("formatar.cores", { range: "A1:B1", fill: "#ffeeaa", color: "#112233" }));
    expect(cell("A1").style.backgroundColor).toBe("rgb(255, 238, 170)");
    expect(cell("B1").style.color).toBe("rgb(17, 34, 51)");

    const rule = await act(() => provider.apply("formatar.condicional", { range: "B2:B3", op: ">", value: "10", fill: "#ff0000", color: "#ffffff" }));
    expect(rule).toMatchObject({ ok: true, count: 1 });
    expect(cell("B3").style.backgroundColor).toBe("rgb(255, 0, 0)");
    expect(cell("B2").style.backgroundColor).toBe("");
    expect(screen.getByRole("list", { name: "Formatação condicional" })).toHaveTextContent("B2:B3 · maior que “10”");
    // Regra dinâmica: B2 = 1 faz B3 (=B2*4) cair para 4 e a cor sai sozinha.
    fireEvent.change(cell("B2"), { target: { value: "1" } });
    expect(cell("B3").style.backgroundColor).toBe("");
    fireEvent.change(cell("B2"), { target: { value: "20" } });
    expect(cell("B2").style.backgroundColor).toBe("rgb(255, 0, 0)");

    const chart = await act(() => provider.apply("dados.grafico", { range: "A1:B3", title: "Vendas do mês" }));
    expect(chart.summary).toBe("Gráfico de barras de A1:B3 criado com 2 categoria(s) e 1 série(s)");
    const figure = screen.getByRole("figure", { name: "Vendas do mês" });
    expect(within(figure).getByRole("img", { name: "Gráfico de barras: Vendas" })).toBeInTheDocument();
    expect(within(figure).getAllByTestId("chart-bar")).toHaveLength(2);
    expect(within(figure).getByText("Fev")).toBeInTheDocument();
    // O gráfico relê o intervalo: limpar um valor tira a barra.
    fireEvent.change(cell("B2"), { target: { value: "" } });
    expect(within(figure).getAllByTestId("chart-bar")).toHaveLength(1);

    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(screen.getByRole("figure", { name: "Vendas do mês" })).toBeInTheDocument();

    const line = await act(() => provider.apply("dados.grafico", { range: "A1:B3", type: "line" }));
    expect(line.ok).toBe(true);
    expect(screen.getByRole("figure", { name: "Gráfico de A1:B3" }).querySelector("[data-testid=chart-line] polyline")).not.toBeNull();
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.queryByRole("figure", { name: "Gráfico de A1:B3" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Remover gráfico Vendas do mês" }));
    expect(screen.queryByRole("figure")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remover regra B2:B3 · maior que “10”" }));
    expect(screen.queryByRole("list", { name: "Formatação condicional" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("mm-office-grid")).sheets[0]).toMatchObject({ rules: [], charts: [] });
  });

  it("mostra gráfico sem números e guarda cores manuais pela faixa de opções", () => {
    localStorage.setItem("mm-office-grid", JSON.stringify({ sheets: [{ id: "s1", name: "P", cells: { A1: "x", B1: "y" }, formats: { A1: { fill: "#00ff00" } }, rules: [{ range: "A1", op: "contains", value: "x", color: "#0000ff" }], charts: [{ id: "g", range: "A1:B1", header: false }] }], active: "s1" }));
    render(<OfficeCraft initialApp="Excel" />);
    expect(cell("A1").style.backgroundColor).toBe("rgb(0, 255, 0)");
    expect(cell("A1").style.color).toBe("rgb(0, 0, 255)");
    expect(screen.getByText("Sem números nas colunas de valores de A1:B1.")).toBeInTheDocument();
    fireEvent.focus(cell("B1"));
    expect(screen.getByRole("button", { name: "Sem cor" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Cor de preenchimento"), { target: { value: "#123456" } });
    fireEvent.change(screen.getByLabelText("Cor do texto"), { target: { value: "#654321" } });
    expect(cell("B1").style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(cell("B1").style.color).toBe("rgb(101, 67, 33)");
    fireEvent.click(screen.getByRole("button", { name: "Sem cor" }));
    expect(cell("B1").style.backgroundColor).toBe("");
    expect(JSON.parse(localStorage.getItem("mm-office-grid")).sheets[0].formats.B1).toEqual({});
  });
});

describe("PowerPoint · tema, alinhamento e anotações de verdade", () => {
  it("aplica pelo MCP e mostra no editor, nas miniaturas e na apresentação", async () => {
    render(<OfficeCraft initialApp="PowerPoint" />);
    const provider = currentMCPActions();
    const canvas = () => screen.getByTestId("slide-canvas");
    expect(canvas().style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(screen.getByLabelText("Título do slide").style.textAlign).toBe("center");

    const theme = await act(() => provider.apply("design.tema", { preset: "ocean" }));
    expect(theme.summary).toBe("Tema Oceano (fundo #0c4a6e, texto #e0f2fe) em 1 slide(s)");
    expect(canvas().style.backgroundColor).toBe("rgb(12, 74, 110)");
    expect(canvas().style.color).toBe("rgb(224, 242, 254)");
    expect(screen.getByLabelText("Slide 1").querySelector("span[style]").style.backgroundColor).toBe("rgb(12, 74, 110)");

    await act(() => provider.apply("design.alinhar", { align: "right" }));
    expect(screen.getByLabelText("Título do slide").style.textAlign).toBe("right");
    expect(screen.getByLabelText("Conteúdo do slide").style.textAlign).toBe("right");

    await act(() => provider.apply("design.notas", { text: "Cumprimentar a plateia" }));
    expect(screen.getByLabelText("Anotações do slide")).toHaveValue("Cumprimentar a plateia");
    expect(screen.getByText("Com anotações")).toBeInTheDocument();
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.getByLabelText("Anotações do slide")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Anotações do slide"), { target: { value: "Pausa para perguntas" } });
    expect(JSON.parse(localStorage.getItem("mm-office-deck"))[0]).toMatchObject({ notes: "Pausa para perguntas", align: "right", theme: { background: "#0c4a6e", color: "#e0f2fe" } });

    fireEvent.click(screen.getByRole("button", { name: "Apresentação" }));
    fireEvent.click(screen.getByRole("button", { name: "Apresentar do início" }));
    const dialog = screen.getByRole("dialog", { name: "Apresentação de slides" });
    const heading = within(dialog).getByRole("heading", { name: "Título da apresentação" });
    expect(heading.style.textAlign).toBe("right");
    expect(heading.parentElement.style.backgroundColor).toBe("rgb(12, 74, 110)");
    expect(within(dialog).queryByLabelText("Anotações do apresentador")).toBeNull();
    act(() => { fireEvent.keyDown(window, { key: "n" }); });
    const notes = within(dialog).getByLabelText("Anotações do apresentador");
    expect(notes).toHaveTextContent("Pausa para perguntas");
    fireEvent.click(notes);
    expect(within(dialog).getByText("Slide 1 de 1", { exact: false })).toBeInTheDocument();
    act(() => { fireEvent.keyDown(window, { key: "N" }); });
    expect(within(dialog).queryByLabelText("Anotações do apresentador")).toBeNull();
    act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
  });

  it("aplica tema e alinhamento pela guia Design", () => {
    render(<OfficeCraft initialApp="PowerPoint" />);
    fireEvent.click(screen.getByRole("button", { name: "Novo slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Tema Escuro" }));
    expect(screen.getByRole("button", { name: "Tema Escuro" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("slide-canvas").style.backgroundColor).toBe("rgb(31, 41, 55)");
    fireEvent.click(screen.getByRole("button", { name: "Tema em todos" }));
    expect(screen.getByLabelText("Slide 1").querySelector("span[style]").style.backgroundColor).toBe("rgb(31, 41, 55)");
    fireEvent.click(screen.getByRole("button", { name: "Justificar" }));
    expect(screen.getByLabelText("Título do slide").style.textAlign).toBe("justify");
    expect(screen.getByLabelText("Slide 2").querySelector("span[style]").style.justifyContent).toBe("center");
    fireEvent.click(screen.getByRole("button", { name: "Alinhar à esquerda" }));
    expect(screen.getByLabelText("Slide 2").querySelector("span[style]").style.justifyContent).toBe("flex-start");
    fireEvent.click(screen.getByRole("button", { name: "Alinhar pelo layout" }));
    expect(screen.getByRole("button", { name: "Alinhar pelo layout" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Título do slide").style.textAlign).toBe("center");
  });
});
