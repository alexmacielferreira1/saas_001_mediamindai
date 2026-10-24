import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ToolRail, { shownToolForSlot } from "./ToolRail.jsx";

const Brush = (props) => <svg data-testid="brush" {...props} />;
const Pencil = (props) => <svg data-testid="pencil" {...props} />;
const Move = (props) => <svg data-testid="move" {...props} />;

const SLOTS = [
  { tools: [{ name: "Mover", shortcut: "V", Icon: Move }] },
  {
    label: "Pincéis",
    tools: [
      { name: "Pincel", shortcut: "B", Icon: Brush },
      { name: "Lápis", shortcut: "B", Icon: Pencil },
      { name: "Mistura", shortcut: "B", disabled: true },
    ],
  },
];

function Harness({ onSelect = () => {}, initial = "Mover" }) {
  const [tool, setTool] = useState(initial);
  return (
    <>
      <ToolRail
        slots={SLOTS}
        activeTool={tool}
        onSelect={(name) => {
          onSelect(name);
          setTool(name);
        }}
      />
      <button type="button" onClick={() => setTool("Lápis")}>
        atalho
      </button>
      <span>fora</span>
    </>
  );
}

describe("ToolRail", () => {
  it("seleciona a ferramenta do slot e marca como pressionada", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "Mover (V)" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Pincel (B)" }));
    expect(onSelect).toHaveBeenCalledWith("Pincel");
    expect(screen.getByRole("button", { name: "Pincel (B)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("abre o grupo pelo canto e pelo botão direito, e o slot passa a mostrar a escolhida", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo: Pincéis" }));
    const group = screen.getByRole("group", { name: "Pincéis" });
    expect(group).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Lápis (B)" }).at(-1));
    expect(screen.queryByRole("group", { name: "Pincéis" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lápis (B)" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Mover (V)" }));
    // O slot lembra a última usada no grupo mesmo com outra ferramenta ativa.
    expect(screen.getByRole("button", { name: "Lápis (B)" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.contextMenu(screen.getByRole("button", { name: "Lápis (B)" }));
    expect(screen.getByRole("group", { name: "Pincéis" })).toBeInTheDocument();
    fireEvent.contextMenu(screen.getAllByRole("button", { name: "Lápis (B)" })[0]);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("no grupo aberto a ferramenta ativa aparece destacada", () => {
    render(<Harness initial="Lápis" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo: Pincéis" }));
    const items = screen.getAllByRole("button", { name: "Lápis (B)" });
    expect(items.at(-1)).toHaveAttribute("aria-pressed", "true");
    expect(items.at(-1)).toHaveClass("text-white");
  });

  it("acompanha a ferramenta escolhida por atalho", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "atalho" }));
    expect(screen.getByRole("button", { name: "Lápis (B)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("fecha o grupo com clique fora e com Esc", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo: Pincéis" }));
    fireEvent.pointerDown(screen.getByText("fora"));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo: Pincéis" }));
    fireEvent.pointerDown(screen.getByRole("group", { name: "Pincéis" }));
    expect(screen.getByRole("group", { name: "Pincéis" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Enter" });
    expect(screen.getByRole("group", { name: "Pincéis" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo: Pincéis" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo: Pincéis" }));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("ferramenta sem suporte não é selecionada e avisa no título", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo: Pincéis" }));
    const item = screen.getByRole("button", { name: "Mistura (B)" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("title", "Ainda não disponível");
    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("slot simples ignora o botão direito e slot sem ícone mostra a inicial", () => {
    render(
      <ToolRail
        slots={[{ tools: [{ name: "Zoom", disabled: true }] }, { label: "Só", tools: [{ name: "Texto", shortcut: "T" }] }]}
        activeTool="Nada"
        onSelect={() => {}}
        iconSize={12}
        classes={{ disabled: "app-disabled" }}
      />,
    );
    const zoom = screen.getByRole("button", { name: "Zoom" });
    expect(zoom).toHaveTextContent("Z");
    expect(zoom).toHaveClass("app-disabled");
    expect(zoom).toHaveAttribute("title", "Zoom · Ainda não disponível");
    fireEvent.contextMenu(zoom);
    fireEvent.contextMenu(screen.getByRole("button", { name: "Texto (T)" }));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abrir grupo/ })).not.toBeInTheDocument();
  });

  it("shownToolForSlot prioriza a ativa, depois a lembrada, depois a primeira", () => {
    const slot = SLOTS[1];
    expect(shownToolForSlot(slot, "Lápis", "Pincel").name).toBe("Lápis");
    expect(shownToolForSlot(slot, "Mover", "Lápis").name).toBe("Lápis");
    expect(shownToolForSlot(slot, "Mover", undefined).name).toBe("Pincel");
  });
});
