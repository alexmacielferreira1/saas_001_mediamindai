import {
  Archive, Blocks, ClipboardList, ContactRound, Database, FileInput, FolderKanban,
  KeyRound, LayoutDashboard, LockKeyhole, PlugZap, Settings, UserCog, Users, UsersRound,
} from 'lucide-react';

export const CORE_TABS = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'users', label: 'Usuários', icon: Users },
  { key: 'access', label: 'Acessos por Função', icon: UserCog },
  { key: 'profiles', label: 'Perfis e Funções', icon: ContactRound },
  { key: 'permissions', label: 'Permissões', icon: KeyRound },
  { key: 'teams', label: 'Equipes', icon: UsersRound },
  { key: 'forms', label: 'Formulários', icon: ClipboardList },
  { key: 'imports', label: 'Importações', icon: FileInput },
  { key: 'security', label: 'Segurança', icon: LockKeyhole },
];

export const RELATED_TABS = [
  { key: 'archive', label: 'Acervo', icon: Archive },
  { key: 'management', label: 'Gestão', icon: FolderKanban },
  { key: 'registry', label: 'Telas e Módulos', icon: Blocks },
  { key: 'records', label: 'Cadastros', icon: Database },
  { key: 'integrations', label: 'Integrações', icon: PlugZap },
  { key: 'settings', label: 'Configurações', icon: Settings },
];

export const ALL_TABS = [...CORE_TABS, ...RELATED_TABS];

// Abas que exibem o aviso de dados de demonstração (PreviewNotice): nelas o
// selo "Dados reais…" do cabeçalho seria contraditório e fica oculto.
export const DEMO_DATA_TABS = new Set(['teams', 'forms', 'imports', 'registry', 'records', 'integrations']);
