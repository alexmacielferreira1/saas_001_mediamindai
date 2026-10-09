export function workspaceAssetId(searchParams) {
  return searchParams.get('assetId') || searchParams.get('asset') || '';
}

export function findAssetById(assets, id) {
  return assets.find((asset) => String(asset.id) === String(id));
}
