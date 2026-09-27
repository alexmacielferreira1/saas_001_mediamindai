import { request } from './httpClient';

export async function listMediaAssets() {
  return (await request('/media/assets')).assets;
}

export function uploadMediaAsset(file) {
  const body = new FormData();
  body.append('file', file);
  return request('/media/assets', { method: 'POST', body });
}

export function mediaStreamUrl(asset) {
  return asset?.stream_url || '';
}
