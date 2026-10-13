import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VectorCraftWorkspace from "./VectorCraftWorkspace";

describe("MMVector direct manipulation", () => {
  it("creates, moves and resizes an element from the workspace", () => {
    let generatedId = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => `new-vector-object-${generatedId++}`,
    });
    render(
      <VectorCraftWorkspace
        assets={[]}
        selected={null}
        onSelect={vi.fn()}
        onOpenFiles={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    const rectangle = screen.getByRole("button", {
      name: "Retângulo 10 na prancheta",
    });
    expect(rectangle).toHaveStyle({ left: "220px", top: "220px" });

    fireEvent.pointerDown(rectangle, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 236, clientY: 218 });
    fireEvent.pointerUp(window);
    expect(rectangle).toHaveStyle({ left: "270px", top: "245px" });

    const resizeHandle = screen.getByRole("button", {
      name: "Redimensionar Retângulo 10 se",
    });
    fireEvent.pointerDown(resizeHandle, { clientX: 300, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 336, clientY: 336 });
    fireEvent.pointerUp(window);
    expect(rectangle).toHaveStyle({ width: "230px", height: "190px" });
    expect(
      screen.getAllByRole("button", { name: /Redimensionar Retângulo 10/ }),
    ).toHaveLength(8);

    const rotationHandle = screen.getByRole("button", {
      name: "Girar Retângulo 10",
    });
    fireEvent.pointerDown(rotationHandle, { clientX: 10, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 0, clientY: 10 });
    fireEvent.pointerUp(window);
    expect(rectangle).toHaveStyle({ transform: "rotate(90deg)" });

    fireEvent.change(screen.getByLabelText("Espessura do traçado"), {
      target: { value: "6" },
    });
    expect(rectangle.style.boxShadow).toContain("6px");

    fireEvent.click(screen.getByRole("button", { name: "+ Texto" }));
    fireEvent.change(screen.getByLabelText("Conteúdo do texto"), {
      target: { value: "NOVA MARCA" },
    });
    expect(screen.getAllByText("NOVA MARCA")).toHaveLength(2);
  }, 10000);

  it("draws shapes and paths by clicking or dragging on the artboard", () => {
    let generatedId = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => `drawn-vector-object-${generatedId++}`,
    });
    render(
      <VectorCraftWorkspace
        assets={[]}
        selected={null}
        onSelect={vi.fn()}
        onOpenFiles={vi.fn()}
      />,
    );

    const artboard = screen.getByLabelText("Prancheta vetorial");
    vi.spyOn(artboard, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      width: 590.4,
      height: 446.4,
      right: 690.4,
      bottom: 546.4,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    fireEvent.click(screen.getByRole("button", { name: "Retângulo (M)" }));
    fireEvent.pointerDown(artboard, { clientX: 172, clientY: 172 });
    fireEvent.pointerMove(window, { clientX: 316, clientY: 280 });
    fireEvent.pointerUp(window);
    expect(
      screen.getByRole("button", { name: "Retângulo 10 na prancheta" }),
    ).toHaveStyle({ left: "100px", top: "100px", width: "200px", height: "150px" });

    fireEvent.click(screen.getByRole("button", { name: "Elipse (L)" }));
    fireEvent.pointerDown(artboard, { clientX: 244, clientY: 244 });
    fireEvent.pointerUp(window);
    expect(
      screen.getByRole("button", { name: "Elipse 11 na prancheta" }),
    ).toHaveStyle({ width: "140px", height: "140px", borderRadius: "50%" });

    fireEvent.click(screen.getByRole("button", { name: "Polígono" }));
    fireEvent.pointerDown(artboard, { clientX: 260, clientY: 260 });
    fireEvent.pointerUp(window);
    expect(
      screen.getByRole("button", { name: "Forma 12 na prancheta" }),
    ).toHaveStyle({ clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" });

    fireEvent.click(screen.getByRole("button", { name: "Caneta (P)" }));
    fireEvent.pointerDown(artboard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 380, clientY: 290 });
    fireEvent.pointerUp(window);
    expect(
      screen.getByRole("button", { name: "Traçado 13 na prancheta" }),
    ).toBeInTheDocument();
  }, 10000);

  it("draws over an existing object instead of moving that object", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "drawn-over-background",
    });
    render(
      <VectorCraftWorkspace
        assets={[]}
        selected={null}
        onSelect={vi.fn()}
        onOpenFiles={vi.fn()}
      />,
    );

    const artboard = screen.getByLabelText("Prancheta vetorial");
    vi.spyOn(artboard, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      width: 590.4,
      height: 446.4,
      right: 690.4,
      bottom: 546.4,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    fireEvent.click(screen.getByRole("button", { name: "Retângulo (M)" }));
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Fundo na prancheta" }),
      { clientX: 172, clientY: 172 },
    );
    fireEvent.pointerMove(window, { clientX: 316, clientY: 280 });
    fireEvent.pointerUp(window);

    expect(
      screen.getByRole("button", { name: "Retângulo 10 na prancheta" }),
    ).toHaveStyle({ left: "100px", top: "100px", width: "200px", height: "150px" });
  }, 10000);

  it("matches the primary tools and shortcuts from the VectorCraft 0.7 basic toolbar", () => {
    let generatedId = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => `distinct-tool-${generatedId++}`,
    });
    render(
      <VectorCraftWorkspace
        assets={[]}
        selected={null}
        onSelect={vi.fn()}
        onOpenFiles={vi.fn()}
      />,
    );

    for (const name of [
      "Seleção (V)",
      "Seleção direta (A)",
      "Laço (Q)",
      "Retângulo (M)",
      "Elipse (L)",
      "Polígono",
      "Modelador (Shift+N)",
      "Lápis (N)",
      "Borracha (Shift+E)",
      "Pincel (B)",
      "Caneta (P)",
      "Curvatura (Shift+~)",
      "Largura (Shift+W)",
      "Girar (R)",
      "Construtor de formas (Shift+M)",
      "Texto em área",
      "Texto (T)",
      "Zoom (Z)",
      "Mão (H)",
      "Girar visualização (Shift+H)",
      "Gradiente (G)",
      "Conta-gotas (I)",
    ]) {
      expect(screen.getByRole("button", { name, hidden: true })).toBeInTheDocument();
    }

    expect(screen.queryByRole("button", { name: "Polígono (Y)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Curvatura (C)" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Retângulo (M)" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Gradiente (G)" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Conta-gotas (I)" })).toHaveLength(1);

    const artboard = screen.getByLabelText("Prancheta vetorial");
    vi.spyOn(artboard, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      width: 590.4,
      height: 446.4,
      right: 690.4,
      bottom: 546.4,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    for (const name of ["Caneta (P)", "Pincel (B)", "Lápis (N)", "Curvatura (Shift+~)"]) {
      fireEvent.click(screen.getByRole("button", { name, hidden: true }));
      fireEvent.pointerDown(artboard, { clientX: 180, clientY: 180 });
      fireEvent.pointerMove(window, { clientX: 300, clientY: 240 });
      fireEvent.pointerUp(window);
    }

    const paths = screen
      .getAllByRole("button", { name: /Traçado \d+ na prancheta/ })
      .map((element) => element.querySelector("path")?.getAttribute("d"));
    expect(new Set(paths).size).toBe(4);

    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.pointerDown(artboard, { clientX: 220, clientY: 220 });
    fireEvent.pointerUp(window);
    expect(screen.getByRole("button", { name: "Texto 14 na prancheta" })).toHaveStyle({
      background: "transparent",
    });

    fireEvent.click(screen.getByRole("button", { name: "Borracha (Shift+E)" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Forma circular na prancheta" }));
    expect(screen.queryByRole("button", { name: "Forma circular na prancheta" })).not.toBeInTheDocument();
  }, 20000);

  it("restores the tools hidden in the original VectorCraft flyout groups", () => {
    render(
      <VectorCraftWorkspace
        assets={[]}
        selected={null}
        onSelect={vi.fn()}
        onOpenFiles={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Retângulo arredondado" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo de Retângulo" }));
    for (const name of [
      "Retângulo arredondado",
      "Estrela",
      "Segmento de linha (\\)",
      "Arco",
      "Espiral",
      "Grade retangular",
      "Grade polar",
      "Clarão",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Estrela" }));
    expect(screen.getByRole("button", { name: "Estrela" })).toHaveClass("bg-[#202020]");

    fireEvent.click(screen.getByRole("button", { name: "Abrir grupo de Borracha" }));
    for (const name of ["Tesoura (C)", "Faca", "Corte espelhado", "Corte em linha", "Corte retangular"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});
