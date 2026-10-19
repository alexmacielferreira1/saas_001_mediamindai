import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildGraphicPackage } from './graphicPackage';

describe('pacote do GC', () => {
  it('contains ordered background-only frames and a truthful compatibility note', async () => {
    const seen = [];
    const zip = await buildGraphicPackage({ durationMs: 1000, fps: 2, renderFrame: async (time) => { seen.push(time); return new Uint8Array([137, 80, 78, 71]); } });
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toContain('png-sem-texto/gc_0000.png');
    expect(Object.keys(entries)).toContain('png-sem-texto/gc_0001.png');
    expect(seen).toEqual([0, 500]);
    expect(strFromU8(entries['LEIA-ME.txt'])).toContain('Não contém projeto .aep');
  });
});
