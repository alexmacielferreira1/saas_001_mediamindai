import { describe, expect, it } from "vitest";
import {
  TEXT_ANIMATIONS,
  TEXT_ANIMATION_GROUPS,
  animatedTextStyle,
  drawAnimatedText,
  findTextAnimation,
  letterSpans,
  textAnimationProgress,
  textAnimationState,
} from "./mmfilmTextAnimation";

function fakeContext({ filter = "none", alpha } = {}) {
  const calls = [];
  const stack = [];
  const context = {
    calls,
    filter,
    globalAlpha: alpha,
    measureText: (text) => ({ width: text.length * 10 }),
  };
  ["translate", "rotate", "scale", "transform", "fillText"].forEach((name) => {
    context[name] = (...args) => calls.push([name, ...args]);
  });
  context.save = () => {
    stack.push({ globalAlpha: context.globalAlpha, filter: context.filter });
    calls.push(["save"]);
  };
  context.restore = () => {
    Object.assign(context, stack.pop());
    calls.push(["restore"]);
  };
  const realFill = context.fillText;
  context.fillText = (...args) => {
    realFill(...args);
    calls.push(["state", { alpha: context.globalAlpha, filter: context.filter, font: context.font, fill: context.fillStyle }]);
  };
  return context;
}

const named = (context, name) => context.calls.filter((call) => call[0] === name);

describe("catálogo de animações de texto", () => {
  it("tem 20+ presets próprios, ids únicos e grupos conhecidos", () => {
    expect(TEXT_ANIMATIONS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(TEXT_ANIMATIONS.map((item) => item.id)).size).toBe(TEXT_ANIMATIONS.length);
    TEXT_ANIMATIONS.forEach((item) => {
      expect(TEXT_ANIMATION_GROUPS).toContain(item.group);
      expect(item.duration).toBeGreaterThan(0);
      expect(item).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
    });
    TEXT_ANIMATION_GROUPS.forEach((group) => expect(TEXT_ANIMATIONS.some((item) => item.group === group)).toBe(true));
  });

  it("encontra por id ou objeto e rejeita o desconhecido", () => {
    expect(findTextAnimation("digitar").style).toBe("type");
    const custom = { id: "x", style: "fade", mode: "in", duration: 1 };
    expect(findTextAnimation(custom)).toBe(custom);
    expect(findTextAnimation({ id: "sem-estilo" })).toBeNull();
    expect(findTextAnimation("nada")).toBeNull();
    expect(findTextAnimation(null)).toBeNull();
  });

  it("todos os presets assentam no texto original fora da animação", () => {
    TEXT_ANIMATIONS.filter((item) => item.mode !== "loop").forEach((item) => {
      const time = item.mode === "in" ? 5 : 0;
      const state = textAnimationState(item, "Olá mundo", time, 10);
      expect(state.opacity).toBe(1);
      expect(state.visibleText).toBe("Olá mundo");
      (state.letters || []).forEach((letter) => expect(letter).toMatchObject({ opacity: 1, dx: 0, dy: 0, scale: 1, rotation: 0, blur: 0 }));
    });
  });
});

describe("progresso", () => {
  const entrada = { mode: "in", duration: 1 };
  const saida = { mode: "out", duration: 1 };
  it("entrada no início, saída terminando no fim, ênfase sempre ativa", () => {
    expect(textAnimationProgress(entrada, 0.5, 4)).toEqual({ amount: 0.5, phase: "in" });
    expect(textAnimationProgress(entrada, 2, 4)).toEqual({ amount: 1, phase: "idle" });
    expect(textAnimationProgress(saida, 1, 4)).toEqual({ amount: 1, phase: "idle" });
    expect(textAnimationProgress(saida, 3.5, 4)).toEqual({ amount: 0.5, phase: "out" });
    expect(textAnimationProgress(saida, 9, 4)).toEqual({ amount: 0, phase: "out" });
    expect(textAnimationProgress({ mode: "loop", duration: 1 }, 3, 4)).toEqual({ amount: 1, phase: "loop" });
  });

  it("clipe menor que o preset encolhe a animação; clipe vazio fica assentado", () => {
    expect(textAnimationProgress(entrada, 0.25, 0.5).amount).toBe(0.5);
    expect(textAnimationProgress(saida, 0.25, 0.5).amount).toBe(0.5);
    expect(textAnimationProgress(entrada, 0, 0)).toEqual({ amount: 1, phase: "idle" });
  });
});

describe("estado do texto", () => {
  it("preset desconhecido e entradas inválidas devolvem estado neutro", () => {
    expect(textAnimationState("nada", "abc", 0, 1)).toMatchObject({ visibleText: "abc", opacity: 1, phase: "idle" });
    expect(textAnimationState("aparecer", undefined, "x", "y")).toMatchObject({ visibleText: "", opacity: 1 });
  });

  it("estilos do texto inteiro", () => {
    expect(textAnimationState("aparecer", "a", 0, 2)).toMatchObject({ opacity: 0, phase: "in", progress: 0 });
    expect(textAnimationState("desfoque-in", "a", 0, 2)).toMatchObject({ opacity: 0, blur: 24 });
    expect(textAnimationState("espacamento-in", "a", 0, 2).tracking).toBe(40);
    expect(textAnimationState("inclinar-in", "a", 0, 2)).toMatchObject({ skew: -25, dx: -120 });
    expect(textAnimationState("deslizar-in", "a", 0, 2).dx).toBe(-200);
    expect(textAnimationState("aproximar-in", "a", 0, 2).scale).toBe(0.6);
    const out = textAnimationState("sumir", "a", 1.75, 2);
    expect(out.phase).toBe("out");
    expect(out.opacity).toBeGreaterThan(0);
    expect(out.opacity).toBeLessThan(1);
    expect(textAnimationState("espacamento-out", "a", 2, 2).tracking).toBe(40);
    expect(textAnimationState("desfoque-out", "a", 2, 2).blur).toBe(24);
  });

  it("digitar revela caracteres e apagar remove até sumir", () => {
    expect(textAnimationState("digitar", "abcd", 0.6, 5).visibleText).toBe("ab");
    expect(textAnimationState("digitar", "abcd", 0, 5).visibleText).toBe("");
    expect(textAnimationState("apagar", "abcd", 4.5, 5).visibleText).toBe("ab");
    expect(textAnimationState("apagar", "abcd", 5, 5).visibleText).toBe("");
  });

  it("digitar palavras mostra palavras inteiras", () => {
    expect(textAnimationState("digitar-palavras", "um dois  três", 0.5, 5).visibleText).toBe("um");
    expect(textAnimationState("digitar-palavras", "um dois  três", 0.7, 5).visibleText).toBe("um dois");
    expect(textAnimationState("digitar-palavras", "um dois  três", 0, 5).visibleText).toBe("");
    expect(textAnimationState("digitar-palavras", " ", 0.5, 5).visibleText).toBe("");
  });

  it("decodificar embaralha de forma determinística e resolve no fim", () => {
    const first = textAnimationState("decodificar", "AB C", 0.3, 5, 2);
    const again = textAnimationState("decodificar", "AB C", 0.3, 5, 2);
    expect(first).toEqual(again);
    expect(first.letters).toHaveLength(4);
    expect(first.letters[2]).toMatchObject({ char: " ", opacity: 1 });
    expect(first.letters[3].opacity).toBe(0);
    expect(first.visibleText).toHaveLength(4);
    expect(first.visibleText).not.toBe("AB C");
    expect(textAnimationState("decodificar", "AB C", 5, 5).visibleText).toBe("AB C");
    const other = textAnimationState("decodificar", "ABCDEFGH", 0.6, 5, 9);
    expect(other.letters.some((letter) => letter.opacity === 1 && !"ABCDEFGH".includes(letter.char))).toBe(true);
    expect(textAnimationState("decodificar-out", "AB", 5, 5).letters.every((letter) => letter.opacity === 0)).toBe(true);
  });

  it("presets por letra escalonam: a primeira letra anda antes da última", () => {
    const state = textAnimationState("cair-letras", "abcde", 0.3, 5);
    expect(state.letters[0].opacity).toBeGreaterThan(state.letters[4].opacity);
    expect(state.letters[4]).toMatchObject({ opacity: 0, dy: -60 });
    expect(textAnimationState("girar-letras", "ab", 0, 5).letters[0]).toMatchObject({ rotation: -90, scale: 0.5 });
    expect(textAnimationState("saltar-letras", "ab", 0, 5).letters[0].scale).toBe(3);
    expect(textAnimationState("surgir-letras", "a", 0.35, 5).letters[0].opacity).toBeGreaterThan(0);
    expect(textAnimationState("nevoa-letras", "ab", 0, 5).letters[1].blur).toBe(12);
  });

  it("presets por palavra movem a palavra inteira junto", () => {
    const state = textAnimationState("subir-palavras", " oi  tudo", 0.2, 5);
    const [space, o, i, , , t] = state.letters;
    expect(o).toEqual({ ...i, char: "o" });
    expect(space.dy).toBe(o.dy);
    expect(t.opacity).toBeLessThan(o.opacity);
    const pop = textAnimationState("pop-palavras", "oi", 0, 5).letters[0];
    expect(pop).toMatchObject({ opacity: 0, scale: 0 });
    expect(textAnimationState("descer-palavras-out", "oi", 5, 5).letters[0].dy).toBe(40);
  });

  it("ênfases contínuas variam no tempo e são determinísticas", () => {
    const wave = textAnimationState("onda", "abc", 0.2, 5);
    expect(wave.phase).toBe("loop");
    expect(wave.letters[0].dy).not.toBe(wave.letters[1].dy);
    expect(textAnimationState("pulsar", "a", 1 / 6, 5).scale).toBeCloseTo(1.06, 4);
    const flickers = Array.from({ length: 24 }, (_, step) => textAnimationState("brilho", "a", step / 12, 5, 1).opacity);
    expect(new Set(flickers)).toEqual(new Set([0.35, 1]));
    const shake = textAnimationState("tremer", "a", 0.5, 5, 3);
    expect(shake).toEqual(textAnimationState("tremer", "a", 0.5, 5, 3));
    expect(Math.abs(shake.dx)).toBeLessThanOrEqual(4);
    expect(textAnimationState("balancar", "a", 0.3125, 5).rotation).toBeCloseTo(4, 4);
  });
});

describe("desenho no canvas", () => {
  it("texto inteiro: centralizado como o título padrão, multilinha, sem transformações neutras", () => {
    const context = fakeContext();
    drawAnimatedText(context, "a\nb", textAnimationState("nada", "a\nb", 0, 1), 1920, 1080);
    expect(named(context, "fillText")).toEqual([
      ["fillText", "a", 0, -41.875],
      ["fillText", "b", 0, 41.875],
    ]);
    expect(named(context, "translate")).toEqual([["translate", 960, 540]]);
    expect(named(context, "rotate")).toEqual([]);
    expect(named(context, "state")[0][1]).toMatchObject({ alpha: 1, filter: "none", font: "bold 67px sans-serif", fill: "#fff" });
    expect(context.calls.at(-1)).toEqual(["restore"]);
  });

  it("sem estado usa o texto recebido; aplica estilo, posição, desfoque e transformações", () => {
    const plain = fakeContext();
    drawAnimatedText(plain, "oi", null, 960, 540, { fontSize: 20, color: "#f00", fontFamily: "serif", fontWeight: 400, x: 10, y: 20, lineHeight: 2 });
    expect(named(plain, "fillText")).toEqual([["fillText", "oi", 0, 0]]);
    expect(named(plain, "translate")).toEqual([["translate", 10, 20]]);
    expect(named(plain, "state")[0][1]).toMatchObject({ font: "400 20px serif", fill: "#f00" });
    const empty = fakeContext();
    drawAnimatedText(empty, undefined, undefined, 1920, 1080);
    expect(named(empty, "fillText")).toEqual([["fillText", "", 0, 0]]);

    const context = fakeContext({ filter: "contrast(110%)", alpha: 0.5 });
    const state = { ...textAnimationState("nada", "oi", 0, 1), opacity: 0.5, blur: 10, dx: 100, dy: -50, rotation: 90, scale: 2, skew: 45 };
    drawAnimatedText(context, "oi", state, 960, 540);
    expect(named(context, "translate")).toEqual([["translate", 530, 245]]);
    expect(named(context, "rotate")[0][1]).toBeCloseTo(Math.PI / 2);
    expect(named(context, "scale")).toEqual([["scale", 2, 2]]);
    expect(named(context, "transform")[0][3]).toBeCloseTo(1);
    expect(named(context, "state")[0][1]).toMatchObject({ alpha: 0.25, filter: "contrast(110%) blur(5px)" });
  });

  it("letra a letra: espaçamento, quebras de linha, letras invisíveis e espaços pulados", () => {
    const context = fakeContext();
    const state = {
      ...textAnimationState("nada", "", 0, 1),
      tracking: 20,
      letters: [
        { char: "a", opacity: 1, dx: 0, dy: 0, scale: 1, rotation: 0, blur: 0 },
        { char: " ", opacity: 1, dx: 0, dy: 0, scale: 1, rotation: 0, blur: 0 },
        { char: "b", opacity: 0.5, dx: 10, dy: 5, scale: 2, rotation: 180, blur: 4 },
        { char: "\n", opacity: 1, dx: 0, dy: 0, scale: 1, rotation: 0, blur: 0 },
        { char: "c", opacity: 0, dx: 0, dy: 0, scale: 1, rotation: 0, blur: 0 },
        { char: "d", opacity: 1, dx: 0, dy: 0, scale: 1, rotation: 0, blur: 0 },
      ],
    };
    drawAnimatedText(context, "", state, 1920, 1080);
    expect(named(context, "fillText")).toEqual([
      ["fillText", "a", 0, 0],
      ["fillText", "b", 0, 0],
      ["fillText", "d", 0, 0],
    ]);
    const translates = named(context, "translate");
    // linha 1: "a b" = 3×10 + 2×20 = 70 → começa em -35; "b" em 25 + 5 + dx 10.
    expect(translates[1]).toEqual(["translate", -30, -41.875]);
    expect(translates[2]).toEqual(["translate", 40, -36.875]);
    // linha 2: "cd" = 2×10 + 20 = 40 → começa em -20; "d" em -20 + 10 + 20 + 5.
    expect(translates[3]).toEqual(["translate", 15, 41.875]);
    expect(named(context, "state")[1][1]).toMatchObject({ alpha: 0.5, filter: "blur(4px)" });
    expect(named(context, "scale")).toEqual([["scale", 2, 2]]);
  });

  it("espaçamento sem letras desenha caractere por caractere", () => {
    const context = fakeContext();
    drawAnimatedText(context, "ab", textAnimationState("espacamento-in", "ab", 0.4, 5), 1920, 1080);
    expect(named(context, "fillText").map((call) => call[1])).toEqual(["a", "b"]);
  });
});

describe("prévia React", () => {
  it("estilo do bloco converte unidades e omite o que é neutro", () => {
    expect(animatedTextStyle(textAnimationState("nada", "a", 0, 1))).toEqual({
      display: "inline-block",
      whiteSpace: "pre-wrap",
      opacity: 1,
      letterSpacing: undefined,
      transform: undefined,
      filter: undefined,
    });
    const state = { ...textAnimationState("nada", "a", 0, 1), tracking: 10, blur: 4, dx: 10, dy: 0, rotation: 5, scale: 1.5, skew: -10, opacity: 2 };
    expect(animatedTextStyle(state, { pxScale: 0.5 })).toMatchObject({
      opacity: 1,
      letterSpacing: "5px",
      filter: "blur(2px)",
      transform: "translate(5px, 0px) rotate(5deg) scale(1.5) skewX(-10deg)",
    });
    expect(animatedTextStyle(null).opacity).toBe(1);
  });

  it("spans por letra ou um span único", () => {
    expect(letterSpans(textAnimationState("aparecer", "oi", 0.2, 5))).toEqual([
      { key: "texto", char: "oi", lineBreak: false, style: {} },
    ]);
    expect(letterSpans(null)).toEqual([{ key: "texto", char: "", lineBreak: false, style: {} }]);
    const spans = letterSpans(
      {
        ...textAnimationState("nada", "", 0, 1),
        letters: [
          { char: "a", opacity: 1, dx: 0, dy: 4, scale: 1, rotation: 0, blur: 2 },
          { char: "\n", opacity: 1, dx: 0, dy: 0, scale: 1, rotation: 0, blur: 0 },
        ],
      },
      { pxScale: 0.5 },
    );
    expect(spans[0]).toEqual({
      key: "0",
      char: "a",
      lineBreak: false,
      style: { display: "inline-block", whiteSpace: "pre", opacity: 1, transform: "translate(0px, 2px)", filter: "blur(1px)" },
    });
    expect(spans[1]).toMatchObject({ key: "1", lineBreak: true, style: { transform: undefined, filter: undefined } });
  });
});
