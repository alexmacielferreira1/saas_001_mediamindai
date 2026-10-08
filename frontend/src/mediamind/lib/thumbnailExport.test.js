import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportThumbnailElement, thumbnailBlob } from './thumbnailExport';

describe('thumbnail export', () => {
  beforeEach(() => { URL.createObjectURL = vi.fn(() => 'blob:export'); URL.revokeObjectURL = vi.fn(); });
  it('exports the actual rendered pixels at the required dimensions', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const canvas = { width: 1920, height: 1080, dataset: { renderStatus: 'ready' }, thumbnailReady: Promise.resolve(), toBlob: vi.fn((fn) => fn(blob)) };
    const anchor = { click: vi.fn(), remove: vi.fn() }; vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor);
    await exportThumbnailElement({ querySelector: () => canvas }, { width: 1920, height: 1080, filename: 'ep-054-horizontal.png' });
    expect(canvas.toBlob).toHaveBeenCalledOnce(); expect(anchor.download).toBe('ep-054-horizontal.png'); expect(anchor.click).toHaveBeenCalledOnce();
  });
  it('refuses a failed render or a canvas with wrong dimensions', async () => {
    await expect(thumbnailBlob({ querySelector: () => ({ width: 960, height: 540, dataset: { renderStatus: 'ready' } }) }, { width: 1920, height: 1080 })).rejects.toThrow('pronta');
    await expect(thumbnailBlob({ querySelector: () => ({ thumbnailReady: Promise.reject(new Error('Foto quebrada')) }) }, { width: 1920, height: 1080 })).rejects.toThrow('Foto quebrada');
  });
});
