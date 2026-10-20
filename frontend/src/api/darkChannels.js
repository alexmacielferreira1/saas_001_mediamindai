import { request } from "./httpClient";

export function listDarkChannels() {
  return request("/dark-channels");
}

export function createDarkChannel(body) {
  return request("/dark-channels", { method: "POST", body });
}

export function updateDarkChannel(id, body) {
  return request(`/dark-channels/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export function listDarkChannelScripts(channelId) {
  return request(`/dark-channels/${encodeURIComponent(channelId)}/scripts`);
}

export function createDarkChannelScript(channelId, body) {
  return request(`/dark-channels/${encodeURIComponent(channelId)}/scripts`, { method: "POST", body });
}

export function updateDarkChannelScript(channelId, scriptId, body) {
  return request(`/dark-channels/${encodeURIComponent(channelId)}/scripts/${encodeURIComponent(scriptId)}`, { method: "PATCH", body });
}

export function getDarkStructure() {
  return request("/dark-channels/structure");
}

export function listDarkStructureTemplates() {
  return request("/dark-channels/structure/templates");
}

export function getDarkStructureTemplate(templateId) {
  return request(`/dark-channels/structure/templates/${encodeURIComponent(templateId)}`);
}

export function importDarkStructure(pkg, { dryRun = true } = {}) {
  return request("/dark-channels/structure/import", { method: "POST", body: { package: pkg, dry_run: Boolean(dryRun) } });
}

export function exportDarkStructure() {
  return request("/dark-channels/structure/export");
}

export function updateDarkStructure(body) {
  return request("/dark-channels/structure", { method: "PUT", body });
}

export function updateDarkDecision(decisionId, body) {
  return request(`/dark-channels/structure/decisions/${encodeURIComponent(decisionId)}`, { method: "PATCH", body });
}
