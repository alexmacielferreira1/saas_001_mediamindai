import { describe, expect, it } from 'vitest';
import { areaAccessFor, areaLabel, auditActionLabel, auditReference, buildPeople, moduleAccessFor, roleLabel } from './accessModel';
import { formatDateTime, initials } from './shared';

describe('accessModel (Telas 2)', () => {
  it('combina usuários e memberships, incluindo membership sem usuário administrativo', () => {
    const people = buildPeople(
      [{ id: 'u1', full_name: 'Bia', email: 'b@x', tenant_role: 'editor', status: 'active' }],
      [
        { user_id: 'u1', role: 'producer', extra_screens: ['qualidade'], restricted_screens: [] },
        { user_id: 'u2', full_name: '', email: 'ana@x', role: 'cedoc' },
      ],
    );
    expect(people.map((p) => p.name)).toEqual(['ana@x', 'Bia']);
    expect(people[1]).toMatchObject({ role: 'producer', extra: ['qualidade'], hasMembership: true });
    expect(people[0]).toMatchObject({ extra: [], restricted: [], status: 'active' });
    expect(buildPeople([{ id: 'u3', email: 'c@x', tenant_role: 'viewer' }])[0]).toMatchObject({ name: 'c@x', role: 'viewer', hasMembership: false });
  });

  it('calcula áreas efetivas com Herdar/Permitir/Negar', () => {
    expect(areaAccessFor('admin')).toEqual({ full: true, rows: [] });
    const { rows } = areaAccessFor('editor', ['qualidade'], ['editor_video']);
    expect(rows).toEqual([
      { id: 'editor_video', label: 'Edição de vídeo', fromRole: true, exception: 'deny', effective: false },
      { id: 'qualidade', label: 'Controle de qualidade', fromRole: false, exception: 'allow', effective: true },
    ]);
    expect(areaAccessFor('desconhecido').rows).toEqual([]);
    expect(areaAccessFor('editor').rows[0]).toMatchObject({ exception: 'inherit', effective: true });
  });

  it('rótulos e referências', () => {
    expect(areaLabel('xyz')).toBe('xyz');
    expect(roleLabel('editor')).toBe('Editor de vídeo');
    expect(roleLabel('viewer')).toBe('Visitante');
    expect(auditActionLabel('user.suspended')).toBe('Suspendeu usuário');
    // Ações gravadas pelo backend (add_audit) têm rótulo em português, sem cair no texto cru.
    const backendActions = [
      'user.reactivated', 'user.sessions_revoked', 'membership.role_changed',
      'membership.permission_group_changed', 'membership.screens_changed', 'permission_group.created',
      'permission_group.updated', 'permission_group.deactivated', 'production.stage_changed',
      'records.bulk_created', 'records.bulk_updated', 'settings.updated', 'creative_document.approved',
      'creative_export.ready', 'thumbnail.cutout_created', 'dark_script.updated', 'mcp.queue.executed',
    ];
    for (const action of backendActions) {
      expect(auditActionLabel(action)).not.toBe(action.replaceAll('.', ' ').replaceAll('_', ' '));
    }
    expect(auditActionLabel('production.stage_changed')).toBe('Mudou a etapa da produção');
    expect(auditActionLabel('membership.screens_changed')).toBe('Alterou as telas do membro');
    expect(auditActionLabel('foo.bar_baz')).toBe('foo bar baz');
    expect(auditActionLabel()).toBe('Ação registrada');
    expect(auditReference({ id: 'abcdefghij' })).toBe('AUD-ABCDEFGH');
    expect(auditReference(null)).toBe('AUD-—');
    expect(moduleAccessFor('mvp').find((m) => m.id === 'workspace').allowed).toBe(false);
    expect(initials('maria.silva@x')).toBe('MS');
    expect(initials('')).toBe('?');
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('não é data')).toBe('—');
  });
});
