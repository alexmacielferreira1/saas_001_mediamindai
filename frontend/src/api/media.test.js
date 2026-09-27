import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listMediaAssets, mediaStreamUrl, uploadMediaAsset } from './media';

describe('media API', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists persisted media assets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ assets: [{ id: 'asset-1', filename: 'video.mp4' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    await expect(listMediaAssets()).resolves.toEqual([{ id: 'asset-1', filename: 'video.mp4' }]);
  });

  it('uploads the real file as multipart data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 'asset-2', filename: 'real.mp4', stream_url: '/api/v1/media/assets/asset-2/stream' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )));
    const file = new File(['video'], 'real.mp4', { type: 'video/mp4' });

    const uploaded = await uploadMediaAsset(file);

    expect(uploaded.id).toBe('asset-2');
    const [, options] = fetch.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('file')).toBe(file);
  });

  it('keeps same-origin stream paths usable by authenticated players', () => {
    expect(mediaStreamUrl({ stream_url: '/api/v1/media/assets/asset-1/stream' }))
      .toBe('/api/v1/media/assets/asset-1/stream');
  });
});
