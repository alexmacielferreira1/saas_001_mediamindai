import { describe, expect, it } from 'vitest';
import { ACTIONS, actionsForUser } from './quickActions';

describe('quickActions por perfil', () => {
  it('oferece ao superadministrador todos os atalhos disponíveis', () => {
    const visible = actionsForUser({ id: 'alex', role: 'superadmin' });
    expect(visible.map((action) => action.id)).toEqual(ACTIONS.map((action) => action.id));
  });

  it('mantém para cada perfil apenas ações permitidas e ações universais', () => {
    const editor = actionsForUser({ id: 'editor', role: 'editor' });
    expect(editor.map((action) => action.id)).toEqual(expect.arrayContaining([
      'nova_publicacao', 'nova_edicao', 'nova_revisao', 'nova_pesquisa',
    ]));
    expect(editor.map((action) => action.id)).not.toContain('nova_empresa');
  });
});
