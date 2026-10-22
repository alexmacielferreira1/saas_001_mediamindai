import { describe, expect, it } from "vitest";
import { textAt } from "./EffectCraftWorkspace";

const layer = (textAnimation, text = "Olá mundo") => ({ text, textAnimation });

describe("MMEffects · texto animado (textAt)", () => {
  it("sem animação mostra o texto inteiro (e o padrão MMEffect)", () => {
    expect(textAt(layer(undefined), 0)).toBe("Olá mundo");
    expect(textAt({}, 5)).toBe("MMEffect");
    expect(textAt(undefined, 5)).toBe("MMEffect");
    expect(textAt(layer({ mode: "outro", start: 0, duration: 1 }), 0)).toBe("Olá mundo");
  });

  it("máquina de escrever revela letra por letra no intervalo", () => {
    const typing = layer({ mode: "letters", start: 1, duration: 0.9 });
    expect(textAt(typing, 0)).toBe("");
    expect(textAt(typing, 1.3)).toBe("Olá");
    expect(textAt(typing, 1.4)).toBe("Olá ");
    expect(textAt(typing, 5)).toBe("Olá mundo");
    expect(textAt(layer({ mode: "letters", start: 0, duration: 0 }), 0.5)).toBe("Olá mundo");
  });

  it("palavra por palavra e cursor (fixo digitando, piscando no fim)", () => {
    const words = layer({ mode: "words", start: 0, duration: 2, cursor: true });
    expect(textAt(words, 1)).toBe("Olá |");
    expect(textAt(words, 2.2)).toBe("Olá mundo|");
    expect(textAt(words, 2.6)).toBe("Olá mundo");
    expect(textAt(layer({ mode: "words", start: 0, duration: 1 }, "   "), 2)).toBe("");
  });
});
