import React from 'react';
import { Loader2, FlaskConical, Search } from 'lucide-react';

// Panel — container padrão de seção
export function Panel({ title, children, right }) {
  return (
    <section className="mm-panel">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="mm-panel-title !mb-0">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// Stat — card de estatística
export function Stat({ title, value, icon: Icon, tone = 'default' }) {
  const toneClasses = {
    default: 'text-slate-100',
    sky: 'text-sky-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    violet: 'text-violet-300',
  };
  return (
    <div className="mm-panel mm-card-hover">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        {Icon && <Icon size={14} />}
        {title}
      </p>
      <h3 className={`mt-2 text-2xl font-bold ${toneClasses[tone]}`}>{value}</h3>
    </div>
  );
}

// Tabs — barra de abas
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-sky-500 text-slate-950'
                : 'border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {Icon && <Icon size={15} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// Loading — estado de carregamento
export function Loading({ label = 'Carregando...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  );
}

// MockBanner — selo de protótipo/dados de exemplo
export function MockBanner({ note }) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
      <FlaskConical size={14} className="shrink-0" />
      <span>
        Protótipo com dados de exemplo — backend ainda não conectado a esta tela.
        {note ? ` ${note}` : ''}
      </span>
    </div>
  );
}

// Badge — selo de status
export function Badge({ children, tone = 'info' }) {
  return <span className={`mm-badge mm-badge-${tone}`}>{children}</span>;
}

// InfoRow — linha label: valor
export function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-200">{value}</span>
    </div>
  );
}

// SearchInput — campo de busca
export function SearchInput({ placeholder = 'Buscar...', value, onChange, className = '', ...rest }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-700 bg-slate-950/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500"
        {...rest}
      />
    </div>
  );
}

// Button — botão reutilizável
export function Button({ variant = 'primary', size = 'md', icon, loading = false, disabled, children, className = '', ...rest }) {
  const variants = {
    primary: 'bg-sky-500 text-slate-950 hover:bg-sky-400',
    secondary: 'border border-slate-700 text-slate-300 hover:bg-slate-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
    ghost: 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// SideItem — item de menu lateral
export function SideItem({ label, badge, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
        active ? 'bg-sky-500 text-slate-950' : 'bg-slate-950/60 text-slate-400 hover:bg-slate-800'
      }`}
    >
      <span>{label}</span>
      {badge && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs">{badge}</span>}
    </button>
  );
}

// EmptyState — estado vazio
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {Icon && <Icon size={40} className="text-slate-600" />}
      <div>
        <p className="font-semibold text-slate-300">{title}</p>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// statusBadge — helper para mapear status → Badge
export function StatusBadge({ status, labels }) {
  const map = {
    // IAcervo Corp
    em_producao: { tone: 'pending', label: 'Em produção' },
    gravado: { tone: 'info', label: 'Gravado' },
    em_edicao: { tone: 'info', label: 'Em edição' },
    aguardando_aprovacao: { tone: 'pending', label: 'Aguardando aprovação' },
    aprovado: { tone: 'success', label: 'Aprovado' },
    programado: { tone: 'info', label: 'Programado' },
    rascunho: { tone: 'pending', label: 'Rascunho' },
    // Assets
    reviewed: { tone: 'success', label: 'Revisado' },
    indexed: { tone: 'info', label: 'Indexado' },
    processing: { tone: 'info', label: 'Processando' },
    reviewing: { tone: 'info', label: 'Em revisão' },
    pending: { tone: 'pending', label: 'Pendente' },
    failed: { tone: 'error', label: 'Falha' },
    error: { tone: 'error', label: 'Erro' },
    archived: { tone: 'error', label: 'Arquivado' },
    // Tasks
    not_started: { tone: 'pending', label: 'Não iniciado' },
    in_progress: { tone: 'info', label: 'Em andamento' },
    delivered: { tone: 'violet', label: 'Entregue' },
    approved: { tone: 'success', label: 'Aprovado' },
    // Clips
    draft: { tone: 'pending', label: 'Rascunho' },
    ready: { tone: 'violet', label: 'Pronto' },
    sent_to_publish: { tone: 'success', label: 'Enviado p/ publicar' },
    // Publications
    published: { tone: 'success', label: 'Publicado' },
    pending_review: { tone: 'pending', label: 'Aguardando revisão' },
    scheduled: { tone: 'info', label: 'Agendado' },
    // Ingest
    queued: { tone: 'pending', label: 'Na fila' },
    completed: { tone: 'success', label: 'Concluído' },
    // Projects
    active: { tone: 'info', label: 'Ativo' },
    // Libraries
    warning: { tone: 'pending', label: 'Atenção' },
    // Misc
    ok: { tone: 'success', label: 'OK' },
  };
  const cfg = map[status] || (labels?.[status] ? { tone: 'info', label: labels[status] } : { tone: 'info', label: status });
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}