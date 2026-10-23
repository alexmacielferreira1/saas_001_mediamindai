import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CraftLibraryWorkspace from "./CraftLibraryWorkspace";

const props = { assets: [], selected: null, onSelect: vi.fn(), onOpenFiles: vi.fn() };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("MM Library — Nova pasta sem window.prompt", () => {
  it("abre o diálogo próprio mesmo com o prompt nativo bloqueado e cria a pasta", async () => {
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<CraftLibraryWorkspace {...props} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Nova pasta/ })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Nome da nova pasta" });
    expect(prompt).not.toHaveBeenCalled();
    const input = screen.getByRole("textbox", { name: "Nome da nova pasta" });
    expect(input).toHaveValue("Nova pasta");
    fireEvent.change(input, { target: { value: "  Clientes 2026  " } });
    fireEvent.submit(dialog);
    expect(await screen.findByRole("button", { name: /Clientes 2026/ })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancelar ou nome vazio não cria pasta", async () => {
    render(<CraftLibraryWorkspace {...props} />);
    const before = screen.getAllByRole("button").length;
    fireEvent.click(screen.getAllByRole("button", { name: /Nova pasta/ })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Nova pasta/ })[0]);
    fireEvent.change(await screen.findByRole("textbox", { name: "Nome da nova pasta" }), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("dialog"));
    await screen.findAllByRole("button", { name: /Nova pasta/ });
    expect(screen.getAllByRole("button")).toHaveLength(before);
  });
});
