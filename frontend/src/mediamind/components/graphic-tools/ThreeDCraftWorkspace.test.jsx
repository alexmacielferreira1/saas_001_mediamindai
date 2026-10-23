import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThreeDCraftWorkspace from "./ThreeDCraftWorkspace";

// "Adicionar" fica num slot com flyout (como no Blender, Shift+A): abre o menu e escolhe o tipo.
function addObject(name) {
  fireEvent.click(screen.getByRole("button", { name: "Adicionar objeto" }));
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("ThreeDCraftWorkspace — campos numéricos", () => {
  it("apagar o campo não zera e aceita negativo e decimal", () => {
    render(<ThreeDCraftWorkspace />);
    const x = screen.getByRole("spinbutton", { name: "X de Cubo" });
    const cube = () => screen.getByRole("button", { name: "Objeto Cubo" });
    fireEvent.focus(x);
    fireEvent.change(x, { target: { value: "" } });
    expect(x).toHaveValue("");
    expect(cube()).toHaveStyle({ left: "52%" });
    fireEvent.change(x, { target: { value: "-" } });
    expect(x).toHaveValue("-");
    expect(cube()).toHaveStyle({ left: "52%" });
    fireEvent.change(x, { target: { value: "-12.5" } });
    expect(cube()).toHaveStyle({ left: "-12.5%" });
    fireEvent.blur(x);
    expect(x).toHaveValue("-12.5");
    fireEvent.focus(x);
    fireEvent.change(x, { target: { value: "" } });
    fireEvent.blur(x);
    expect(x).toHaveValue("-12.5");
  });
});

describe("ThreeDCraftWorkspace — barra e cabeçalho", () => {
  it("ferramentas têm aria-label e aria-pressed; Adicionar é um slot com flyout", () => {
    render(<ThreeDCraftWorkspace />);
    const toolbar = screen.getByRole("complementary", { name: "Ferramentas 3D" });
    for (const button of toolbar.querySelectorAll("button")) {
      expect(button).toHaveAttribute("aria-label");
      if (!button.hasAttribute("aria-haspopup")) expect(button).toHaveAttribute("aria-pressed");
    }
    expect(screen.getByRole("button", { name: "Mover" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Adicionar cubo" })).not.toBeInTheDocument();
    const slot = screen.getByRole("button", { name: "Adicionar objeto" });
    expect(slot).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(slot);
    expect(slot).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("group", { name: "Adicionar objeto" });
    expect([...menu.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Adicionar cubo", "Adicionar esfera", "Adicionar plano", "Adicionar câmera", "Adicionar luz"]);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar luz" }));
    expect(screen.getByRole("button", { name: "Luz 2" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Adicionar objeto" })).not.toBeInTheDocument();
  });

  it("Outliner mostra/oculta o painel da cena e Atalhos lista atalhos que funcionam", () => {
    render(<ThreeDCraftWorkspace />);
    expect(screen.queryByText("Arquivo")).not.toBeInTheDocument();
    const outliner = screen.getByRole("button", { name: "Outliner" });
    expect(outliner).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Cena")).toBeInTheDocument();
    fireEvent.click(outliner);
    expect(outliner).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Cena")).not.toBeInTheDocument();
    fireEvent.click(outliner);
    expect(screen.getByText("Cena")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Atalhos" }));
    const list = screen.getByRole("dialog", { name: "Atalhos do MM3D" });
    expect(list).toHaveTextContent("G");
    fireEvent.click(screen.getByRole("button", { name: "Fechar atalhos" }));
    expect(screen.queryByRole("dialog", { name: "Atalhos do MM3D" })).not.toBeInTheDocument();

    const editor = screen.getByLabelText("Editor MM3D");
    fireEvent.keyDown(editor, { key: "r" });
    expect(screen.getByRole("button", { name: "Rotacionar" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(editor, { key: "s" });
    expect(screen.getByRole("button", { name: "Escalar" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(editor, { key: "g" });
    expect(screen.getByRole("button", { name: "Mover" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(editor, { key: "D", shiftKey: true });
    expect(screen.getByRole("button", { name: "Cubo cópia" })).toBeInTheDocument();
    fireEvent.keyDown(editor, { key: "Delete" });
    expect(screen.queryByRole("button", { name: "Cubo cópia" })).not.toBeInTheDocument();
    // Digitar num campo não troca a ferramenta.
    fireEvent.keyDown(screen.getAllByRole("spinbutton")[0], { key: "r" });
    expect(screen.getByRole("button", { name: "Mover" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Grade é um botão de alternância", () => {
    render(<ThreeDCraftWorkspace />);
    const grid = screen.getByRole("button", { name: "Grade" });
    expect(grid).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(grid);
    expect(grid).toHaveAttribute("aria-pressed", "false");
  });
});

describe("ThreeDCraftWorkspace", () => {
  it("adds, selects and transforms a scene object", () => {
    render(<ThreeDCraftWorkspace />);
    addObject("Adicionar esfera");
    expect(screen.getByRole("button", { name: "Esfera 1" })).toBeInTheDocument();
    const x = screen.getByLabelText("X de Esfera 1");
    fireEvent.change(x, { target: { value: "64" } });
    expect(x).toHaveValue("64");
    expect(screen.getByRole("button", { name: "Objeto Esfera 1" })).toBeInTheDocument();
  });

  it("changes viewport and timeline controls", () => {
    render(<ThreeDCraftWorkspace />);
    fireEvent.change(screen.getByLabelText("Proporção do viewport"), { target: { value: "9:16" } });
    fireEvent.change(screen.getByLabelText("Timeline 3D"), { target: { value: "4.5" } });
    expect(screen.getByLabelText("Proporção do viewport")).toHaveValue("9:16");
    expect(screen.getByLabelText("Timeline 3D")).toHaveValue("4.5");
  });

  it("uses Blender-style transform tools directly in the viewport", () => {
    render(<ThreeDCraftWorkspace />);
    const cube = screen.getByRole("button", { name: "Objeto Cubo" });
    fireEvent.pointerDown(cube, { pointerId: 1, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(cube, { pointerId: 1, clientX: 440, clientY: 320 });
    fireEvent.pointerUp(cube, { pointerId: 1 });
    expect(screen.getByLabelText("X de Cubo")).toHaveValue("60");
    expect(screen.getByLabelText("Y de Cubo")).toHaveValue("53");

    fireEvent.click(screen.getByRole("button", { name: "Rotacionar" }));
    fireEvent.pointerDown(cube, { pointerId: 2, clientX: 440, clientY: 320 });
    fireEvent.pointerMove(cube, { pointerId: 2, clientX: 470, clientY: 320 });
    fireEvent.pointerUp(cube, { pointerId: 2 });
    expect(screen.getByLabelText("Rotação de Cubo")).toHaveValue("18");
  });

  it("manages objects from the outliner", () => {
    render(<ThreeDCraftWorkspace />);
    addObject("Adicionar plano");
    expect(screen.getByRole("button", { name: "Plano 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Duplicar objeto" }));
    expect(screen.getByRole("button", { name: "Plano 1 cópia" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar Plano 1 cópia" }));
    expect(screen.queryByRole("button", { name: "Objeto Plano 1 cópia" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir objeto" }));
    expect(screen.queryByRole("button", { name: "Plano 1 cópia" })).not.toBeInTheDocument();
  });

  it("interpolates animated transforms between keyframes", () => {
    render(<ThreeDCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Animar X de Cubo" }));
    fireEvent.change(screen.getByLabelText("Timeline 3D"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("X de Cubo"), { target: { value: "72" } });
    expect(screen.getByText("2 quadros-chave")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Timeline 3D"), { target: { value: "2.5" } });
    expect(screen.getByLabelText("X de Cubo")).toHaveValue("62");
    expect(screen.getByRole("button", { name: "Objeto Cubo" })).toHaveStyle({ left: "62%" });
  });
});

describe("ThreeDCraftWorkspace — ações não implementadas", () => {
  it("Construir e Gravar ficam desabilitados com aviso honesto", () => {
    render(<ThreeDCraftWorkspace />);
    for (const name of ["Construir", "Gravar"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Ainda não disponível");
    }
  });
});
