import { describe, expect, it } from "vitest";

import { NAV_GROUPS, navigationForRole, settingsPathForRole } from "./Shell";

describe("settings shortcut", () => {
  it("opens Administração for administrators", () => {
    expect(settingsPathForRole("admin")).toBe("/administration2");
    expect(settingsPathForRole("superadmin")).toBe("/administration2");
  });

  it("opens the AI settings for other roles that can reach them", () => {
    expect(settingsPathForRole("editor")).toBe("/configuracoes/ia");
  });

  it("has no destination for roles without a settings area", () => {
    expect(settingsPathForRole("mvp")).toBeNull();
    expect(settingsPathForRole(undefined)).toBeNull();
  });
});

describe("production navigation", () => {
  it("shows only the approved operational workflow", () => {
    const labels = NAV_GROUPS.flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).not.toContain("IAcervo Corp");
    expect(labels).not.toContain("Roteiro 2");
    expect(labels).toContain("Pesquisa");
    expect(labels).toContain("Workspace");
    expect(labels).not.toContain("Modo roteiro");
    expect(labels).not.toContain("Workspace 2");
    expect(labels).not.toContain("Timeline 2");
    expect(labels).not.toContain("Material para editar");
    expect(labels).toContain("Edição");
    expect(labels).toContain("Alteração");
    expect(labels).toContain("Para publicação");
    expect(labels).toContain("Publicado");
    expect(labels).not.toContain("Criar Thumbs");
    expect(labels).toContain("Estúdio de Arte");
    expect(labels).toContain("Canais Dark");
    expect(labels).toContain("Geração de vídeo");
    expect(labels).not.toContain("VIDEO_ESTUDIO");
    expect(labels).not.toContain("Ferramentas IA");
    expect(labels).not.toContain("MMSOM");
    expect(labels).not.toContain("Ferramentas Office");
    expect(labels).toContain("Ferramentas Gráficas");
    expect(labels).not.toContain("Configuração de IA");
  });

  it("shows the MVP profile its selected workflow, including recording prerequisites", () => {
    const navigation = navigationForRole("mvp").flatMap((group) => group.items);
    const labels = navigation.map((item) => item.label);
    expect(labels).toEqual([
      "Início",
      "Pesquisa",
      "Workspace",
      "Rascunhos",
      "Agendamentos",
      "Gravações",
      "Edição",
      "Em revisão",
      "Finalizado",
    ]);
    expect(navigation.some((item) => item.label === "Acervo")).toBe(false);
  });

  it("keeps only Administração in the lateral administration group", () => {
    const administration = NAV_GROUPS.find(
      (group) => group.group === "Administração",
    ).items;
    expect(administration.map((item) => item.label)).toEqual(["Administração"]);
    expect(administration.map((item) => item.to)).toEqual(["/administration2"]);
    expect(administration.some((item) => item.label.endsWith(" 2"))).toBe(
      false,
    );
  });
});
