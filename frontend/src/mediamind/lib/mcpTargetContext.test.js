import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { clearMCPContext, isPersistedAssetId, publishMCPContext, timelineContext, useMCPContext } from "./mcpTargetContext";

const ASSET = "11111111-2222-4333-8444-555555555555";

describe("mcpTargetContext", () => {
  it("keeps only Acervo ids and counts local media separately", () => {
    const context = timelineContext({ source: "mmfilm", sequenceName: "S1", clips: [{ assetId: ASSET }, { assetId: ASSET }, { assetId: "blob-1" }, {}] });
    expect(context).toMatchObject({ id: "mmfilm:S1", name: "S1", clipCount: 4, asset_ids: [ASSET], localAssetCount: 1 });
    expect(isPersistedAssetId("blob-1")).toBe(false);
  });

  it("delivers the current context to new and existing subscribers and clears only its own source", () => {
    const context = timelineContext({ source: "mmfilm", sequenceName: "S2", clips: [] });
    act(() => publishMCPContext(context));
    const { result } = renderHook(() => useMCPContext());
    expect(result.current).toEqual(context);
    act(() => clearMCPContext("outra-ferramenta"));
    expect(result.current).toEqual(context);
    act(() => clearMCPContext("mmfilm"));
    expect(result.current).toBeNull();
  });
});
