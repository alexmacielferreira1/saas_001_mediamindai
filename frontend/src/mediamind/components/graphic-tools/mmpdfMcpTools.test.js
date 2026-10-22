import { describe, expect, it } from "vitest";
import { MMPDF_TABS, mmpdfCatalogue, runMMPdfTool } from "./mmpdfMcpTools";

let counter = 0;
const state = (extra = {}) => ({
  docKey: "doc",
  docName: "Relatório.pdf",
  page: 2,
  annotations: {},
  newId: () => `n${++counter}`,
  ...extra,
});
const last = (result) => result.annotations.doc.at(-1);

describe("catálogo do PDF", () => {
  it("tem guias próprias, 14 ferramentas com ícones distintos e as que exigem mecanismo de PDF como em breve", () => {
    const { tabs, tools } = mmpdfCatalogue();
    expect(tabs).toBe(MMPDF_TABS);
    expect(tools).toHaveLength(14);
    expect(new Set(tools.map((tool) => tool.icon)).size).toBe(14);
    expect(tools.every((tool) => tabs.some((tab) => tab.id === tool.tab))).toBe(true);
    const soon = tools.filter((tool) => tool.status === "soon");
    expect(soon.map((tool) => tool.id)).toEqual(["edit.ocr", "sign.request", "organize.pages", "protect.encrypt", "export.convert"]);
    expect(soon.every((tool) => tool.soonReason.length > 20)).toBe(true);
    expect(runMMPdfTool("organize.pages", state())).toMatchObject({ ok: false });
    expect(runMMPdfTool("organize.pages", state()).summary).toMatch(/^“Páginas” ainda não está disponível: requer um mecanismo/);
  });

  it("explica ferramentas desconhecidas, falta de documento e deixa subir erros inesperados", () => {
    expect(runMMPdfTool("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(runMMPdfTool("edit.watermark", { docKey: "" })).toEqual({ ok: false, summary: "Abra um PDF primeiro." });
    expect(() => runMMPdfTool("edit.watermark", state({ annotations: null }))).toThrow(TypeError);
  });

  it("usa id e página padrão quando o estado não traz", () => {
    const result = runMMPdfTool("edit.watermark", { docKey: "doc" });
    expect(last(result)).toMatchObject({ type: "watermark", text: "CONFIDENCIAL", page: 0 });
    expect(last(result).id).toMatch(/^\d+-[a-z0-9]+$/);
  });
});

describe("Editar", () => {
  it("adiciona texto na página atual ou em todas, sem mexer em outros documentos", () => {
    const other = { outro: [{ id: "x" }] };
    expect(runMMPdfTool("edit.text", state()).summary).toBe("Escreva o texto a adicionar.");
    const here = runMMPdfTool("edit.text", state({ annotations: other }), { text: "  Olá  ", x: 5, y: 6 });
    expect(here).toMatchObject({ ok: true, count: 1, summary: "Texto “Olá” adicionado na página 2 (camada de anotação do MMPDF)" });
    expect(last(here)).toMatchObject({ type: "text", text: "Olá", x: 5, y: 6, page: 2 });
    expect(here.annotations.outro).toBe(other.outro);
    const all = runMMPdfTool("edit.text", state({ annotations: here.annotations }), { text: "Tudo", where: "all" });
    expect(all.summary).toBe("Texto “Tudo” adicionado em todas as páginas (camada de anotação do MMPDF)");
    expect(all.annotations.doc).toHaveLength(2);
    expect(last(all).page).toBe(0);
  });

  it("cria links só para http/https", () => {
    expect(runMMPdfTool("edit.link", state(), { url: null }).summary).toBe("Informe o endereço do link.");
    expect(runMMPdfTool("edit.link", state(), { url: "javascript:alert(1)" }).summary).toBe("Link inválido: use um endereço http:// ou https://.");
    const plain = runMMPdfTool("edit.link", state(), { url: "https://mediamind.ai" });
    expect(plain.summary).toBe("Link para https://mediamind.ai adicionado na página 2 (camada de anotação do MMPDF)");
    expect(last(plain)).toMatchObject({ type: "link", url: "https://mediamind.ai", text: "https://mediamind.ai", x: 10, y: 90, page: 2 });
    expect(last(runMMPdfTool("edit.link", state(), { url: "http://a.b", text: " Site " })).text).toBe("Site");
    expect(last(runMMPdfTool("edit.link", state(), { url: "http://a.b", text: null })).text).toBe("http://a.b");
  });

  it("cabeçalho/rodapé e marca d'água valem para todas as páginas", () => {
    expect(runMMPdfTool("edit.headerfooter", state()).summary).toBe("Escreva o texto do cabeçalho e rodapé.");
    const header = runMMPdfTool("edit.headerfooter", state(), { text: "MediaMind" });
    expect(header.summary).toBe("Cabeçalho e rodapé “MediaMind” em todas as páginas (camada de anotação do MMPDF)");
    expect(last(header)).toMatchObject({ type: "headerfooter", text: "MediaMind", page: 0 });
    expect(runMMPdfTool("edit.watermark", state(), { text: " " }).summary).toBe("Escreva o texto da marca d'água.");
  });
});

describe("Comentar e assinar", () => {
  it("nota e carimbo", () => {
    expect(runMMPdfTool("comment.note", state()).summary).toBe("Escreva o texto da nota.");
    const note = runMMPdfTool("comment.note", state(), { text: "Rever" });
    expect(note.summary).toBe("Nota adicionada na página 2 (camada de anotação do MMPDF)");
    expect(last(note)).toMatchObject({ type: "note", text: "Rever", x: 70, y: 10, page: 2 });
    const stamp = runMMPdfTool("comment.stamp", state(), { stamp: "RASCUNHO", where: "all" });
    expect(stamp.summary).toBe("Carimbo RASCUNHO em todas as páginas (camada de anotação do MMPDF)");
    expect(last(stamp)).toMatchObject({ type: "stamp", text: "RASCUNHO", page: 0 });
  });

  it("marca áreas no formato usado pela camada (Realçar/Sublinhar/Riscar), limitado à página", () => {
    const mark = runMMPdfTool("comment.mark", state(), { style: "Riscar", x: 50, w: 80, h: 1 });
    expect(mark.summary).toBe("Tachado adicionado na página 2 (camada de anotação do MMPDF)");
    expect(last(mark)).toMatchObject({ type: "Riscar", x: 50, y: 20, w: 50, h: 2, page: 2 });
    expect(last(runMMPdfTool("comment.mark", state())).type).toBe("Realçar");
    expect(last(runMMPdfTool("comment.mark", state(), { h: 10 })).h).toBe(10);
    expect(runMMPdfTool("comment.mark", state(), { x: 99.6 }).summary).toBe("A área ficou fora da página: diminua a posição horizontal.");
  });

  it("assina com o nome ou com as iniciais geradas a partir dele", () => {
    expect(runMMPdfTool("sign.signature", state()).summary).toBe("Escreva o nome para a assinatura.");
    const full = runMMPdfTool("sign.signature", state(), { name: "Alex Maciel" });
    expect(full.summary).toBe("Assinatura “Alex Maciel” na página 2 (camada de anotação do MMPDF)");
    const initials = runMMPdfTool("sign.signature", state(), { name: " alex  maciel ferreira ", kind: "initials", where: "all" });
    expect(initials.summary).toBe("Iniciais “AMF” em todas as páginas (camada de anotação do MMPDF)");
    expect(last(initials)).toMatchObject({ type: "signature", text: "AMF", page: 0, x: 60, y: 85 });
  });
});

describe("Organizar", () => {
  const items = [
    { id: 1, page: 2 },
    { id: 2, page: 2 },
    { id: 3, page: 0 },
    { id: 4, page: 3 },
  ];

  it("limpa a página atual (preservando as anotações de todas as páginas) ou o documento", () => {
    expect(mmpdfCatalogue().tools.find((tool) => tool.id === "organize.clear").confirm).toBeTruthy();
    const page = runMMPdfTool("organize.clear", state({ annotations: { doc: items } }));
    expect(page).toMatchObject({ ok: true, count: 2, summary: "2 anotação(ões) removida(s) da página 2" });
    expect(page.annotations.doc.map((item) => item.id)).toEqual([3, 4]);
    expect(runMMPdfTool("organize.clear", state({ annotations: page.annotations })).summary).toBe("A página 2 não tem anotações próprias.");
    const all = runMMPdfTool("organize.clear", state({ annotations: page.annotations }), { scope: "all" });
    expect(all).toMatchObject({ count: 2, summary: "2 anotação(ões) removida(s) do documento", annotations: { doc: [] } });
    expect(runMMPdfTool("organize.clear", state(), { scope: "all" }).summary).toBe("Este documento não tem anotações.");
  });
});
