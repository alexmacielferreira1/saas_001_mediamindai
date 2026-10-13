import { MemoryRouter } from "react-router-dom";
import {
  fireEvent,
  render as renderComponent,
  screen,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PromoVideoStudio from "./PromoVideoStudio";
import ExistingWorkflowTool from "./ExistingWorkflowTool";
import AnimatedStudio from "./AnimatedStudio";
import CarouselStudio from "../carousel/CarouselStudio";
import FramesStudio from "./FramesStudio";
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
    fireEvent.click(screen.getByRole("button", { name: "Criar com IA" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    expect(
      JSON.parse(localStorage.getItem("mm-carousel:project-a"))[0].slides,
    ).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: /05Projetos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir projeto" }));
    expect(screen.getByLabelText("Título")).toHaveValue(
      "Saúde mental merece atenção",
    );
  });
  it("reports invalid carousel import without losing the current draft", () => {
    render(<CarouselStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Criar com IA" }));
    fireEvent.click(screen.getByRole("button", { name: /03Copy/ }));
    fireEvent.change(screen.getByLabelText("JSON do carrossel"), {
      target: { value: '{"tool_type":"carousel","format":"bad","slides":[]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar copy" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Formato de rede social não reconhecido.",
    );
  });

  it("offers common social formats in carousel and frame studios", () => {
    const { unmount } = render(<CarouselStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Criar com IA" }));
    fireEvent.click(screen.getByRole("button", { name: /04Editor/ }));
    expect(screen.getByLabelText("Formato do projeto")).toHaveTextContent("TikTok / Reels / Stories");
    expect(screen.getByLabelText("Formato do projeto")).toHaveTextContent("YouTube / Facebook horizontal");
    unmount();

    render(<FramesStudio />);
    expect(screen.getByLabelText("Formato da moldura")).toHaveTextContent("TikTok / Reels / Stories");
    fireEvent.change(screen.getByLabelText("Formato da moldura"), { target: { value: "1:1" } });
    expect(screen.getByTestId("frame-preview")).toHaveAttribute(
      "style",
      expect.stringContaining("aspect-ratio: 1080 / 1080"),
    );
  });

  it("keeps more than one carousel open and preserves each workspace", () => {
    render(<CarouselStudio />);
    expect(screen.getByRole("tablist", { name: "Artes abertas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar outra arte" }));
    expect(screen.getByRole("tablist", { name: "Artes abertas" }).querySelectorAll('[role="tab"]')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Título do slide"), {
      target: { value: "Segundo trabalho" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Arte 1" }));
    expect(screen.getByLabelText("Título do slide")).not.toHaveValue("Segundo trabalho");
    fireEvent.click(screen.getByRole("tab", { name: "Arte 3" }));
    expect(screen.getByLabelText("Título do slide")).toHaveValue("Segundo trabalho");
  });

  it("creates a blank independent art before a model is selected", () => {
    render(<CarouselStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar outra arte" }));
    expect(screen.getByLabelText("Título do slide")).toHaveValue("");
    expect(screen.getByLabelText("Texto do slide")).toHaveValue("");
    expect(screen.getByText("Artes deste trabalho (1)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Usar modelo Lima institucional" }));
    expect(screen.getByLabelText("Título do slide")).toHaveValue("");
    expect(screen.getByLabelText("Texto do slide")).toHaveValue("");
    expect(screen.getByText("Artes deste trabalho (1)")).toBeInTheDocument();
  });

  it("asks for confirmation before deleting an open art", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<CarouselStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar outra arte" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir Arte 3" }));
    expect(screen.getByRole("tab", { name: "Arte 3" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Arte 3" }));
    expect(screen.queryByRole("tab", { name: "Arte 3" })).not.toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("offers the compact creation modes without an intermediate dialog", () => {
    render(<CarouselStudio />);
    const modes = screen.getByRole("tablist", { name: "Modos do Estúdio de Arte" });
    expect(modes.querySelectorAll('[role="tab"]')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Criação Livre' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Outros' })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Nova arte" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Modo: Padrão SIMERS/ }));
    expect(screen.queryByRole('region', { name: 'Modelos SIMERS' })).not.toBeInTheDocument();
  });

  it("adds output formats as navigable tabs", () => {
    render(<CarouselStudio />);
    expect(screen.getByLabelText("Formato da arte")).toHaveValue("4:5");
    fireEvent.change(screen.getByLabelText("Adicionar formato"), {
      target: { value: "1:1" },
    });
    expect(screen.getByLabelText("Formato da arte")).toHaveValue("4:5");
    expect(screen.getByLabelText("Formato da arte")).toHaveTextContent("Instagram / Facebook quadrado");
    fireEvent.change(screen.getByLabelText("Formato da arte"), { target: { value: "1:1" } });
    expect(screen.getByLabelText("Formato do projeto")).toHaveValue("1:1");
  });

  it("chooses whether multiple arts export individually or as a sequence", () => {
    render(<CarouselStudio />);
    expect(screen.getByLabelText("Modo de exportação")).toHaveValue("individual");
    fireEvent.change(screen.getByLabelText("Modo de exportação"), { target: { value: "sequence" } });
    expect(screen.getByLabelText("Modo de exportação")).toHaveValue("sequence");
  });

  it("creates and saves a reusable custom output format", () => {
    render(<CarouselStudio />);
    fireEvent.change(screen.getByLabelText("Adicionar formato"), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByLabelText("Nome do formato personalizado"), { target: { value: "Painel interno" } });
    fireEvent.change(screen.getByLabelText("Largura personalizada"), { target: { value: "1440" } });
    fireEvent.change(screen.getByLabelText("Altura personalizada"), { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar e fixar formato" }));
    expect(screen.getByLabelText("Formato da arte")).toHaveValue("4:5");
    expect(screen.getByLabelText("Formato da arte")).toHaveTextContent("Painel interno");
    const customId = JSON.parse(localStorage.getItem("mm-custom-social-formats"))[0].id;
    fireEvent.change(screen.getByLabelText("Formato da arte"), { target: { value: customId } });
    expect(screen.getByLabelText("Formato do projeto")).toHaveValue(customId);
    expect(JSON.parse(localStorage.getItem("mm-custom-social-formats"))[0]).toMatchObject({ width: 1440, height: 900 });
  });

  it("controls visibility and locking from the layers panel", () => {
    render(<CarouselStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Camadas" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocultar Título" }));
    expect(screen.queryByTestId("carousel-title")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bloquear Texto" }));
    expect(screen.getByRole("button", { name: "Desbloquear Texto" })).toBeInTheDocument();
  });

  it("saves the current carousel as a reusable model", () => {
    render(<CarouselStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar como modelo" }));
    expect(JSON.parse(localStorage.getItem("mm-carousel-templates"))).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Meus modelos" }));
    expect(screen.getByRole("button", { name: "Abrir modelo Saúde mental merece atenção" })).toBeInTheDocument();
  });

  it("applies the SIMERS Giro da Semana carousel model", () => {
    render(<CarouselStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar modelo Giro da Semana" }));
    expect(screen.getByLabelText("Título do slide")).toHaveValue("GIRO DE NOTÍCIAS DA SEMANA");
    expect(screen.getByLabelText("Modelo visual")).toHaveValue("giro");
    expect(screen.getAllByTestId("carousel-title")[0]).toHaveTextContent("GIRO DE NOTÍCIAS DA SEMANA");
  });

  it("opens the shared Giro model when requested from the Thumbs gallery", async () => {
    render(<CarouselStudio initialMode="single" initialTemplate="giro" />);
    expect(await screen.findByLabelText("Título do slide")).toHaveValue("GIRO DE NOTÍCIAS DA SEMANA");
    expect(screen.getByLabelText("Modelo visual")).toHaveValue("giro");
    expect(screen.getByText("Artes deste trabalho (5)")).toBeInTheDocument();
  });

  it("opens the complete Saúde em ondas model when requested from the Thumbs gallery", async () => {
    render(<CarouselStudio initialMode="single" initialTemplate="health" />);
    expect(await screen.findByLabelText("Título do slide")).toHaveValue("Saúde mental merece atenção");
    expect(screen.getByLabelText("Modelo visual")).toHaveValue("health");
    expect(screen.getByText("Artes deste trabalho (6)")).toBeInTheDocument();
    expect(screen.getByLabelText("Formato do projeto")).toHaveValue("4:5");
  });

  it("creates a single SIMERS news artwork with editable highlight styling", () => {
    render(<CarouselStudio />);
    fireEvent.click(screen.getByRole("tab", { name: /Arte única/ }));
    expect(screen.getByLabelText("Trecho em destaque")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Trecho em destaque"), { target: { value: "Hospital Estrela" } });
    fireEvent.change(screen.getByLabelText("Cor do fundo da arte"), { target: { value: "#62d7c4" } });
    expect(screen.getAllByTestId("single-art-highlight")[0]).toHaveTextContent("Hospital Estrela");
    expect(screen.getAllByTestId("single-news-art")[0]).toHaveStyle({ backgroundColor: "#62d7c4" });
    fireEvent.click(screen.getByRole("button", { name: /Guia Padrão SIMERS/ }));
    expect(screen.getByRole("dialog", { name: "Guia Padrão SIMERS" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar padrão Lima escuro" }));
    expect(screen.getByLabelText("Cor do fundo da arte")).toHaveValue("#063b36");
  });

  it("shows SIMERS models as a visible thumbnail gallery", () => {
    render(<CarouselStudio />);
    const gallery = screen.getByRole("region", { name: "Modelos SIMERS" });
    expect(gallery).toBeInTheDocument();
    expect(gallery.querySelectorAll("button").length).toBe(7);
    fireEvent.click(screen.getByRole("button", { name: "Usar modelo Turquesa institucional" }));
    expect(screen.getByLabelText("Modelo visual")).toHaveValue("single-news");
  });
});
