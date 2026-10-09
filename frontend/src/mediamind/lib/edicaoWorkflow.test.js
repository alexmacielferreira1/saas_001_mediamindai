import { describe, expect, it } from 'vitest';
import { editingTransition, laneForEditingProject, laneForEditingStatus, moveEditingLane } from './edicaoWorkflow';

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

  it('places canonical workflow stages in their editing lanes', () => {
    expect(laneForEditingProject({ etapa: 'para_editar' })).toBe('para_editar');
    expect(laneForEditingProject({ etapa: 'em_edicao' })).toBe('em_edicao');
    expect(laneForEditingProject({ etapa: 'aguardando_aprovacao' })).toBe('aguardando');
    expect(laneForEditingProject({ etapa: 'em_edicao', edicao_status: 'pronto_para_aprovacao' })).toBe('aguardando');
  });

  it('moves editing cards one lane and updates both canonical stage and detailed status', () => {
    expect(editingTransition({ etapa: 'para_editar' }, 'em_edicao')).toEqual({ etapa: 'em_edicao', edicao_status: 'corte_fino' });
    expect(editingTransition({ etapa: 'em_edicao', edicao_status: 'corte_fino' }, 'aguardando')).toEqual({ etapa: 'aguardando_aprovacao', edicao_status: 'pronto_para_aprovacao' });
    expect(editingTransition({ etapa: 'para_editar' }, 'aguardando')).toBeNull();
  });
});
