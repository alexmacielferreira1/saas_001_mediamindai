import { describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();
vi.mock('./httpClient', () => ({ request: (...args) => requestMock(...args) }));
import { uploadFile } from './uploads';

describe('uploads API', () => {
  it('sends the real file as multipart data', async () => {
    const file = new File(['media'], 'video.mp4', { type: 'video/mp4' });
    requestMock.mockResolvedValue({ file_url: '/api/v1/uploads/id.mp4' });
    await uploadFile(file);
    const [, options] = requestMock.mock.calls[0];
    expect(requestMock.mock.calls[0][0]).toBe('/uploads');
    expect(options.method).toBe('POST');
    expect(options.body.get('file')).toBe(file);
  });

  it('uses the progress-capable sender only when a progress callback is given', async () => {
    requestMock.mockClear();
    const file = new File(['doc'], 'pauta.pdf', { type: 'application/pdf' });
    const send = vi.fn().mockResolvedValue({ file_url: '/api/v1/uploads/x.pdf' });
    vi.doMock('./uploadProgress', () => ({ sendFormWithProgress: send }));
    vi.resetModules();
    const { uploadFile: fresh } = await import('./uploads');
    const onProgress = vi.fn();
    await fresh(file, { onProgress });
    expect(send).toHaveBeenCalledWith('/uploads', expect.any(FormData), { onProgress });
    expect(requestMock).not.toHaveBeenCalled();
  });
});
