import { useEffect, useRef, useState } from "react";

// Campo numérico dos clones Adobe. Substitui <input type="number"> com
// onChange={Number(e.target.value)}, que transformava "apagar" em 0, recusava "-"
// e "12." e podia gravar NaN. O texto digitado fica num rascunho local; o pai só
// recebe números finitos (nunca NaN). Blur/Enter confirmam com clamp, Escape
// restaura o valor do início da edição e as setas incrementam por step.

const ALLOWED = /^-?\d*\.?\d*$/;
const COMPLETE = /^-?\d+(\.\d+)?$/;

// Lê o texto do campo aceitando vírgula como separador decimal.
// ok: o texto pode virar número (inclui intermediários como "-", "12.", ",5");
// complete: número inteiro escrito, pode ser propagado durante a digitação;
// number: valor numérico quando há dígitos, senão null.
export function parseNumericText(text) {
  const normalized = String(text ?? "")
    .trim()
    .replace(",", ".");
  if (!ALLOWED.test(normalized)) return { ok: false, complete: false, number: null };
  const number = /\d/.test(normalized) ? Number(normalized) : null;
  return { ok: true, complete: COMPLETE.test(normalized), number };
}

const finite = (n) => typeof n === "number" && Number.isFinite(n);

const decimalsOf = (n) => {
  const [, fraction = ""] = String(n).split(".");
  return fraction.length;
};

const roundTo = (n, digits) => Number(n.toFixed(Math.min(digits, 20)));

export default function NumericField({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision,
  disabled = false,
  type = "text",
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}) {
  const hasPrecision = finite(precision) && precision >= 0;
  const format = (n) => (finite(n) ? String(hasPrecision ? roundTo(n, precision) : n) : "");
  const [draft, setDraft] = useState(() => format(value));
  const editing = useRef(false);
  const original = useRef(null);
  const escaping = useRef(false);

  // Fora de edição o rascunho acompanha o valor externo.
  useEffect(() => {
    if (!editing.current) setDraft(format(value));
  }, [value, precision]);

  const clamp = (n) => {
    let next = n;
    if (finite(min)) next = Math.max(min, next);
    if (finite(max)) next = Math.min(max, next);
    return next;
  };
  const inRange = (n) => (!finite(min) || n >= min) && (!finite(max) || n <= max);
  const round = (n) => (hasPrecision ? roundTo(n, precision) : n);

  const emit = (n) => {
    if (finite(n) && n !== value) onChange?.(n);
  };

  const commit = () => {
    const { number } = parseNumericText(draft);
    if (number === null) {
      setDraft(format(value));
      return;
    }
    const next = clamp(round(number));
    setDraft(format(next));
    emit(next);
  };

  const handleChange = (event) => {
    const text = event.target.value;
    const parsed = parseNumericText(text);
    if (!parsed.ok) return;
    setDraft(text);
    if (parsed.complete) {
      const next = round(parsed.number);
      if (inRange(next)) emit(next);
    }
  };

  const handleFocus = (event) => {
    editing.current = true;
    escaping.current = false;
    original.current = value;
    onFocus?.(event);
  };

  const handleBlur = (event) => {
    editing.current = false;
    if (escaping.current) escaping.current = false;
    else commit();
    onBlur?.(event);
  };

  const stepBy = (direction, shift) => {
    const unit = finite(step) && step > 0 ? step : 1;
    const typed = parseNumericText(draft).number;
    const base = typed !== null ? typed : finite(value) ? value : 0;
    const raw = base + direction * unit * (shift ? 10 : 1);
    const digits = hasPrecision ? precision : Math.max(decimalsOf(unit), decimalsOf(base));
    const next = clamp(roundTo(raw, digits));
    setDraft(format(next));
    emit(next);
  };

  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (disabled) return;
    if (event.key === "Enter") {
      commit();
    } else if (event.key === "Escape") {
      const restored = editing.current ? original.current : value;
      setDraft(format(restored));
      emit(restored);
      escaping.current = true;
      event.currentTarget.blur();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      stepBy(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
    }
  };

  return (
    <input
      {...rest}
      type={type}
      inputMode="decimal"
      role="spinbutton"
      autoComplete="off"
      aria-valuenow={finite(value) ? value : undefined}
      aria-valuemin={finite(min) ? min : undefined}
      aria-valuemax={finite(max) ? max : undefined}
      disabled={disabled}
      value={draft}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
