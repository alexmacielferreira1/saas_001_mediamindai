// ============================================================================
// Controle de acesso portátil (RBAC) — independente do Base44.
// Define quais abas/perfis do IAcervo Corp cada papel enxerga. Quando migrar
// para produção fora do Base44, basta trocar a fonte de `papel` (hoje vem do
// mock auth.jsx) — a lógica de permissão fica aqui, reutilizável.
//
// Princípio: negar por padrão. Papéis não listados não veem nada. Admin vê tudo.
// ============================================================================

import { effectiveTabsForUser } from './roleCatalog';

// Mapa: papel (do mock auth) -> lista de ids de abas do Corp permitidos.
export const ROLE_CORP_ACCESS = {
  admin: '*',
  producer: ['producao'],
  editor: ['editor_video'],
  cedoc: ['cedoc'],
  // Papéis adicionais do Corp — mapear conforme o backend real for definido.
  videomaker: ['videomaker'],
  reporter: ['reporter'],
  journalist: ['redacao'],
  apresentador: ['apresentador'],
  locutor: ['locutor'],
  sonoplasta: ['sonoplasta'],
  fotografo: ['fotografo'],
  motion_designer: ['motion_designer'],
  cenografo: ['cenografo'],
  roteirista: ['roteirista'],
  revisor: ['revisor'],
  tradutor: ['tradutor'],
  social_media: ['social_media'],
  coordenador_comunicacao: ['coordenador_comunicacao'],
  juridico: ['juridico'],
  ti_suporte: ['ti_suporte'],
};

// hasCorpAccess(role, tabId): true se o papel pode acessar a aba.
export function hasCorpAccess(role, tabId) {
  if (!role) return false;
  const allowed = ROLE_CORP_ACCESS[role];
  if (!allowed) return false;
  if (allowed === '*') return true;
  return allowed.includes(tabId);
}

// filterTabsByRole(tabs, role): retorna só as abas permitidas para o papel.
export function filterTabsByRole(tabs, role) {
  if (!role) return [];
  const allowed = ROLE_CORP_ACCESS[role];
  if (!allowed) return [];
  if (allowed === '*') return tabs;
  return tabs.filter((t) => allowed.includes(t.id));
}

// defaultTabForRole(tabs, role): primeira aba permitida (ou null).
export function defaultTabForRole(tabs, role) {
  const filtered = filterTabsByRole(tabs, role);
  return filtered.length ? filtered[0].id : null;
}

// RBAC por usuário (cargo atribuído + ajustes por pessoa). Admin vê tudo.
// Usa o catálogo oficial de cargos + overrides individuais (roleCatalog.js).
export function filterTabsForUser(tabs, user) {
  if (!user) return [];
  const ids = new Set(effectiveTabsForUser(user, tabs.map((t) => t.id)));
  return tabs.filter((t) => ids.has(t.id));
}

export function defaultTabForUser(tabs, user) {
  const filtered = filterTabsForUser(tabs, user);
  return filtered.length ? filtered[0].id : null;
}