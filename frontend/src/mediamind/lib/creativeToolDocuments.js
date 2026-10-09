import { base44 } from '@/api/base44Client';
import { uploadMediaAsset, resolveMediaUrl } from '@/api/media';

export async function persistToolMedia(value, projectId, uploaded = new Map()) {
  if (typeof value === 'string' && (value.startsWith('blob:') || /^data:(image|audio|video)\//.test(value))) {
    if (!uploaded.has(value)) uploaded.set(value, (async () => {
      const response = await fetch(value);
      if (!response.ok) throw new Error('Uma mídia temporária expirou. Envie o arquivo novamente antes de salvar.');
      const blob = await response.blob();
      const extensions = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
      const file = new File([blob], `criacao-${crypto.randomUUID()}.${extensions[blob.type] || 'bin'}`, { type: blob.type || 'application/octet-stream' });
      const asset = await uploadMediaAsset(file, { origin: 'ai-tool-source', project_id: projectId });
      return resolveMediaUrl(asset.stream_url);
    })());
    return uploaded.get(value);
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => persistToolMedia(item, projectId, uploaded)));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = await persistToolMedia(item, projectId, uploaded);
    return output;
  }
  return value;
}
export async function saveToolDocument({ tool, projectId, title, value, previousId }) {
  const content = await persistToolMedia(value, projectId);
  return base44.entities.CreativeDocument.create({ tool_type: 'ai-tool', tool_id: tool, project_id: projectId || '', title: title.trim() || 'Criação sem título', status: 'draft', previous_version_id: previousId || null, content });
}
export async function listToolDocuments(tool, projectId) {
  const records = await base44.entities.CreativeDocument.list('-created_date', 500);
  return records.filter((r) => r.tool_type === 'ai-tool' && r.tool_id === tool && (!projectId || String(r.project_id) === String(projectId)));
}
export function parseProjectFile(text, tool) {
  const data = JSON.parse(text);
  if (!data || data.schema !== 'mediamind-creative/v1' || data.tool !== tool || !data.content || typeof data.content !== 'object' || Array.isArray(data.content)) throw new Error('Escolha um projeto exportado por esta ferramenta do MediaMind.');
  return data;
}
export function parseSceneLines(text) {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = /^\[([^\]]+)\]\s*(.*)$/.exec(line);
    return { text: match ? match[2] : line, tag: match ? match[1] : 'ideia' };
  });
}
export function safeSourceUrl(text) {
  try { const url = new URL(text); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function buildSrt(segments, language = 'translation') {
  const clock = (seconds) => { const n = Math.round(Math.max(0, Number(seconds)) * 1000); return `${String(Math.floor(n / 3600000)).padStart(2, '0')}:${String(Math.floor(n / 60000) % 60).padStart(2, '0')}:${String(Math.floor(n / 1000) % 60).padStart(2, '0')},${String(n % 1000).padStart(3, '0')}`; };
  return segments.map((s, i) => `${i + 1}\n${clock(s.start)} --> ${clock(s.end)}\n${s[language] || s.text || ''}\n`).join('\n');
}
