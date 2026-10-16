import { request } from "./httpClient";

export function startClipAnalysis(assetId, connectionId = null, options = {}) {
  return request("/clips/analyses", { method: "POST", body: { asset_id: assetId, connection_id: connectionId || null, ...options } });
}

export function getClipAnalysis(analysisId) {
  return request(`/clips/analyses/${encodeURIComponent(analysisId)}`);
}
