import { describe, expect, it } from 'vitest';
import { buildMediaHandoff, timecodeToMs } from './mediaHandoff';

describe('finalized media handoff', () => {
  const project = { id: 42, titulo: 'Vacinação infantil', programa: 'Saúde em Foco', episodio: 'EP08', pauta: 'Campanha nacional', responsavel: 'Ana' };
  it('keeps source identity and selected range when sending to cuts', () => {
    expect(buildMediaHandoff(project, 'redes_sociais', '00:01:10', '00:02:40')).toMatchObject({ sourceId: 42, destination: 'redes_sociais', titulo: 'Vacinação infantil', inPoint: '00:01:10', outPoint: '00:02:40' });
  });
  it('creates a publication payload instead of only navigating', () => {
    expect(buildMediaHandoff(project, 'publicacoes', '00:00:00', '00:08:42')).toMatchObject({ destination: 'publicacoes', programa: 'Saúde em Foco', descricao: 'Campanha nacional' });
  });
  it('converts the selected range for the cuts player', () => {
    expect(timecodeToMs('00:01:10')).toBe(70000);
    expect(timecodeToMs('01:02:03')).toBe(3723000);
    expect(timecodeToMs('invalid')).toBe(0);
  });
});
