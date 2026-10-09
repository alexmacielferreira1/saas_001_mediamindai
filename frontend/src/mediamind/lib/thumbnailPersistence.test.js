import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), update: vi.fn(), upload: vi.fn(), merge: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: { entities: { CreativeDocument: { create: mocks.create, list: mocks.list }, ProducaoProjeto: { update: mocks.update } } } }));
vi.mock('@/api/media', () => ({ uploadMediaAsset: mocks.upload, resolveMediaUrl: (url) => url }));
vi.mock('./producaoStore', () => ({ mergePersistedProject: mocks.merge }));
import { persistThumbnailSession, saveThumbnailVersion, markProjectThumbnail, listSavedThumbnails } from './thumbnailPersistence';
const session = () => ({ draft: { projectId: 'p1', people: [], photos: [], highlight: 'Chamada' }, savedId: 'v1', revision: 1 });
describe('persistent project thumbnails', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('uploads repeated temporary image URLs only once and keeps the project link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) })));
    mocks.upload.mockResolvedValue({ id: 'a1', stream_url: '/media/a1' });
    const s = session(); s.draft.people = [{ id: 'person', photo: 'blob:same', originalPhoto: 'blob:same' }];
    s.draft.photos = [{ id: 'photo', url: 'blob:same' }];
    const saved = await persistThumbnailSession(s, 'p1');
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.upload.mock.calls[0][1]).toEqual({ origin: 'thumbnail-source', project_id: 'p1' });
    expect(saved.draft.people[0].photo).toBe('/media/a1'); expect(saved.draft.photos[0].url).toBe('/media/a1');
    expect(s.draft.people[0].photo).toBe('blob:same'); vi.unstubAllGlobals();
  });
  it('creates a new version with its previous record and exported asset IDs', async () => {
    mocks.create.mockResolvedValue({ id: 'v2', revision: 2 });
    const result = await saveThumbnailVersion(session(), { exports: [{ assetId: 'a1', url: '/media/a1', format: 'horizontal' }] });
    expect(result.savedId).toBe('v2'); expect(mocks.create.mock.calls[0][0]).toMatchObject({ project_id: 'p1', previous_version_id: 'v1', revision: 2, asset_ids: ['a1'] });
  });
  it('updates the project cover and merges local state only after persistence succeeds', async () => {
    mocks.update.mockRejectedValueOnce(new Error('offline'));
    await expect(markProjectThumbnail(session(), [])).rejects.toThrow('offline'); expect(mocks.merge).not.toHaveBeenCalled();
    mocks.update.mockResolvedValue({});
    await markProjectThumbnail(session(), [{ format: 'vertical', url: '/v' }, { format: 'horizontal', url: '/h' }]);
    expect(mocks.merge).toHaveBeenCalledWith('p1', expect.objectContaining({ thumbnail_document_id: 'v1', thumbnail_url: '/h' }));
  });
  it('returns only thumbnail records associated with the requested project', async () => {
    mocks.list.mockResolvedValue([{ id: 'a', tool_type: 'thumbnail', project_id: 'p1' }, { id: 'b', tool_type: 'thumbnail', project_id: 'p2' }, { id: 'c', tool_type: 'script', project_id: 'p1' }]);
    expect(await listSavedThumbnails('p1')).toEqual([{ id: 'a', tool_type: 'thumbnail', project_id: 'p1' }]);
  });
});
