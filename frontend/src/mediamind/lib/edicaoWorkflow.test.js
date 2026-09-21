import { describe, expect, it } from 'vitest';
import { laneForEditingStatus, moveEditingLane } from './edicaoWorkflow';

describe('editing workflow', () => {
  it('classifies each status into one non-overlapping lane', () => {
    expect(laneForEditingStatus()).toBe('para_editar');
    expect(laneForEditingStatus('corte_fino')).toBe('em_edicao');
    expect(laneForEditingStatus('revisao_interna')).toBe('em_edicao');
    expect(laneForEditingStatus('pronto_para_aprovacao')).toBe('aguardando');
  });
  it('allows only the immediately previous or next lane', () => {
    expect(moveEditingLane('rascunho_corte', 'em_edicao')).toBe('corte_fino');
    expect(moveEditingLane('corte_fino', 'aguardando')).toBe('pronto_para_aprovacao');
    expect(moveEditingLane('pronto_para_aprovacao', 'em_edicao')).toBe('corte_fino');
  });
  it('rejects skipped and same-lane movements', () => {
    expect(moveEditingLane('rascunho_corte', 'aguardando')).toBeNull();
    expect(moveEditingLane('corte_fino', 'em_edicao')).toBeNull();
  });
});
