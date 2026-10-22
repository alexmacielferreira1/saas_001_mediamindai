import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ updateDarkDecision: vi.fn(), updateDarkStructure: vi.fn() }));
vi.mock("../../../api/darkChannels", () => api);

import DarkDecisions, { structureBody } from "./DarkDecisions";

const decisions = [
  { id: "d2", title: "Formato padrão", question: "Longo ou Shorts?", options: ["Longo"], recommendation: "", scope: "canal", ref: "his-pt-01", status: "decidida", answer: "Longo", notes: "ok", decided_at: "2026-10-20T12:00:00Z" },
  { id: "d1", title: "Voz do nicho", question: "Qual voz usar?", options: ["Masculina", "Feminina"], recommendation: "Feminina", scope: "nicho", ref: "historia", status: "pendente", answer: "", notes: "", decided_at: null },
  { id: "d3", title: "Calendário", question: "", options: [], recommendation: "Começar em janeiro", status: "pendente", answer: "", notes: "rascunho", decided_at: null },
  { id: "d4", title: "Antiga", question: "Q", scope: "outro", status: "decidida", answer: "Sim", notes: "", decided_at: null },
  { id: "d5", title: "Data ruim", question: "Q", options: [], scope: "idioma", status: "decidida", answer: "Não", notes: "", decided_at: "lixo" },
];
const structure = { name: "Rede", languages: [{ code: "pt-BR", name: "Português" }], niches: [{ code: "historia", name: "História" }], decisions };
const onChange = vi.fn();

function Harness({ initial = structure }) {
  const [current, setCurrent] = useState(initial);
  return <DarkDecisions structure={current} onStructureChange={(next) => { onChange(next); setCurrent(next); }}/>;
}

const card = (title) => screen.getByRole("article", { name: `Decisão: ${title}` });

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  onChange.mockReset();
});

describe("Decisões do Canais Dark", () => {
  it("lists pending decisions first, with scope chips, recommendation and decided details", () => {
    render(<Harness/>);
    expect(screen.getAllByRole("article").map((item) => item.getAttribute("aria-label"))).toEqual([
      "Decisão: Voz do nicho", "Decisão: Calendário", "Decisão: Formato padrão", "Decisão: Antiga", "Decisão: Data ruim",
    ]);
    expect(screen.getByText("2 pendentes · 3 decididas. Pendentes aparecem primeiro.")).toBeInTheDocument();
    expect(card("Voz do nicho")).toHaveTextContent("Nicho: historia");
    expect(card("Voz do nicho")).toHaveTextContent("Recomendado: Feminina");
    expect(within(card("Voz do nicho")).getByRole("radio", { name: /Feminina/ })).toHaveTextContent("Recomendado");
    expect(card("Calendário")).toHaveTextContent("Geral");
    expect(within(card("Calendário")).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(card("Formato padrão")).toHaveTextContent("Resposta: Longo");
    expect(card("Formato padrão")).toHaveTextContent(`Decidida em ${new Date("2026-10-20T12:00:00Z").toLocaleDateString("pt-BR")} · ok`);
    expect(card("Antiga")).toHaveTextContent("outro");
    expect(within(card("Antiga")).getByText("Decidida", { selector: "p" })).toBeInTheDocument();
    expect(within(card("Data ruim")).getByText("Decidida em", { selector: "p" })).toBeInTheDocument();
  });

  it("decides with a selected option and notes through PATCH and moves the card to decided", async () => {
    api.updateDarkDecision.mockResolvedValue({ ...decisions[1], status: "decidida", answer: "Feminina", notes: "Teste A/B", decided_at: "2026-10-21T10:00:00Z" });
    render(<Harness/>);
    const decide = within(card("Voz do nicho")).getByRole("button", { name: "Decidir" });
    expect(decide).toBeDisabled();
    fireEvent.click(within(card("Voz do nicho")).getByRole("radio", { name: /Feminina/ }));
    expect(within(card("Voz do nicho")).getByRole("radio", { name: /Feminina/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.change(screen.getByLabelText("Notas da decisão Voz do nicho"), { target: { value: " Teste A/B " } });
    fireEvent.click(decide);

    await waitFor(() => expect(api.updateDarkDecision).toHaveBeenCalledWith("d1", { status: "decidida", answer: "Feminina", notes: "Teste A/B" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Decisão “Voz do nicho” registrada.");
    expect(onChange).toHaveBeenCalledWith({ ...structure, decisions: [decisions[0], expect.objectContaining({ id: "d1", status: "decidida", answer: "Feminina" }), ...decisions.slice(2)] });
    expect(card("Voz do nicho")).toHaveTextContent("Resposta: Feminina");
    expect(screen.getAllByRole("article")[0]).toHaveAttribute("aria-label", "Decisão: Calendário");
  });

  it("uses a free answer instead of the options and keeps existing notes", async () => {
    api.updateDarkDecision.mockImplementation(async (id) => decisions.find((item) => item.id === id));
    render(<Harness/>);
    fireEvent.click(within(card("Voz do nicho")).getByRole("radio", { name: "Masculina" }));
    fireEvent.change(screen.getByLabelText("Outra resposta para Voz do nicho"), { target: { value: "Neutra" } });
    expect(within(card("Voz do nicho")).getByRole("radio", { name: "Masculina" })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(within(card("Voz do nicho")).getByRole("button", { name: "Decidir" }));
    await waitFor(() => expect(api.updateDarkDecision).toHaveBeenCalledWith("d1", { status: "decidida", answer: "Neutra", notes: "" }));

    fireEvent.change(screen.getByLabelText("Outra resposta para Calendário"), { target: { value: "Fevereiro" } });
    fireEvent.click(within(card("Calendário")).getByRole("button", { name: "Decidir" }));
    await waitFor(() => expect(api.updateDarkDecision).toHaveBeenLastCalledWith("d3", { status: "decidida", answer: "Fevereiro", notes: "rascunho" }));
  });

  it("reopens a decided decision and reports API errors without fake success", async () => {
    api.updateDarkDecision
      .mockRejectedValueOnce(Object.assign(new Error("A resposta é obrigatória para decidir."), { status: 422 }))
      .mockRejectedValueOnce({})
      .mockResolvedValueOnce({ ...decisions[0], status: "pendente" });
    render(<Harness/>);
    fireEvent.click(within(card("Formato padrão")).getByRole("button", { name: "Reabrir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A resposta é obrigatória para decidir.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(card("Formato padrão")).getByRole("button", { name: "Reabrir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar a decisão.");
    fireEvent.click(within(card("Formato padrão")).getByRole("button", { name: "Reabrir" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Decisão “Formato padrão” reaberta.");
    expect(api.updateDarkDecision).toHaveBeenLastCalledWith("d2", { status: "pendente" });
    expect(within(card("Formato padrão")).getByRole("button", { name: "Decidir" })).toBeInTheDocument();
  });

  it("filters decisions by scope", () => {
    render(<Harness/>);
    const filter = screen.getByLabelText("Filtrar decisões por escopo");
    expect(within(filter).getByRole("option", { name: "Geral (1)" })).toBeInTheDocument();
    fireEvent.change(filter, { target: { value: "canal" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(filter, { target: { value: "geral" } });
    expect(screen.getAllByRole("article").map((item) => item.getAttribute("aria-label"))).toEqual(["Decisão: Calendário"]);
    fireEvent.change(filter, { target: { value: "idioma" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    render(<Harness initial={{ ...structure, decisions: decisions.filter((item) => item.scope !== "idioma") }}/>);
    fireEvent.change(screen.getAllByLabelText("Filtrar decisões por escopo")[1], { target: { value: "idioma" } });
    expect(screen.getByText("Nenhuma decisão neste escopo.")).toBeInTheDocument();
  });

  it("shows an empty state without a structure", () => {
    render(<DarkDecisions structure={null} onStructureChange={onChange}/>);
    expect(screen.getByText(/Nenhuma decisão registrada/)).toBeInTheDocument();
  });

  it("creates a new decision by saving the full structure through PUT", async () => {
    api.updateDarkStructure.mockImplementation(async (body) => body);
    render(<Harness/>);
    fireEvent.click(screen.getByRole("button", { name: "Nova decisão" }));
    const form = screen.getByRole("form", { name: "Nova decisão" });
    fireEvent.submit(form);
    expect(api.updateDarkStructure).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByLabelText("Título da decisão"), { target: { value: " Idioma inglês " } });
    fireEvent.change(within(form).getByLabelText("Pergunta da decisão"), { target: { value: "Lançar en-US na onda 1?" } });
    fireEvent.change(within(form).getByLabelText("Opções da decisão"), { target: { value: "Sim\n\nNão\nSim" } });
    fireEvent.change(within(form).getByLabelText("Escopo da decisão"), { target: { value: "idioma" } });
    fireEvent.change(within(form).getByLabelText("Referência da decisão"), { target: { value: " en-US " } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar decisão" }));

    await waitFor(() => expect(api.updateDarkStructure).toHaveBeenCalledWith({
      name: "Rede", languages: structure.languages, niches: structure.niches,
      decisions: [...decisions, {
        id: expect.stringMatching(/^dec-[a-z0-9]+$/), title: "Idioma inglês", question: "Lançar en-US na onda 1?", options: ["Sim", "Não"],
        recommendation: "", scope: "idioma", ref: "en-US", status: "pendente", answer: "", notes: "", decided_at: null,
      }],
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("Decisão “Idioma inglês” criada.");
    expect(screen.queryByRole("form", { name: "Nova decisão" })).not.toBeInTheDocument();
    expect(card("Idioma inglês")).toHaveTextContent("Idioma: en-US");
  });

  it("keeps the new decision form open when the PUT fails and can be cancelled", async () => {
    api.updateDarkStructure.mockRejectedValue(new Error("Sem permissão."));
    render(<Harness/>);
    fireEvent.click(screen.getByRole("button", { name: "Nova decisão" }));
    const form = screen.getByRole("form", { name: "Nova decisão" });
    fireEvent.change(within(form).getByLabelText("Título da decisão"), { target: { value: "X" } });
    fireEvent.change(within(form).getByLabelText("Pergunta da decisão"), { target: { value: "Y" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar decisão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão.");
    expect(screen.getByRole("form", { name: "Nova decisão" })).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form", { name: "Nova decisão" })).not.toBeInTheDocument();
  });

  it("builds the PUT body with safe defaults", () => {
    expect(structureBody(null)).toEqual({ name: "", languages: [], niches: [], decisions: [] });
    expect(structureBody({ name: "A", languages: [1], niches: [2], decisions: [3], source: "importado" }, { niches: [] }))
      .toEqual({ name: "A", languages: [1], niches: [], decisions: [3] });
  });
});
