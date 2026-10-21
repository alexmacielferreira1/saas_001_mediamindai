import React from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Componentes visuais compartilhados das "Telas 2" (acessos, equipe e IA).
// Seguem o estilo de Administration2 (cards slate escuros, destaque sky).

export const NOT_AVAILABLE = 'Ainda não disponível';
export const AI_CONFIG_HINT = 'Configure em Configurações de IA';

export function PageHeader2({ kicker, title, description, right, breadcrumb }) {
  return (
    <header className="space-y-2">
      {breadcrumb?.length ? (
        <nav aria-label="Caminho" className="text-xs text-slate-500">
          {breadcrumb.map((item, index) => (
            <span key={`${item}-${index}`}>
              {index > 0 && <span className="mx-1.5">/</span>}
              <span className={index === breadcrumb.length - 1 ? 'text-slate-200' : ''}>{item}</span>
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {kicker && <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{kicker}</p>}
          <h1 className="text-2xl font-bold text-slate-50">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function TabNav2({ label, tabs, active, onChange }) {
  return (
    <nav aria-label={label} className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 p-1.5">
      <div className="flex min-w-max gap-1" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${selected ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
            >
              {Icon && <Icon aria-hidden="true" size={15} />}
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Card2({ title, description, right, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-100">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Metric2({ label, value, hint, icon: Icon, tone = 'sky' }) {
  const tones = {
    sky: 'border-sky-900/60 text-sky-300', emerald: 'border-emerald-900/60 text-emerald-300',
    amber: 'border-amber-900/60 text-amber-300', rose: 'border-rose-900/60 text-rose-300',
    violet: 'border-violet-900/60 text-violet-300', slate: 'border-slate-800 text-slate-300',
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center gap-3">
        {Icon && <span className={`grid h-9 w-9 place-items-center rounded-lg border bg-slate-950/60 ${tones[tone]}`}><Icon size={17} aria-hidden="true" /></span>}
        <p className="text-xs text-slate-400">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const AVATAR_TONES = ['bg-violet-500', 'bg-sky-500', 'bg-fuchsia-500', 'bg-emerald-500', 'bg-amber-500'];

export function initials(name = '') {
  const parts = String(name).trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

export function Avatar2({ name, size = 'md' }) {
  const tone = AVATAR_TONES[[...String(name)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-20 w-20 text-2xl' };
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-semibold text-slate-950 ${tone} ${sizes[size]}`}>{initials(name)}</span>;
}

export function AccessPill({ allowed, label }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/70 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300"><CheckCircle2 size={13} aria-hidden="true" />{label || 'Permitido'}</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-800/70 bg-rose-950/40 px-2.5 py-1 text-xs font-medium text-rose-300"><XCircle size={13} aria-hidden="true" />{label || 'Bloqueado'}</span>
  );
}

// Ação que ainda não existe no backend: aparece, mas desabilitada e explicada.
export function UnavailableButton({ children, icon: Icon, variant = 'secondary', title = NOT_AVAILABLE, className = '' }) {
  const styles = variant === 'primary'
    ? 'bg-sky-500/60 text-slate-950'
    : 'border border-slate-700 text-slate-400';
  return (
    <button type="button" disabled title={title} aria-disabled="true" className={`inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium opacity-60 ${styles} ${className}`}>
      {Icon && <Icon size={15} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function AIConfigLink({ className = '' }) {
  return <Link to="/configuracoes/ia" className={`text-xs font-medium text-sky-300 underline-offset-2 hover:underline ${className}`}>{AI_CONFIG_HINT}</Link>;
}

export function Notice2({ tone = 'sky', children }) {
  const tones = {
    sky: 'border-sky-900/70 bg-sky-950/30 text-sky-200',
    amber: 'border-amber-800/70 bg-amber-950/30 text-amber-200',
    rose: 'border-rose-800/70 bg-rose-950/30 text-rose-200',
  };
  return <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tones[tone]}`}><Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><div>{children}</div></div>;
}

export function Empty2({ title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}

export function DataSeal({ state }) {
  const map = {
    real: ['Dados reais do tenant selecionado', 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300'],
    loading: ['Carregando dados reais…', 'border-slate-700 bg-slate-900/60 text-slate-400'],
    error: ['Dados reais indisponíveis', 'border-rose-800/60 bg-rose-950/30 text-rose-300'],
  };
  const [label, cls] = map[state];
  return <div data-testid="telas2-data-seal" className={`rounded-xl border px-3 py-2 text-xs ${cls}`}>{label}</div>;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}
