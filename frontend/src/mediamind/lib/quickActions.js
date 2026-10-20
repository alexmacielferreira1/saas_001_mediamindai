// Fonte única de verdade das ações de criação rápidas — compartilhada entre
// o grupo "Ações" da Command Palette e o botão "Novo" do Topbar.
//
// Cada ação declara:
//  - id, label, icon, path, param (roteamento via ?novo= quando há handler)
//  - to (opcional): destino exato quando a ação só navega (rótulo "Ir para …");
//    tem prioridade sobre path/param em runAction
//  - group: categoria para agrupar no menu
//  - roles: '*' = todos os papéis logados; array = papéis autorizados a criar
//  - tab (opcional): aba do Corp exigida (verificado via filterTabsForUser)
//
// Princípio RBAC: negar por padrão. Papéis não listados em `roles` não veem a
// ação. Admin aparece em todos os conjuntos. O botão "Novo" e a Command
// Palette usam canRunAction() — mesma regra, nenhum itemSemPermissão.
import {
  Plus, Layers, Scissors, FileText, Calendar, Film, Send,
  Newspaper, BarChart3, Users, Cpu, Database, Zap, ClipboardList, Settings,
  Briefcase, Hash, Search,
} from 'lucide-react';
import { CORP_TABS } from './corpTabs';
import { filterTabsForUser } from './permissions';

// Conjuntos de papéis por domínio (admin sempre incluído).
const ADMIN = ['admin'];
const PRODUCAO = ['admin', 'producer', 'produtor_reportagem', 'diretor_programa'];
const EDITORIAL = ['admin', 'journalist', 'roteirista', 'reporter', 'produtor_reportagem'];
const EDICAO = ['admin', 'editor', 'motion_designer', 'audiovisual'];
const REVISAO = ['admin', 'revisor', 'editor', 'qualidade'];
const SOCIAL = ['admin', 'social_media', 'coordenador_comunicacao'];
const ASSESSORIA = ['admin', 'assessoria', 'journalist'];
const INGEST = ['admin', 'cedoc', 'ti_suporte'];
const TAREFAS = ['admin', 'producer', 'diretor_programa', 'coordenador_comunicacao', 'gestao'];

// Ordem canônica dos grupos no menu.
export const GROUPS = [
  { id: 'producao', label: 'Produção & Conteúdo' },
  { id: 'acervo', label: 'Acervo & Ingest' },
  { id: 'edicao', label: 'Edição & Cortes' },
  { id: 'publicacao', label: 'Publicação & Social' },
  { id: 'comunicacao', label: 'Comunicação & Assessoria' },
  { id: 'gestao', label: 'Gestão & Relatórios' },
  { id: 'sistema', label: 'Sistema' },
];

export const ACTIONS = [
  // Produção & Conteúdo
  { id: 'nova_producao', label: 'Nova produção', icon: Plus, group: 'producao', path: '/corp', param: 'producao', tab: 'producao', roles: PRODUCAO, entity: 'Produção' },
  { id: 'novo_roteiro', label: 'Ir para o Workspace (roteiro)', icon: FileText, group: 'producao', path: '/workspace', roles: EDITORIAL, entity: 'Roteiro' },
  { id: 'nova_gravacao', label: 'Novo agendamento de gravação', icon: Calendar, group: 'producao', path: '/corp', param: 'producao', tab: 'producao', roles: PRODUCAO, entity: 'Gravação' },
  { id: 'novo_briefing', label: 'Novo briefing', icon: ClipboardList, group: 'producao', path: '/corp', param: 'producao', tab: 'producao', roles: PRODUCAO, entity: 'Briefing' },

  // Acervo & Ingest
  { id: 'novo_pacote', label: 'Novo pacote de ingest', icon: Layers, group: 'acervo', path: '/ingest', param: 'pacote', roles: INGEST, entity: 'Pacote de ingest' },
  { id: 'ingest_express', label: 'Ingest express', icon: Zap, group: 'acervo', path: '/ingest', roles: INGEST, entity: 'Ingest expresso' },
  { id: 'nova_biblioteca', label: 'Ir para o Acervo (bibliotecas)', icon: Database, group: 'acervo', path: '/acervo', roles: ADMIN, entity: 'Biblioteca' },
  { id: 'processamento_ia', label: 'Ir para Gestão (processamentos de IA)', icon: Cpu, group: 'acervo', path: '/management', roles: ['admin', 'ti_suporte'], entity: 'Processamento de IA' },

  // Edição & Cortes
  { id: 'nova_publicacao', label: 'Novo corte com IA', icon: Scissors, group: 'edicao', path: '/social', param: 'publicacao', roles: '*', entity: 'Corte' },
  { id: 'nova_edicao', label: 'Ir para Edição de vídeo', icon: Film, group: 'edicao', path: '/corp', param: 'editor_video', tab: 'editor_video', to: '/corp?tab=editor_video', roles: EDICAO, entity: 'Edição' },
  { id: 'nova_revisao', label: 'Ir para Revisão', icon: FileText, group: 'edicao', path: '/corp', param: 'revisor', to: '/corp?tab=revisor', roles: REVISAO, entity: 'Revisão' },
  { id: 'nova_pesquisa', label: 'Nova pesquisa no acervo', icon: Search, group: 'edicao', path: '/search', roles: '*', entity: 'Busca' },

  // Publicação & Social
  { id: 'publicar', label: 'Ir para Redes sociais', icon: Send, group: 'publicacao', path: '/social', roles: SOCIAL, entity: 'Publicação' },
  { id: 'agendar_publicacao', label: 'Ir para Redes sociais (agendamento)', icon: Calendar, group: 'publicacao', path: '/social', roles: SOCIAL, entity: 'Agendamento' },

  // Comunicação & Assessoria
  { id: 'novo_release', label: 'Ir para Assessoria (releases)', icon: Newspaper, group: 'comunicacao', path: '/corp', param: 'assessoria', tab: 'assessoria', to: '/corp?tab=assessoria', roles: ASSESSORIA, entity: 'Release' },
  { id: 'novo_clipping', label: 'Ir para Assessoria (clipping)', icon: Newspaper, group: 'comunicacao', path: '/corp', param: 'assessoria', tab: 'assessoria', to: '/corp?tab=assessoria', roles: ASSESSORIA, entity: 'Clipping' },
  { id: 'nova_mencao', label: 'Ir para Assessoria (menções)', icon: Hash, group: 'comunicacao', path: '/corp', param: 'assessoria', tab: 'assessoria', to: '/corp?tab=assessoria', roles: ASSESSORIA, entity: 'Menção' },

  // Gestão & Relatórios
  { id: 'novo_relatorio', label: 'Ir para Gestão (relatórios)', icon: BarChart3, group: 'gestao', path: '/management', to: '/management?tab=reports', roles: ADMIN, entity: 'Relatório' },
  { id: 'gestao_equipe', label: 'Gestão de equipe e acessos', icon: Users, group: 'gestao', path: '/corp', param: 'admin_acessos', tab: 'admin_acessos', to: '/corp?tab=admin_acessos', roles: ADMIN, entity: 'Acessos' },
  { id: 'nova_tarefa', label: 'Ir para o Workspace (tarefas)', icon: ClipboardList, group: 'gestao', path: '/workspace', roles: TAREFAS, entity: 'Tarefa' },

  // Sistema
  { id: 'acesso_ia', label: 'Ir para Gestão de acessos (IA)', icon: Settings, group: 'sistema', path: '/corp', param: 'admin_acessos', tab: 'admin_acessos', to: '/corp?tab=admin_acessos', roles: ADMIN, entity: 'Acesso IA' },
  { id: 'nova_empresa', label: 'Ir para Gestão (empresas)', icon: Briefcase, group: 'sistema', path: '/management', roles: ADMIN, entity: 'Empresa' },
];

export function getAction(id) {
  return ACTIONS.find((a) => a.id === id) || null;
}

// canRunAction(action, user): true se o usuário logado pode ver/executar a ação.
//  1) Porta por papel (roles): '*' = qualquer logado; array = só os listados.
//  2) Porta por aba do Corp (tab): se a ação exige uma aba, o usuário precisa
//     ter acesso a ela (filterTabsForUser — respeita overrides individuais).
export function canRunAction(action, user) {
  if (!action || !user) return false;
  if (user.role === 'superadmin') return true;
  if (Array.isArray(action.roles) && !action.roles.includes(user.role)) return false;
  if (action.tab) {
    const allowed = new Set(filterTabsForUser(CORP_TABS, user).map((t) => t.id));
    if (!allowed.has(action.tab)) return false;
  }
  return true;
}

// Ações visíveis para um usuário (botão "Novo" + Command Palette usam isto).
export function actionsForUser(user) {
  return ACTIONS.filter((a) => canRunAction(a, user));
}

// runAction navega para ${path}?novo=${param} quando a ação tem param; senão
// só navega para path. O drawer de criação já existente na página-alvo lê o
// param e abre. Não duplica formulários.
export function runAction(actionId, navigate) {
  const a = getAction(actionId);
  if (!a || !navigate) return;
  if (a.to) { navigate(a.to); return; }
  navigate(a.param ? `${a.path}?novo=${a.param}` : a.path);
}

// Mapeia uma ação para a aba do Corp que ela exige (ou null se não for Corp).
export function tabForAction(a) {
  if (!a) return null;
  return a.tab || null;
}
