import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import NumericField, { parseNumericText } from "./NumericField";

// Pai controlado: reproduz o uso real nos apps (estado numérico no workspace).
function Controlled({ initial = 10, onValue = () => {}, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumericField
        aria-label="Campo"
        value={value}
        onChange={(next) => {
          onValue(next);
          setValue(next);
        }}
        {...props}
      />
      <output data-testid="estado">{String(value)}</output>
    </>
  );
}

const field = () => screen.getByRole("spinbutton", { name: "Campo" });
const typeText = (text) => fireEvent.change(field(), { target: { value: text } });

describe("parseNumericText", () => {
  it("aceita número completo, vírgula decimal e sinal", () => {
    expect(parseNumericText("12")).toEqual({ ok: true, complete: true, number: 12 });
    expect(parseNumericText(" -3,25 ")).toEqual({ ok: true, complete: true, number: -3.25 });
    expect(parseNumericText("0.5")).toEqual({ ok: true, complete: true, number: 0.5 });
  });

  it("trata '-', '12.', '', ',5' como rascunhos intermediários", () => {
    expect(parseNumericText("")).toEqual({ ok: true, complete: false, number: null });
    expect(parseNumericText("-")).toEqual({ ok: true, complete: false, number: null });
    expect(parseNumericText("12.")).toEqual({ ok: true, complete: false, number: 12 });
    expect(parseNumericText(",5")).toEqual({ ok: true, complete: false, number: 0.5 });
    expect(parseNumericText("-.")).toEqual({ ok: true, complete: false, number: null });
  });

  it("rejeita texto que não pode virar número", () => {
    expect(parseNumericText("abc")).toEqual({ ok: false, complete: false, number: null });
    expect(parseNumericText("1-2")).toEqual({ ok: false, complete: false, number: null });
    expect(parseNumericText("1.2.3")).toEqual({ ok: false, complete: false, number: null });
    expect(parseNumericText("1e5")).toEqual({ ok: false, complete: false, number: null });
    expect(parseNumericText(null)).toEqual({ ok: true, complete: false, number: null });
  });
});

describe("NumericField", () => {
  it("renderiza como texto com teclado decimal e repassa atributos", () => {
    render(
      <NumericField
        id="largura"
        aria-label="Campo"
        className="w-16 rounded"
        name="largura"
        value={42}
        onChange={() => {}}
        min={0}
        max={100}
      />,
    );
    const input = field();
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(input).toHaveAttribute("id", "largura");
    expect(input).toHaveAttribute("name", "largura");
    expect(input).toHaveClass("w-16", "rounded");
    expect(input).toHaveAttribute("aria-valuenow", "42");
    expect(input).toHaveAttribute("aria-valuemin", "0");
    expect(input).toHaveAttribute("aria-valuemax", "100");
    expect(input).toHaveValue("42");
  });

  it("permite outro type quando pedido", () => {
    render(<NumericField aria-label="Campo" type="number" value={1} onChange={() => {}} />);
    expect(field()).toHaveAttribute("type", "number");
  });

  it("propaga enquanto digita só quando o texto é um número completo", () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    fireEvent.focus(field());

    typeText("");
    expect(field()).toHaveValue("");
    typeText("-");
    expect(field()).toHaveValue("-");
    expect(onValue).not.toHaveBeenCalled();

    typeText("-1");
    expect(onValue).toHaveBeenLastCalledWith(-1);
    typeText("-12");
    expect(onValue).toHaveBeenLastCalledWith(-12);
    typeText("-12.");
    expect(field()).toHaveValue("-12.");
    typeText("-12,5");
    expect(onValue).toHaveBeenLastCalledWith(-12.5);
    expect(field()).toHaveValue("-12,5");
    expect(onValue.mock.calls.every(([n]) => Number.isFinite(n))).toBe(true);
  });

  it("ignora caracteres que não formam número", () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    fireEvent.focus(field());
    typeText("1a");
    expect(field()).toHaveValue("10");
    expect(onValue).not.toHaveBeenCalled();
  });

  it("não chama onChange quando o número digitado é igual ao valor atual", () => {
    const onChange = vi.fn();
    render(<NumericField aria-label="Campo" value={7} onChange={onChange} />);
    fireEvent.focus(field());
    typeText("7");
    fireEvent.blur(field());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("não propaga valor fora da faixa durante a digitação e aplica clamp no blur", () => {
    const onValue = vi.fn();
    render(<Controlled initial={20} onValue={onValue} min={10} max={50} />);
    fireEvent.focus(field());
    typeText("5");
    expect(onValue).not.toHaveBeenCalled();
    fireEvent.blur(field());
    expect(onValue).toHaveBeenLastCalledWith(10);
    expect(field()).toHaveValue("10");

    fireEvent.focus(field());
    typeText("999");
    fireEvent.blur(field());
    expect(onValue).toHaveBeenLastCalledWith(50);
    expect(field()).toHaveValue("50");
    expect(screen.getByTestId("estado")).toHaveTextContent("50");
  });

  it("Enter confirma e normaliza rascunhos intermediários", () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    fireEvent.focus(field());
    typeText(",5");
    expect(onValue).not.toHaveBeenCalled();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onValue).toHaveBeenLastCalledWith(0.5);
    expect(field()).toHaveValue("0.5");

    typeText("12.");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onValue).toHaveBeenLastCalledWith(12);
    expect(field()).toHaveValue("12");
  });

  it("vazio ou só sinal volta ao último valor válido sem chamar onChange", () => {
    const onValue = vi.fn();
    render(<Controlled initial={33} onValue={onValue} />);
    fireEvent.focus(field());
    typeText("");
    fireEvent.blur(field());
    expect(field()).toHaveValue("33");
    fireEvent.focus(field());
    typeText("-");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(field()).toHaveValue("33");
    expect(onValue).not.toHaveBeenCalled();
  });

  it("volta ao último valor digitado válido (já propagado) quando o texto final é inválido", () => {
    const onValue = vi.fn();
    render(<Controlled initial={1} onValue={onValue} />);
    fireEvent.focus(field());
    typeText("8");
    typeText("");
    fireEvent.blur(field());
    expect(field()).toHaveValue("8");
    expect(onValue).toHaveBeenCalledTimes(1);
  });

  it("com valor externo inválido (NaN), vazio fica vazio e nunca emite NaN", () => {
    const onChange = vi.fn();
    render(<NumericField aria-label="Campo" value={Number.NaN} onChange={onChange} />);
    expect(field()).toHaveValue("");
    expect(field()).not.toHaveAttribute("aria-valuenow");
    fireEvent.focus(field());
    fireEvent.blur(field());
    expect(field()).toHaveValue("");
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(onChange.mock.calls.every(([n]) => Number.isFinite(n))).toBe(true);
  });

  it("Escape restaura o valor do início da edição e tira o foco", () => {
    const onValue = vi.fn();
    render(<Controlled initial={20} onValue={onValue} />);
    const input = field();
    input.focus();
    fireEvent.focus(input);
    typeText("45");
    expect(onValue).toHaveBeenLastCalledWith(45);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onValue).toHaveBeenLastCalledWith(20);
    expect(input).toHaveValue("20");
    expect(input).not.toHaveFocus();
    expect(screen.getByTestId("estado")).toHaveTextContent("20");
  });

  it("Escape sem alteração não chama onChange", () => {
    const onChange = vi.fn();
    render(<NumericField aria-label="Campo" value={3} onChange={onChange} />);
    field().focus();
    typeText("3,");
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(field()).toHaveValue("3");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Escape fora de edição usa o valor atual", () => {
    const onChange = vi.fn();
    render(<NumericField aria-label="Campo" value={4} onChange={onChange} />);
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(field()).toHaveValue("4");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("setas incrementam por step, Shift multiplica por 10 e respeitam min/max", () => {
    const onValue = vi.fn();
    render(<Controlled initial={5} onValue={onValue} step={2} min={0} max={30} />);
    fireEvent.focus(field());
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValue).toHaveBeenLastCalledWith(7);
    expect(field()).toHaveValue("7");
    fireEvent.keyDown(field(), { key: "ArrowUp", shiftKey: true });
    expect(onValue).toHaveBeenLastCalledWith(27);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValue).toHaveBeenLastCalledWith(30);
    expect(field()).toHaveValue("30");
    onValue.mockClear();
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValue).not.toHaveBeenCalled();
    fireEvent.keyDown(field(), { key: "ArrowDown", shiftKey: true });
    expect(onValue).toHaveBeenLastCalledWith(10);
    fireEvent.keyDown(field(), { key: "ArrowDown", shiftKey: true });
    expect(onValue).toHaveBeenLastCalledWith(0);
  });

  it("setas partem do rascunho digitado e evitam erro de ponto flutuante", () => {
    const onValue = vi.fn();
    render(<Controlled initial={0} onValue={onValue} step={0.1} />);
    fireEvent.focus(field());
    typeText("0,2");
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValue).toHaveBeenLastCalledWith(0.3);
    expect(field()).toHaveValue("0.3");
    typeText("-");
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(onValue).toHaveBeenLastCalledWith(0.2);
  });

  it("step inválido cai para 1", () => {
    const onChange = vi.fn();
    render(<NumericField aria-label="Campo" value={2} onChange={onChange} step={0} />);
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("precision arredonda ao digitar, confirmar e incrementar", () => {
    const onValue = vi.fn();
    render(<Controlled initial={1} onValue={onValue} precision={2} step={0.001} />);
    fireEvent.focus(field());
    typeText("1,23456");
    expect(onValue).toHaveBeenLastCalledWith(1.23);
    fireEvent.blur(field());
    expect(field()).toHaveValue("1.23");
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValue).toHaveBeenLastCalledWith(1.23);
    fireEvent.keyDown(field(), { key: "ArrowUp", shiftKey: true });
    expect(onValue).toHaveBeenLastCalledWith(1.24);
  });

  it("precision 0 trabalha com inteiros", () => {
    const onValue = vi.fn();
    render(<Controlled initial={1} onValue={onValue} precision={0} />);
    fireEvent.focus(field());
    typeText("3,7");
    fireEvent.blur(field());
    expect(onValue).toHaveBeenLastCalledWith(4);
    expect(field()).toHaveValue("4");
  });

  it("acompanha mudança externa do value quando não está em edição", () => {
    const { rerender } = render(<NumericField aria-label="Campo" value={1} onChange={() => {}} />);
    rerender(<NumericField aria-label="Campo" value={9} onChange={() => {}} />);
    expect(field()).toHaveValue("9");
  });

  it("preserva o rascunho durante a edição mesmo com mudança externa do value", () => {
    const onChange = vi.fn();
    const { rerender } = render(<NumericField aria-label="Campo" value={1} onChange={onChange} />);
    fireEvent.focus(field());
    typeText("5.");
    rerender(<NumericField aria-label="Campo" value={9} onChange={onChange} />);
    expect(field()).toHaveValue("5.");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it("outras teclas não alteram o valor e handlers do pai são chamados", () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <NumericField
        aria-label="Campo"
        value={2}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />,
    );
    fireEvent.focus(field());
    fireEvent.keyDown(field(), { key: "a" });
    fireEvent.blur(field());
    expect(onChange).not.toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("disabled é repassado e bloqueia setas", () => {
    const onChange = vi.fn();
    render(<NumericField aria-label="Campo" value={2} onChange={onChange} disabled />);
    expect(field()).toBeDisabled();
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("funciona sem onChange", () => {
    render(<NumericField aria-label="Campo" value={2} />);
    fireEvent.focus(field());
    typeText("3");
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    fireEvent.blur(field());
    expect(field()).toHaveValue("4");
  });
});
