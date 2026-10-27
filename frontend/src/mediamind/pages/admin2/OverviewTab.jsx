import {
  AlertTriangle, ArrowRight, Bell, CheckCircle2, ChevronRight, Clock3, Database, FileText,
  Info, KeyRound, Lock, Mail, OctagonAlert, Settings, ShieldCheck, UserPlus, Users, UsersRound, Zap,
} from 'lucide-react';
import { panel } from '../../components/admin2/ui/styles';

// Visão Geral no layout da referência 16: seis indicadores, ações rápidas, alertas,
// últimas ações e status de segurança. Só dados reais; o que não tem fonte aparece como "—".

// Valores ainda sem fonte no servidor: só aparecem na sessão local de demonstração.
const DEMO_ONLY = { teams: 7, forms: 9, imports: 4 };
const NOT_INTEGRATED = 'Não integrado';
const UNAVAILABLE_REASON = 'Requer endpoint no servidor; nenhuma ação é simulada.';

const AUDIT_LABELS = {
  'user.suspended': 'suspendeu o usuário',
  'user.reactivated': 'reativou o usuário',
  'user.sessions_revoked': 'encerrou as sessões do usuário',
  'settings.updated': 'atualizou as configurações da organização',
  'membership.role_changed': 'alterou a função de um acesso',
  'membership.screens_changed': 'alterou as telas de um acesso',
  'membership.permission_group_changed': 'alterou o perfil de um acesso',
  'permission_group.created': 'criou um perfil',
  'permission_group.updated': 'atualizou um perfil',
  'permission_group.deactivated': 'desativou um perfil',
  'record.created': 'criou um registro',
  'record.updated': 'atualizou um registro',
  'records.bulk_created': 'importou registros',
};

export function auditLabel(action = '') {
  return AUDIT_LABELS[action] || action.replaceAll('.', ' ') || 'realizou uma ação administrativa';
}

export function timeAgo(value, now = Date.now()) {
  const time = value ? new Date(value).getTime() : NaN;
  if (Number.isNaN(time)) return 'horário não informado';
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Há 1 dia' : `Há ${days} dias`;
}

function activityIcon(action = '') {
  if (action.startsWith('user.')) return UserPlus;
  if (action.startsWith('permission_group') || action.startsWith('membership')) return Users;
  if (action.startsWith('records')) return Database;
  if (action.startsWith('settings')) return Settings;
  return FileText;
}

export default function OverviewTab({ payload, groups, groupsAvailable = true, activity, activityAvailable = true, onOpenTab, fallbackKind }) {
  const demo = fallbackKind === 'local-demo';
  const real = !fallbackKind;
  const count = (status) => payload.items.filter((item) => item.status === status).length;
  const activeUsers = count('active');
  const invited = count('invited');
  const suspended = count('suspended');
  const blocked = count('blocked');
  const names = new Map(payload.items.map((user) => [user.id, user.full_name || user.email]));

  // Sem sessão real (sem permissão, indisponível) a lista vem vazia: não é "zero", é "não verificado".
  const unverified = Boolean(fallbackKind) && !demo;
  const shown = (value) => (unverified ? '—' : value);
  const unverifiedNote = unverified ? 'Não verificado' : null;
  const indicators = [
    { title: 'Usuários ativos', value: shown(activeUsers), note: unverifiedNote, icon: Users, link: 'Ver usuários', open: () => onOpenTab('users', { status: 'active' }) },
    { title: 'Convites pendentes', value: shown(invited), note: unverifiedNote, icon: Mail, link: 'Ver convites', open: () => onOpenTab('users', { status: 'invited' }) },
    {
      title: 'Perfis',
      value: unverified || !groupsAvailable ? '—' : groups.length,
      note: unverified || !groupsAvailable ? 'Não verificado' : null,
      icon: ShieldCheck,
      link: 'Ver perfis',
      open: () => onOpenTab('profiles'),
    },
    { title: 'Equipes', value: demo ? DEMO_ONLY.teams : '—', note: demo ? null : NOT_INTEGRATED, icon: UsersRound, link: 'Ver equipes', open: () => onOpenTab('teams') },
    { title: 'Formulários ativos', value: demo ? DEMO_ONLY.forms : '—', note: demo ? null : NOT_INTEGRATED, icon: FileText, link: 'Ver formulários', open: () => onOpenTab('forms') },
    { title: 'Importações no mês', value: demo ? DEMO_ONLY.imports : '—', note: demo ? null : NOT_INTEGRATED, icon: Database, link: 'Ver importações', open: () => onOpenTab('imports') },
  ];

  // Sem sessão real (demo, indisponível, sem permissão) as duas primeiras ações só navegam.
  const quickActions = [
    fallbackKind
      ? { title: 'Gerenciar usuários', icon: UserPlus, open: () => onOpenTab('users') }
      : { title: 'Novo usuário', icon: UserPlus, unavailable: true },
    fallbackKind
      ? { title: 'Revisar convites', icon: Mail, open: () => onOpenTab('users', { status: 'invited' }) }
      : { title: 'Convidar usuário', icon: Mail, unavailable: true },
    // A criação de perfil ainda não tem tela (Fase 3.5); com sessão real o atalho fica indisponível.
    real
      ? { title: 'Novo perfil', icon: ShieldCheck, unavailable: true }
      : { title: 'Ver perfis', icon: ShieldCheck, open: () => onOpenTab('profiles') },
    real
      ? { title: 'Nova importação', icon: Database, unavailable: true }
      : { title: 'Nova importação', icon: Database, open: () => onOpenTab('imports') },
    real
      ? { title: 'Novo formulário', icon: FileText, unavailable: true }
      : { title: 'Novo formulário', icon: FileText, open: () => onOpenTab('forms') },
  ];

  const teamAlert = { tone: 'sky', text: demo ? '1 usuário ainda não está vinculado a uma equipe' : 'Vínculo com equipes ainda não integrado', open: () => onOpenTab('teams') };
  const alerts = unverified ? [
    { tone: 'sky', text: 'Convites, bloqueios e acessos não verificados: os dados de usuários não carregaram', open: () => onOpenTab('users') },
    teamAlert,
  ] : [
    invited
      ? { tone: 'amber', text: `${invited} convite(s) pendente(s)`, open: () => onOpenTab('users', { status: 'invited' }) }
      : { tone: 'emerald', text: 'Nenhum convite pendente', open: () => onOpenTab('users', { status: 'invited' }) },
    blocked
      ? { tone: 'rose', text: `${blocked} conta(s) bloqueada(s)`, open: () => onOpenTab('users', { status: 'blocked' }) }
      : { tone: 'emerald', text: 'Nenhuma conta bloqueada no tenant', open: () => onOpenTab('users', { status: 'blocked' }) },
    suspended
      ? { tone: 'amber', text: `${suspended} acesso(s) temporário(s) exigem revisão`, open: () => onOpenTab('users', { status: 'suspended' }) }
      : { tone: 'emerald', text: 'Nenhum acesso temporário pendente', open: () => onOpenTab('users', { status: 'suspended' }) },
    teamAlert,
  ];

  let auditStatus = 'Operacional';
  if (fallbackKind && !demo) auditStatus = 'Indisponível';
  else if (!activityAvailable) auditStatus = 'Não verificada';
  const security = [
    { icon: Lock, title: 'MFA para administradores', description: 'Autenticação multifator obrigatória', value: demo ? 'Ativo' : NOT_INTEGRATED },
    { icon: Zap, title: 'Sessões suspeitas', description: demo ? 'Nenhuma atividade suspeita nas últimas 24 horas' : 'Monitoramento de sessões ainda sem endpoint', value: demo ? '0' : NOT_INTEGRATED },
    { icon: KeyRound, title: 'Política de senha', description: 'Requisitos aplicados às senhas da empresa', value: demo ? 'Conforme' : NOT_INTEGRATED },
    { icon: ShieldCheck, title: 'Auditoria administrativa', description: 'Registro das ações administrativas do tenant', value: auditStatus },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {indicators.map((item) => <Indicator key={item.title} {...item} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Card icon={Zap} title="Ações rápidas" subtitle="Acesse as tarefas mais comuns da administração.">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-3">
            {quickActions.map((item) => <QuickAction key={item.title} {...item} />)}
          </div>
        </Card>
        <Card icon={Bell} title="Alertas administrativos" subtitle="Fique atento aos itens que precisam de sua atenção.">
          <div className="space-y-2">{alerts.map((item) => <AlertRow key={item.text} {...item} />)}</div>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Card
          icon={Clock3}
          title="Últimas ações administrativas"
          subtitle="Acompanhe as ações recentes realizadas na plataforma."
          action={<LinkButton onClick={() => onOpenTab('management', { managementTab: 'auditoria' })}>Ver histórico</LinkButton>}
        >
          {activity.length ? (
            <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
              {activity.slice(0, 6).map((item) => {
                const Icon = activityIcon(item.action);
                return (
                  <li key={item.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <Icon size={18} className="shrink-0 text-sky-400" aria-hidden="true" />
                    <p className="min-w-0 flex-1 text-slate-300">
                      <strong className="font-semibold text-slate-100">{names.get(item.user_id) || 'Sistema'}</strong>{' '}
                      {auditLabel(item.action)}
                      {item.entity_type && <span className="text-slate-500"> · {item.entity_type}</span>}
                    </p>
                    <span className="shrink-0 text-xs text-slate-500">{timeAgo(item.created_date)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-sm text-slate-500">Nenhuma ação administrativa registrada.</p>
          )}
        </Card>
        <Card icon={ShieldCheck} title="Status de segurança" subtitle="Visão geral da segurança da sua organização.">
          <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
            {security.map((item) => <SecurityRow key={item.title} {...item} />)}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, subtitle, action, children }) {
  return (
    <section className={`${panel} p-4`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon size={22} className="mt-0.5 shrink-0 text-sky-400" aria-hidden="true" />
          <div>
            <h3 className="font-bold text-slate-100">{title}</h3>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function IconBox({ icon: Icon }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-950/70 text-sky-300 ring-1 ring-sky-800/70">
      <Icon size={24} aria-hidden="true" />
    </span>
  );
}

function Indicator({ title, value, note, icon, link, open }) {
  return (
    <button type="button" onClick={open} className={`${panel} group flex items-start gap-3 p-4 text-left transition hover:border-sky-500`}>
      <IconBox icon={icon} />
      <span className="min-w-0">
        <span className="block text-sm text-slate-300">{title}</span>
        <strong className="mt-1 block text-3xl font-bold text-slate-50">{value}</strong>
        {note && <span className="block text-xs text-slate-500">{note}</span>}
        <span className="mt-1 flex items-center gap-1 text-xs font-medium text-sky-400 group-hover:text-sky-300">
          {link} <ArrowRight size={13} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

function QuickAction({ title, icon: Icon, open, unavailable }) {
  return (
    <button
      type="button"
      onClick={open}
      disabled={unavailable}
      title={unavailable ? UNAVAILABLE_REASON : undefined}
      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-sky-900/70 bg-sky-950/40 p-3 text-center transition hover:border-sky-500 hover:bg-sky-950/70 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-sky-900/70 disabled:hover:bg-sky-950/40"
    >
      <Icon size={24} className="text-sky-300" aria-hidden="true" />
      <span className="text-sm font-semibold leading-tight text-slate-100">{title}</span>
      {unavailable && <span className="text-[10px] text-slate-500">Requer backend</span>}
    </button>
  );
}

const ALERT_STYLES = {
  amber: ['border-amber-900/70 text-amber-300', AlertTriangle],
  rose: ['border-rose-900/70 text-rose-300', OctagonAlert],
  sky: ['border-sky-900/70 text-sky-300', Info],
  emerald: ['border-emerald-900/70 text-emerald-300', CheckCircle2],
};

function AlertRow({ tone, text, open }) {
  const [classes, Icon] = ALERT_STYLES[tone];
  return (
    <button type="button" onClick={open} className={`flex w-full items-center gap-3 rounded-lg border bg-slate-950/60 px-3 py-2.5 text-left text-sm transition hover:bg-slate-900 ${classes}`}>
      <Icon size={18} className="shrink-0" aria-hidden="true" />
      <span className="flex-1">{text}</span>
      <ChevronRight size={16} className="text-slate-500" aria-hidden="true" />
    </button>
  );
}

function SecurityRow({ icon: Icon, title, description, value }) {
  const good = ['Ativo', 'Operacional', 'Conforme', '0'].includes(value);
  const pill = good
    ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300'
    : 'border-slate-700 bg-slate-900 text-slate-400';
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Icon size={20} className="shrink-0 text-sky-400" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
      <span className={`shrink-0 rounded-md border px-3 py-1 text-xs font-semibold ${pill}`}>{value}</span>
    </li>
  );
}

function LinkButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300">
      {children} <ArrowRight size={13} aria-hidden="true" />
    </button>
  );
}
