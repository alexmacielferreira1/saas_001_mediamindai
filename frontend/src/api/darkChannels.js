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
