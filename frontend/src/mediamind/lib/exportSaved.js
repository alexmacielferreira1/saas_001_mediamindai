// Texto curto de onde a exportação ficou salva (o servidor guarda a peça no Acervo e copia para a
// pasta de destino, EXPORT_ROOT), para as mensagens das telas. Sem asset: nada a dizer.
export function savedNote({ assetId, exportPath } = {}) {
  if (!assetId) return '';
  return exportPath ? ` · salvo no Acervo e na pasta de destino (${exportPath})` : ' · salvo no Acervo';
}
