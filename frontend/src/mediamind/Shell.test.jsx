import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, navigationForRole } from './Shell';

describe('production navigation', () => {
  it('shows only the approved operational workflow', () => {
    const labels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).not.toContain('IAcervo Corp');
    expect(labels).not.toContain('Pesquisa');
    expect(labels).not.toContain('Workspace');
    expect(labels).not.toContain('Modo roteiro');
    expect(labels).toContain('Workspace 2');
    expect(labels).not.toContain('Timeline 2');
    expect(labels).not.toContain('Material para editar');
    expect(labels).toContain('Edição');
    expect(labels).toContain('Aguardando aprovação');
    expect(labels).toContain('Para publicação');
    expect(labels).toContain('Publicado');
  });

  it('shows the MVP profile its selected workflow, including recording prerequisites', () => {
    const labels = navigationForRole('mvp').flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual([
      'Início', 'Workspace 2', 'Rascunhos', 'Agendamentos', 'Gravações', 'Edição',
      'Em aprovação', 'Finalizado', 'Acervo',
    ]);
  });
});
