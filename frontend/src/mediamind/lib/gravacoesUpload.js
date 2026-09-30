function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export async function uploadRecordingFiles(files, upload, metadata = {}) {
  const uploaded = [];
  const failed = [];
  for (const file of files) {
    try {
      if (!file.size) throw new Error('Arquivo vazio');
      const result = await upload(file, {
        origin: 'recording',
        projectId: metadata.projectId,
        recordingId: metadata.recordingId,
      });
      if (!result?.id || !result?.stream_url) throw new Error('Upload sem ativo confirmado');
      uploaded.push({
        id: result.id,
        asset_id: result.id,
        nome: file.name,
        caminhoRelativo: file.webkitRelativePath || file.name,
        pastaOrigem: file.webkitRelativePath?.split('/')[0] || '',
        tamanho: formatBytes(file.size),
        recebido: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        url: result.stream_url,
        stream_url: result.stream_url,
        sha256: result.sha256,
      });
    } catch {
      failed.push(file.name);
    }
  }
  return { uploaded, failed };
}
