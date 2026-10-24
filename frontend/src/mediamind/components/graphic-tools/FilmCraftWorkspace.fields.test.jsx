import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";

// Campos numéricos e controles do painel de propriedades do MMFilm (Premiere).
// Zoom padrão da timeline: 12 px por segundo; no jsdom as faixas começam em x = 0.
const PX = 12;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function lane(container, track = "V1") {
  return container.querySelector(`[data-track-id="${track}"]`);
}
function clipsOn(container, track = "V1") {
  return [...lane(container, track).children].filter((node) => node.tagName === "BUTTON");
}
function clipNamed(container, name, track = "V1") {
  return clipsOn(container, track).find((node) => node.textContent.includes(name));
}
function info(clip) {
  return clip.querySelector("span")?.textContent.replace(/\s+/g, "");
}
function movePlayhead(seconds) {
  const ruler = document.querySelector("[data-timeline-ruler]");
  fireEvent.pointerDown(ruler, { clientX: seconds * PX, button: 0 });
  fireEvent.pointerUp(window, { clientX: seconds * PX });
}
function drop(container, { id, name, seconds, duration = 8, track = "V1" }) {
  movePlayhead(seconds);
  const payload = { id, name, kind: "video", src: `/api/v1/media/assets/${id}/stream`, duration, mimeType: "video/mp4" };
  fireEvent.drop(lane(container, track), {
    clientX: seconds * PX,
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
}
async function answerPrompt(label, value) {
  const dialog = await screen.findByRole("dialog", { name: label });
  fireEvent.change(within(dialog).getByRole("textbox", { name: label }), { target: { value } });
  fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: label })).toBeNull());
}
function chooseTool(label) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}
function chooseWorkspace(name) {
  const trigger = [...document.querySelectorAll('[aria-haspopup="menu"][aria-expanded]')].find((node) =>
    node.textContent.includes("▾"),
  );
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name }));
}
// "Editar" também existe na navegação e no menu do topo; aqui é a aba do painel Gráficos essenciais (a última).
const graphicsEdit = () => screen.getAllByRole("button", { name: "Editar" }).at(-1);
const spin = (name) => screen.getByRole("spinbutton", { name });
function typeInto(field, text) {
  fireEvent.change(field, { target: { value: text } });
}
function withClip() {
  const view = render(<FilmCraftWorkspace />);
  drop(view.container, { id: "a", name: "Cena", seconds: 0 });
  fireEvent.click(clipNamed(view.container, "Cena"));
  return view;
}

describe("MMFilm — campos numéricos não viram 0 nem NaN", () => {
  it("Controles de efeitos: apagar o campo mantém o valor e '-12.5' é aceito", () => {
    withClip();
    const field = spin("Controles de efeitos Posição X");
    const mirror = () => spin("Valor Posição X");
    fireEvent.focus(field);
    typeInto(field, "25");
    expect(mirror()).toHaveValue("25");
    typeInto(field, "");
    expect(field).toHaveValue("");
    expect(mirror()).toHaveValue("25");
    fireEvent.blur(field);
    expect(field).toHaveValue("25");
    fireEvent.focus(field);
    typeInto(field, "-");
    expect(mirror()).toHaveValue("25");
    typeInto(field, "-12.5");
    expect(mirror()).toHaveValue("-12.5");
    fireEvent.blur(field);
    expect(field).toHaveValue("-12.5");
  });

  it("Controles de efeitos: valor fora da faixa só é aplicado com clamp ao confirmar", () => {
    withClip();
    const speed = spin("Controles de efeitos Velocidade");
    fireEvent.focus(speed);
    typeInto(speed, "10");
    expect(spin("Clipe Velocidade")).toHaveValue("100");
    fireEvent.keyDown(speed, { key: "Enter" });
    expect(speed).toHaveValue("25");
    expect(spin("Clipe Velocidade")).toHaveValue("25");
  });

  it("IN/OUT da Origem: apagar não zera a duração", () => {
    render(<FilmCraftWorkspace />);
    const out = spin("OUT");
    fireEvent.focus(out);
    typeInto(out, "");
    expect(screen.getByText("Duração: 8.0 s")).toBeInTheDocument();
    fireEvent.blur(out);
    expect(out).toHaveValue("8");
    const inField = spin("IN");
    fireEvent.focus(inField);
    typeInto(inField, "2.5");
    expect(screen.getByText("Duração: 5.5 s")).toBeInTheDocument();
  });

  it("Rate stretch: digitar a duração estica o clipe e apagar não altera nada", () => {
    const { container } = withClip();
    const field = screen.getByRole("spinbutton", { name: "Rate stretch · duração" });
    fireEvent.focus(field);
    typeInto(field, "");
    expect(info(clipNamed(container, "Cena"))).toBe("00:00·8.0s");
    typeInto(field, "4");
    expect(info(clipNamed(container, "Cena"))).toBe("00:00·4.0s");
    expect(spin("Clipe Velocidade")).toHaveValue("200");
  });

  it("Posição/Duração/Velocidade/Opacidade/Volume do clipe aceitam rascunho sem zerar", () => {
    withClip();
    const volume = spin("Clipe Volume");
    fireEvent.focus(volume);
    typeInto(volume, "");
    expect(screen.getByRole("slider", { name: "Clipe Volume (controle deslizante)" })).toHaveValue("100");
    typeInto(volume, "150");
    expect(screen.getByRole("slider", { name: "Clipe Volume (controle deslizante)" })).toHaveValue("150");
  });

  it("Exportar: apagar a taxa alvo não deixa o resumo sem valor", () => {
    render(<FilmCraftWorkspace />);
    fireEvent.click(within(document.querySelector(".mmfilm-project-header nav")).getByRole("button", { name: "Exportar" }));
    const rate = spin("Taxa alvo");
    fireEvent.focus(rate);
    typeInto(rate, "");
    expect(screen.getByText(/Alvo 9,94 Mbps/)).toBeInTheDocument();
    typeInto(rate, "12.5");
    expect(screen.getByText(/Alvo 12,5 Mbps/)).toBeInTheDocument();
  });

  it("Cortar: apagar mantém o recorte e decimais funcionam", () => {
    withClip();
    const left = spin("Cortar Esquerda");
    fireEvent.focus(left);
    typeInto(left, "12.5");
    typeInto(left, "");
    fireEvent.blur(left);
    expect(left).toHaveValue("12.5");
  });
});

describe("MMFilm — Propriedades: arraste com limiar e clique para digitar", () => {
  it("clique simples foca o campo sem alterar o valor", () => {
    withClip();
    const field = spin("Valor Posição X");
    fireEvent.pointerDown(field, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(field, { button: 0, clientX: 100, pointerId: 1 });
    expect(document.activeElement).toBe(field);
    expect(field).toHaveValue("0");
  });

  it("arraste só altera o valor depois de 4 px", () => {
    withClip();
    const field = spin("Valor Posição X");
    fireEvent.pointerDown(field, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(field, { clientX: 103, pointerId: 1 });
    expect(field).toHaveValue("0");
    fireEvent.pointerMove(field, { clientX: 110, pointerId: 1 });
    expect(field).toHaveValue("10");
    fireEvent.pointerUp(field, { button: 0, clientX: 110, pointerId: 1 });
    expect(document.activeElement).not.toBe(field);
    expect(spin("Controles de efeitos Posição X")).toHaveValue("10");
  });

  it("com o campo em edição, arrastar seleciona texto e não altera o valor", () => {
    withClip();
    const field = spin("Valor Posição X");
    field.focus();
    expect(document.activeElement).toBe(field);
    fireEvent.pointerDown(field, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(field, { clientX: 140, pointerId: 1 });
    fireEvent.pointerUp(field, { button: 0, clientX: 140, pointerId: 1 });
    expect(field).toHaveValue("0");
    typeInto(field, "-12.5");
    expect(spin("Controles de efeitos Posição X")).toHaveValue("-12.5");
  });
});

describe("MMFilm — Gráficos essenciais editam o título de verdade", () => {
  async function withTitle() {
    const view = render(<FilmCraftWorkspace />);
    drop(view.container, { id: "a", name: "Base", seconds: 0 });
    chooseTool("Texto (T)");
    fireEvent.click(clipNamed(view.container, "Base"), { clientX: 2 * PX });
    await answerPrompt("Texto do título", "Abertura");
    chooseTool("Seleção (V)");
    fireEvent.click(clipNamed(view.container, "Abertura", "V2"));
    movePlayhead(3);
    fireEvent.click(screen.getByRole("button", { name: "Gráficos essenciais" }));
    fireEvent.click(graphicsEdit());
    return view;
  }
  const previewText = () => screen.getAllByText("Abertura").find((node) => node.style?.fontSize);

  it("não exibe valores fixos que não alteram nada", async () => {
    await withTitle();
    expect(screen.queryByText("Inter Semibold ▾")).toBeNull();
    expect(screen.queryByText("64 px ▾")).toBeNull();
  });

  it("fonte, tamanho, alinhamento e preenchimento mudam a prévia do Programa", async () => {
    await withTitle();
    expect(screen.getByRole("combobox", { name: "Fonte do gráfico" })).toHaveValue("Inter");
    expect(spin("Tamanho do gráfico")).toHaveValue("64");
    expect(screen.getByRole("combobox", { name: "Alinhamento do gráfico" })).toHaveValue("center");

    fireEvent.change(screen.getByRole("combobox", { name: "Fonte do gráfico" }), { target: { value: "Montserrat" } });
    expect(previewText().style.fontFamily).toContain("Montserrat");
    const base = parseFloat(previewText().style.fontSize);
    expect(base).toBeGreaterThan(0);

    const size = spin("Tamanho do gráfico");
    fireEvent.focus(size);
    typeInto(size, "");
    expect(parseFloat(previewText().style.fontSize)).toBeCloseTo(base, 5);
    typeInto(size, "128");
    fireEvent.blur(size);
    expect(parseFloat(previewText().style.fontSize)).toBeCloseTo(base * 2, 5);

    fireEvent.change(screen.getByRole("combobox", { name: "Alinhamento do gráfico" }), { target: { value: "left" } });
    expect(previewText().style.textAlign).toBe("left");

    fireEvent.change(screen.getByLabelText("Preenchimento do gráfico"), { target: { value: "#ff0000" } });
    expect(previewText().style.color).toBe("rgb(255, 0, 0)");
    expect(screen.getByText("#FF0000")).toBeInTheDocument();
  });

  it("estilo fica desabilitado quando o clipe selecionado não é um título", () => {
    withClip();
    fireEvent.click(screen.getByRole("button", { name: "Gráficos essenciais" }));
    fireEvent.click(graphicsEdit());
    expect(screen.getByRole("combobox", { name: "Fonte do gráfico" })).toBeDisabled();
    expect(spin("Tamanho do gráfico")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Alinhamento do gráfico" })).toBeDisabled();
    expect(screen.getByLabelText("Preenchimento do gráfico")).toBeDisabled();
  });

  it("categoria dos modelos filtra a lista", () => {
    render(<FilmCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Gráficos essenciais" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Categoria dos modelos" }), { target: { value: "Lower Thirds" } });
    expect(screen.getByText("Lower Third – Slab")).toBeInTheDocument();
    expect(screen.queryByText("Title – Centered")).toBeNull();
  });
});

describe("MMFilm — controles sem efeito real ficam indisponíveis", () => {
  it("Modo de mesclagem fica desabilitado e a linha falsa de Lumetri sai", () => {
    withClip();
    const blend = screen.getByRole("combobox", { name: "Modo de mesclagem" });
    expect(blend).toBeDisabled();
    expect(blend).toHaveAttribute("title", "Ainda não disponível");
    expect(screen.queryByText("LUT de entrada")).toBeNull();
  });

  it("Mixer: roteamento e automação ficam desabilitados", () => {
    render(<FilmCraftWorkspace />);
    chooseWorkspace("Áudio");
    for (const name of ["Saída A1", "Automação A1"]) {
      const select = screen.getByRole("combobox", { name });
      expect(select).toBeDisabled();
      expect(select).toHaveAttribute("title", "Ainda não disponível");
    }
  });

  it("Cor: LUT de entrada fica desabilitado", () => {
    render(<FilmCraftWorkspace />);
    chooseWorkspace("Cor");
    const lut = screen.getByRole("combobox", { name: "LUT de entrada" });
    expect(lut).toBeDisabled();
    expect(lut).toHaveAttribute("title", "Ainda não disponível");
  });

  it("Efeitos: a pesquisa filtra a lista", () => {
    render(<FilmCraftWorkspace />);
    chooseWorkspace("Efeitos");
    fireEvent.change(screen.getByPlaceholderText("Pesquisar efeitos"), { target: { value: "wipe" } });
    expect(screen.getByRole("button", { name: /Wipe/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dissolver/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Predefinições Lumetri/ })).toBeNull();
  });

  it("Montagem: informações e metadados são só leitura (não parecem menus)", () => {
    render(<FilmCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "⌂" }));
    const label = screen.getByText("Sequência", { selector: "dt" });
    expect(label.closest("button")).toBeNull();
    expect(label.parentElement.tagName).toBe("DIV");
  });
});

describe("MMFilm — atalhos globais", () => {
  it("não disparam dentro de conteúdo editável (contentEditable) e continuam no slider de zoom", () => {
    render(<FilmCraftWorkspace />);
    const editable = document.createElement("div");
    Object.defineProperty(editable, "isContentEditable", { value: true });
    document.body.appendChild(editable);
    fireEvent.keyDown(editable, { key: " " });
    expect(screen.getByRole("button", { name: "Reproduzir Programa" })).toBeInTheDocument();
    editable.remove();
    const zoom = screen.getByRole("slider", { name: "Zoom da timeline" });
    fireEvent.keyDown(zoom, { key: " " });
    expect(screen.getByRole("button", { name: "Pausar Programa" })).toBeInTheDocument();
  });
});
