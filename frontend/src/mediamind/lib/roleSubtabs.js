// ============================================================================
// Catálogo central das guias (sub-abas) do IAcervo Corp.
//
// - ALL_SUBTABS: universo de todas as guias possíveis (o admin vê todas em cada
//   cargo; as do cargo ficam acesas, as demais apagadas — e o admin pode ativar
//   qualquer uma). 'visao_geral' é alias de 'overview' (mesma guia "Visão geral").
// - ROLE_SUBTABS: conjunto DEFAULT aceso de cada cargo (ids). O cargo "admin"
//   tem acesso total (null).
// - Persistência: o admin liga/desliga guias; as páginas de função consomem
//   `filterActiveSubtabs` pra montar a barra só com as ativas.
// ============================================================================

const VISAO = { id: 'overview', name: 'Visão geral', aliases: ['visao_geral'] };

// Ordem padronizada no pipeline de Produção; o restante vem depois.
export const ALL_SUBTABS = [
  VISAO,
  { id: 'pesquisa', name: 'Pesquisa' },
  { id: 'ingest', name: 'Ingest' },
  { id: 'workspace', name: 'Workspace' },
  { id: 'workspace2', name: 'Workspace 2' },
  { id: 'roteiro', name: 'Modo Roteiro' },
  { id: 'rascunhos', name: 'Rascunhos' },
  { id: 'agendamentos', name: 'Agendamentos' },
  { id: 'gravacoes', name: 'Gravações' },
  { id: 'em_edicao', name: 'Em edição' },
  { id: 'em_aprovacao', name: 'Em aprovação' },
  { id: 'finalizado', name: 'Finalizado' },
  { id: 'redes_sociais', name: 'Redes sociais' },
  { id: 'publicacoes', name: 'Publicações' },
  { id: 'analytics', name: 'Analytics' },
  { id: 'pautas', name: 'Pautas' },
  { id: 'materias', name: 'Matérias' },
  { id: 'fontes', name: 'Fontes' },
  { id: 'releases', name: 'Releases' },
  { id: 'mailing', name: 'Mailing' },
  { id: 'clipping', name: 'Clipping' },
  { id: 'monitoramento', name: 'Monitoramento' },
  { id: 'relatorios', name: 'Relatórios' },
  { id: 'solicitacoes', name: 'Solicitações' },
  { id: 'versoes', name: 'Versões' },
  { id: 'brandkit', name: 'Brand Kit' },
  { id: 'aprovacoes', name: 'Aprovações' },
  { id: 'artes', name: 'Artes' },
  { id: 'publicacao', name: 'Publicação' },
  { id: 'campanhas', name: 'Campanhas' },
  { id: 'newsletters', name: 'Newsletters' },
  { id: 'comunicados', name: 'Comunicados' },
  { id: 'docs', name: 'Documentação' },
  { id: 'pendencias', name: 'Pendências' },
  { id: 'midias', name: 'Mídias' },
  { id: 'arquivos', name: 'Arquivos' },
  { id: 'tarefas', name: 'Tarefas de mídia' },
  { id: 'processados', name: 'Processados IA' },
  { id: 'sistema', name: 'Sistema' },
  { id: 'usuarios', name: 'Gestão de usuários' },
  { id: 'processamentos', name: 'Processamentos' },
  { id: 'auditoria', name: 'Auditoria' },
];

// Conjunto DEFAULT aceso por cargo (ids). null = acesso total (admin).
const COMMON_IDS = ['pesquisa', 'ingest', 'workspace', 'workspace2', 'roteiro'];
const OV = ['overview'];
const VG = ['visao_geral'];

export const ROLE_SUBTABS = {
  admin: null,
  producer: [...OV, 'rascunhos', 'agendamentos', 'gravacoes', 'em_edicao', 'em_aprovacao', 'finalizado', 'redes_sociais', 'publicacoes', 'analytics', ...COMMON_IDS],
  editor: [...VG, 'agendamentos', 'gravacoes', 'em_edicao', 'em_aprovacao', 'finalizado', 'redes_sociais', 'publicacoes', 'analytics', ...COMMON_IDS],
  videomaker: [...VG, 'agendamentos', 'gravacoes', ...COMMON_IDS],
  reporter: [...OV, ...COMMON_IDS],
  produtor_reportagem: [...OV, ...COMMON_IDS],
  diretor_programa: [...OV, ...COMMON_IDS],
  estagiario: [...OV, ...COMMON_IDS],
  programacao: [...OV, ...COMMON_IDS],
  qualidade: [...OV, ...COMMON_IDS],
  journalist: [...OV, 'pautas', 'materias', 'fontes', 'publicacoes', 'analytics', 'pendencias'],
  design: [...OV, 'solicitacoes', 'versoes', 'brandkit', 'aprovacoes', 'analytics', 'pendencias'],
  assessoria: [...OV, 'releases', 'mailing', 'clipping', 'monitoramento', 'relatorios', 'pendencias'],
  audiovisual: [...OV, 'edicoes', 'midias', 'aprovacoes', 'publicacoes', 'analytics', 'pendencias', ...COMMON_IDS],
  revistas: [...OV, 'edicoes', 'materias', 'artes', 'publicacao', 'analytics', 'pendencias'],
  endomarketing: [...OV, 'campanhas', 'newsletters', 'comunicados', 'analytics', 'pendencias'],
  documentacao: [...OV, 'docs', 'pendencias'],
  gestao: [...VG, 'relatorios', 'processamentos', 'auditoria', ...COMMON_IDS],
  cedoc: [...OV, 'ingest', 'midias', 'arquivos', 'tarefas', 'processados', 'sistema', 'usuarios'],
  apresentador: [...OV, ...COMMON_IDS],
  locutor: [...OV, ...COMMON_IDS],
  sonoplasta: [...OV, ...COMMON_IDS],
  fotografo: [...OV, ...COMMON_IDS],
  motion_designer: [...OV, ...COMMON_IDS],
  cenografo: [...OV, ...COMMON_IDS],
  roteirista: [...OV, ...COMMON_IDS],
  revisor: [...OV, ...COMMON_IDS],
  tradutor: [...OV, ...COMMON_IDS],
  social_media: [...OV, ...COMMON_IDS],
  coordenador_comunicacao: [...OV, ...COMMON_IDS],
  juridico: [...OV, ...COMMON_IDS],
  ti_suporte: [...OV, ...COMMON_IDS],
};

const KEY = 'mm_role_subtabs_v1';

function readJSON(k, f) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch { return f; } }
function writeJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

const idsOf = (entry) => [entry.id, ...(entry.aliases || [])];

export function isTotalAccess(cargoId) {
  return ROLE_SUBTABS[cargoId] == null;
}

// Guia ativas de um cargo. Default = o conjunto do cargo; null só p/ admin total.
export function getActiveSubtabs(cargoId) {
  if (isTotalAccess(cargoId)) return null;
  const stored = readJSON(KEY, {})[cargoId];
  if (stored) {
    const hasOriginalWorkspace = stored.includes('workspace');
    const supportsWorkspace2 = (ROLE_SUBTABS[cargoId] || []).includes('workspace2');
    if (hasOriginalWorkspace && supportsWorkspace2 && !stored.includes('workspace2')) {
      return [...stored, 'workspace2'];
    }
    return stored;
  }
  return ROLE_SUBTABS[cargoId] || [];
}

export function setActiveSubtabs(cargoId, ids) {
  const all = readJSON(KEY, {});
  all[cargoId] = ids;
  writeJSON(KEY, all);
}

// Liga/desliga uma guia do universo no cargo (trata aliases junto).
export function toggleSubtab(cargoId, entry) {
  if (isTotalAccess(cargoId)) return;
  const ids = idsOf(entry);
  const current = getActiveSubtabs(cargoId) || [];
  const hasAny = ids.some((id) => current.includes(id));
  const next = hasAny ? current.filter((id) => !ids.includes(id)) : [...current, ...ids];
  setActiveSubtabs(cargoId, next);
}

// Filtra a lista de guias (com Icon) de uma página pelas guias ativas do cargo.
export function filterActiveSubtabs(cargoId, tabs) {
  const active = getActiveSubtabs(cargoId);
  if (active == null) return tabs;
  return tabs.filter((t) => active.includes(t.id));
}
