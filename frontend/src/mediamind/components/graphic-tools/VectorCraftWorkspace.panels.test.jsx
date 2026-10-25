import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VectorCraftWorkspace, { buildSvgDocument, sanitizeObject } from "./VectorCraftWorkspace";

// O componente é grande: com a bateria em paralelo, cada teste pode passar dos 20 s padrão.
vi.setConfig({ testTimeout: 60000 });

const SCALE = 0.72;
const at = (x, y, extra = {}) => ({ clientX: 100 + x * SCALE, clientY: 100 + y * SCALE, ...extra });

function setup() {
  let generatedId = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `panel-object-${generatedId++}` });
  const view = render(
    <VectorCraftWorkspace assets={[]} selected={null} onSelect={vi.fn()} onOpenFiles={vi.fn()} />,
  );
  const artboard = screen.getByLabelText("Prancheta vetorial");
  vi.spyOn(artboard, "getBoundingClientRect").mockReturnValue({
    left: 100, top: 100, width: 820 * SCALE, height: 620 * SCALE, right: 100 + 820 * SCALE, bottom: 100 + 620 * SCALE, x: 100, y: 100, toJSON: () => {},
  });
  return { ...view, artboard };
}
const onCanvas = (name) => screen.getByRole("button", { name: `${name} na prancheta` });
const openPanel = (name) => fireEvent.click(within(screen.getByRole("navigation", { name: "Painéis do MMVector" })).getByRole("button", { name }));
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const status = () => screen.getByRole("status").textContent;
const wavePath = () => onCanvas("Onda vetorial").querySelector("path");

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MMVector — painel Traçado", () => {
  it("peso em px e extremidade, canto, limite e tracejado viram atributos SVG reais", () => {
    setup();
    fireEvent.click(onCanvas("Onda vetorial"));
    openPanel("Traçado");
    const peso = screen.getByLabelText("Peso do traçado");
    expect(peso.parentElement).toHaveTextContent("px");
    expect(peso.parentElement).not.toHaveTextContent(/\bpt\b/);

    expect(wavePath().getAttribute("stroke-linecap")).toBe("butt");
    fireEvent.click(screen.getByRole("button", { name: "Extremidade redonda" }));
    expect(screen.getByRole("button", { name: "Extremidade redonda" })).toHaveAttribute("aria-pressed", "true");
    expect(wavePath().getAttribute("stroke-linecap")).toBe("round");

    fireEvent.click(screen.getByRole("button", { name: "Junção chanfrada" }));
    expect(wavePath().getAttribute("stroke-linejoin")).toBe("bevel");
    fireEvent.click(screen.getByRole("button", { name: "Junção em esquadria" }));
    type("Limite de esquadria", "-");
    type("Limite de esquadria", "4");
    expect(wavePath().getAttribute("stroke-linejoin")).toBe("miter");
    expect(wavePath().getAttribute("stroke-miterlimit")).toBe("4");

    expect(screen.getByLabelText("Traço 1")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Linha tracejada"));
    expect(wavePath().getAttribute("stroke-dasharray")).toBe("12");
    type("Lacuna 1", "6");
    expect(wavePath().getAttribute("stroke-dasharray")).toBe("12 6");
    type("Traço 2", "-");
    expect(wavePath().getAttribute("stroke-dasharray")).toBe("12 6");
    fireEvent.click(screen.getByLabelText("Linha tracejada"));
    expect(wavePath().hasAttribute("stroke-dasharray")).toBe(false);

    // Sem equivalente em SVG: desabilitado com aviso honesto.
    for (const label of ["Ponta de seta inicial", "Ponta de seta final", "Perfil de largura"]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
      expect(screen.getByLabelText(label)).toHaveAttribute("title", "Ainda não disponível");
    }
    expect(screen.getByRole("button", { name: "Alinhar traçado para dentro" })).toBeDisabled();
  });

  it("opções vão para o SVG exportado (traçado pronto e caminho)", () => {
    const preset = buildSvgDocument([{ id: "w", kind: "Traçado", x: 0, y: 0, w: 100, h: 50, visible: true, color: "#000000", strokeWidth: 4, linecap: "square", linejoin: "round", dash: [12, 4] }]);
    expect(preset).toContain('stroke-linecap="square"');
    expect(preset).toContain('stroke-linejoin="round"');
    expect(preset).toContain('stroke-dasharray="12 4"');
    const path = buildSvgDocument([{ id: "p", kind: "Estrela", d: "M0 0 L10 10", vbW: 10, vbH: 10, x: 0, y: 0, w: 10, h: 10, visible: true, color: "#000000", strokeWidth: 2, linecap: "square", linejoin: "bevel", miterLimit: 3, dash: [5, 2] }]);
    expect(path).toContain('stroke-linecap="square"');
    expect(path).toContain('stroke-linejoin="bevel"');
    expect(path).not.toContain("stroke-miterlimit");
    expect(path).toContain('stroke-dasharray="5 2"');
    const miter = buildSvgDocument([{ id: "m", kind: "Estrela", d: "M0 0 L10 10", vbW: 10, vbH: 10, x: 0, y: 0, w: 10, h: 10, visible: true, color: "#000000", strokeWidth: 2, linejoin: "miter", miterLimit: 3 }]);
    expect(miter).toContain('stroke-miterlimit="3"');
    expect(miter).not.toContain("stroke-dasharray");
  });

  it("cada campo do tracejado mantém a posição; campo vazio no meio encerra o padrão", () => {
    setup();
    fireEvent.click(onCanvas("Onda vetorial"));
    openPanel("Traçado");
    fireEvent.click(screen.getByLabelText("Linha tracejada"));
    type("Traço 2", "8");
    // Lacuna 1 vazia: o 8 continua no campo Traço 2 e o padrão efetivo para no vazio.
    expect(screen.getByLabelText("Traço 2")).toHaveValue("8");
    expect(screen.getByLabelText("Lacuna 1")).toHaveValue("");
    expect(wavePath().getAttribute("stroke-dasharray")).toBe("12");
    type("Lacuna 1", "4");
    expect(wavePath().getAttribute("stroke-dasharray")).toBe("12 4 8");
    expect(screen.getByLabelText("Traço 2")).toHaveValue("8");
  });

  it("zerar o Traço 1 não desmarca a caixa nem gera dasharray só de zeros", () => {
    setup();
    fireEvent.click(onCanvas("Onda vetorial"));
    openPanel("Traçado");
    fireEvent.click(screen.getByLabelText("Linha tracejada"));
    type("Traço 1", "0");
    expect(screen.getByLabelText("Linha tracejada")).toBeChecked();
    expect(screen.getByLabelText("Traço 1")).toHaveValue("0");
    expect(screen.getByLabelText("Traço 1")).not.toBeDisabled();
    expect(wavePath().hasAttribute("stroke-dasharray")).toBe(false);
    type("Traço 1", "5");
    expect(wavePath().getAttribute("stroke-dasharray")).toBe("5");
    // Desmarcar guarda os campos; marcar de novo restaura.
    fireEvent.click(screen.getByLabelText("Linha tracejada"));
    expect(wavePath().hasAttribute("stroke-dasharray")).toBe(false);
    fireEvent.click(screen.getByLabelText("Linha tracejada"));
    expect(wavePath().getAttribute("stroke-dasharray")).toBe("5");
  });

  it("documento aberto e SVG exportado continuam válidos com campos vazios e zeros", () => {
    const loaded = sanitizeObject({ id: "w", kind: "Traçado", dashed: true, dash: [0, null, "x", -3, 20000, 4, 9] });
    expect(loaded.dashed).toBe(true);
    expect(loaded.dash).toEqual([0, null, null, 0, 10000, 4]);
    const base = { id: "w", kind: "Traçado", x: 0, y: 0, w: 100, h: 50, visible: true, color: "#000000", strokeWidth: 2 };
    expect(buildSvgDocument([{ ...base, dashed: true, dash: [0, 0, null] }])).not.toContain("stroke-dasharray");
    expect(buildSvgDocument([{ ...base, dashed: true, dash: [6, null, 9] }])).toContain('stroke-dasharray="6"');
    expect(buildSvgDocument([{ ...base, dashed: false, dash: [6, 2] }])).not.toContain("stroke-dasharray");
    expect(buildSvgDocument([{ ...base, dash: [6, 2] }])).toContain('stroke-dasharray="6 2"');
  });

  it("formas simples (caixa) não fingem aceitar extremidade e tracejado", () => {
    setup();
    fireEvent.click(onCanvas("Forma circular"));
    openPanel("Traçado");
    expect(screen.getByLabelText("Peso do traçado")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Extremidade redonda" })).toBeDisabled();
    expect(screen.getByLabelText("Linha tracejada")).toBeDisabled();
  });
});

describe("MMVector — cabeçalho dos painéis", () => {
  it("» fecha o painel e ☰ fica desabilitado com aviso", () => {
    setup();
    openPanel("Amostras");
    expect(screen.getByRole("button", { name: "Menu do painel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Menu do painel" })).toHaveAttribute("title", "Ainda não disponível");
    fireEvent.click(screen.getByRole("button", { name: "Fechar painel" }));
    expect(screen.queryByLabelText("Localizar amostra")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Propriedades" }).className).toMatch(/bg-\[#414141\]/);
  });
});

describe("MMVector — Amostras, Guia de cores e Estilos", () => {
  it("amostra aplica preenchimento ou traçado à seleção", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    openPanel("Amostras");
    fireEvent.click(screen.getByRole("button", { name: "Amostra Vermelho" }));
    expect(circle).toHaveStyle({ background: "#ef4444" });
    fireEvent.click(screen.getByRole("button", { name: "Amostra Nenhuma" }));
    expect(circle).toHaveStyle({ background: "transparent" });

    fireEvent.click(screen.getByRole("button", { name: "Aplicar ao traçado" }));
    expect(screen.getByRole("button", { name: "Aplicar ao traçado" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Amostra Azul" }));
    expect(circle.style.boxShadow).toMatch(/1px/);
    expect(circle.style.boxShadow).toMatch(/#3b82f6|rgb\(59, 130, 246\)/);
    fireEvent.click(screen.getByRole("button", { name: "Amostra Nenhuma" }));
    expect(circle.style.boxShadow).toBe("");
  });

  it("localizar filtra; nova amostra e excluir", () => {
    setup();
    fireEvent.click(onCanvas("Forma circular"));
    openPanel("Amostras");
    type("Localizar amostra", "verm");
    expect(screen.getByRole("button", { name: "Amostra Vermelho" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Amostra Azul" })).not.toBeInTheDocument();
    type("Localizar amostra", "");

    fireEvent.click(screen.getByRole("button", { name: "Amostra Verde" }));
    expect(screen.getByRole("button", { name: "Excluir amostra" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Nova amostra" }));
    const custom = screen.getByRole("button", { name: "Amostra #22c55e" });
    fireEvent.click(custom);
    fireEvent.click(screen.getByRole("button", { name: "Excluir amostra" }));
    expect(screen.queryByRole("button", { name: "Amostra #22c55e" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bibliotecas de amostras" })).toBeDisabled();
  });

  it("sem seleção, a amostra vira a cor de preenchimento atual", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Prancheta vetorial").parentElement);
    openPanel("Amostras");
    fireEvent.click(screen.getByRole("button", { name: "Amostra Roxo" }));
    expect(status()).toMatch(/preenchimento atual/i);
  });

  it("Guia de cores calcula harmonias a partir da cor do objeto e salva como amostras", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    openPanel("Guia de cores");
    fireEvent.change(screen.getByLabelText("Regra de harmonia"), { target: { value: "Complementar" } });
    const colors = screen.getAllByRole("button", { name: /^Cor da harmonia/ });
    expect(colors).toHaveLength(2);
    expect(colors[0]).toHaveAccessibleName("Cor da harmonia #22d3ee");
    fireEvent.change(screen.getByLabelText("Regra de harmonia"), { target: { value: "Tríade" } });
    expect(screen.getAllByRole("button", { name: /^Cor da harmonia/ })).toHaveLength(3);
    const second = screen.getAllByRole("button", { name: /^Cor da harmonia/ })[1];
    const hex = second.getAttribute("aria-label").replace("Cor da harmonia ", "");
    fireEvent.click(second);
    expect(circle).toHaveStyle({ background: hex });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cores como amostras" }));
    openPanel("Amostras");
    expect(screen.getByRole("button", { name: `Amostra ${hex}` })).toBeInTheDocument();
  });

  it("Estilos gráficos aplicam preenchimento, traçado e sombra reais; Pincéis e Símbolos ficam desabilitados", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    openPanel("Estilos gráficos");
    fireEvent.click(screen.getByRole("button", { name: "Estilo Contorno escuro" }));
    expect(circle.style.boxShadow).toMatch(/3px/);
    fireEvent.click(screen.getByRole("button", { name: "Estilo Sombra suave" }));
    expect(circle.style.filter).toContain("drop-shadow");
    openPanel("Pincéis");
    for (const button of within(screen.getByLabelText("Biblioteca de Pincéis")).getAllByRole("button")) expect(button).toBeDisabled();
    openPanel("Símbolos");
    for (const button of within(screen.getByLabelText("Biblioteca de Símbolos")).getAllByRole("button")) expect(button).toBeDisabled();
  });
});

describe("MMVector — Histórico, Ações, Navegador, Pranchetas e Aparência", () => {
  it("Histórico lista os passos reais e volta/avança pelo desfazer", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    type("X", "100");
    type("X", "200");
    openPanel("Histórico");
    const list = screen.getByRole("list", { name: "Histórico de alterações" });
    const steps = within(list).getAllByRole("button");
    expect(steps.map((item) => item.textContent)).toEqual(["Estado inicial", "Alteração 1", "Alteração 2"]);
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    fireEvent.click(steps[0]);
    expect(circle).toHaveStyle({ left: "530px" });
    expect(within(list).getByRole("button", { name: "Estado inicial" })).toHaveAttribute("aria-current", "step");
    fireEvent.click(within(list).getByRole("button", { name: "Alteração 2" }));
    expect(circle).toHaveStyle({ left: "200px" });
    fireEvent.click(screen.getByRole("button", { name: "Desfazer passo" }));
    expect(circle).toHaveStyle({ left: "100px" });
    fireEvent.click(screen.getByRole("button", { name: "Refazer passo" }));
    expect(circle).toHaveStyle({ left: "200px" });
    fireEvent.click(screen.getByRole("button", { name: "Excluir histórico" }));
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Desfazer passo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Novo instantâneo" })).toBeDisabled();
  });

  it("Ações executa ações padrão reais; gravar fica desabilitado", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    openPanel("Ações");
    expect(screen.getByRole("button", { name: "Executar ação" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ação Sombra projetada" }));
    fireEvent.click(screen.getByRole("button", { name: "Executar ação" }));
    expect(circle.style.filter).toContain("drop-shadow");
    fireEvent.click(screen.getByRole("button", { name: "Ação Limpar efeitos" }));
    fireEvent.click(screen.getByRole("button", { name: "Executar ação" }));
    expect(circle.style.filter).toBe("");
    expect(screen.getByRole("button", { name: "Gravar ação" })).toBeDisabled();
  });

  it("Navegador mostra miniatura real e controla o zoom", () => {
    setup();
    openPanel("Navegador");
    const thumb = screen.getByRole("img", { name: "Miniatura do documento" });
    expect(thumb.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(thumb.getAttribute("src"))).toContain("#22d3ee");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar zoom" }));
    expect(screen.getByLabelText("Zoom do navegador")).toHaveValue("100");
    fireEvent.change(screen.getByLabelText("Zoom do navegador"), { target: { value: "50" } });
    expect(screen.getByLabelText("Prancheta vetorial").style.transform).toBe("scale(0.5)");
    fireEvent.click(screen.getByRole("button", { name: "Diminuir zoom" }));
    expect(screen.getByLabelText("Prancheta vetorial").style.transform).toBe("scale(0.33)");
  });

  it("Pranchetas mostra o tamanho real e desabilita criar/excluir", () => {
    setup();
    openPanel("Pranchetas");
    expect(screen.getByText(/820 × 620 px/)).toBeInTheDocument();
    for (const name of ["Nova prancheta", "Excluir prancheta", "Reorganizar pranchetas"]) expect(screen.getByRole("button", { name })).toBeDisabled();
  });

  it("Aparência mostra valores reais, fx abre a aparência flutuante e Limpar remove efeitos", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.click(circle);
    openPanel("Aparência");
    const panel = screen.getByLabelText("Atributos de aparência");
    expect(panel).toHaveTextContent("Elipse");
    expect(panel).toHaveTextContent("#22d3ee");
    expect(panel).toHaveTextContent("100%");
    fireEvent.click(screen.getByRole("button", { name: "Sombra projetada (fx)" }));
    expect(circle.style.filter).toContain("drop-shadow");
    fireEvent.click(screen.getByRole("button", { name: "Limpar aparência" }));
    expect(circle.style.filter).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Abrir efeitos (fx)" }));
    expect(screen.getByRole("region", { name: "Aparência flutuante" })).toBeInTheDocument();
  });

  it("botões fx e ••• das Propriedades abrem a aparência flutuante e a Transparência", () => {
    setup();
    fireEvent.click(onCanvas("Forma circular"));
    fireEvent.click(screen.getByRole("button", { name: "Efeitos (fx)" }));
    expect(screen.getByRole("region", { name: "Aparência flutuante" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mais opções de aparência" }));
    expect(screen.getByLabelText("Opacidade da transparência")).toBeInTheDocument();
  });
});

describe("MMVector — Documento: réguas, grade, limites e guias", () => {
  it("réguas aparecem e clicar nelas cria guias reais; guias podem ser ocultadas e limpas", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Prancheta vetorial").parentElement);
    expect(screen.queryByLabelText("Régua horizontal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réguas" }));
    expect(screen.getByRole("button", { name: "Réguas" })).toHaveAttribute("aria-pressed", "true");
    const top = screen.getByLabelText("Régua horizontal");
    const left = screen.getByLabelText("Régua vertical");
    expect(top).toHaveTextContent("100");
    fireEvent.pointerDown(top, at(300, 5));
    fireEvent.pointerDown(left, at(5, 250));
    const guides = screen.getByLabelText("Guias");
    expect(guides.querySelector('line[x1="300"]')).not.toBeNull();
    expect(guides.querySelector('line[y1="250"]')).not.toBeNull();
    expect(status()).toMatch(/Guia/);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar guias" }));
    expect(screen.queryByLabelText("Guias")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar guias" }));
    expect(screen.getByLabelText("Guias").querySelectorAll("line")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Limpar guias" }));
    expect(screen.queryByLabelText("Guias")).not.toBeInTheDocument();
  });

  it("grade, limites e botões do documento", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Prancheta vetorial").parentElement);
    fireEvent.click(screen.getByRole("button", { name: "Grade" }));
    expect(screen.getByLabelText("Grade da prancheta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limites" }));
    expect(screen.getByRole("button", { name: "Limites" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(onCanvas("Forma circular"));
    expect(screen.queryByLabelText("Redimensionar Forma circular se")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Prancheta vetorial").parentElement);
    fireEvent.click(screen.getByRole("button", { name: "Limites" }));
    fireEvent.click(onCanvas("Forma circular"));
    expect(screen.getByLabelText("Redimensionar Forma circular se")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Prancheta vetorial").parentElement);

    for (const button of screen.getAllByRole("button", { name: "Configurar documento" })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Ainda não disponível");
    }
    fireEvent.click(screen.getByRole("button", { name: "Editar pranchetas" }));
    expect(screen.getByText(/820 × 620 px/)).toBeInTheDocument();
  });
});
