import React from 'react';
import { Loader2, FlaskConical, Search, AlertTriangle } from 'lucide-react';

// ============================================================================
// Kit de UI canônico do MediaMind AI / IAcervo Corp.
// Padrão de referência: camada IAcervo Corp (estilo dark, bordas slate-800,
// bg slate-900/40). Todos os componentes compartilhados moram aqui — os
// módulos legados (ui.jsx, RoleShared.jsx, CorpPanel.jsx) reexportam a partir
// deste para manter imports existentes funcionando.
// ============================================================================

// --- Panel ---------------------------------------------------------------
// Container de seção. title + action no cabeçalho (estilo Corp).
export function Panel({ title, action, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/40 p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// --- PanelScroll ---------------------------------------------------------
// Painel com cabeçalho fixo e corpo rolável (usado em layouts split).
export function PanelScroll({ title, action, children, className = '' }) {
  return (
    <div className={`flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
          {action}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

// --- StatCard ------------------------------------------------------------
export function StatCard({ label, value, tone, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {Icon && <Icon size={12} />}
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${tone || 'text-slate-100'}`}>{value}</p>
    </div>
  );
}

// --- SubTabsBar ----------------------------------------------------------
// Barra de abas canônica. Items: { id, name, Icon }.
export function SubTabsBar({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-2">
      {tabs.map((t) => {
        const Icon = t.Icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
              active === t.id ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {Icon && <Icon size={14} />}
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

// --- StatusBadge ---------------------------------------------------------
// API unificada: aceita map/labels opcionais (estilo Corp roles) e cai num
// mapa canônico PT-BR quando omitidos (compatível com chamadas antigas).
const CANON_STATUS = {
  // Corp — produção
  em_producao: 'bg-amber-500/15 text-amber-300|Em produção',
  gravado: 'bg-sky-500/15 text-sky-300|Gravado',
  em_edicao: 'bg-violet-500/15 text-violet-300|Em edição',
  aguardando_aprovacao: 'bg-amber-500/15 text-amber-300|Aguardando aprovação',
  aprovado: 'bg-emerald-500/15 text-emerald-300|Aprovado',
  programado: 'bg-sky-500/15 text-sky-300|Programado',
  rascunho: 'bg-slate-500/15 text-slate-300|Rascunho',
  publicado: 'bg-emerald-500/15 text-emerald-300|Publicado',
  finalizado: 'bg-emerald-500/15 text-emerald-300|Finalizado',
  // Tarefas
  pendente: 'bg-amber-500/15 text-amber-300|Pendente',
  em_andamento: 'bg-amber-500/15 text-amber-300|Em andamento',
  concluido: 'bg-emerald-500/15 text-emerald-300|Concluído',
  concluida: 'bg-emerald-500/15 text-emerald-300|Concluída',
  aberta: 'bg-sky-500/15 text-sky-300|Aberta',
  // Assets / ingest
  processando: 'bg-sky-500/15 text-sky-300|Processando',
  indexed: 'bg-sky-500/15 text-sky-300|Indexado',
  reviewed: 'bg-emerald-500/15 text-emerald-300|Revisado',
  ready: 'bg-violet-500/15 text-violet-300|Pronto',
  draft: 'bg-amber-500/15 text-amber-300|Rascunho',
  queued: 'bg-amber-500/15 text-amber-300|Na fila',
  completed: 'bg-emerald-500/15 text-emerald-300|Concluído',
  processing: 'bg-sky-500/15 text-sky-300|Processando',
  failed: 'bg-rose-500/15 text-rose-300|Falhou',
  falhou: 'bg-rose-500/15 text-rose-300|Falhou',
  error: 'bg-rose-500/15 text-rose-300|Erro',
  archived: 'bg-slate-500/15 text-slate-400|Arquivado',
  // Sistema / bibliotecas
  ativo: 'bg-emerald-500/15 text-emerald-300|Ativo',
  inativo: 'bg-slate-500/15 text-slate-400|Inativo',
  suspenso: 'bg-rose-500/15 text-rose-300|Suspenso',
  active: 'bg-emerald-500/15 text-emerald-300|Ativo',
  warning: 'bg-amber-500/15 text-amber-300|Atenção',
  ok: 'bg-emerald-500/15 text-emerald-300|OK',
  // Clips / publicações
  sent_to_publish: 'bg-sky-500/15 text-sky-300|Enviado p/ publicar',
  pending_review: 'bg-amber-500/15 text-amber-300|Aguardando revisão',
  scheduled: 'bg-sky-500/15 text-sky-300|Agendado',
  published: 'bg-emerald-500/15 text-emerald-300|Publicado',
  // Entregas
  delivered: 'bg-violet-500/15 text-violet-300|Entregue',
  not_started: 'bg-slate-500/15 text-slate-400|Não iniciado',
  in_progress: 'bg-sky-500/15 text-sky-300|Em andamento',
  approved: 'bg-emerald-500/15 text-emerald-300|Aprovado',
  // Corp — feminino / específicos
  gravada: 'bg-sky-500/15 text-sky-300|Gravada',
  planejada: 'bg-amber-500/15 text-amber-300|Planejada',
  confirmada: 'bg-emerald-500/15 text-emerald-300|Confirmada',
  agendada: 'bg-sky-500/15 text-sky-300|Agendada',
  publicada: 'bg-emerald-500/15 text-emerald-300|Publicada',
  entregue: 'bg-violet-500/15 text-violet-300|Entregue',
  complete: 'bg-emerald-500/15 text-emerald-300|Concluído',
  // Prioridades
  alta: 'bg-rose-500/15 text-rose-300|Alta',
  media: 'bg-amber-500/15 text-amber-300|Média',
  baixa: 'bg-slate-500/15 text-slate-300|Baixa',
};

export function StatusBadge({ status, map, labels }) {
  let tone;
  let label;
  if (map && map[status]) {
    tone = map[status];
    label = (labels && labels[status]) || status;
  } else {
    const entry = CANON_STATUS[status];
    if (entry) {
      const [t, l] = entry.split('|');
      tone = t;
      label = l;
    } else if (labels && labels[status]) {
      tone = 'bg-slate-500/15 text-slate-300';
      label = labels[status];
    } else {
      tone = 'bg-slate-500/15 text-slate-300';
      label = status;
    }
  }
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${tone}`}>{label}</span>;
}

// --- Badge ---------------------------------------------------------------
const BADGE_TONES = {
  success: 'bg-emerald-400/15 text-emerald-300',
  pending: 'bg-amber-400/15 text-amber-300',
  info: 'bg-sky-400/15 text-sky-300',
  error: 'bg-rose-400/15 text-rose-300',
  violet: 'bg-violet-400/15 text-violet-300',
};
export function Badge({ children, tone = 'info' }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${BADGE_TONES[tone] || BADGE_TONES.info}`}>{children}</span>;
}

// --- EmptyState ----------------------------------------------------------
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

// --- Loading -------------------------------------------------------------
export function Loading({ label = 'Carregando...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  );
}

// --- MockBanner ----------------------------------------------------------
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

// --- Button --------------------------------------------------------------
const BTN_VARIANTS = {
  primary: 'bg-sky-500 text-slate-950 hover:bg-sky-400',
  secondary: 'border border-slate-700 text-slate-300 hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  ghost: 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
};
const BTN_SIZES = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
export function Button({ variant = 'primary', size = 'md', icon, loading = false, disabled, children, className = '', ...rest }) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// --- SearchInput ---------------------------------------------------------
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

// --- InfoRow -------------------------------------------------------------
export function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-200">{value}</span>
    </div>
  );
}

// --- Skeleton ------------------------------------------------------------
// Placeholder shimmer para conteúdo em carregamento (degradação graciosa).
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-800/60 ${className}`} />;
}

// --- ListSkeleton --------------------------------------------------------
// Lista de N linhas skeleton para painéis/listas carregando.
export function ListSkeleton({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md bg-slate-950/40 px-3 py-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- CardSkeleton --------------------------------------------------------
// Grid de N cards skeleton (para grades em carregamento).
export function CardSkeleton({ count = 4, className = '' }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// --- ErrorState ----------------------------------------------------------
// Estado de erro com ação de tentar de novo (degradação graciosa).
export function ErrorState({ title = 'Não foi possível carregar', description, onRetry, retryLabel = 'Tentar novamente' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
        <AlertTriangle size={20} />
      </div>
      <div>
        <p className="font-semibold text-slate-200">{title}</p>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}