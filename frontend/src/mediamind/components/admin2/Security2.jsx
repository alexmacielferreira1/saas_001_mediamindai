import { useEffect, useState } from 'react';
import {
  AlertTriangle, CalendarClock, Clock3, FileClock, KeyRound,
  LockKeyhole, Mail, Monitor, Settings, ShieldCheck, UserRound,
  Users, X,
} from 'lucide-react';
import { outline, panel } from './ui/styles';

const roles = [
  ['Superadmin', 'Administradores da plataforma', true],
  ['Administrador', 'Administradores do sistema', true],
  ['Gestor de Acervo', 'Gestores de canal, bibliotecas e equipes', true],
  ['Usuário padrão', 'Demais usuários do sistema', false],
];

// Dados fictícios: aparecem somente na sessão local de demonstração (selo "demonstração explícita").
const DEMO = {
  sessions: [
    ['Windows', 'Chrome 126', '189.124.5.10', 'São Paulo, SP', 'Hoje 14:32'],
    ['MacOS', 'Safari 17', '200.18.33.21', 'Rio de Janeiro, RJ', 'Hoje 11:05'],
    ['iPhone', 'Safari Mobile', '189.124.5.10', 'São Paulo, SP', 'Hoje 09:18'],
    ['Windows', 'Edge 125', '177.22.11.90', 'Belo Horizonte, MG', 'Ontem 18:44'],
    ['Android', 'Chrome Mobile', '200.18.33.21', 'Rio de Janeiro, RJ', 'Ontem 16:21'],
  ],
  attempts: [
    ['03/10/2026 15:42', 'alex@mediamind.ai', '189.124.5.10', 'Sucesso', 'São Paulo, SP'],
    ['03/10/2026 14:21', 'marina@mediamind.ai', '201.33.12.44', 'Falha', 'Recife, PE'],
    ['03/10/2026 13:17', 'carlos@mediamind.ai', '177.22.11.90', 'Falha', 'Belo Horizonte, MG'],
    ['03/10/2026 11:05', 'ana@mediamind.ai', '200.18.33.21', 'Sucesso', 'Rio de Janeiro, RJ'],
    ['03/10/2026 09:48', 'rafael@mediamind.ai', '189.124.5.10', 'Sucesso', 'São Paulo, SP'],
  ],
  history: [
    ['03/10/2026 15:20', 'MFA ativado', 'marina@mediamind.ai', 'Autenticação em duas etapas ativada'],
    ['03/10/2026 14:12', 'Usuário bloqueado', 'sistema', 'Excesso de tentativas de login'],
    ['03/10/2026 11:30', 'Senha redefinida', 'carlos@mediamind.ai', 'Solicitação de redefinição de senha'],
    ['02/10/2026 16:44', 'Sessões encerradas', 'alex@mediamind.ai', 'Todas as sessões foram encerradas'],
    ['02/10/2026 10:05', 'Convite reenviado', 'admin@mediamind.ai', 'Convite reenviado para joao@mediamind.ai'],
  ],
  expiring: [
    ['Marina Alves', 'Produtora', 'Produção', '05/10/2026 (2 dias)', 'Expira em breve'],
    ['João Ribeiro', 'Revisor', 'Jornalismo', '10/10/2026 (7 dias)', 'Ativo'],
    ['Beatriz Santos', 'Social Media', 'Marketing', '15/10/2026 (12 dias)', 'Ativo'],
  ],
  invites: [
    ['João Ribeiro', 'joao@mediamind.ai', 'Revisor', 'Expira em 2 dias'],
    ['Fernanda Alves', 'fernanda@mediamind.ai', 'Editora', 'Expira em 6 dias'],
  ],
  mfaRate: { value: '78%', note: '24 de 31 usuários' },
  attemptsToday: { value: '5', note: '2 falharam' },
  password: [['Comprimento mínimo', '12 caracteres'], ['Complexidade', 'Maiúscula, minúscula, número e símbolo'], ['Validade', '90 dias'], ['Histórico', 'Últimas 5 senhas']],
  sessionPolicy: [['Tempo de inatividade', '30 minutos'], ['Sessões simultâneas', 'Até 5'], ['Dispositivos confiáveis', 'Permitidos']],
};

const NOT_INTEGRATED = 'Não integrado';
const NOT_INTEGRATED_DRAWERS = new Set(['mfa', 'sessions', 'session', 'end-all', 'attempts', 'history', 'expiring', 'access', 'password']);
const UNAVAILABLE_REASON = 'Requer endpoint no servidor; nenhuma alteração é simulada.';
const NOT_INTEGRATED_REASON = 'Ainda não integrado ao servidor: não há dados reais para mostrar.';

const policyTabs = ['Autenticação', 'Senha', 'Sessões', 'Bloqueios', 'Convites'];

function inviteRows(users) {
  return users
    .filter((user) => user.status === 'invited')
    .map((user) => [user.full_name || user.email, user.email, user.profile_name || user.tenant_role || '—', 'Validade não integrada']);
}

export default function Security2({ users = [], localDemo = false }) {
  const [activePolicy, setActivePolicy] = useState('Autenticação');
  const [drawer, setDrawer] = useState(null);
  const [sessions, setSessions] = useState(() => (localDemo ? DEMO.sessions : []));
  const [mfa, setMfa] = useState(() => roles.map((role) => role[2]));
  const [rules, setRules] = useState({ lockout: true, notify: true, suspicious: true, attempts: '5 tentativas', duration: '30 minutos' });
  const blocked = users.filter((user) => user.status === 'blocked').length;
  const invites = localDemo ? DEMO.invites : inviteRows(users);
  const data = {
    localDemo,
    sessions,
    invites,
    attempts: localDemo ? DEMO.attempts : [],
    history: localDemo ? DEMO.history : [],
    expiring: localDemo ? DEMO.expiring : [],
  };

  function openDrawer(title, type, payload) { setDrawer({ title, type, data: payload }); }
  function closeDrawer() { setDrawer(null); }
  function endSession(index) {
    setSessions((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setDrawer(null);
  }

  useEffect(() => {
    if (!drawer) return undefined;
    function closeOnEscape(event) { if (event.key === 'Escape') closeDrawer(); }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [drawer]);

  const sessionRows = sessions.map((row, index) => [
    ...row,
    <button
      key={`${row[0]}-${row[4]}`}
      type="button"
      onClick={() => openDrawer(`Sessão · ${row[0]}`, 'session', { row, index })}
      className="rounded-md border border-rose-700 px-3 py-1 text-xs text-rose-300 hover:bg-rose-950"
    >
      Encerrar
    </button>,
  ]);
  const expiringRows = data.expiring.map((row) => [
    ...row,
    <button
      key={row[0]}
      type="button"
      aria-label={`Detalhar acesso de ${row[0]}`}
      onClick={() => openDrawer(`Acesso de ${row[0]}`, 'access', row)}
      className="text-sky-300"
    >
      •••
    </button>,
  ]);

  return (
    <div className="relative space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-sky-400" size={34} />
            <h2 className="text-3xl font-bold text-white">Segurança</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">Gerencie políticas de segurança, autenticação, sessões e acessos ao sistema.</p>
        </div>
        <button type="button" className={`${outline} disabled:cursor-not-allowed disabled:opacity-50`} disabled={!localDemo} title={localDemo ? undefined : NOT_INTEGRATED_REASON} onClick={() => openDrawer('Auditoria de segurança', 'history')}>
          <FileClock className="mr-2 inline" size={15} />Ver auditoria de segurança
        </button>
      </header>

      {!localDemo && (
        <p role="note" className="rounded-lg border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
          Usuários bloqueados e convites vêm do tenant. MFA, sessões, tentativas de login, histórico, validade de acesso e
          políticas ainda não têm endpoint e aparecem como não integrados.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores de segurança">
        <Metric
          icon={ShieldCheck}
          label="MFA Ativo"
          disabled={!localDemo}
          value={localDemo ? DEMO.mfaRate.value : '—'}
          note={localDemo ? DEMO.mfaRate.note : NOT_INTEGRATED}
          tone="emerald"
          onClick={() => openDrawer('Configurar MFA', 'mfa')}
        />
        <Metric
          icon={Users}
          label="Usuários bloqueados"
          value={blocked}
          note={localDemo ? '0 tentativas hoje' : 'Contas com estado bloqueado'}
          tone="rose"
          onClick={() => openDrawer('Usuários bloqueados', 'blocked')}
        />
        <Metric
          icon={KeyRound}
          label="Convites pendentes"
          value={invites.length}
          note={localDemo ? 'Expiram em até 7 dias' : 'Validade não integrada'}
          tone="amber"
          onClick={() => { setActivePolicy('Convites'); openDrawer('Convites pendentes', 'invites'); }}
        />
        <Metric
          icon={Clock3}
          label="Sessões ativas"
          disabled={!localDemo}
          value={localDemo ? sessions.length : '—'}
          note={localDemo ? `Em ${sessions.length} dispositivos` : NOT_INTEGRATED}
          tone="sky"
          onClick={() => openDrawer('Sessões ativas', 'sessions')}
        />
        <Metric
          icon={AlertTriangle}
          label="Tentativas de login (24h)"
          disabled={!localDemo}
          value={localDemo ? DEMO.attemptsToday.value : '—'}
          note={localDemo ? DEMO.attemptsToday.note : NOT_INTEGRATED}
          tone="rose"
          onClick={() => openDrawer('Tentativas de login', 'attempts')}
        />
      </section>

      <div className="grid items-start gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <section className={panel}>
            <PanelHeader icon={Settings} title="Política de segurança" subtitle="Configure as regras de autenticação e segurança para os usuários." />
            <nav className="mx-3 grid grid-cols-5 overflow-hidden rounded-lg bg-slate-900/80" aria-label="Políticas de segurança">
              {policyTabs.map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActivePolicy(tab)}
                  className={`px-2 py-2.5 text-xs font-semibold transition ${activePolicy === tab ? 'bg-sky-400 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  {tab}
                </button>
              ))}
            </nav>
            <div className="p-3">
              <PolicyContent active={activePolicy} mfa={mfa} setMfa={setMfa} rules={rules} data={data} openDrawer={openDrawer} />
            </div>
          </section>

          <section className={panel}>
            <PanelHeader icon={ShieldCheck} title="Regras de bloqueio e proteção" subtitle="Configure regras automáticas para proteger o sistema." />
            <div className="px-3 pb-3">
              <RuleRow
                icon={LockKeyhole}
                title="Bloqueio por tentativas de login"
                description="Bloqueia usuário após tentativas consecutivas."
                selectValue={rules.attempts}
                options={['3 tentativas', '5 tentativas', '10 tentativas']}
                onSelect={(value) => setRules((old) => ({ ...old, attempts: value }))}
                checked={rules.lockout}
                onToggle={() => setRules((old) => ({ ...old, lockout: !old.lockout }))}
                disabled={!localDemo}
              />
              <RuleRow
                icon={Clock3}
                title="Tempo de bloqueio"
                description="Tempo de bloqueio após excesso de tentativas."
                selectValue={rules.duration}
                options={['15 minutos', '30 minutos', '1 hora']}
                onSelect={(value) => setRules((old) => ({ ...old, duration: value }))}
                checked={rules.lockout}
                onToggle={() => setRules((old) => ({ ...old, lockout: !old.lockout }))}
                disabled={!localDemo}
              />
              <RuleRow
                icon={Mail}
                title="Notificar administrador"
                description="Enviar alerta em tentativas suspeitas."
                checked={rules.notify}
                onToggle={() => setRules((old) => ({ ...old, notify: !old.notify }))}
                disabled={!localDemo}
              />
              <RuleRow
                icon={ShieldCheck}
                title="Bloquear IPs suspeitos"
                description="Bloqueio automático de IPs com atividade maliciosa."
                checked={rules.suspicious}
                onToggle={() => setRules((old) => ({ ...old, suspicious: !old.suspicious }))}
                disabled={!localDemo}
              />
              {!localDemo && <p className="pt-2 text-xs text-slate-500">Regras exibidas como referência: a política aplicada no login ainda não é configurável por esta tela.</p>}
            </div>
          </section>

          <TablePanel
            title="Acessos expirando"
            subtitle="Usuários com acesso temporário que expiram em breve."
            icon={CalendarClock}
            actionLabel="Ver todos"
            actionDisabled={!localDemo}
            onAction={() => openDrawer('Acessos expirando', 'expiring')}
            headers={['Usuário', 'Função', 'Equipe', 'Expiração', 'Status', 'Ações']}
            rows={expiringRows}
            emptyText="Validade de acesso ainda não integrada ao servidor."
          />
        </div>

        <div className="space-y-4">
          <TablePanel
            title="Sessões ativas"
            subtitle="Visualize e gerencie as sessões ativas no sistema."
            icon={Monitor}
            actionLabel="Ver todas as sessões"
            actionDisabled={!localDemo}
            onAction={() => openDrawer('Sessões ativas', 'sessions')}
            headers={['Dispositivo', 'Navegador', 'IP', 'Localização', 'Início da sessão', 'Ações']}
            rows={sessionRows}
            emptyText={localDemo ? 'Nenhuma sessão aberta nesta demonstração.' : 'Lista de sessões ainda não integrada. Para encerrar as sessões de uma pessoa, use Usuários › detalhe.'}
            footer={localDemo && (
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-rose-700 hover:text-rose-300"
                onClick={() => openDrawer('Encerrar todas as sessões', 'end-all')}
              >
                Encerrar todas as sessões
              </button>
            )}
          />
          <TablePanel
            title="Tentativas de login recentes"
            subtitle="Últimas tentativas de autenticação no sistema."
            icon={AlertTriangle}
            actionLabel="Ver todos os logs"
            actionDisabled={!localDemo}
            onAction={() => openDrawer('Tentativas de login', 'attempts')}
            headers={['Data e hora', 'Usuário', 'IP', 'Resultado', 'Localização']}
            rows={data.attempts.map((row) => row.map((cell, index) => (index === 3 ? <Status key={cell} value={cell} /> : cell)))}
            emptyText="Registro de tentativas de login ainda não integrado."
          />
          <TablePanel
            title="Histórico de segurança"
            subtitle="Principais eventos de segurança do sistema."
            icon={FileClock}
            actionLabel="Ver mais"
            actionDisabled={!localDemo}
            onAction={() => openDrawer('Auditoria de segurança', 'history')}
            headers={['Data e hora', 'Evento', 'Usuário', 'Detalhes']}
            rows={data.history}
            emptyText="Eventos de login e bloqueio ainda não são auditados pelo servidor."
          />
        </div>
      </div>

      {drawer && (
        <SecurityDrawer
          drawer={drawer}
          close={closeDrawer}
          data={data}
          setSessions={setSessions}
          endSession={endSession}
          mfa={mfa}
          setMfa={setMfa}
          blocked={users.filter((user) => user.status === 'blocked')}
        />
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, note, tone, onClick, disabled = false }) {
  const colors = { emerald: 'text-emerald-400', rose: 'text-rose-400', amber: 'text-amber-400', sky: 'text-sky-400' };
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={disabled ? NOT_INTEGRATED_REASON : undefined} className={`${panel} flex min-h-28 items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-500 disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:border-sky-900/70`}>
      <Icon className={colors[tone]} size={34} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-300">{label}</span>
        <strong className={`block text-3xl ${colors[tone]}`}>{value}</strong>
        <span className="block text-xs text-slate-500">{note}</span>
      </span>
    </button>
  );
}

function PanelHeader({ icon: Icon, title, subtitle, action: headerAction }) {
  return (
    <header className="flex items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 text-sky-400" size={23} />
        <div>
          <h3 className="font-bold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      {headerAction}
    </header>
  );
}

function PolicyContent({ active, mfa, setMfa, rules, data, openDrawer }) {
  const { localDemo } = data;
  if (active === 'Autenticação') {
    return (
      <div className="rounded-lg border border-slate-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-3">
          <div>
            <h3 className="font-bold">Autenticação em duas etapas (MFA)</h3>
            <p className="text-xs text-slate-500">Defina a obrigatoriedade do MFA por perfil.</p>
          </div>
          <button type="button" className={`${outline} disabled:cursor-not-allowed disabled:opacity-50`} disabled={!localDemo} title={localDemo ? undefined : NOT_INTEGRATED_REASON} onClick={() => openDrawer('Configurar MFA', 'mfa')}>Configurar MFA</button>
        </div>
        {roles.map((role, index) => (
          <div key={role[0]} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-slate-800/70 px-3 py-2.5 last:border-0">
            <div className="flex items-center gap-3">
              <UserRound className="text-sky-400" size={19} />
              <div>
                <p className="text-sm font-semibold">{role[0]}</p>
                <p className="text-xs text-slate-500">{role[1]}</p>
              </div>
            </div>
            <Status value={localDemo ? (mfa[index] ? 'Obrigatório' : 'Opcional') : NOT_INTEGRATED} />
            <Toggle
              checked={localDemo && mfa[index]}
              disabled={!localDemo}
              onChange={() => setMfa((current) => current.map((value, row) => (row === index ? !value : value)))}
              label={`MFA para ${role[0]}`}
            />
          </div>
        ))}
        <p className="border-t border-sky-900/60 bg-sky-950/30 px-3 py-2 text-xs text-sky-300">
          O MFA aumenta significativamente a segurança da conta e é altamente recomendado.
        </p>
      </div>
    );
  }
  const notIntegrated = (labels) => labels.map((label) => [label, NOT_INTEGRATED]);
  if (active === 'Senha') {
    return (
      <PolicyList
        title="Política de senha"
        description="Defina os requisitos aplicados às senhas do tenant."
        items={localDemo ? DEMO.password : notIntegrated(['Comprimento mínimo', 'Complexidade', 'Validade', 'Histórico'])}
        onOpen={localDemo ? () => openDrawer('Política de senha', 'password') : null}
      />
    );
  }
  if (active === 'Sessões') {
    return (
      <PolicyList
        title="Política de sessões"
        description="Controle duração, simultaneidade e encerramento automático."
        items={localDemo
          ? [['Sessões ativas', String(data.sessions.length)], ...DEMO.sessionPolicy]
          : notIntegrated(['Sessões ativas', 'Tempo de inatividade', 'Sessões simultâneas', 'Dispositivos confiáveis'])}
        onOpen={localDemo ? () => openDrawer('Sessões ativas', 'sessions') : null}
      />
    );
  }
  if (active === 'Bloqueios') {
    return (
      <PolicyList
        title="Política de bloqueios"
        description="Revise limites e respostas automáticas a acessos suspeitos."
        items={localDemo
          ? [['Tentativas permitidas', rules.attempts], ['Tempo de bloqueio', rules.duration], ['Notificar administrador', rules.notify ? 'Ativo' : 'Inativo'], ['Bloquear IPs suspeitos', rules.suspicious ? 'Ativo' : 'Inativo']]
          : notIntegrated(['Tentativas permitidas', 'Tempo de bloqueio', 'Notificar administrador', 'Bloquear IPs suspeitos'])}
        onOpen={() => openDrawer('Política de bloqueios', 'blocked')}
      />
    );
  }
  return (
    <PolicyList
      title="Política de convites"
      description="Gerencie validade, reenvio e cancelamento de convites."
      items={data.invites.length ? data.invites.map((item) => [item[0], `${item[2]} · ${item[3]}`]) : [['Convites pendentes', 'Nenhum']]}
      onOpen={() => openDrawer('Convites pendentes', 'invites')}
    />
  );
}

function PolicyList({ title, description, items, onOpen }) {
  return (
    <div className="rounded-lg border border-slate-800">
      <div className="flex items-start justify-between border-b border-slate-800 p-3">
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <button type="button" className={`${outline} disabled:cursor-not-allowed disabled:opacity-50`} disabled={!onOpen} title={onOpen ? undefined : NOT_INTEGRATED_REASON} onClick={onOpen || undefined}>Gerenciar</button>
      </div>
      {items.map(([label, value]) => (
        <button
          type="button"
          onClick={onOpen || undefined}
          disabled={!onOpen}
          key={label}
          className="flex w-full items-center justify-between border-b border-slate-800/70 px-3 py-3 text-left text-sm last:border-0 hover:bg-sky-950/20 disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span>{label}</span>
          <span className={value === NOT_INTEGRATED ? 'text-slate-500' : 'text-sky-300'}>{value}</span>
        </button>
      ))}
    </div>
  );
}

function RuleRow({ icon: Icon, title, description, selectValue, options, onSelect, checked, onToggle, disabled = false }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-slate-800/70 py-2.5 last:border-0">
      <div className="flex items-center gap-3">
        <Icon className="text-sky-400" size={20} />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {options ? (
        <select
          aria-label={title}
          value={selectValue}
          disabled={disabled}
          title={disabled ? UNAVAILABLE_REASON : undefined}
          onChange={(event) => onSelect(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs disabled:opacity-50"
        >
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : <span />}
      <Toggle checked={!disabled && checked} onChange={onToggle} label={title} disabled={disabled} />
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      title={disabled ? UNAVAILABLE_REASON : undefined}
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'bg-sky-400' : 'bg-slate-700'}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function TablePanel({ title, subtitle, icon, actionLabel, onAction, actionDisabled = false, headers, rows, footer, emptyText }) {
  return (
    <section className={panel}>
      <PanelHeader icon={icon} title={title} subtitle={subtitle} action={<button type="button" className={`${outline} disabled:cursor-not-allowed disabled:opacity-50`} disabled={actionDisabled} title={actionDisabled ? NOT_INTEGRATED_REASON : undefined} onClick={onAction}>{actionLabel}</button>} />
      <div className="overflow-x-auto px-3 pb-3">
        {rows.length ? (
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-sky-950/70 text-slate-300">
              <tr>{headers.map((header) => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-800/70 text-slate-300">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-500">{emptyText}</p>
        )}
        {footer && <div className="pt-3">{footer}</div>}
      </div>
    </section>
  );
}

function Status({ value }) {
  const good = ['Sucesso', 'Ativo', 'Obrigatório'].includes(String(value));
  const bad = ['Falha', 'Bloqueado'].includes(String(value));
  const cls = good ? 'bg-emerald-950 text-emerald-300 ring-emerald-800' : bad ? 'bg-rose-950 text-rose-300 ring-rose-800' : 'bg-slate-800 text-slate-300 ring-slate-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cls}`}>{value}</span>;
}

function SecurityDrawer({ drawer, close, data, setSessions, endSession, mfa, setMfa, blocked }) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/55 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <aside role="dialog" aria-modal="true" aria-label={drawer.title} className="h-full w-full max-w-xl animate-[slideIn_.22s_ease-out] overflow-y-auto border-l border-sky-800 bg-mm-drawer shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-mm-drawer/95 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-sky-400">Segurança 2</p>
            <h2 className="text-xl font-bold text-white">{drawer.title}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Fechar painel" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={20} /></button>
        </header>
        <div className="space-y-4 p-5">
          <p className="rounded-lg border border-sky-900 bg-sky-950/30 px-3 py-2 text-xs text-sky-300">
            {data.localDemo
              ? 'As alterações desta demonstração ficam somente nesta sessão local.'
              : 'Ações sem endpoint disponível permanecem em modo de revisão e não simulam persistência no servidor.'}
          </p>
          <DrawerContent drawer={drawer} data={data} setSessions={setSessions} endSession={endSession} mfa={mfa} setMfa={setMfa} close={close} blocked={blocked} />
        </div>
      </aside>
    </div>
  );
}

function DrawerContent({ drawer, data, setSessions, endSession, mfa, setMfa, close, blocked }) {
  const { sessions } = data;
  if (!data.localDemo && NOT_INTEGRATED_DRAWERS.has(drawer.type)) {
    return <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">Dados ainda não integrados ao servidor. Esta área será conectada quando o endpoint correspondente existir.</p>;
  }
  if (drawer.type === 'mfa') {
    return (
      <div className="space-y-3">
        {roles.map((role, index) => (
          <div key={role[0]} className="flex items-center justify-between rounded-xl border border-slate-800 p-4">
            <div><strong>{role[0]}</strong><p className="text-xs text-slate-500">{role[1]}</p></div>
            <Toggle checked={mfa[index]} onChange={() => setMfa((current) => current.map((value, row) => (row === index ? !value : value)))} label={`Configurar ${role[0]}`} />
          </div>
        ))}
      </div>
    );
  }
  if (drawer.type === 'sessions') {
    return (
      <div className="space-y-2">
        {sessions.map((row, index) => (
          <div key={`${row[0]}-${row[4]}`} className="flex items-center justify-between rounded-xl border border-slate-800 p-3">
            <div><strong>{row[0]} · {row[1]}</strong><p className="text-xs text-slate-500">{row[2]} · {row[3]} · {row[4]}</p></div>
            <button type="button" onClick={() => endSession(index)} className="rounded-lg border border-rose-700 px-3 py-2 text-xs text-rose-300">Encerrar</button>
          </div>
        ))}
        {sessions.length > 0 && <button type="button" onClick={() => setSessions([])} className="w-full rounded-lg bg-rose-600 px-4 py-3 text-sm font-bold text-white">Encerrar todas as sessões</button>}
      </div>
    );
  }
  if (drawer.type === 'session') {
    const { row, index } = drawer.data;
    return (
      <div className="space-y-4">
        <DetailRows rows={[['Dispositivo', row[0]], ['Navegador', row[1]], ['IP', row[2]], ['Localização', row[3]], ['Início', row[4]]]} />
        <button type="button" onClick={() => endSession(index)} className="w-full rounded-lg bg-rose-600 px-4 py-3 font-bold text-white">Encerrar esta sessão</button>
      </div>
    );
  }
  if (drawer.type === 'end-all') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-300">Esta ação encerra {sessions.length} sessões exibidas, mantendo apenas a sessão administrativa atual.</p>
        <button type="button" onClick={() => { setSessions([]); close(); }} className="w-full rounded-lg bg-rose-600 px-4 py-3 font-bold text-white">Confirmar encerramento</button>
      </div>
    );
  }
  if (drawer.type === 'invites') {
    if (!data.invites.length) return <p className="text-sm text-slate-400">Nenhum convite pendente neste tenant.</p>;
    return (
      <div className="space-y-3">
        {data.invites.map((item) => (
          <div key={item[1]} className="rounded-xl border border-slate-800 p-4">
            <strong>{item[0]}</strong>
            <p className="text-sm text-slate-400">{item[1]}</p>
            <p className="mt-1 text-xs text-amber-300">{item[2]} · {item[3]}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled title={UNAVAILABLE_REASON} className={`${outline} disabled:cursor-not-allowed disabled:opacity-50`}>Reenviar</button>
              <button type="button" disabled title={UNAVAILABLE_REASON} className="rounded-lg border border-rose-800 px-3 py-2 text-xs text-rose-300 disabled:cursor-not-allowed disabled:opacity-50">Cancelar</button>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (drawer.type === 'blocked') {
    if (!blocked.length) return <p className="text-sm text-slate-400">Nenhuma conta bloqueada neste tenant.</p>;
    return <DrawerTable headers={['Usuário', 'E-mail']} rows={blocked.map((user) => [user.full_name || user.email, user.email])} />;
  }
  if (drawer.type === 'attempts') return <DrawerTable headers={['Data', 'Usuário', 'Resultado']} rows={data.attempts.map((row) => [row[0], row[1], <Status key={row[0]} value={row[3]} />])} />;
  if (drawer.type === 'history') return <DrawerTable headers={['Data', 'Evento', 'Usuário']} rows={data.history.map((row) => row.slice(0, 3))} />;
  if (drawer.type === 'expiring') return <DrawerTable headers={['Usuário', 'Função', 'Expiração']} rows={data.expiring.map((row) => [row[0], row[1], row[3]])} />;
  if (drawer.type === 'access') {
    return (
      <div className="space-y-4">
        <DetailRows rows={[['Usuário', drawer.data[0]], ['Função', drawer.data[1]], ['Equipe', drawer.data[2]], ['Expiração', drawer.data[3]], ['Status', drawer.data[4]]]} />
        <button type="button" disabled title={UNAVAILABLE_REASON} className={`${outline} disabled:cursor-not-allowed disabled:opacity-50`}>Renovar acesso</button>
      </div>
    );
  }
  if (drawer.type === 'password') return <DetailRows rows={DEMO.password} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">Revise os detalhes e os usuários afetados sem sair desta página.</p>
      <DetailRows rows={[['Estado', 'Revisão administrativa'], ['Escopo', 'Tenant atual'], ['Auditoria', 'Registrada ao persistir']]} />
    </div>
  );
}

function DetailRows({ rows }) {
  return (
    <dl className="divide-y divide-slate-800 rounded-xl border border-slate-800">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 p-3">
          <dt className="text-sm text-slate-500">{label}</dt>
          <dd className="text-right text-sm text-slate-200">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DrawerTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-sky-950/60"><tr>{headers.map((header) => <th key={header} className="p-3">{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-800">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="p-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
