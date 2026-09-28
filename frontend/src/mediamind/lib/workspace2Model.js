export const DEFAULT_WORKSPACE_MEDIA_SEARCH = {
  filters: { filename: '', transcription: '', person: '', gc: '', local: '', date: '' },
  quickType: 'all',
};

export function filterWorkspaceAssets(assets, mediaSearch = DEFAULT_WORKSPACE_MEDIA_SEARCH) {
  const filters = { ...DEFAULT_WORKSPACE_MEDIA_SEARCH.filters, ...(mediaSearch?.filters || {}) };
  const quickType = mediaSearch?.quickType || 'all';
  return (assets || []).filter((asset) => {
    const includes = (value, query) => !query || String(value || '').toLocaleLowerCase('pt-BR').includes(String(query).toLocaleLowerCase('pt-BR'));
    if (!includes(`${asset.title || ''} ${asset.filename || ''}`, filters.filename)) return false;
    if (!includes(`${asset.description || ''} ${asset.subjects || ''}`, filters.transcription)) return false;
    if (!includes(asset.people, filters.person)) return false;
    if (!includes(asset.subjects, filters.gc)) return false;
    if (!includes(asset.location, filters.local)) return false;
    if (filters.date && asset.reference_date !== filters.date) return false;
    return quickType === 'all' || asset.asset_type === quickType;
  });
}

export function toggleSelectedAsset(selectedIds, assetId) {
  return selectedIds.includes(assetId)
    ? selectedIds.filter((id) => id !== assetId)
    : [...selectedIds, assetId];
}

export function appendScriptBlock(blocks, asset) {
  return [
    ...blocks,
    {
      id: `block-${asset.id}-${blocks.length + 1}`,
      assetId: asset.id,
      title: asset.title,
      duration: asset.duration || 0,
      type: asset.asset_type === 'audio' ? 'audio' : 'media',
      src: asset.stream_url || asset.src || null,
      mimeType: asset.mime_type || null,
    },
  ];
}

export function appendTextBlock(blocks, text = 'Novo bloco de texto') {
  const normalizedText = text.trim() || 'Novo bloco de texto';
  return [
    ...blocks,
    {
      id: `text-${Date.now()}-${blocks.length + 1}`,
      assetId: null,
      title: normalizedText,
      text: normalizedText,
      duration: 5,
      type: 'text',
    },
  ];
}

export function removeScriptBlock(blocks, blockId) {
  return blocks.filter((block) => block.id !== blockId);
}
