import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ updateDarkStructure: vi.fn(), updateDarkDecision: vi.fn() }));
vi.mock("../../../api/darkChannels", () => api);

import DarkStructureEditor, { validateDraft } from "./DarkStructureEditor";

const structure = {
  name: "Rede", source: "importado",
  languages: [
    { code: "pt-BR", name: "Português", regional_frame: "aberto", launch_wave: 1, enabled: true, notes: "Base" },
    { code: "en-US", name: "Inglês", regional_frame: "moldura_propria" },
  ],
  niches: [
    { code: "historia", name: "História", subniches: ["Antiga", "Medieval"], status: "ativo", priority: 1, notes: "Forte" },
    { code: "fe", name: "Fé" },
  ],
  decisions: [{ id: "d1", title: "T", status: "pendente" }],
};
const onChange = vi.fn();
const onDirty = vi.fn();

const renderEditor = (value = structure) => render(<DarkStructureEditor structure={value} onStructureChange={onChange} onDirtyChange={onDirty}/>);
const save = () => screen.getByRole("button", { name: "Salvar estrutura" });

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  onChange.mockReset();
  onDirty.mockReset();
});

describe("Editor de nichos e idiomas", () => {
  it("shows the structure in editable tables and keeps save disabled until something changes", () => {
    renderEditor();
    expect(screen.getByText("Nichos (2)")).toBeInTheDocument();
    expect(screen.getByText("Idiomas (2)")).toBeInTheDocument();
    expect(screen.getByLabelText("Subnichos do nicho 1")).toHaveValue("Antiga, Medieval");
    expect(screen.getByLabelText("Prioridade do nicho 2")).toHaveValue(0);
    expect(screen.getByLabelText("Status do nicho 2")).toHaveValue("");
    expect(within(screen.getByLabelText("Status do nicho 2")).getByRole("option", { name: "—" })).toBeInTheDocument();
    expect(screen.getByLabelText("Recorte regional do idioma 1")).toHaveValue("aberto");
    expect(within(screen.getByLabelText("Recorte regional do idioma 2")).getByRole("option", { name: "moldura_propria" })).toBeInTheDocument();
    expect(screen.getByLabelText("Onda do idioma 1")).toHaveValue(1);
    expect(screen.getByLabelText("Idioma 2 ativo")).toBeChecked();
    expect(save()).toBeDisabled();
    expect(screen.queryByText("Há alterações não salvas em nichos e idiomas.")).not.toBeInTheDocument();
    expect(onDirty).toHaveBeenLastCalledWith(false);
  });

  it("saves edited niches and languages through PUT, preserving decisions and extra fields", async () => {
    api.updateDarkStructure.mockImplementation(async (body) => ({ ...structure, ...body }));
    renderEditor();
    fireEvent.change(screen.getByLabelText("Nome do nicho 2"), { target: { value: " Fé e espiritualidade " } });
    expect(screen.getByText("Há alterações não salvas em nichos e idiomas.")).toBeInTheDocument();
    expect(onDirty).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByLabelText("Status do nicho 2"), { target: { value: "planejado" } });
    fireEvent.change(screen.getByLabelText("Prioridade do nicho 2"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Subnichos do nicho 2"), { target: { value: "Oração, , Salmos, Oração" } });
    fireEvent.change(screen.getByLabelText("Notas do nicho 2"), { target: { value: " Novo " } });
    fireEvent.change(screen.getByLabelText("Código do nicho 2"), { target: { value: "fe " } });
    fireEvent.change(screen.getByLabelText("Prioridade do nicho 1"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Recorte regional do idioma 2"), { target: { value: "sabedoria_compartilhada" } });
    fireEvent.change(screen.getByLabelText("Onda do idioma 2"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Onda do idioma 1"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Idioma 2 ativo"));
    fireEvent.change(screen.getByLabelText("Nome do idioma 2"), { target: { value: "Inglês (EUA)" } });
    fireEvent.change(screen.getByLabelText("Código do idioma 2"), { target: { value: " en-US" } });
    fireEvent.click(save());

    await waitFor(() => expect(api.updateDarkStructure).toHaveBeenCalledWith({
      name: "Rede",
      decisions: structure.decisions,
      niches: [
        { code: "historia", name: "História", subniches: ["Antiga", "Medieval"], status: "ativo", priority: 0, notes: "Forte" },
        { code: "fe", name: "Fé e espiritualidade", subniches: ["Oração", "Salmos"], status: "planejado", priority: 3, notes: "Novo" },
      ],
      languages: [
        { code: "pt-BR", name: "Português", regional_frame: "aberto", launch_wave: null, enabled: true, notes: "Base" },
        { code: "en-US", name: "Inglês (EUA)", regional_frame: "sabedoria_compartilhada", launch_wave: 2, enabled: false },
      ],
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("Estrutura salva.");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Rede" }));
    expect(screen.queryByText("Há alterações não salvas em nichos e idiomas.")).not.toBeInTheDocument();
    expect(onDirty).toHaveBeenLastCalledWith(false);
  });

  it("adds and removes rows and blocks saving on empty or duplicate codes", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar nicho" }));
    expect(screen.getByLabelText("Status do nicho 3")).toHaveValue("planejado");
    expect(screen.getByRole("list", { name: "Problemas na estrutura" })).toHaveTextContent("Preencha código e nome do nicho na linha 3.");
    expect(save()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Código do nicho 3"), { target: { value: "HISTORIA" } });
    fireEvent.change(screen.getByLabelText("Nome do nicho 3"), { target: { value: "Outra história" } });
    expect(screen.getByRole("list", { name: "Problemas na estrutura" })).toHaveTextContent("Código de nicho repetido: HISTORIA.");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar idioma" }));
    expect(screen.getByLabelText("Idioma 3 ativo")).toBeChecked();
    fireEvent.change(screen.getByLabelText("Código do idioma 3"), { target: { value: "pt-br" } });
    fireEvent.change(screen.getByLabelText("Nome do idioma 3"), { target: { value: "Dup" } });
    expect(screen.getByRole("list", { name: "Problemas na estrutura" })).toHaveTextContent("Código de idioma repetido: pt-br.");
    fireEvent.click(screen.getByRole("button", { name: "Remover nicho 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover idioma 3" }));
    expect(screen.queryByRole("list", { name: "Problemas na estrutura" })).not.toBeInTheDocument();
    expect(save()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remover idioma 2" }));
    expect(screen.getByText("Idiomas (1)")).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it("shows API errors when saving fails and keeps the draft", async () => {
    let finish;
    api.updateDarkStructure.mockReturnValueOnce(new Promise((_resolve, reject) => { finish = reject; })).mockRejectedValueOnce({});
    renderEditor();
    fireEvent.change(screen.getByLabelText("Nome do nicho 1"), { target: { value: "Hist" } });
    fireEvent.click(save());
    expect(await screen.findByRole("button", { name: "Salvando…" })).toBeDisabled();
    finish(new Error("Código duplicado no servidor."));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código duplicado no servidor.");
    expect(screen.getByLabelText("Nome do nicho 1")).toHaveValue("Hist");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar a estrutura.");
  });

  it("follows structure updates only while there are no unsaved edits", () => {
    const { rerender } = renderEditor();
    rerender(<DarkStructureEditor structure={{ ...structure, niches: [structure.niches[0]] }} onStructureChange={onChange}/>);
    expect(screen.getByText("Nichos (1)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome do nicho 1"), { target: { value: "Editado" } });
    rerender(<DarkStructureEditor structure={structure} onStructureChange={onChange}/>);
    expect(screen.getByText("Nichos (1)")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do nicho 1")).toHaveValue("Editado");
  });

  it("renders an empty editor without a structure", () => {
    render(<DarkStructureEditor structure={null} onStructureChange={onChange}/>);
    expect(screen.getByText("Nichos (0)")).toBeInTheDocument();
    expect(screen.getByText("Idiomas (0)")).toBeInTheDocument();
  });

  it("validates drafts independently of the screen", () => {
    expect(validateDraft({ niches: [{ code: " ", name: "A" }], languages: [{ code: "x", name: " " }] })).toEqual([
      "Preencha código e nome do nicho na linha 1.", "Preencha código e nome do idioma na linha 1.",
    ]);
    expect(validateDraft({ niches: [], languages: [] })).toEqual([]);
  });
});
