import { describe, expect, it } from 'vitest';

import {
  PRODUCTION_STAGE_ORDER,
  getAdjacentProductionStage,
  getProductionTransition,
  isProjectInProductionStage,
  isScheduleReady,
  normalizeProductionStage,
  productionStageLabel,
  resolveProjectProductionStage,
} from './productionWorkflow';

describe('canonical production workflow', () => {
  it('keeps the product stages in the approved order', () => {
    expect(PRODUCTION_STAGE_ORDER).toEqual([
      'rascunho',
      'agendamentos',
      'gravacoes',
      'para_editar',
      'em_edicao',
      'em_aprovacao',
      'finalizado',
      'redes_sociais',
      'para_publicar',
      'publicado',
      'analytics',
    ]);
  });

  it('normalizes legacy states without losing old records', () => {
    expect(normalizeProductionStage('gravacao')).toBe('gravacoes');
    expect(normalizeProductionStage('aguardando')).toBe('aguardando_aprovacao');
    expect(normalizeProductionStage('em_edicao')).toBe('em_edicao');
    expect(normalizeProductionStage('publicacoes')).toBe('publicado');
    expect(normalizeProductionStage('etapa_desconhecida')).toBe('revisar_classificacao');
  });

  it('rejects invalid and out-of-bounds transitions', () => {
    expect(getProductionTransition('rascunho', -1)).toEqual({ ok: false, reason: 'first_stage' });
    expect(getProductionTransition('rascunho', 2)).toEqual({ ok: false, reason: 'invalid_direction' });
    expect(getProductionTransition('publicado', 1)).toEqual({ ok: true, from: 'publicado', to: 'analytics' });
    expect(getProductionTransition('analytics', 1)).toEqual({ ok: false, reason: 'last_stage' });
    expect(getProductionTransition('etapa_desconhecida', 1)).toEqual({ ok: false, reason: 'unknown_stage' });
  });

  it('separates legacy scheduled and completed recordings without losing records', () => {
    expect(resolveProjectProductionStage({ etapa: 'gravacao', gravada: false, grav_status: 'agendada' })).toBe('agendamentos');
    expect(resolveProjectProductionStage({ etapa: 'gravacao', gravada: true, grav_status: 'gravada' })).toBe('gravacoes');
    expect(resolveProjectProductionStage({ etapa: 'gravacao', grav_status: 'gravada' })).toBe('gravacoes');
  });

  it('matches canonical and legacy projects to the correct screen', () => {
    expect(isProjectInProductionStage({ etapa: 'agendamentos' }, 'agendamentos')).toBe(true);
    expect(isProjectInProductionStage({ etapa: 'gravacao', grav_status: 'agendada' }, 'agendamentos')).toBe(true);
    expect(isProjectInProductionStage({ etapa: 'gravacao', grav_status: 'gravada' }, 'gravacoes')).toBe(true);
    expect(isProjectInProductionStage({ etapa: 'gravacao', grav_status: 'agendada' }, 'gravacoes')).toBe(false);
  });

  it('only confirms schedules that have date and time', () => {
    expect(isScheduleReady({ gravacao: { data: '2026-09-23', horario: '14:00' } })).toBe(true);
    expect(isScheduleReady({ gravacao: { data: '2026-09-23', horario: '' } })).toBe(false);
    expect(isScheduleReady({ gravacao: null })).toBe(false);
  });

  it('only moves to the adjacent stage', () => {
    expect(getAdjacentProductionStage('rascunho', 1)).toBe('agendamentos');
    expect(getAdjacentProductionStage('gravacao', 1)).toBe('para_editar');
    expect(getAdjacentProductionStage('em_aprovacao', -1)).toBe('em_edicao');
    expect(getAdjacentProductionStage('analytics', 1)).toBeNull();
    expect(getAdjacentProductionStage('etapa_desconhecida', 1)).toBeNull();
    expect(productionStageLabel('gravacao')).toBe('Gravações');
    expect(productionStageLabel('etapa_desconhecida')).toBe('Revisar classificação');
  });
});
