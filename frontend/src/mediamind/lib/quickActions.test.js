import { describe, expect, it, vi } from 'vitest';
import { ACTIONS, actionsForUser, getAction, runAction } from './quickActions';

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

describe('quickActions — rótulos e destinos honestos', () => {
  it('não expõe nomes técnicos de entidade', () => {
    const entities = ACTIONS.map((action) => action.entity);
    for (const technical of ['IngestPackage', 'ProcessamentoJob', 'Clip']) expect(entities).not.toContain(technical);
    expect(getAction('novo_pacote').entity).toBe('Pacote de ingest');
  });

  it('ações que só navegam começam com "Ir para" e abrem a aba certa', () => {
    const navigate = vi.fn();
    runAction('nova_edicao', navigate);
    expect(navigate).toHaveBeenLastCalledWith('/corp?tab=editor_video');
    runAction('novo_release', navigate);
    expect(navigate).toHaveBeenLastCalledWith('/corp?tab=assessoria');
    runAction('novo_relatorio', navigate);
    expect(navigate).toHaveBeenLastCalledWith('/management?tab=reports');
    for (const id of ['nova_edicao', 'nova_revisao', 'novo_release', 'novo_relatorio', 'nova_empresa', 'nova_tarefa']) {
      expect(getAction(id).label).toMatch(/^Ir para /);
    }
  });

  it('ações de criação com handler continuam usando ?novo=', () => {
    const navigate = vi.fn();
    runAction('nova_producao', navigate);
    expect(navigate).toHaveBeenLastCalledWith('/corp?novo=producao');
    runAction('novo_pacote', navigate);
    expect(navigate).toHaveBeenLastCalledWith('/ingest?novo=pacote');
  });
});
