// Rótulos em português dos status de mídia do acervo (Pesquisa e Workspace).
export const ASSET_STATUS_LABELS = { reviewed: 'Revisado', indexed: 'Indexado', processing: 'Processando', ready: 'Pronto', pending: 'Pendente' };

export function assetStatusLabel(status, fallback = '—') {
  if (!status) return fallback;
  return ASSET_STATUS_LABELS[status] || status;
}
