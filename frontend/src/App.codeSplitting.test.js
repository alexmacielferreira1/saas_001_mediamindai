import { describe, expect, it } from 'vitest';
import source from './App.jsx?raw';

// Auditoria 2026-10-23, achado #15: as páginas entram por React.lazy, para que login e
// home não baixem os editores gráficos (milhares de linhas) no chunk inicial.
const EAGER_PAGES = new Set(['Login']);

describe('App route code splitting', () => {
  it('loads every page except login lazily', () => {
    const staticPages = [...source.matchAll(/^import\s+(\w+)\s+from\s+["']\.\/mediamind\/pages\/(\w+)["']/gm)]
      .map((match) => match[2])
      .filter((page) => !EAGER_PAGES.has(page));
    const lazyPages = [...source.matchAll(/lazy\(\(\)\s*=>\s*import\(["']\.\/mediamind\/pages\/(\w+)["']\)\)/g)]
      .map((match) => match[1]);

    expect(staticPages).toEqual([]);
    expect(lazyPages.length).toBeGreaterThanOrEqual(28);
    expect(lazyPages).toEqual(expect.arrayContaining(['GraphicTools', 'Timeline2', 'ClipsFree', 'SoundCraft', 'Home']));
  });

  it('wraps lazy routes in a Suspense boundary', () => {
    expect(source).toMatch(/<Suspense\s+fallback=/);
  });
});
