import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EffectCraftWorkspace from "./EffectCraftWorkspace";

describe("MMEffect parenting", () => {
  it("assigns the layer under the cursor when the captured pick whip is released", () => {
    render(
      <EffectCraftWorkspace
        assets={[]}
        selected={null}
        onSelect={vi.fn()}
        onOpenFiles={vi.fn()}
      />,
    );

    const source = screen.getByRole("button", {
      name: "Vincular MMEffect a outra camada",
    });
    const target = screen.getByRole("button", { name: "Controller" });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => target),
    });

    fireEvent.pointerDown(source, {
      pointerId: 12,
      clientX: 500,
      clientY: 300,
    });
    fireEvent.pointerMove(source, {
      pointerId: 12,
      clientX: 620,
      clientY: 420,
    });
    fireEvent.pointerUp(source, {
      pointerId: 12,
      clientX: 620,
      clientY: 420,
    });

    expect(screen.getByLabelText("Pai de MMEffect")).toHaveValue("shape");
  }, 15000);
});
