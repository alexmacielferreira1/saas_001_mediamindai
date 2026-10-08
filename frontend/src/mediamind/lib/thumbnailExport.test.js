import { beforeEach, describe, expect, it, vi } from 'vitest';

const { html2canvas } = vi.hoisted(() => ({ html2canvas: vi.fn() }));
vi.mock('html2canvas', () => ({ default: html2canvas }));

import { exportThumbnailElement } from './thumbnailExport';

describe('thumbnail export', () => {
  beforeEach(() => {
    const anchor = { click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    html2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,thumb' });
  });

  it('exports a PNG using the nominal horizontal dimensions', async () => {
    const element = { getBoundingClientRect: () => ({ width: 960 }) };
    await exportThumbnailElement(element, { width: 1920, height: 1080, filename: 'ep-054-horizontal.png' });

    expect(html2canvas).toHaveBeenCalledWith(element, expect.objectContaining({
      scale: 2,
      width: 960,
      height: 540,
      useCORS: true,
      backgroundColor: null,
    }));
    const anchor = document.createElement.mock.results[0].value;
    expect(anchor.download).toBe('ep-054-horizontal.png');
    expect(anchor.href).toBe('data:image/png;base64,thumb');
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});
