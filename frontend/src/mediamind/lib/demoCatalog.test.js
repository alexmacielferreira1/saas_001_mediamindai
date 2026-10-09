import { describe, expect, it } from 'vitest';
import {
  DEMO_DATASET,
  getDemoPermissionGroups,
  getDemoUsers,
  isDemoRecord,
} from './demoCatalog';

describe('demoCatalog', () => {
  it('identifica todos os registros como parte do conjunto demonstrativo único', () => {
    expect(DEMO_DATASET).toBe('demo_seed_v1');
    expect(getDemoUsers()).not.toHaveLength(0);
    expect(getDemoPermissionGroups()).not.toHaveLength(0);
    expect([...getDemoUsers(), ...getDemoPermissionGroups()].every(isDemoRecord)).toBe(true);
  });

  it('mantém identificadores únicos entre usuários e perfis', () => {
    const ids = [...getDemoUsers(), ...getDemoPermissionGroups()].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('devolve cópias defensivas, inclusive das permissões aninhadas', () => {
    const users = getDemoUsers();
    const groups = getDemoPermissionGroups();
    users[0].full_name = 'Alterado';
    groups[0].permission_codes.push('alterado');

    expect(getDemoUsers()[0].full_name).not.toBe('Alterado');
    expect(getDemoPermissionGroups()[0].permission_codes).not.toContain('alterado');
  });
});
