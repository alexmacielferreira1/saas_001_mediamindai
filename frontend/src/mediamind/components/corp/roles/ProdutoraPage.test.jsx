import { describe, expect, it } from 'vitest';

import { PRODUCTION_SUBTABS, normalizeProductionSubtab } from './ProdutoraPage';

describe('producer workflow tabs', () => {
  it('exposes every canonical operational screen', () => {
    const ids = PRODUCTION_SUBTABS.map((tab) => tab.id);
    expect(ids).toEqual(expect.arrayContaining([
      'rascunhos', 'agendamentos', 'gravacoes', 'em_edicao',
      'aguardando_aprovacao', 'em_aprovacao', 'finalizado', 'redes_sociais',
      'para_publicar', 'publicado', 'analytics',
    ]));
    expect(ids).not.toContain('para_editar');
    expect(PRODUCTION_SUBTABS.find((tab) => tab.id === 'em_edicao')?.name).toBe('Edição');
  });

  it('keeps legacy publication handoffs working', () => {
    expect(normalizeProductionSubtab('publicacoes')).toBe('para_publicar');
    expect(normalizeProductionSubtab('para_editar')).toBe('em_edicao');
    expect(normalizeProductionSubtab('workspace2')).toBe('workspace');
  });
});
