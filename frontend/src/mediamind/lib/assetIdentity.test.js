import { describe, expect, it } from 'vitest';
import { findAssetById, workspaceAssetId } from './assetIdentity';

describe('asset identity', () => {
  it('accepts the canonical assetId deep-link and the legacy asset fallback', () => {
    expect(workspaceAssetId(new URLSearchParams('assetId=uuid-123'))).toBe('uuid-123');
    expect(workspaceAssetId(new URLSearchParams('asset=7'))).toBe('7');
  });

  it('matches real string ids without numeric coercion', () => {
    const assets = [{ id: 'uuid-123' }, { id: 7 }];
    expect(findAssetById(assets, 'uuid-123')).toBe(assets[0]);
    expect(findAssetById(assets, '7')).toBe(assets[1]);
  });
});
