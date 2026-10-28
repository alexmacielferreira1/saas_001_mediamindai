import { uploadMediaAsset } from '../../api/media';

// Texto curto de onde a exportação ficou salva (o servidor guarda a peça no Acervo e copia para a
// pasta de destino, EXPORT_ROOT), para as mensagens das telas. Sem asset: nada a dizer.
export function savedNote({ assetId, exportPath } = {}) {
  if (!assetId) return '';
  return exportPath ? ` · salvo no Acervo e na pasta de destino (${exportPath})` : ' · salvo no Acervo';
}

// Peça pronta gerada no navegador (thumbnail PNG, WebM do MMFilm): envia ao Acervo como
// exportação; o servidor copia para a pasta de destino. Devolve { assetId, exportPath }.
export async function saveExportToLibrary(blob, filename) {
  const file = new File([blob], filename, { type: (blob.type || 'application/octet-stream').split(';')[0] });
  const asset = await uploadMediaAsset(file, { origin: 'export' });
  return { assetId: asset?.id || null, exportPath: asset?.export_path || null };
}
