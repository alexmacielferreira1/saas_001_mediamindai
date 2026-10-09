import { describe, expect, it } from 'vitest';
import { buildSectorRows, buildTeamRows } from './managementReportsViewModel';

const memberships = [
  { id: '1', full_name: 'Ana', role: 'editor' },
  { id: '2', full_name: 'Claudia', role: 'producer' },
];
const projects = [
  { id: 'p1', equipe: ['Ana', 'Claudia'], etapa: 'em_edicao' },
  { id: 'p2', equipe: 'Ana, Rafael', etapa: 'finalizado' },
];

describe('managementReportsViewModel', () => {
  it('calcula carga real por membro a partir das equipes dos projetos', () => {
    expect(buildTeamRows(memberships, projects)).toEqual([
      expect.objectContaining({ name: 'Ana', assigned: 2, active: 1, completed: 1 }),
      expect.objectContaining({ name: 'Claudia', assigned: 1, active: 1, completed: 0 }),
    ]);
  });

  it('agrega pessoas e carga por função', () => {
    expect(buildSectorRows(memberships, projects)).toEqual([
      expect.objectContaining({ role: 'editor', people: 1, assigned: 2 }),
      expect.objectContaining({ role: 'producer', people: 1, assigned: 1 }),
    ]);
  });
});
