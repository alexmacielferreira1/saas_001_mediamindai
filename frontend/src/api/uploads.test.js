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
});
