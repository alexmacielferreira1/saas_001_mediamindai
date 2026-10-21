import { describe, expect, it } from 'vitest';
import { auditChangeFields, formatAuditValue } from './auditChange';

describe('auditChange', () => {
  it('lists before/after/reason/actor_role/correlation_id when present', () => {
    expect(auditChangeFields({
      before: { role: 'editor' },
      after: { role: 'reporter' },
      reason: 'Troca de equipe',
      actor_role: 'admin',
      correlation_id: 'corr-123',
    })).toEqual([
      ['Antes', 'role: editor'],
      ['Depois', 'role: reporter'],
      ['Motivo', 'Troca de equipe'],
      ['Cargo do responsável', 'admin'],
      ['Correlação', 'corr-123'],
    ]);
  });

  it('falls back to details.reason and omits missing fields', () => {
    expect(auditChangeFields({ details: { reason: 'Saiu da empresa' } })).toEqual([['Motivo', 'Saiu da empresa']]);
    expect(auditChangeFields({})).toEqual([]);
    expect(auditChangeFields()).toEqual([]);
  });

  it('formats lists, nulls and nested values', () => {
    expect(formatAuditValue({ extra_screens: ['cedoc', 'gestao'], restricted_screens: [], permission_group_id: null }))
      .toBe('extra_screens: cedoc, gestao · restricted_screens: nenhum · permission_group_id: —');
    expect(formatAuditValue({ group: { name: 'Editores' } })).toBe('group: name: Editores');
    expect(formatAuditValue(3)).toBe('3');
    expect(formatAuditValue('')).toBe('');
    expect(formatAuditValue(null)).toBe('');
  });
});
