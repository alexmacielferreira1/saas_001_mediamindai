import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("./httpClient", () => ({ request }));

import {
  createDarkChannel,
  createDarkChannelScript,
  exportDarkStructure,
  getDarkStructure,
  getDarkStructureTemplate,
  importDarkStructure,
  listDarkChannels,
  listDarkChannelScripts,
  listDarkStructureTemplates,
  updateDarkChannel,
  updateDarkChannelScript,
  updateDarkDecision,
  updateDarkStructure,
} from "./darkChannels";

describe("dark channel API", () => {
  beforeEach(() => request.mockReset());

  it("uses tenant-scoped channel and script endpoints for CRUD operations", async () => {
    await listDarkChannels();
    await createDarkChannel({ name: "Histórias", niche: "História" });
    await updateDarkChannel("channel-1", { publishing_mode: "manual" });
    await listDarkChannelScripts("channel-1");
    await createDarkChannelScript("channel-1", { topic: "Tema" });
    await updateDarkChannelScript("channel-1", "script-1", { script: "Roteiro" });

    expect(request.mock.calls).toEqual([
      ["/dark-channels"],
      ["/dark-channels", { method: "POST", body: { name: "Histórias", niche: "História" } }],
      ["/dark-channels/channel-1", { method: "PATCH", body: { publishing_mode: "manual" } }],
      ["/dark-channels/channel-1/scripts"],
      ["/dark-channels/channel-1/scripts", { method: "POST", body: { topic: "Tema" } }],
      ["/dark-channels/channel-1/scripts/script-1", { method: "PATCH", body: { script: "Roteiro" } }],
    ]);
  });

  it("reads, imports and exports the niche/language structure through the structure endpoints", async () => {
    const pkg = { schema: "mediamind.dark-structure/v1", name: "Minha estrutura", languages: [], niches: [], channels: [] };
    request.mockResolvedValue({ ok: true });

    await getDarkStructure();
    await listDarkStructureTemplates();
    await getDarkStructureTemplate("padrao/v1");
    await importDarkStructure(pkg);
    await importDarkStructure(pkg, { dryRun: false });
    await exportDarkStructure();

    expect(request.mock.calls).toEqual([
      ["/dark-channels/structure"],
      ["/dark-channels/structure/templates"],
      ["/dark-channels/structure/templates/padrao%2Fv1"],
      ["/dark-channels/structure/import", { method: "POST", body: { package: pkg, dry_run: true } }],
      ["/dark-channels/structure/import", { method: "POST", body: { package: pkg, dry_run: false } }],
      ["/dark-channels/structure/export"],
    ]);
  });

  it("saves the edited structure and individual decisions", async () => {
    const body = { name: "Rede", languages: [], niches: [], decisions: [] };
    request.mockResolvedValue(body);

    await updateDarkStructure(body);
    await updateDarkDecision("dec/1", { status: "decidida", answer: "Sim" });

    expect(request.mock.calls).toEqual([
      ["/dark-channels/structure", { method: "PUT", body }],
      ["/dark-channels/structure/decisions/dec%2F1", { method: "PATCH", body: { status: "decidida", answer: "Sim" } }],
    ]);
  });
});
