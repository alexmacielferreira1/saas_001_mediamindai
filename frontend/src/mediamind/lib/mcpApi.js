import { request } from "../../api/httpClient";

export function listMCPTools() {
  return request("/mcp/tools");
}

export function callMCPTool(name, args = {}) {
  return request(`/mcp/tools/${encodeURIComponent(name)}/call`, {
    method: "POST",
    body: { arguments: args },
  });
}

export function createMCPQueue(data) {
  return request("/mcp/queues", { method: "POST", body: data });
}

export function listMCPQueues() {
  return request("/mcp/queues");
}

export function executeMCPQueue(queueId) {
  return request(`/mcp/queues/${encodeURIComponent(queueId)}/execute`, {
    method: "POST",
  });
}
