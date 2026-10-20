import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OfficeCraft, { documentHtmlToText, sanitizeDocumentHtml, setBlockFormat, toggleInlineFormat } from "./OfficeCraft";

function stubDownloads() {
  const files = [];
  URL.createObjectURL = vi.fn((blob) => { files.push(blob); return `blob:test/${files.length}`; });
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function record() { files[files.length - 1].fileName = this.download; });
  return { files, click };
}

function selectText(node, start, end) {
  const range = document.createRange();
  range.setStart(node, start); range.setEnd(node, end);
  const selection = window.getSelection();
  selection.removeAllRanges(); selection.addRange(range);
}

function editorTyping(editor, html) {
  editor.innerHTML = html;
  fireEvent.input(editor);
}

afterEach(() => { delete URL.createObjectURL; delete URL.revokeObjectURL; });

describe("Word rich text helpers", () => {
  beforeEach(() => localStorage.clear());

  it("sanitizes untrusted HTML", () => {
    const html = sanitizeDocumentHtml('<p onclick="x()" style="color:red; text-align:center">Oi<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:x">link</a></p><style>p{}</style>');
    expect(html).toBe('<p style="text-align: center">Oilink</p>');
  });

  it("toggles bold on part of a paragraph and removes it again", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>Olá mundo</p>";
    document.body.appendChild(root);
    const text = root.querySelector("p").firstChild;
    let range = document.createRange(); range.setStart(text, 4); range.setEnd(text, 9);
    toggleInlineFormat(root, range, "strong");
    expect(root.innerHTML).toBe("<p>Olá <strong>mundo</strong></p>");
    const bold = root.querySelector("strong").firstChild;
    range = document.createRange(); range.setStart(bold, 0); range.setEnd(bold, 3);
    toggleInlineFormat(root, range, "strong");
    expect(root.innerHTML).toBe("<p>Olá mun<strong>do</strong></p>");
    root.remove();
  });

  it("converts paragraphs into headings and back", () => {
    const root = document.createElement("div");
    root.innerHTML = '<p style="text-align: center;">Capítulo</p><p>Texto</p>';
    const range = document.createRange(); range.setStart(root.firstChild.firstChild, 2); range.collapse(true);
    setBlockFormat(root, range, "h1");
    expect(root.innerHTML).toBe('<h1 style="text-align: center;">Capítulo</h1><p>Texto</p>');
    expect(documentHtmlToText(root.innerHTML)).toBe("Capítulo\nTexto");
  });
});

describe("WordCraft", () => {
  beforeEach(() => localStorage.clear());

  it("migrates the legacy plain-text document into the rich editor", () => {
    localStorage.setItem("mm-office-word", JSON.stringify("Linha 1\n\nLinha 3"));
    render(<OfficeCraft />);
    const editor = screen.getByRole("textbox", { name: "Documento WordCraft" });
    expect(editor).toHaveAttribute("contenteditable", "true");
    expect(editor.innerHTML).toBe("<p>Linha 1</p><p><br></p><p>Linha 3</p>");
    expect(screen.getByText("4 palavras".replace("4", "4"), { exact: false })).toBeInTheDocument();
  });

  it("applies bold, italic, underline, heading, font and size to the selection", () => {
    render(<OfficeCraft />);
    const editor = screen.getByRole("textbox", { name: "Documento WordCraft" });
    editorTyping(editor, "<p>Relatório anual</p>");
    selectText(editor.querySelector("p").firstChild, 0, 9);
    fireEvent.click(screen.getByTitle("Negrito"));
    expect(editor.innerHTML).toBe("<p><strong>Relatório</strong> anual</p>");
    fireEvent.click(screen.getByTitle("Itálico"));
    fireEvent.click(screen.getByTitle("Sublinhado"));
    expect(editor.querySelector("strong em u")).toHaveTextContent("Relatório");
    fireEvent.change(screen.getByLabelText("Fonte"), { target: { value: "Georgia" } });
    fireEvent.change(screen.getByLabelText("Tamanho da fonte"), { target: { value: "18" } });
    const span = editor.querySelector("span");
    expect(span.style.fontFamily).toContain("Georgia");
    expect(span.style.fontSize).toBe("18pt");
    fireEvent.click(screen.getByRole("button", { name: "Título 1" }));
    expect(editor.querySelector("h1")).toHaveTextContent("Relatório anual");
    fireEvent.click(screen.getByRole("button", { name: "Normal" }));
    expect(editor.querySelector("h1")).toBeNull();
    expect(JSON.parse(localStorage.getItem("mm-office-word"))).toContain("<strong>");
  });

  it("undoes and redoes edits", () => {
    render(<OfficeCraft />);
    const editor = screen.getByRole("textbox", { name: "Documento WordCraft" });
    const original = editor.innerHTML;
    const undo = screen.getByTitle("Desfazer");
    expect(undo).toBeDisabled();
    editorTyping(editor, "<p>Primeira versão</p>");
    selectText(editor.querySelector("p").firstChild, 0, 8);
    fireEvent.click(screen.getByTitle("Negrito"));
    fireEvent.click(undo);
    expect(editor.innerHTML).toBe("<p>Primeira versão</p>");
    fireEvent.click(undo);
    expect(editor.innerHTML).toBe(original);
    fireEvent.click(screen.getByTitle("Refazer"));
    fireEvent.click(screen.getByTitle("Refazer"));
    expect(editor.innerHTML).toBe("<p><strong>Primeira</strong> versão</p>");
    fireEvent.keyDown(editor, { key: "z", ctrlKey: true });
    expect(editor.innerHTML).toBe("<p>Primeira versão</p>");
  });

  it("downloads .doc and .txt when saving", async () => {
    const { files } = stubDownloads();
    render(<OfficeCraft />);
    const editor = screen.getByRole("textbox", { name: "Documento WordCraft" });
    editorTyping(editor, "<p><strong>Ata</strong></p><p>Item 1</p>");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(files.map((file) => file.fileName)).toEqual(["documento-wordcraft.doc", "documento-wordcraft.txt"]);
    expect(await files[0].text()).toContain("<strong>Ata</strong>");
    expect(files[0].type).toBe("application/msword");
    expect(await files[1].text()).toBe("Ata\nItem 1");
    expect(screen.getByRole("status")).toHaveTextContent("Arquivos .doc e .txt baixados");
  });

  it("switches ribbon tabs and runs their commands", () => {
    render(<OfficeCraft />);
    const editor = screen.getByRole("textbox", { name: "Documento WordCraft" });
    editorTyping(editor, "<p>Centro</p>");
    selectText(editor.querySelector("p").firstChild, 0, 3);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Centralizar" }));
    expect(editor.querySelector("p").style.textAlign).toBe("center");
    fireEvent.click(screen.getByRole("button", { name: "Exibir" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom 125%" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Referências" }));
    expect(screen.getByText(/ainda não estão disponíveis/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revisão" }));
    fireEvent.click(screen.getByRole("button", { name: /Verificação ortográfica/ }));
    expect(editor).toHaveAttribute("spellcheck", "false");
  });

  it("pastes clipboard content as plain text", () => {
    render(<OfficeCraft />);
    const editor = screen.getByRole("textbox", { name: "Documento WordCraft" });
    editorTyping(editor, "<p>A</p>");
    const text = editor.querySelector("p").firstChild;
    selectText(text, 1, 1);
    fireEvent.paste(editor, { clipboardData: { getData: () => "<b>x</b>\ny" } });
    expect(editor.innerHTML).toBe("<p>A&lt;b&gt;x&lt;/b&gt;<br>y</p>");
  });
});

describe("GridCraft", () => {
  beforeEach(() => localStorage.clear());
  const openExcel = () => { render(<OfficeCraft initialApp="Excel" />); };

  it("evaluates formulas and recalculates when inputs change", () => {
    openExcel();
    fireEvent.change(screen.getByLabelText("Célula A1"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Célula A2"), { target: { value: "32" } });
    const a3 = screen.getByLabelText("Célula A3");
    fireEvent.focus(a3);
    fireEvent.change(a3, { target: { value: "=SUM(A1:A2)" } });
    expect(a3).toHaveValue("=SUM(A1:A2)");
    fireEvent.blur(a3);
    expect(a3).toHaveValue("42");
    fireEvent.change(screen.getByLabelText("Célula A1"), { target: { value: "20" } });
    expect(a3).toHaveValue("52");
    fireEvent.focus(screen.getByLabelText("Célula B1"));
    fireEvent.change(screen.getByLabelText("Barra de fórmulas"), { target: { value: "=A1/0" } });
    fireEvent.blur(screen.getByLabelText("Célula B1"));
    expect(screen.getByLabelText("Célula B1")).toHaveValue("#DIV/0!");
  });

  it("stores bold, italic, currency and percent formats per cell", () => {
    openExcel();
    const a1 = screen.getByLabelText("Célula A1");
    fireEvent.focus(a1);
    fireEvent.change(a1, { target: { value: "1234.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Negrito" }));
    fireEvent.click(screen.getByRole("button", { name: "Itálico" }));
    fireEvent.click(screen.getByRole("button", { name: "Moeda" }));
    fireEvent.blur(a1);
    expect(a1.value).toMatch(/R\$\s*1\.234,50/);
    expect(a1.style.fontWeight).toBe("700");
    expect(a1.style.fontStyle).toBe("italic");
    expect(screen.getByLabelText("Célula A2").style.fontWeight).toBe("");
    fireEvent.focus(a1);
    fireEvent.click(screen.getByRole("button", { name: "Porcentagem" }));
    fireEvent.blur(a1);
    expect(a1.value).toMatch(/123\.450\s*%/);
  });

  it("pastes TSV from the clipboard into multiple cells", async () => {
    openExcel();
    fireEvent.focus(screen.getByLabelText("Célula B2"));
    fireEvent.paste(screen.getByLabelText("Célula B2"), { clipboardData: { getData: () => "1\t2\n3\t=B2+C2\n" } });
    expect(screen.getByLabelText("Célula C2")).toHaveValue("2");
    expect(screen.getByLabelText("Célula C3")).toHaveValue("3");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText: vi.fn().mockRejectedValue(new Error("negado")) } });
    fireEvent.click(screen.getByRole("button", { name: "Colar" }));
    expect(await screen.findByText(/Sem acesso à área de transferência/)).toBeInTheDocument();
    navigator.clipboard.readText = vi.fn().mockResolvedValue("x\ty");
    fireEvent.focus(screen.getByLabelText("Célula A5"));
    fireEvent.click(screen.getByRole("button", { name: "Colar" }));
    await waitFor(() => expect(screen.getByLabelText("Célula B5")).toHaveValue("y"));
    delete navigator.clipboard;
  });

  it("adds sheets with cross-sheet formulas and exports CSV", async () => {
    const { files } = stubDownloads();
    openExcel();
    fireEvent.change(screen.getByLabelText("Célula A1"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Nova planilha" }));
    expect(screen.getByRole("button", { name: "Planilha2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Célula A1")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Célula A1"), { target: { value: "=Planilha1!A1*2" } });
    expect(screen.getByLabelText("Célula A1")).toHaveValue("10");
    fireEvent.click(screen.getByRole("button", { name: "Salvar CSV" }));
    expect(files[0].fileName).toBe("Planilha2.csv");
    expect([...new Uint8Array(await files[0].arrayBuffer())].slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    expect(await files[0].text()).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "Planilha1" }));
    expect(screen.getByLabelText("Célula A1")).toHaveValue("5");
    const stored = JSON.parse(localStorage.getItem("mm-office-grid"));
    expect(stored.sheets.map((sheet) => sheet.name)).toEqual(["Planilha1", "Planilha2"]);
  });

  it("runs AutoSoma and shows formulas from the Fórmulas tab", () => {
    openExcel();
    fireEvent.change(screen.getByLabelText("Célula C1"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Célula C2"), { target: { value: "2" } });
    fireEvent.focus(screen.getByLabelText("Célula C3"));
    fireEvent.click(screen.getByRole("button", { name: "Fórmulas" }));
    fireEvent.click(screen.getByRole("button", { name: "AutoSoma" }));
    fireEvent.blur(screen.getByLabelText("Célula C3"));
    expect(screen.getByLabelText("Célula C3")).toHaveValue("3");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar fórmulas" }));
    expect(screen.getByLabelText("Célula C3")).toHaveValue("=SUM(C1:C2)");
    fireEvent.click(screen.getByRole("button", { name: "Dados" }));
    expect(screen.getByText(/ainda não estão disponíveis/)).toBeInTheDocument();
  });
});

describe("DeckCraft", () => {
  beforeEach(() => { localStorage.clear(); vi.spyOn(window, "confirm").mockReturnValue(true); });
  const openDeck = () => render(<OfficeCraft initialApp="PowerPoint" />);

  it("duplicates, reorders and deletes slides", () => {
    openDeck();
    fireEvent.change(screen.getByLabelText("Título do slide"), { target: { value: "Abertura" } });
    fireEvent.click(screen.getByRole("button", { name: "Inserir" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicar slide" }));
    expect(screen.getAllByRole("button", { name: /^Slide \d+$/ })).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Título do slide"), { target: { value: "Cópia" } });
    fireEvent.click(screen.getByRole("button", { name: "Mover para cima" }));
    expect(screen.getByRole("button", { name: "Slide 1" })).toHaveTextContent("Cópia");
    fireEvent.click(screen.getByRole("button", { name: "Excluir slide" }));
    expect(screen.getAllByRole("button", { name: /^Slide \d+$/ })).toHaveLength(1);
    expect(screen.getByLabelText("Título do slide")).toHaveValue("Abertura");
    fireEvent.click(screen.getByRole("button", { name: "Excluir slide" }));
    expect(screen.getByRole("status")).toHaveTextContent("ao menos um slide");
  });

  it("applies layouts and bold/italic to the focused text", () => {
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Somente título" }));
    expect(screen.queryByLabelText("Conteúdo do slide")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Título e conteúdo" }));
    expect(screen.getByLabelText("Conteúdo do slide").style.textAlign).toBe("left");
    fireEvent.focus(screen.getByLabelText("Conteúdo do slide"));
    fireEvent.click(screen.getByRole("button", { name: "Itálico" }));
    expect(screen.getByLabelText("Conteúdo do slide").style.fontStyle).toBe("italic");
    fireEvent.focus(screen.getByLabelText("Título do slide"));
    fireEvent.click(screen.getByRole("button", { name: "Negrito" }));
    expect(screen.getByLabelText("Título do slide").style.fontWeight).toBe("800");
    const saved = JSON.parse(localStorage.getItem("mm-office-deck"));
    expect(saved[0]).toMatchObject({ layout: "title-content", titleStyle: { bold: true }, bodyStyle: { italic: true } });
  });

  it("presents slides with arrow keys and Esc", () => {
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "Novo slide" }));
    fireEvent.change(screen.getByLabelText("Título do slide"), { target: { value: "Segundo" } });
    fireEvent.click(screen.getByRole("button", { name: "Apresentação" }));
    fireEvent.click(screen.getByRole("button", { name: "Apresentar do início" }));
    const dialog = screen.getByRole("dialog", { name: "Apresentação de slides" });
    expect(within(dialog).getByText("Título da apresentação")).toBeInTheDocument();
    act(() => { fireEvent.keyDown(window, { key: "ArrowRight" }); });
    expect(within(dialog).getByText("Segundo")).toBeInTheDocument();
    act(() => { fireEvent.keyDown(window, { key: "ArrowLeft" }); });
    expect(within(dialog).getByText("Slide 1 de 2", { exact: false })).toBeInTheDocument();
    act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saves the presentation as JSON", async () => {
    const { files } = stubDownloads();
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "Salvar apresentação" }));
    expect(files[0].fileName).toBe("apresentacao-deckcraft.json");
    const parsed = JSON.parse(await files[0].text());
    expect(parsed.schema).toBe("mm-deckcraft/v1");
    expect(parsed.slides[0].title).toBe("Título da apresentação");
  });
});
