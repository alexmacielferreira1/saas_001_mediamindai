import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VectorCraftWorkspace, { TOOL_GROUPS, UNSUPPORTED_TOOLS } from "./VectorCraftWorkspace";

const SCALE = 0.72;
const at = (x, y, extra = {}) => ({ clientX: 100 + x * SCALE, clientY: 100 + y * SCALE, ...extra });

function setup() {
  let generatedId = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `field-object-${generatedId++}` });
  const view = render(
    <VectorCraftWorkspace assets={[]} selected={null} onSelect={vi.fn()} onOpenFiles={vi.fn()} />,
  );
  const artboard = screen.getByLabelText("Prancheta vetorial");
  vi.spyOn(artboard, "getBoundingClientRect").mockReturnValue({
    left: 100, top: 100, width: 820 * SCALE, height: 620 * SCALE, right: 100 + 820 * SCALE, bottom: 100 + 620 * SCALE, x: 100, y: 100, toJSON: () => {},
  });
  return { ...view, artboard };
}
const onCanvas = (name) => screen.getByRole("button", { name: `${name} na prancheta` });
const openPanel = (name) => fireEvent.click(within(screen.getByRole("navigation", { name: "Painéis do MMVector" })).getByRole("button", { name }));
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const status = () => screen.getByRole("status").textContent;

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MMVector — barra de ferramentas", () => {
  it("cada ferramenta tem um ícone próprio", () => {
    const owners = new Map();
    const clashes = [];
    for (const group of TOOL_GROUPS) for (const slot of group.slots) for (const [, name, Icon] of slot) {
      expect(Icon, name).toBeTruthy();
      if (owners.has(Icon) && owners.get(Icon) !== name) clashes.push(`${owners.get(Icon)} = ${name}`);
      owners.set(Icon, name);
    }
    expect(clashes).toEqual([]);
  });

  it("botões da barra têm aria-pressed e ferramentas sem suporte aparecem desabilitadas", () => {
    setup();
    expect(screen.getByRole("button", { name: "Seleção (V)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Laço (Q)" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo de Gradiente" }));
    const flyout = screen.getByRole("menu", { name: "Grupo de Gradiente" });
    const mesh = within(flyout).getByRole("button", { name: "Malha (U)" });
    expect(mesh).toHaveAttribute("aria-disabled", "true");
    expect(mesh.getAttribute("title")).toMatch(/Ainda não disponível/);
    expect(mesh.className).toMatch(/opacity-/);
    expect(within(flyout).getByRole("button", { name: "Gradiente (G)" })).not.toHaveAttribute("aria-disabled");
    fireEvent.click(mesh);
    expect(status()).toMatch(/ainda não está disponível/);

    // Seleção de grupo, Transformação livre e Seleção de pintura ao vivo não fingem funcionar.
    for (const name of ["Seleção de grupo", "Transformação livre", "Seleção de pintura ao vivo"]) expect(UNSUPPORTED_TOOLS[name]).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo de Seleção direta" }));
    expect(screen.getByRole("button", { name: "Seleção de grupo" })).toHaveAttribute("aria-disabled", "true");
  });

  it("Seleção direta arrasta um ponto de ancoragem de verdade", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    fireEvent.keyDown(window, { key: "a" });
    expect(screen.getByRole("button", { name: "Seleção direta (A)" })).toHaveAttribute("aria-pressed", "true");
    const rectangle = onCanvas("Retângulo 10");
    expect(screen.getByLabelText("Pontos de ancoragem")).toBeInTheDocument();
    fireEvent.pointerDown(rectangle, at(220, 220));
    fireEvent.pointerMove(window, at(200, 190));
    fireEvent.pointerUp(window, at(200, 190));
    expect(rectangle).toHaveStyle({ left: "200px", top: "190px", width: "200px", height: "170px" });
    expect(rectangle.querySelector("path").getAttribute("d")).toBe("M0 0 L200 30 L200 170 L20 170 Z");
    expect(status()).toMatch(/Ponto de ancoragem movido/);

    // Fora de um ponto, a Seleção direta move o caminho inteiro.
    fireEvent.pointerDown(rectangle, at(300, 300));
    fireEvent.pointerMove(window, at(310, 300));
    fireEvent.pointerUp(window, at(310, 300));
    expect(rectangle).toHaveStyle({ left: "210px" });
  });

  it("recolher rótulos, mais ferramentas e quadros de cor funcionam", () => {
    setup();
    expect(screen.queryByTitle("Modos de desenho")).not.toBeInTheDocument();
    const collapse = screen.getByRole("button", { name: "Recolher rótulos das ferramentas" });
    expect(screen.getByText("Formas")).toBeInTheDocument();
    fireEvent.click(collapse);
    expect(screen.queryByText("Formas")).not.toBeInTheDocument();
    expect(collapse).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(collapse);
    expect(screen.getByText("Formas")).toBeInTheDocument();

    const more = screen.getByRole("button", { name: "Mais ferramentas" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    const list = screen.getByRole("menu", { name: "Todas as ferramentas" });
    fireEvent.click(within(list).getByRole("menuitem", { name: "Estrela" }));
    expect(screen.queryByRole("menu", { name: "Todas as ferramentas" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Estrela" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(onCanvas("Forma circular"));
    fireEvent.click(screen.getByRole("button", { name: "Preenchimento em gradiente" }));
    expect(onCanvas("Forma circular").style.background).toContain("linear-gradient");
    fireEvent.click(screen.getByRole("button", { name: "Sem preenchimento" }));
    expect(onCanvas("Forma circular")).toHaveStyle({ background: "transparent" });
    fireEvent.click(screen.getByRole("button", { name: "Preenchimento sólido" }));
    expect(onCanvas("Forma circular")).toHaveStyle({ background: "#22d3ee" });
  });
});

describe("MMVector — campos numéricos", () => {
  it("digitar '-' não grava NaN nem some com a forma", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    for (const label of ["X", "Y", "L", "A", "Rotação", "Espessura do traçado", "Opacidade"]) {
      type(label, "-");
      expect(screen.getByLabelText(label)).toHaveValue("-");
    }
    expect(circle).toHaveStyle({ left: "530px", top: "170px", width: "185px", height: "185px", opacity: "1" });
    expect(circle.style.transform).toBe("rotate(0deg)");
    type("X", "-20");
    expect(circle).toHaveStyle({ left: "-20px" });
    type("Rotação", "-45");
    expect(circle.style.transform).toBe("rotate(-45deg)");
    type("Opacidade", "40");
    expect(circle).toHaveStyle({ opacity: "0.4" });
    fireEvent.blur(screen.getByLabelText("L"));
    expect(circle).toHaveStyle({ width: "185px" });
  });

  it("raio dos cantos e peso do traçado aceitam rascunho sem NaN", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    const rectangle = onCanvas("Retângulo 10");
    type("Raio dos cantos", "-");
    expect(rectangle.style.borderRadius).not.toMatch(/NaN/);
    expect(rectangle).toHaveStyle({ width: "180px" });
    type("Raio dos cantos", "12");
    expect(rectangle.style.borderRadius).toBe("12px");
    openPanel("Traçado");
    type("Peso do traçado", "-");
    expect(rectangle.style.boxShadow).toBe("");
    type("Peso do traçado", "4");
    expect(rectangle.style.boxShadow).toContain("4px");
  });
});

describe("MMVector — painéis com efeito real", () => {
  it("Transformar mostra os valores do objeto e edita o mesmo estado", () => {
    setup();
    openPanel("Transformar");
    expect(screen.getByLabelText("X")).toHaveValue("112");
    expect(screen.getByLabelText("L")).toHaveValue("390");
    const title = onCanvas("Título principal");
    type("X", "140");
    expect(title).toHaveStyle({ left: "140px" });
    type("Inclinação", "-");
    type("Inclinação", "15");
    expect(title.style.transform).toContain("skewX(15deg)");
    expect(screen.getByLabelText("Transformar padrões")).toBeDisabled();
  });

  it("Informações mostra valores reais do objeto selecionado", () => {
    setup();
    fireEvent.click(onCanvas("Forma circular"));
    openPanel("Informações");
    const info = screen.getByLabelText("Informações do objeto");
    expect(info).toHaveTextContent("X530 px");
    expect(info).toHaveTextContent("R34");
    expect(info).toHaveTextContent("G211");
    expect(info).toHaveTextContent("B238");
  });

  it("Gradiente aplica, edita ângulo e cores do preenchimento", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    openPanel("Gradiente");
    expect(screen.getByLabelText("Ângulo do gradiente")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Linear" }));
    expect(circle.style.background).toContain("linear-gradient(90deg");
    type("Ângulo do gradiente", "-");
    type("Ângulo do gradiente", "45");
    expect(circle.style.background).toContain("linear-gradient(45deg");
    type("Cor inicial do gradiente", "#ff0000");
    expect(circle.style.background).toMatch(/#ff0000|rgb\(255, 0, 0\)/);
    expect(screen.getByRole("button", { name: "Radial" })).toBeDisabled();
    expect(screen.getByLabelText("Proporção do gradiente")).toBeDisabled();
  });

  it("Texto e Parágrafo alteram fonte, tamanho e alinhamento do texto", () => {
    setup();
    openPanel("Texto");
    const span = onCanvas("Título principal").querySelector("span");
    fireEvent.change(screen.getByLabelText("Família da fonte"), { target: { value: "Arial" } });
    fireEvent.change(screen.getByLabelText("Estilo da fonte"), { target: { value: "Regular" } });
    type("Tamanho da fonte", "-");
    type("Tamanho da fonte", "30");
    type("Tracking", "100");
    expect(span.style.fontFamily).toContain("Arial");
    expect(span.style.fontWeight).toBe("400");
    expect(span.style.fontSize).toBe("30px");
    expect(span.style.letterSpacing).toBe("0.1em");
    expect(screen.getByLabelText("Escala H")).toBeDisabled();

    openPanel("Parágrafo");
    fireEvent.click(screen.getByRole("button", { name: "Centralizar" }));
    expect(span.style.textAlign).toBe("center");
    expect(screen.getByRole("button", { name: "Centralizar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Recuo esquerdo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Justificar tudo" })).toBeDisabled();

    fireEvent.click(onCanvas("Forma circular"));
    openPanel("Texto");
    expect(screen.getByLabelText("Tamanho da fonte")).toBeDisabled();
  });

  it("Cor e Transparência editam a cor e a opacidade do objeto", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    openPanel("Cor");
    expect(screen.getByLabelText("Valor R")).toHaveValue("34");
    type("Valor R", "-");
    expect(circle).toHaveStyle({ background: "#22d3ee" });
    type("Valor R", "255");
    expect(circle).toHaveStyle({ background: "#ffd3ee" });
    type("Canal G", "0");
    expect(circle).toHaveStyle({ background: "#ff00ee" });
    type("Cor hexadecimal", "12");
    expect(circle).toHaveStyle({ background: "#ff00ee" });
    type("Cor hexadecimal", "#123456");
    expect(circle).toHaveStyle({ background: "#123456" });

    openPanel("Transparência");
    type("Opacidade da transparência", "30");
    expect(circle).toHaveStyle({ opacity: "0.3" });
    expect(screen.getByLabelText("Modo de mesclagem")).toBeDisabled();
  });

  it("Opções de padrão fica desabilitado com aviso honesto", () => {
    setup();
    openPanel("Opções de padrão");
    for (const label of ["Nome do padrão", "Tipo de bloco", "Largura do bloco", "Altura do bloco"]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
      expect(screen.getByLabelText(label)).toHaveAttribute("title", "Ainda não disponível");
    }
  });

  it("Aparência flutuante edita desfoque e opacidade reais", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    fireEvent.click(screen.getByRole("button", { name: "Janela", expanded: false }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Aparência flutuante" }));
    const panel = screen.getByRole("region", { name: "Aparência flutuante" });
    fireEvent.change(within(panel).getByLabelText("Desfoque"), { target: { value: "3" } });
    expect(circle.style.filter).toBe("blur(3px)");
    fireEvent.change(within(panel).getByLabelText("Opacidade da aparência"), { target: { value: "-" } });
    expect(circle).toHaveStyle({ opacity: "1" });
    fireEvent.change(within(panel).getByLabelText("Opacidade da aparência"), { target: { value: "50" } });
    expect(circle).toHaveStyle({ opacity: "0.5" });
    expect(within(panel).getByLabelText("Modo de mesclagem")).toBeDisabled();
  });
});
