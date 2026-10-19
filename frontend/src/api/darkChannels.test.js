import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("./httpClient", () => ({ request }));

import {
  createDarkChannel,
  createDarkChannelScript,
  listDarkChannels,
  listDarkChannelScripts,
  updateDarkChannel,
  updateDarkChannelScript,
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
});
