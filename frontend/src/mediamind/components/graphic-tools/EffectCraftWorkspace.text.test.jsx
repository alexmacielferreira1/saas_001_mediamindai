import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EffectCraftWorkspace from "./EffectCraftWorkspace";

const TAGLINE = "MOTION GRAPHICS · VISUAL EFFECTS · PURE RUST";

function renderWorkspace(props = {}) {
  return render(<EffectCraftWorkspace assets={[]} selected={null} onSelect={vi.fn()} onOpenFiles={vi.fn()} {...props} />);
}

function runMenu(menu, command) {
  fireEvent.click(screen.getAllByRole("button", { name: menu })[0]);
  fireEvent.click(screen.getByRole("button", { name: command }));
}

const rendered = () => screen.getByLabelText("Texto renderizado da camada");
const editor = () => screen.getByLabelText("Editar texto da camada");
const layerElement = () => screen.getByLabelText(/^Camada .* na composição$/);
const viewer = () => screen.getByLabelText("Visualizador da composição");

vi.setConfig({ testTimeout: 40000 });

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("MMEffect — edição de texto no canvas", () => {
  it("duplo clique edita o texto; Ctrl+Enter e blur confirmam, Esc cancela", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    fireEvent.doubleClick(rendered());
    expect(editor()).toHaveFocus();
    expect(editor()).toHaveValue("MMEffect");
    fireEvent.change(editor(), { target: { value: "Olá" } });
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    expect(screen.queryByLabelText("Editar texto da camada")).toBeNull();
    expect(rendered()).toHaveTextContent("Olá");

    fireEvent.doubleClick(rendered());
    fireEvent.change(editor(), { target: { value: "Descartado" } });
    fireEvent.keyDown(editor(), { key: "Escape" });
    expect(rendered()).toHaveTextContent("Olá");

    fireEvent.doubleClick(rendered());
    fireEvent.change(editor(), { target: { value: "Pelo blur" } });
    fireEvent.blur(editor());
    expect(rendered()).toHaveTextContent("Pelo blur");
    // Edição de texto entra no histórico.
    runMenu("Editar", "Desfazer");
    expect(rendered()).toHaveTextContent("Olá");
  });

  it("não edita texto de camada que não é de texto nem bloqueada", () => {
    renderWorkspace();
    fireEvent.doubleClick(rendered());
    expect(screen.queryByLabelText("Editar texto da camada")).toBeNull();
  });

  it("ferramenta T cria camada vazia já em edição; letras e Backspace não viram atalhos", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.pointerDown(viewer(), { clientX: 10, clientY: 10 });
    expect(screen.getByRole("button", { name: "Texto 9" })).toBeInTheDocument();
    expect(editor()).toHaveFocus();
    expect(editor()).toHaveValue("");
    fireEvent.keyDown(editor(), { key: "v" });
    fireEvent.keyDown(editor(), { key: "Backspace" });
    expect(screen.getByRole("button", { name: "Texto (T)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Texto 9" })).toBeInTheDocument();
    fireEvent.change(editor(), { target: { value: "Novo título" } });
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    expect(rendered()).toHaveTextContent("Novo título");
    // Clicar dentro do editor não cria outra camada.
    fireEvent.doubleClick(rendered());
    fireEvent.pointerDown(editor());
    expect(screen.queryByRole("button", { name: "Texto 10" })).toBeNull();
  });

  it("menu Camada > Nova camada de texto também abre o editor focado", () => {
    renderWorkspace();
    runMenu("Camada", "Nova camada de texto");
    expect(editor()).toHaveFocus();
  });

  it("clicar com T sobre a camada de texto existente edita em vez de criar", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.pointerDown(layerElement(), { clientX: 10, clientY: 10 });
    expect(editor()).toHaveValue("MMEffect");
    expect(screen.queryByRole("button", { name: "Texto 9" })).toBeNull();
  });

  it("Texto de origem nas Propriedades edita a camada de texto selecionada", () => {
    renderWorkspace();
    expect(screen.queryByLabelText("Texto de origem")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    fireEvent.change(screen.getByLabelText("Texto de origem"), { target: { value: "Fonte nova" } });
    expect(rendered()).toHaveTextContent("Fonte nova");
  });

  it("cada camada de texto mostra o próprio texto (a tagline vem da camada Tagline)", () => {
    renderWorkspace();
    expect(screen.getByLabelText("Texto da camada Tagline")).toHaveTextContent(TAGLINE);
    fireEvent.click(screen.getByRole("button", { name: "Tagline" }));
    expect(screen.getByLabelText("Texto de origem")).toHaveValue(TAGLINE);
    fireEvent.change(screen.getByLabelText("Texto de origem"), { target: { value: "NOVA TAGLINE" } });
    expect(rendered()).toHaveTextContent("NOVA TAGLINE");
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    expect(rendered()).toHaveTextContent("MMEffect");
    expect(screen.getByLabelText("Texto da camada Tagline")).toHaveTextContent("NOVA TAGLINE");
  });
});

describe("MMEffect — campos numéricos", () => {
  it("apagar não vira 0 e aceita negativos decimais", () => {
    renderWorkspace();
    const scale = screen.getByLabelText("Valor Escala da camada");
    fireEvent.focus(scale);
    fireEvent.change(scale, { target: { value: "" } });
    expect(scale).toHaveValue("");
    expect(layerElement().style.transform).toContain("scale(1)");
    fireEvent.blur(scale);
    expect(scale).toHaveValue("100");

    const x = screen.getByLabelText("Valor X da camada");
    fireEvent.focus(x);
    fireEvent.change(x, { target: { value: "-" } });
    expect(x).toHaveValue("-");
    fireEvent.change(x, { target: { value: "-12.5" } });
    fireEvent.blur(x);
    expect(x).toHaveValue("-12.5");

    const fuzziness = screen.getByLabelText("Valor de Fuzziness");
    fireEvent.focus(fuzziness);
    fireEvent.change(fuzziness, { target: { value: "" } });
    expect(fuzziness).toHaveValue("");
    fireEvent.blur(fuzziness);
    expect(fuzziness).toHaveValue("0");

    const effectX = screen.getByLabelText("Valor de x no efeito");
    fireEvent.focus(effectX);
    fireEvent.change(effectX, { target: { value: "-5" } });
    fireEvent.blur(effectX);
    expect(effectX).toHaveValue("-5");
  });
});

describe("MMEffect — composição sem window.prompt", () => {
  it("nova composição e renomear usam a caixa de texto do app", async () => {
    const prompt = vi.spyOn(window, "prompt");
    renderWorkspace();
    runMenu("Composição", "Nova composição");
    const create = screen.getByRole("dialog", { name: "Nome da nova composição (1920×1080, 10 s):" });
    fireEvent.change(within(create).getByRole("textbox"), { target: { value: "Abertura" } });
    await act(async () => fireEvent.click(within(create).getByRole("button", { name: "OK" })));
    expect(screen.getByText("Composição: Abertura")).toBeInTheDocument();

    runMenu("Composição", "Configurações da composição");
    const rename = screen.getByRole("dialog", { name: "Nome da composição:" });
    fireEvent.change(within(rename).getByRole("textbox"), { target: { value: "Final" } });
    await act(async () => fireEvent.click(within(rename).getByRole("button", { name: "OK" })));
    expect(screen.getByText("Composição: Final")).toBeInTheDocument();

    runMenu("Composição", "Configurações da composição");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancelar" })));
    expect(screen.getByText("Composição: Final")).toBeInTheDocument();
    expect(prompt).not.toHaveBeenCalled();
    prompt.mockRestore();
  });
});

describe("MMEffect — controles que eram decorativos", () => {
  it("Pesquisar da timeline filtra camadas pelo nome", () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Pesquisar camadas"), { target: { value: "tag" } });
    expect(screen.getByRole("button", { name: "Mover Tagline na timeline" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mover Controller na timeline" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Pesquisar camadas"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Mover Controller na timeline" })).toBeInTheDocument();
  });

  it("Alinhar camadas a fica desativado com motivo", () => {
    renderWorkspace();
    const select = screen.getByLabelText("Alinhar camadas a");
    expect(select).toBeDisabled();
    expect(select).toHaveAttribute("title", expect.stringContaining("Ainda não disponível"));
  });

  it("Repetir controla se a reprodução volta ao início ou para no fim", () => {
    vi.useFakeTimers();
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Pré-visualização" }));
    const repeat = screen.getByLabelText("Repetir reprodução");
    expect(repeat).toBeChecked();
    fireEvent.click(repeat);
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "9.9" } });
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir prévia" }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByLabelText("Agulha da timeline")).toHaveValue("10");
    expect(screen.getByRole("button", { name: "Reproduzir prévia" })).toBeInTheDocument();

    fireEvent.click(repeat);
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir prévia" }));
    act(() => vi.advanceTimersByTime(250));
    expect(Number(screen.getByLabelText("Agulha da timeline").value)).toBeLessThan(1);
    expect(screen.getByRole("button", { name: "Pausar prévia" })).toBeInTheDocument();
  });
});

describe("MMEffect — barra de ferramentas", () => {
  it("tem todas as ferramentas na ordem do After, com aria-pressed e ícones distintos", () => {
    renderWorkspace();
    const bar = screen.getByRole("toolbar", { name: "Ferramentas do MMEffect" });
    const tools = within(bar).getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"));
    expect(tools.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Seleção (V)", "Mão (H)", "Zoom (Z)", "Rotação (W)", "Câmera (C)", "Âncora (Y)", "Forma (Q)", "Caneta (G)", "Texto (T)",
    ]);
    const icons = tools.map((button) => button.querySelector("svg").getAttribute("class"));
    expect(new Set(icons).size).toBe(icons.length);
    expect(tools[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(bar).getByRole("button", { name: "Zoom (Z)" }));
    expect(within(bar).getByRole("button", { name: "Zoom (Z)" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(bar).getByRole("button", { name: "Rotação (W)" }));
    expect(within(bar).getByRole("button", { name: "Rotação (W)" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(bar).getByRole("button", { name: "Âncora (Y)" }));
    expect(within(bar).getByRole("button", { name: "Âncora (Y)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Câmera e Luz dividem um slot com menu suspenso", () => {
    renderWorkspace();
    const bar = screen.getByRole("toolbar", { name: "Ferramentas do MMEffect" });
    expect(within(bar).queryByRole("button", { name: "Luz (L)" })).toBeNull();
    const more = within(bar).getByRole("button", { name: "Mais ferramentas de câmera e luz" });
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Luz (L)" }));
    expect(within(bar).getByRole("button", { name: "Luz (L)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("menu", { name: "Câmera e luz" })).toBeNull();
    fireEvent.keyDown(window, { key: "c" });
    expect(within(bar).getByRole("button", { name: "Câmera (C)" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(more);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "Câmera e luz" })).toBeNull();
  });
});
