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
      type: 'media',
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
