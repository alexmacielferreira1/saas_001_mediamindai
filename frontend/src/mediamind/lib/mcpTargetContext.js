import { useEffect, useState } from "react";

// Alvo real que a ferramenta aberta oferece ao MCP (Express e painel completo).
// Só a ferramenta que de fato tem a sequência aberta publica; sem publicação não há alvo.
const EVENT = "mm:mcp-context";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let current = null;

export const isPersistedAssetId = (value) => UUID_PATTERN.test(String(value ?? ""));

export function timelineContext({ source, sequenceName, clips = [] }) {
  const ids = [...new Set(clips.map((clip) => clip.assetId).filter(Boolean).map(String))];
  const assetIds = ids.filter(isPersistedAssetId);
  return {
    source,
    kind: "timeline",
    id: `${source}:${sequenceName}`,
    name: sequenceName,
    clipCount: clips.length,
    asset_ids: assetIds,
    localAssetCount: ids.length - assetIds.length,
  };
}

export function publishMCPContext(context) {
  current = context;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: context }));
}

export function clearMCPContext(source) {
  if (current?.source === source) publishMCPContext(null);
}

export function useMCPContext() {
  const [context, setContext] = useState(current);
  useEffect(() => {
    const receive = (event) => setContext(event.detail);
    window.addEventListener(EVENT, receive);
    setContext(current);
    return () => window.removeEventListener(EVENT, receive);
  }, []);
  return context;
}
