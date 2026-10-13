import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThreeDCraftWorkspace from "./ThreeDCraftWorkspace";

describe("ThreeDCraftWorkspace", () => {
  it("adds, selects and transforms a scene object", () => {
    render(<ThreeDCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar esfera" }));
    expect(screen.getByRole("button", { name: "Esfera 1" })).toBeInTheDocument();
    const x = screen.getByLabelText("X de Esfera 1");
    fireEvent.change(x, { target: { value: "64" } });
    expect(x).toHaveValue(64);
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
    expect(screen.getByLabelText("X de Cubo")).toHaveValue(60);
    expect(screen.getByLabelText("Y de Cubo")).toHaveValue(53);

    fireEvent.click(screen.getByRole("button", { name: "Rotacionar" }));
    fireEvent.pointerDown(cube, { pointerId: 2, clientX: 440, clientY: 320 });
    fireEvent.pointerMove(cube, { pointerId: 2, clientX: 470, clientY: 320 });
    fireEvent.pointerUp(cube, { pointerId: 2 });
    expect(screen.getByLabelText("Rotação de Cubo")).toHaveValue(18);
  });

  it("manages objects from the outliner", () => {
    render(<ThreeDCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar plano" }));
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
    expect(screen.getByLabelText("X de Cubo")).toHaveValue(62);
    expect(screen.getByRole("button", { name: "Objeto Cubo" })).toHaveStyle({ left: "62%" });
  });
});
