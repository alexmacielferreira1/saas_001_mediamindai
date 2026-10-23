import { beforeEach, describe, expect, it, vi } from 'vitest';

// Empresa sem registros: os loaders exibem o exemplo marcado como demonstração
// e nunca gravam o mock no banco da empresa (antes: bulkCreate a cada tela,
// às vezes em duplicidade quando duas telas carregavam ao mesmo tempo).
const { writes } = vi.hoisted(() => ({ writes: vi.fn() }));

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: new Proxy({}, {
      get: (_target, name) => ({
        list: () => Promise.resolve([]),
        filter: () => Promise.resolve([]),
        bulkCreate: (...args) => writes(name, 'bulkCreate', ...args),
        create: (...args) => writes(name, 'create', ...args),
        subscribe: () => () => {},
      }),
    }),
  },
}));

import { isDemoRecord } from './demoCatalog';
import { loadOrSeedAgenda } from './corpAgenda';
import { loadOrSeedPendencias } from './corpPendencias';
import { loadOrSeedAprovacoes } from './corpAprovacoes';
import { loadOrSeedPublicacoes } from './corpPublicacoes';
import {
  loadOrSeedReleases, loadOrSeedClippings, loadOrSeedJornalistas, loadOrSeedMencoes,
} from './corpAssessoria';

const LOADERS = {
  agenda: () => loadOrSeedAgenda([{ id: 'e1', titulo: 'Gravação' }]),
  pendencias: () => loadOrSeedPendencias('Design', [{ id: 'p1', titulo: 'Arte' }]),
  aprovacoes: () => loadOrSeedAprovacoes(),
  publicacoes: () => loadOrSeedPublicacoes(),
  releases: () => loadOrSeedReleases(),
  clippings: () => loadOrSeedClippings(),
  jornalistas: () => loadOrSeedJornalistas(),
  mencoes: () => loadOrSeedMencoes(),
};

describe('exemplos em empresa vazia', () => {
  beforeEach(() => writes.mockReset());

  for (const [name, load] of Object.entries(LOADERS)) {
    it(`${name}: exibe o exemplo marcado e não grava no banco`, async () => {
      const rows = await load();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(isDemoRecord)).toBe(true);
      expect(rows.every((row) => row.id != null)).toBe(true);
      expect(writes).not.toHaveBeenCalled();
    });
  }

  it('cargas simultâneas da agenda não duplicam registros', async () => {
    await Promise.all([loadOrSeedAgenda([{ id: 'e1' }]), loadOrSeedAgenda([{ id: 'e1' }])]);
    expect(writes).not.toHaveBeenCalled();
  });

  it('aprovações de exemplo mantêm o formato da fila pendente', async () => {
    const [first] = await loadOrSeedAprovacoes([{ id: 'ap1', titulo: 'Capa' }]);
    expect(first).toEqual(expect.objectContaining({ id: 'ap1', status: 'pendente', prioridade: 'media' }));
  });
});
