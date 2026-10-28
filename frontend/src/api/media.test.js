import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetPlaybackUrl, exportMediaClip, exportTimeline, listMediaAssets, mediaStreamUrl, transcribeMediaAsset, uploadMediaAsset } from './media';

describe('media API', () => {
  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it('pede a transcrição da mídia ao servidor (Whisper local)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ segments: 3, reused: false }), { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
    vi.stubGlobal('fetch', fetchMock);
    await expect(transcribeMediaAsset('a b', { force: true })).resolves.toEqual({ segments: 3, reused: false });
    expect(fetchMock.mock.calls[0][0]).toContain('/media/assets/a%20b/transcription');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ force: true });
    await transcribeMediaAsset('x');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ force: false });
  });

  it('lists persisted media assets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ assets: [{ id: 'asset-1', filename: 'video.mp4' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    await expect(listMediaAssets()).resolves.toEqual([{ id: 'asset-1', filename: 'video.mp4' }]);
  });

  it('uses the disk-backed local catalog for demo sessions', async () => {
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({ selected_tenant_id: 'mediamind-demo' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ assets: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    await listMediaAssets();

    expect(fetch).toHaveBeenCalledWith('/api/v1/media/local/assets', expect.any(Object));
  });

  it('uploads the real file as multipart data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 'asset-2', filename: 'real.mp4', stream_url: '/api/v1/media/assets/asset-2/stream' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )));
    const file = new File(['video'], 'real.mp4', { type: 'video/mp4' });

    const uploaded = await uploadMediaAsset(file, {
      origin: 'recording', project_id: 'project-17', recording_id: 'recording-4',
    });

    expect(uploaded.id).toBe('asset-2');
    const [, options] = fetch.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('file')).toBe(file);
    expect(options.body.get('origin')).toBe('recording');
    expect(options.body.get('project_id')).toBe('project-17');
    expect(options.body.get('recording_id')).toBe('recording-4');
  });

  it('resolves the real playback URL of records-API assets', () => {
    expect(assetPlaybackUrl({ id: 'a1', stream_url: '/api/v1/media/assets/a1/stream' })).toBe('/api/v1/media/assets/a1/stream');
    expect(assetPlaybackUrl({ id: 'a2', sha256: 'abc', mime_type: 'video/mp4' })).toBe('/api/v1/media/assets/a2/stream');
    expect(assetPlaybackUrl({ id: 'a3', media_asset_id: 'm3', file_url: '/old.mp4' })).toBe('/api/v1/media/assets/m3/stream');
    expect(assetPlaybackUrl({ id: 'a4', file_url: 'https://cdn.example/a4.mp4' })).toBe('https://cdn.example/a4.mp4');
    expect(assetPlaybackUrl(null)).toBe('');
  });

  it('keeps same-origin stream paths usable by authenticated players', () => {
    expect(mediaStreamUrl({ stream_url: '/api/v1/media/assets/asset-1/stream' }))
      .toBe('/api/v1/media/assets/asset-1/stream');
  });

  it('downloads an actually rendered selected clip', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('rendered-video', {
      status: 200,
      headers: { 'Content-Type': 'video/mp4', 'Content-Disposition': 'attachment; filename="edited.mp4"' },
    })));

    const result = await exportMediaClip({ asset_id: 'asset-1', source_in: 2, duration: 4, properties: {} });

    expect(result.blob.type).toBe('video/mp4');
    expect(result.filename).toBe('edited.mp4');
    expect(fetch).toHaveBeenCalledWith('/api/v1/media/exports/clip', expect.objectContaining({ method: 'POST', credentials: 'include' }));
  });

  it('requests a rendered complete timeline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('timeline-video', {
      status: 200,
      headers: { 'Content-Type': 'video/mp4', 'Content-Disposition': 'attachment; filename="timeline.mp4"' },
    })));
    const project = { name: 'News', tracks: [] };

    const result = await exportTimeline(project);

    expect(result.filename).toBe('timeline.mp4');
    expect(fetch).toHaveBeenCalledWith('/api/v1/media/exports/timeline', expect.objectContaining({ body: JSON.stringify(project) }));
    expect(result).toMatchObject({ assetId: null, exportPath: null });
  });

  it('informa onde o servidor salvou a exportação (Acervo e pasta de destino)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('video', {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'X-MediaMind-Asset-Id': 'salvo-1',
        'X-MediaMind-Export-Path': encodeURIComponent('empresa/2026-10-28/Praça-editado.mp4'),
      },
    })));

    const result = await exportMediaClip({ asset_id: 'asset-1', source_in: 0, duration: 1, properties: {} });

    expect(result).toMatchObject({ filename: 'mediamind-editado.mp4', assetId: 'salvo-1', exportPath: 'empresa/2026-10-28/Praça-editado.mp4' });
  });
});
