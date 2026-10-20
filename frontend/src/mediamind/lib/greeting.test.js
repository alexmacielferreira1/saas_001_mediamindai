import { describe, expect, it } from 'vitest';
import { getGreeting } from './greeting';

const at = (h) => new Date(2026, 9, 20, h, 0, 0);

describe('getGreeting', () => {
  it('usa a mesma regra de horário para Home e Corp', () => {
    expect(getGreeting(at(3))).toBe('Boa noite');
    expect(getGreeting(at(6))).toBe('Bom dia');
    expect(getGreeting(at(11))).toBe('Bom dia');
    expect(getGreeting(at(12))).toBe('Boa tarde');
    expect(getGreeting(at(17))).toBe('Boa tarde');
    expect(getGreeting(at(18))).toBe('Boa noite');
  });
});
