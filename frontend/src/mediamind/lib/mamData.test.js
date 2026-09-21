import { beforeEach, describe, expect, it, vi } from 'vitest';

const { list, bulkCreate } = vi.hoisted(()=>({list:vi.fn(),bulkCreate:vi.fn()}));
vi.mock('@/api/base44Client',()=>({base44:{entities:{Asset:{list,bulkCreate}}}}));
import { loadOrSeed } from './mamData';

describe('MAM offline fallback',()=>{
  const fallback=[{id:1,title:'Mídia local'}];
  beforeEach(()=>{list.mockReset();bulkCreate.mockReset();});
  it('keeps local data visible when the API is unavailable',async()=>{
    list.mockRejectedValue(new Error('offline'));
    expect(await loadOrSeed('Asset',fallback)).toEqual(fallback);
  });
  it('keeps local data when the remote seed cannot be persisted',async()=>{
    list.mockResolvedValue([]);bulkCreate.mockRejectedValue(new Error('offline'));
    expect(await loadOrSeed('Asset',fallback)).toEqual(fallback);
  });
});
