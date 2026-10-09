import { base44 } from '@/api/base44Client';

// Helper de auditoria — best-effort, nunca quebra o fluxo principal.
// O ator real fica registrado no campo built-in created_by (email do usuário logado).
export async function logAudit(acao, entidade, detalhe) {
  try {
    await base44.entities.LogAuditoria.create({ acao, entidade, detalhe, ator: '' });
  } catch {
    // silencioso: auditoria é complementar
  }
}