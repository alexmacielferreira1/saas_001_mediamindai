import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import OfficeCraft from "./OfficeCraft";
import SoundCraft from "./SoundCraft";

describe("SoundCraft", () => {
  beforeEach(() => localStorage.clear());

  it("adds and mixes audio tracks in an edit window", () => {
    render(<SoundCraft />);
    fireEvent.click(screen.getByRole("tab", { name: "Mesa integrada" }));
    fireEvent.click(screen.getByRole("button", { name: "Nova faixa" }));
    expect(screen.getByDisplayValue("Áudio 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Silenciar Áudio 3" }));
    expect(screen.getByRole("button", { name: "Silenciar Áudio 3" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Volume Áudio 3"), { target: { value: "62" } });
    expect(screen.getByText("-7.6 dB")).toBeInTheDocument();
  });

  it("switches between edit and mix windows", () => {
    render(<SoundCraft />);
    fireEvent.click(screen.getByRole("tab", { name: "Mesa integrada" }));
    fireEvent.click(screen.getByRole("tab", { name: "Mix" }));
    expect(screen.getByRole("region", { name: "Mesa de mixagem" })).toBeInTheDocument();
  });

  it("loads the complete SoundCraft web runtime by default", () => {
    render(<SoundCraft />);
    expect(screen.getByTitle("MMSOM completo")).toHaveAttribute("src", "/soundcraft-runtime/index.html");
  });
});

describe("OfficeCraft", () => {
  beforeEach(() => localStorage.clear());

  it("edits and restores a WordCraft document locally", () => {
    const { unmount } = render(<OfficeCraft />);
    const editor = screen.getByLabelText("Documento WordCraft");
    editor.innerHTML = "<p>Relatório trimestral</p>";
    fireEvent.input(editor);
    unmount();
    render(<OfficeCraft />);
    expect(screen.getByLabelText("Documento WordCraft")).toHaveTextContent("Relatório trimestral");
  });

  it("edits spreadsheet cells and adds presentation slides", () => {
    render(<OfficeCraft />);
    fireEvent.click(screen.getByRole("tab", { name: "Excel" }));
    fireEvent.change(screen.getByLabelText("Célula A1"), { target: { value: "Receita" } });
    expect(screen.getByLabelText("Célula A1")).toHaveValue("Receita");
    fireEvent.click(screen.getByRole("tab", { name: "PowerPoint" }));
    fireEvent.click(screen.getByRole("button", { name: "Novo slide" }));
    expect(screen.getAllByRole("button", { name: /^Slide \d+$/ })).toHaveLength(2);
  });
});
