import { describe, expect, it } from 'vitest';
import { auditLabel, timeAgo } from './OverviewTab';

describe('OverviewTab helpers', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');

  it('formats how long ago an audit event happened', () => {
    expect(timeAgo(null, now)).toBe('horário não informado');
    expect(timeAgo('2026-10-27T11:59:50Z', now)).toBe('Agora');
    expect(timeAgo('2026-10-27T11:48:00Z', now)).toBe('Há 12 min');
    expect(timeAgo('2026-10-27T09:00:00Z', now)).toBe('Há 3 h');
    expect(timeAgo('2026-10-26T12:00:00Z', now)).toBe('Há 1 dia');
    expect(timeAgo('2026-10-22T12:00:00Z', now)).toBe('Há 5 dias');
  });

  it('describes known audit actions and keeps unknown ones readable', () => {
    expect(auditLabel('settings.updated')).toBe('atualizou as configurações da organização');
    expect(auditLabel('custom.event')).toBe('custom event');
    expect(auditLabel()).toBe('realizou uma ação administrativa');
  });
});
