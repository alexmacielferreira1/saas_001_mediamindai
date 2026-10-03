import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, navigationForRole } from './Shell';

describe('production navigation', () => {
  it('shows only the approved operational workflow', () => {
    const labels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).not.toContain('IAcervo Corp');
    expect(labels).not.toContain('Roteiro 2');
    expect(labels).not.toContain('Pesquisa');
    expect(labels).not.toContain('Workspace');
    expect(labels).not.toContain('Modo roteiro');
    expect(labels).toContain('Workspace 2');
    expect(labels).not.toContain('Timeline 2');
    expect(labels).not.toContain('Material para editar');
    expect(labels).toContain('Edição');
    expect(labels).toContain('Alteração');
    expect(labels).toContain('Para publicação');
    expect(labels).toContain('Publicado');
  });

  it('shows the MVP profile its selected workflow, including recording prerequisites', () => {
    const navigation = navigationForRole('mvp').flatMap((group) => group.items);
    const labels = navigation.map((item) => item.label);
    expect(labels).toEqual([
      'Início', 'Workspace 2', 'Rascunhos', 'Agendamentos', 'Gravações', 'Edição',
      'Em revisão', 'Finalizado', 'Acervo',
    ]);
    expect(navigation.find((item) => item.label === 'Acervo')?.to).toBe('/acervo');
  });

  it('promotes the administration areas to the main menu without preview suffixes', () => {
    const administration = NAV_GROUPS.find((group) => group.group === 'Administração').items;
    expect(administration.map((item) => item.label)).toEqual([
      'Acervo', 'Gestão', 'Telas e Módulos', 'Cadastros', 'Integrações', 'Configurações', 'Administração',
    ]);
    expect(administration.map((item) => item.to)).toEqual([
      '/administration2?tab=archive',
      '/administration2?tab=management',
      '/administration2?tab=registry',
      '/administration2?tab=records',
      '/administration2?tab=integrations',
      '/administration2?tab=settings',
      '/administration2',
    ]);
    expect(administration.some((item) => item.label.endsWith(' 2'))).toBe(false);
  });
});
