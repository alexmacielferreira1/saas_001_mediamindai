import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTextPrompt } from "./FilmCraftTextPrompt";

let ask;
function Host() {
  const [askText, dialog] = useTextPrompt();
  ask = askText;
  return dialog;
}

describe("FilmCraftTextPrompt", () => {
  it("devolve o texto confirmado e null ao cancelar", async () => {
    render(<Host />);
    let answer;
    act(() => {
      ask("Nome", "Antigo").then((value) => (answer = value));
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Novo" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "OK" })));
    expect(answer).toBe("Novo");
    act(() => {
      ask("Nome").then((value) => (answer = value));
    });
    await act(async () => fireEvent.keyDown(screen.getByRole("dialog", { name: "Nome" }), { key: "Escape" }));
    expect(answer).toBeNull();
  });

  it("usa tokens de tema (sem cinzas hex fixos) para funcionar no tema claro", () => {
    render(<Host />);
    act(() => {
      ask("Nome");
    });
    const dialog = screen.getByRole("dialog", { name: "Nome" });
    expect(dialog.className).toContain("bg-mm-dialog");
    expect(dialog.className).toContain("border-mm-dialog-edge");
    expect(screen.getByRole("textbox", { name: "Nome" }).className).toContain("text-mm-dialog-ink");
    const classes = [dialog, ...dialog.querySelectorAll("*")].map((node) => node.getAttribute("class") || "").join(" ");
    expect(classes).not.toMatch(/\[#[0-9a-f]{3,6}\]/i);
  });
});
