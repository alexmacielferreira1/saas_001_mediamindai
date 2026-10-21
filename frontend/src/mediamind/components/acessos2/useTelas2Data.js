import { useCallback, useEffect, useState } from 'react';
import { listAdminActivity, listAdminUsers } from '../../../api/admin';
import { request } from '../../../api/httpClient';
import { listMemberships, listPermissionGroups } from '../../../api/permissions';
import { accessErrorMessage } from '../../lib/accessErrors';
import { buildPeople } from './accessModel';

function describeError(reason, fallback) {
  if (reason?.status === 401) return 'Sessão expirada. Entre novamente para ver os dados.';
  if (reason?.status === 403) return accessErrorMessage(reason, 'Sem permissão para consultar estes dados nesta empresa.');
  return reason?.message || fallback;
}

// Leitura dos dados reais de equipe e acessos. Falhas parciais ficam visíveis
// por fonte; nenhuma fonte é substituída por dados de exemplo.
export function useAcessosData() {
  const [state, setState] = useState({ status: 'loading', people: [], groups: [], audit: [], users: [], errors: {} });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading' }));
    const [users, memberships, groups, audit] = await Promise.allSettled([
      listAdminUsers({ page: 1, pageSize: 100 }),
      listMemberships(),
      listPermissionGroups(),
      listAdminActivity(200),
    ]);
    const errors = {};
    if (users.status === 'rejected') errors.users = describeError(users.reason, 'Usuários indisponíveis.');
    if (memberships.status === 'rejected') errors.memberships = describeError(memberships.reason, 'Acessos individuais indisponíveis.');
    if (groups.status === 'rejected') errors.groups = describeError(groups.reason, 'Perfis indisponíveis.');
    if (audit.status === 'rejected') errors.audit = describeError(audit.reason, 'Histórico indisponível.');
    const userItems = users.status === 'fulfilled' ? users.value?.items || [] : [];
    const membershipItems = memberships.status === 'fulfilled' ? memberships.value || [] : [];
    setState({
      status: errors.users && errors.memberships ? 'error' : 'real',
      users: userItems,
      people: buildPeople(userItems, membershipItems),
      groups: groups.status === 'fulfilled' ? groups.value || [] : [],
      audit: audit.status === 'fulfilled' ? audit.value || [] : [],
      errors,
    });
  }, []);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// Relatório de consumo de IA já existente no backend (somente leitura).
export function useAIUsageReport(days) {
  const [state, setState] = useState({ status: 'loading', report: null, error: '' });

  const load = useCallback(async () => {
    setState({ status: 'loading', report: null, error: '' });
    try {
      const report = await request(`/ai/usage/report?days=${days}`);
      setState({ status: 'real', report, error: '' });
    } catch (reason) {
      setState({ status: 'error', report: null, error: describeError(reason, 'Relatório de consumo indisponível.') });
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
