import { describe, expect, it } from 'vitest';

import { PRODUCTION_SUBTABS, normalizeProductionSubtab } from './ProdutoraPage';

describe('producer workflow tabs', () => {
  it('exposes every canonical operational screen', () => {
    const ids = PRODUCTION_SUBTABS.map((tab) => tab.id);
    expect(ids).toEqual(expect.arrayContaining([
      'rascunhos', 'agendamentos', 'gravacoes', 'para_editar', 'em_edicao',
      'aguardando_aprovacao', 'em_aprovacao', 'finalizado', 'redes_sociais',
      'para_publicar', 'publicado', 'analytics',
    ]));
  });

  it('keeps legacy publication handoffs working', () => {
    expect(normalizeProductionSubtab('publicacoes')).toBe('para_publicar');
    expect(normalizeProductionSubtab('workspace2')).toBe('workspace2');
  });
});
