import { describe, expect, it } from 'vitest';
import { ROLE_CATALOG } from './roleCatalog';
import { mergeAgendaEvents, personalizedAgenda, roleInicioData, workTabForRole } from './roleInicioData';

const EVENTS = [
  { id: 'g1', type: 'gravacao', title: 'Gravação', horario: '09:00' },
  { id: 'e1', type: 'edicao', title: 'Edição', horario: '10:00' },
  { id: 'a1', type: 'aprovacao', title: 'Aprovação', horario: '11:00' },
  { id: 'p1', type: 'publicacao', title: 'Publicação', horario: '12:00' },
];

describe('roleInicioData', () => {
  it('oferece uma visão geral para todos os cargos do catálogo', () => {
    for (const role of ROLE_CATALOG) {
      const data = roleInicioData(role.id);
      expect(data, role.id).not.toBeNull();
      expect(data.roleName, role.id).toBe(role.name);
      expect(data.stats, role.id).toHaveLength(4);
    }
  });

  it('personaliza a agenda por etapa de trabalho', () => {
    expect(personalizedAgenda('editor', EVENTS).map((event) => event.id)).toEqual(['e1']);
    expect(personalizedAgenda('videomaker', EVENTS).map((event) => event.id)).toEqual(['g1']);
    expect(personalizedAgenda('social_media', EVENTS).map((event) => event.id)).toEqual(['p1']);
    expect(personalizedAgenda('qualidade', EVENTS).map((event) => event.id)).toEqual(['a1']);
  });

  it('mantém a visão consolidada para administração e gestão', () => {
    for (const roleId of ['superadmin', 'admin', 'gestao']) {
      expect(personalizedAgenda(roleId, EVENTS)).toEqual(EVENTS);
    }
  });

  it('preserva compromissos específicos ao mesclar uma agenda antiga', () => {
    const antiga = [{ ...EVENTS[0], title: 'Gravação atualizada' }];
    const merged = mergeAgendaEvents(antiga, EVENTS);
    expect(merged).toHaveLength(4);
    expect(merged.find((event) => event.id === 'g1').title).toBe('Gravação atualizada');
    expect(personalizedAgenda('editor', merged).map((event) => event.id)).toEqual(['e1']);
  });

  it('não expõe agenda para cargo desconhecido', () => {
    expect(personalizedAgenda('nao_existe', EVENTS)).toEqual([]);
    expect(roleInicioData('nao_existe')).toBeNull();
  });

  it('direciona o trabalho para a guia operacional do perfil', () => {
    expect(workTabForRole('editor', 'Em edição')).toBe('em_edicao');
    expect(workTabForRole('videomaker', 'confirmada')).toBe('gravacoes');
    expect(workTabForRole('producer', 'aguardando_aprovacao')).toBe('aguardando_aprovacao');
    expect(workTabForRole('cedoc', 'complete')).toBe('midias');
    expect(workTabForRole('design', 'pendente')).toBe('solicitacoes');
  });
});
