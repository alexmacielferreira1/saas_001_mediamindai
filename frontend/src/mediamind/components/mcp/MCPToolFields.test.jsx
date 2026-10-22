import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Help, LastActionBar, PanelFooter, ParamField, ProgressBar, ResultList, Section, Waveform, paramVisible } from "./MCPToolFields";

const Icone = (props) => <svg data-testid="icone" {...props} />;

describe("Help e Section", () => {
  it("Help só aparece com texto", () => {
    const { container } = render(<Help />);
    expect(container).toBeEmptyDOMElement();
    render(<Help text="Explica" />);
    expect(screen.getByLabelText("Ajuda: Explica")).toHaveAttribute("title", "Explica");
  });

  it("Section com título e ícone, só título e sem título", () => {
    const { rerender, container } = render(
      <Section title="Detecção" icon={Icone}>
        <span>filho</span>
      </Section>,
    );
    expect(screen.getByText("Detecção")).toBeInTheDocument();
    expect(screen.getByTestId("icone")).toBeInTheDocument();
    rerender(<Section title="Sem ícone">filho</Section>);
    expect(screen.queryByTestId("icone")).toBeNull();
    expect(screen.getByText("Sem ícone")).toBeInTheDocument();
    rerender(<Section>só filho</Section>);
    expect(container.querySelector("legend")).toBeNull();
    expect(screen.getByText("só filho")).toBeInTheDocument();
  });
});

describe("ParamField", () => {
  it("info mostra o texto", () => {
    render(<ParamField param={{ key: "i", type: "info", label: "Use fones" }} onChange={vi.fn()} />);
    expect(screen.getByText("Use fones")).toBeInTheDocument();
  });

  it("toggle com descrição e ajuda, e sem descrição", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ParamField param={{ key: "t", type: "toggle", label: "Proteger", help: "ajuda", description: "Mantém a música" }} value={false} onChange={onChange} />);
    expect(screen.getByText("Mantém a música")).toBeInTheDocument();
    expect(screen.getByLabelText("Ajuda: ajuda")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<ParamField param={{ key: "t", type: "toggle", label: "Proteger" }} value onChange={onChange} />);
    expect(screen.queryByText("Mantém a música")).toBeNull();
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("select com e sem descrição", () => {
    const onChange = vi.fn();
    const param = { key: "s", type: "select", label: "Modo", options: [["a", "A"], ["b", "B"]], description: "Escolha" };
    const { rerender } = render(<ParamField param={param} value="a" onChange={onChange} />);
    expect(screen.getByText("Escolha")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Modo/), { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith("b");
    rerender(<ParamField param={{ ...param, description: undefined }} value="a" onChange={onChange} />);
    expect(screen.queryByText("Escolha")).toBeNull();
  });

  it("text usa linhas padrão, valor vazio e linhas próprias", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ParamField param={{ key: "x", type: "text", label: "Prompt", placeholder: "Digite" }} onChange={onChange} />);
    const area = screen.getByPlaceholderText("Digite");
    expect(area).toHaveAttribute("rows", "2");
    expect(area).toHaveValue("");
    fireEvent.change(area, { target: { value: "oi" } });
    expect(onChange).toHaveBeenCalledWith("oi");
    rerender(<ParamField param={{ key: "x", type: "text", label: "Prompt", rows: 5 }} value="abc" onChange={onChange} />);
    expect(screen.getByLabelText(/Prompt/)).toHaveAttribute("rows", "5");
    expect(screen.getByLabelText(/Prompt/)).toHaveValue("abc");
  });

  it("color usa branco sem valor e volta à cor do template", () => {
    const onChange = vi.fn();
    const param = { key: "c", type: "color", label: "Cor" };
    const { rerender } = render(<ParamField param={param} value="" onChange={onChange} />);
    expect(screen.getByLabelText(/Cor/)).toHaveValue("#ffffff");
    expect(screen.queryByRole("button", { name: "usar a do template" })).toBeNull();
    fireEvent.input(screen.getByLabelText(/Cor/), { target: { value: "#ff0000" } });
    expect(onChange).toHaveBeenCalledWith("#ff0000");
    rerender(<ParamField param={param} value="#00ff00" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "usar a do template" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("chips marcam a opção atual e trocam ao clicar", () => {
    const onChange = vi.fn();
    render(<ParamField param={{ key: "k", type: "chips", label: "Formato", options: [["v", "Vertical"], ["h", "Horizontal"]] }} value="v" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Vertical" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Horizontal" })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("radio", { name: "Horizontal" }));
    expect(onChange).toHaveBeenCalledWith("h");
  });

  it("stepper com passo decimal respeita mínimo, máximo e ignora digitação inválida", () => {
    const onChange = vi.fn();
    const param = { key: "p", type: "stepper", label: "Margem", step: 0.1, min: 0, max: 1, unit: "s", description: "Respiro" };
    const { rerender } = render(<ParamField param={param} value={0.3} onChange={onChange} />);
    expect(screen.getByText("s")).toBeInTheDocument();
    expect(screen.getByText("Respiro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Margem" }));
    expect(onChange).toHaveBeenLastCalledWith(0.4);
    fireEvent.click(screen.getByRole("button", { name: "Diminuir Margem" }));
    expect(onChange).toHaveBeenLastCalledWith(0.2);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Margem" }), { target: { value: "5" } });
    expect(onChange).toHaveBeenLastCalledWith(1);
    rerender(<ParamField param={param} value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Diminuir Margem" }));
    expect(onChange).toHaveBeenLastCalledWith(0);
    onChange.mockClear();
    // o navegador já limpa texto inválido; simula um valor não numérico lido do campo
    const input = screen.getByRole("spinbutton", { name: "Margem" });
    Object.defineProperty(input, "value", { configurable: true, get: () => "abc", set: () => {} });
    fireEvent.change(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stepper sem passo, limites, unidade ou descrição usa passo 1", () => {
    const onChange = vi.fn();
    render(<ParamField param={{ key: "n", type: "stepper", label: "Cortes" }} value={3} onChange={onChange} />);
    expect(screen.getByRole("spinbutton", { name: "Cortes" })).toHaveAttribute("step", "1");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Cortes" }));
    expect(onChange).toHaveBeenLastCalledWith(4);
    fireEvent.click(screen.getByRole("button", { name: "Diminuir Cortes" }));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it("multi sem valor, desmarcando e com mensagens de vazio", () => {
    const onChange = vi.fn();
    const param = { key: "m", type: "multi", label: "Faixas", options: [["A1", "A1"], ["A2", "A2"]] };
    const { rerender } = render(<ParamField param={param} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "A1" }));
    expect(onChange).toHaveBeenLastCalledWith(["A1"]);
    rerender(<ParamField param={param} value={["A1", "A2"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "A1" }));
    expect(onChange).toHaveBeenLastCalledWith(["A2"]);
    rerender(<ParamField param={{ ...param, options: [], empty: "Importe sons" }} onChange={onChange} />);
    expect(screen.getByText("Importe sons")).toBeInTheDocument();
    rerender(<ParamField param={{ ...param, options: [] }} onChange={onChange} />);
    expect(screen.getByText("Nenhuma opção disponível.")).toBeInTheDocument();
  });

  it("range mostra valor com vírgula, unidade, descrição e passo padrão", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ParamField param={{ key: "r", label: "Margem", min: 0, max: 1, step: 0.1, unit: "s", description: "Respiro" }} value={0.5} onChange={onChange} />);
    expect(screen.getByText("0,5 s")).toBeInTheDocument();
    expect(screen.getByText("Respiro")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Margem/), { target: { value: "0.7" } });
    expect(onChange).toHaveBeenCalledWith(0.7);
    rerender(<ParamField param={{ key: "r", type: "range", label: "Ganho", min: -6, max: 6 }} value={2} onChange={onChange} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByLabelText(/Ganho/)).toHaveAttribute("step", "1");
    expect(screen.queryByText("Respiro")).toBeNull();
  });
});

describe("paramVisible", () => {
  it("sem condição, equals e notEquals", () => {
    expect(paramVisible({ key: "a" }, {})).toBe(true);
    expect(paramVisible({ key: "a", when: { key: "modo", equals: "manual" } }, { modo: "manual" })).toBe(true);
    expect(paramVisible({ key: "a", when: { key: "modo", equals: "manual" } }, { modo: "auto" })).toBe(false);
    expect(paramVisible({ key: "a", when: { key: "modo", notEquals: "auto" } }, { modo: "manual" })).toBe(true);
    expect(paramVisible({ key: "a", when: { key: "modo", notEquals: "auto" } }, { modo: "auto" })).toBe(false);
  });
});

describe("Waveform", () => {
  it("desenha picos, regiões por tipo e a linha do limite", () => {
    const { container } = render(
      <Waveform
        data={{
          peaks: [0, 0.5, 1],
          duration: 10,
          threshold: 0.2,
          regions: [
            { start: 1, end: 2, kind: "silencio" },
            { start: 4, end: 4, kind: "manter" },
            { start: 6, end: 8 },
          ],
        }}
      />,
    );
    expect(screen.getByRole("img", { name: "Forma de onda com 3 região(ões) marcada(s)" })).toBeInTheDocument();
    const regions = container.querySelectorAll("[data-region]");
    expect([...regions].map((node) => node.getAttribute("data-region"))).toEqual(["silencio", "manter", "regiao"]);
    expect(regions[0]).toHaveAttribute("x", "30");
    expect(regions[1]).toHaveAttribute("width", "1");
    expect(regions[1].getAttribute("class")).toContain("emerald");
    expect(regions[2].getAttribute("class")).toContain("red");
    expect(container.querySelectorAll("rect.fill-amber-400")).toHaveLength(3);
    expect(container.querySelector("[data-threshold]")).not.toBeNull();
  });

  it("sem picos, sem duração e sem limite", () => {
    const { container, rerender } = render(<Waveform data={{}} />);
    expect(screen.getByRole("img", { name: "Forma de onda com 0 região(ões) marcada(s)" })).toBeInTheDocument();
    expect(container.querySelector("[data-threshold]")).toBeNull();
    rerender(<Waveform data={{ regions: [{ start: 1, end: 2 }] }} />);
    const region = container.querySelector("[data-region]");
    expect(region).toHaveAttribute("x", "0");
    expect(region).toHaveAttribute("width", "0");
  });
});

describe("ResultList", () => {
  const items = [
    { id: "a", label: "Silêncio 1", timecode: "00:01", time: 1, badge: "0,5 s" },
    { id: "b", label: "Silêncio 2", timecode: "00:05" },
  ];

  it("marca, marca todos e navega para o tempo", () => {
    const onToggle = vi.fn();
    const onToggleAll = vi.fn();
    const onSeek = vi.fn();
    const { rerender } = render(<ResultList items={items} selected={["a"]} onToggle={onToggle} onToggleAll={onToggleAll} onSeek={onSeek} />);
    expect(screen.getByText(/1 de 2 marcado/)).toBeInTheDocument();
    expect(screen.getByText("0,5 s")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Incluir Silêncio 2" }));
    expect(onToggle).toHaveBeenCalledWith("b");
    fireEvent.click(screen.getByRole("checkbox", { name: "Marcar todos os itens" }));
    expect(onToggleAll).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "00:01" }));
    expect(onSeek).toHaveBeenCalledWith(1);
    expect(screen.getByRole("button", { name: "00:05" })).toBeDisabled();
    rerender(<ResultList items={items} selected={["a", "b"]} onToggle={onToggle} onToggleAll={onToggleAll} />);
    expect(screen.getByRole("checkbox", { name: "Marcar todos os itens" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Marcar todos os itens" }));
    expect(onToggleAll).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "00:01" })).toBeDisabled();
  });
});

describe("LastActionBar, ProgressBar e PanelFooter", () => {
  it("LastActionBar vazia ou com desfazer", () => {
    const { container, rerender } = render(<LastActionBar action={null} onUndo={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    const onUndo = vi.fn();
    rerender(<LastActionBar action={{ label: "Remover silêncios", time: "10:05" }} onUndo={onUndo} />);
    expect(screen.getByRole("status", { name: "Última ação" })).toHaveTextContent("Última ação: Remover silêncios (10:05)");
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(onUndo).toHaveBeenCalled();
    rerender(<LastActionBar action={{ label: "x", time: "1" }} onUndo={onUndo} disabled />);
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeDisabled();
  });

  it("ProgressBar vazia e limitada entre 0 e 100%", () => {
    const { container, rerender } = render(<ProgressBar progress={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ProgressBar progress={{ value: 0.456, stage: "Lendo áudio" }} />);
    expect(screen.getByRole("progressbar", { name: "Lendo áudio" })).toHaveAttribute("aria-valuenow", "46");
    rerender(<ProgressBar progress={{ value: 3, stage: "Fim" }} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    rerender(<ProgressBar progress={{ value: -1, stage: "Início" }} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("PanelFooter vazio, com botões, informação e trilhas", () => {
    const { container, rerender } = render(<PanelFooter footer={null} />);
    expect(container).toBeEmptyDOMElement();
    const onClick = vi.fn();
    const onChip = vi.fn();
    rerender(
      <PanelFooter
        footer={{
          buttons: [
            { id: "b1", label: "Exportar", icon: Icone, onClick, hint: "Exporta o vídeo" },
            { id: "b2", label: "Salvar", disabled: true },
          ],
          info: "Sequência 1 · 00:30",
          chips: [
            { id: "v1", label: "V1", active: true, onClick: onChip, hint: "Trilha de vídeo" },
            { id: "a1", label: "A1" },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("icone")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Exportar" })).toHaveAttribute("title", "Exporta o vídeo");
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveAttribute("title", "Salvar");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.getByText("Sequência 1 · 00:30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "V1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "A1" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "V1" }));
    expect(onChip).toHaveBeenCalled();
    rerender(<PanelFooter footer={{ info: "Só informação" }} />);
    expect(screen.getByText("Só informação")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
