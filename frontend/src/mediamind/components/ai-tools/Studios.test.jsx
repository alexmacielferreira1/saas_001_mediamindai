import { MemoryRouter } from "react-router-dom";
import { fireEvent, render as renderComponent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PromoVideoStudio from "./PromoVideoStudio";
import ExistingWorkflowTool from "./ExistingWorkflowTool";
import AnimatedStudio from "./AnimatedStudio";
import CarouselStudio from "../carousel/CarouselStudio";
vi.mock("../../lib/producaoStore", () => ({ useProducaoProjetos: () => [] }));

const render = (ui) => renderComponent(<MemoryRouter>{ui}</MemoryRouter>);

describe("creative studios without a backend", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("creates real editable scenes from a product briefing", () => {
    render(<PromoVideoStudio />);
    fireEvent.change(screen.getByLabelText("Nome do produto / serviço"), {
      target: { value: "Curso de edição" },
    });
    fireEvent.change(screen.getByLabelText("Benefício principal"), {
      target: { value: "Aprenda a editar vídeos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar roteiro-base" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Criar cenas na Timeline" }),
    );
    expect(screen.getByLabelText("Texto / legenda")).toHaveValue(
      "Conheça Curso de edição.",
    );
    fireEvent.change(screen.getByLabelText("Duração (segundos)"), {
      target: { value: "9" },
    });
    expect(screen.getByLabelText("Duração (segundos)")).toHaveValue(9);
    expect(screen.getByRole("button", { name: "Exportar MP4" })).toBeDisabled();
  });
  it("requires actual briefing before creating a promotional draft", () => {
    render(<PromoVideoStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Criar roteiro-base" }));
    expect(screen.getByRole("status")).toHaveTextContent("Informe o produto");
    expect(screen.queryByLabelText("Texto / legenda")).not.toBeInTheDocument();
  });
  it("lets editors select spoken lines and reorder the resulting sequence", () => {
    render(<ExistingWorkflowTool toolId="speech-montage" />);
    fireEvent.change(screen.getByLabelText("Falas (uma por linha)"), {
      target: { value: "Primeira fala.\nSegunda fala." },
    });
    fireEvent.click(screen.getByLabelText("Primeira fala."));
    fireEvent.click(screen.getByLabelText("Segunda fala."));
    fireEvent.click(screen.getByRole("button", { name: "Montar sequência" }));
    expect(screen.getByLabelText("Texto / legenda")).toHaveValue(
      "Primeira fala.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Mover cena para direita" }),
    );
    expect(screen.getByLabelText("Texto / legenda")).toHaveValue(
      "Primeira fala.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /01 · 5s Segunda fala/ }),
    );
    expect(screen.getByLabelText("Texto / legenda")).toHaveValue(
      "Segunda fala.",
    );
  });
  it("creates editable animation directions from each line", () => {
    render(<AnimatedStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Organizar cenas" }));
    expect(screen.getByLabelText("Direção da ilustração")).toHaveValue(
      "Apresentação",
    );
    fireEvent.change(screen.getByLabelText("Direção da ilustração"), {
      target: { value: "Conquista" },
    });
    expect(screen.getByLabelText("Direção da ilustração")).toHaveValue(
      "Conquista",
    );
  });
  it("saves a carousel locally and restores it from Projects", () => {
    render(<CarouselStudio projectId="project-a" />);
    fireEvent.click(screen.getByRole("button", { name: "Explorar exemplo" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar projeto" }));
    expect(
      JSON.parse(localStorage.getItem("mm-carousel:project-a"))[0].slides,
    ).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: /05Projetos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir projeto" }));
    expect(screen.getByLabelText("Título")).toHaveValue(
      "Como transformar uma ideia em conteúdo que gera conexão",
    );
  });
  it("reports invalid carousel import without losing the current draft", () => {
    render(<CarouselStudio />);
    fireEvent.click(screen.getByRole("button", { name: /03Copy/ }));
    fireEvent.change(screen.getByLabelText("JSON do carrossel"), {
      target: { value: '{"tool_type":"carousel","format":"bad","slides":[]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar copy" }));
    expect(screen.getByRole("status")).toHaveTextContent("Formato deve ser");
  });
});
