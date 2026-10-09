import { describe, expect, it } from 'vitest';

import { ALL_SUBTABS, MVP_SUBTABS, ROLE_SUBTABS, getActiveSubtabs } from './roleSubtabs';

describe('producer role workflow access', () => {
  it('exposes editing as one screen while keeping the approval queues', () => {
    expect(ROLE_SUBTABS.producer).toEqual(expect.arrayContaining([
      'em_edicao', 'aguardando_aprovacao', 'para_publicar', 'publicado',
    ]));
    expect(ROLE_SUBTABS.producer).not.toContain('para_editar');
    expect(ALL_SUBTABS.find((tab) => tab.id === 'em_edicao')?.name).toBe('Edição');
    expect(ALL_SUBTABS.some((tab) => tab.id === 'para_editar')).toBe(false);
  });

  it('migrates a saved Material para editar permission to Edição', () => {
    localStorage.setItem('mm_role_subtabs_v1', JSON.stringify({
      producer: ['overview', 'para_editar', 'aguardando_aprovacao'],
    }));

    expect(getActiveSubtabs('producer')).toEqual([
      'overview', 'em_edicao', 'aguardando_aprovacao',
    ]);
  });

  it('selects only the existing MVP workflow screens', () => {
    expect(MVP_SUBTABS).toEqual([
      'workspace', 'rascunhos', 'agendamentos', 'gravacoes', 'em_edicao',
      'aguardando_aprovacao', 'em_aprovacao', 'finalizado',
    ]);
    expect(ROLE_SUBTABS.mvp).toEqual(MVP_SUBTABS);
    expect(getActiveSubtabs('mvp')).toEqual(MVP_SUBTABS);
  });

  it('migrates a saved Workspace 2 permission to the canonical Workspace', () => {
    localStorage.setItem('mm_role_subtabs_v1', JSON.stringify({
      producer: ['overview', 'workspace2', 'rascunhos'],
    }));

    expect(getActiveSubtabs('producer')).toEqual(['overview', 'workspace', 'rascunhos']);
  });
});
