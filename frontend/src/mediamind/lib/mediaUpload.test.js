import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/media', () => ({ uploadMediaAsset: vi.fn() }));

import { uploadMediaAsset } from '../../api/media';
import { uploadMvpMedia } from './mediaUpload';

describe('MVP media upload contract', () => {
  it('normalizes recording and project metadata through the native API', async () => {
    const file = new File(['media'], 'take.mp4', { type: 'video/mp4' });
    uploadMediaAsset.mockResolvedValue({ id: 'asset-1' });

    await expect(uploadMvpMedia(file, {
      origin: 'recording', projectId: 'p-1', recordingId: 'r-1',
    })).resolves.toEqual({ id: 'asset-1' });

    expect(uploadMediaAsset).toHaveBeenCalledWith(file, {
      origin: 'recording', project_id: 'p-1', recording_id: 'r-1',
    });
  });
});
