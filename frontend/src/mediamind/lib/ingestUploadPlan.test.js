import { describe, expect, it } from 'vitest';

import { pendingUploadEntries } from './ingestUploadPlan';

describe('ingest upload retry plan', () => {
  it('retries only pending or failed files and preserves completed uploads', () => {
    const files = [
      { id: 'done', status: 'uploaded' },
      { id: 'failed', status: 'failed' },
      { id: 'pending', status: 'pending' },
      { id: 'active', status: 'uploading' },
    ];

    expect(pendingUploadEntries(files).map((item) => item.id)).toEqual(['failed', 'pending']);
  });
});
