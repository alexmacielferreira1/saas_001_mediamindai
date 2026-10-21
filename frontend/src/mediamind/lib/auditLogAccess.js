import { base44 } from '@/api/base44Client';

export const AUDIT_FORBIDDEN_MESSAGE = 'Sem permissão para ver a auditoria.';

// Lê LogAuditoria sem nunca trocar a resposta do servidor por dados de
// demonstração: 403 vira "sem permissão" e qualquer outra falha vira erro.
export async function loadAuditLogs(limit = 100) {
  try {
    const logs = await base44.entities.LogAuditoria.list('-created_date', limit);
    return { logs: Array.isArray(logs) ? logs : [], forbidden: false, error: '' };
  } catch (error) {
    if (error?.status === 403) return { logs: [], forbidden: true, error: AUDIT_FORBIDDEN_MESSAGE };
    return { logs: [], forbidden: false, error: error?.message || 'Falha de conexão com o servidor.' };
  }
}
