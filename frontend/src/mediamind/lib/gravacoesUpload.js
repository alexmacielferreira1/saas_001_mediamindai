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

export async function uploadRecordingFiles(files, upload) {
  const uploaded = [];
  const failed = [];
  for (const file of files) {
    try {
      if (!file.size) throw new Error('Arquivo vazio');
      const result = await upload(file);
      const url = result?.stream_url || result?.file_url;
      if (!url) throw new Error('Upload sem URL confirmada');
      uploaded.push({
        id: result.id || url,
        mediaAssetId: result.id || null,
        nome: file.name,
        caminhoRelativo: file.webkitRelativePath || file.name,
        pastaOrigem: file.webkitRelativePath?.split('/')[0] || '',
        tamanho: formatBytes(file.size),
        recebido: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        url,
        sha256: result.sha256,
      });
    } catch {
      failed.push(file.name);
    }
  }
  return { uploaded, failed };
}
