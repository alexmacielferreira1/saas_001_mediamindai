import { beforeEach, describe, expect, it, vi } from 'vitest';

const { list, bulkCreate } = vi.hoisted(()=>({list:vi.fn(),bulkCreate:vi.fn()}));
vi.mock('@/api/base44Client',()=>({base44:{entities:{Asset:{list,bulkCreate}}}}));
import { loadOrSeed } from './mamData';
import { isDemoRecord } from './demoCatalog';

describe('MAM offline fallback',()=>{
  const fallback=[{id:1,title:'Mídia local'}];
  beforeEach(()=>{list.mockReset();bulkCreate.mockReset();});
  it('keeps local data visible when the API is unavailable',async()=>{
    list.mockRejectedValue(new Error('offline'));
    const rows=await loadOrSeed('Asset',fallback);
    expect(rows).toEqual([expect.objectContaining(fallback[0])]);
    expect(isDemoRecord(rows[0])).toBe(true);
  });
  it('shows the example on an empty tenant without writing it to the database',async()=>{
    list.mockResolvedValue([]);
    const rows=await loadOrSeed('Asset',fallback);
    expect(rows).toEqual([expect.objectContaining(fallback[0])]);
    expect(isDemoRecord(rows[0])).toBe(true);
    expect(bulkCreate).not.toHaveBeenCalled();
  });
  it('returns the real records untouched when the tenant has data',async()=>{
    const real=[{id:'11111111-1111-1111-1111-111111111111',title:'Real'}];
    list.mockResolvedValue(real);
    expect(await loadOrSeed('Asset',fallback)).toBe(real);
  });
});
