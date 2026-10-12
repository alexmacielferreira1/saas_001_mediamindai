import { request } from "./httpClient";

export function getAICompanies() {
  return request("/ai/companies");
}
export function getAIConnections(tenantId) {
  return request(
    `/ai/connections${tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : ""}`,
  );
}
export function saveAIConnections(settings, tenantId) {
  return request(
    `/ai/connections${tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : ""}`,
    { method: "PUT", body: settings },
  );
}

export function getAISettings() {
  return request("/ai/settings");
}

export function saveAISettings(settings) {
  return request("/ai/settings", { method: "PATCH", body: settings });
}

export function getImageGenerationStatus() {
  return request("/ai/generation/image/status");
}

export function generateImage(payload) {
  return request("/ai/generation/image", { method: "POST", body: payload });
}
