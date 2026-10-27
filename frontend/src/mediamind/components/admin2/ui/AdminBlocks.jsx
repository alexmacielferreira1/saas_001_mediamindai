import { Badge } from '../../../ui';

// Peças visuais compartilhadas pelas guias da Administração 2.

export function AdminTabs({ label, tabs, active, onChange, compact = false }) {
  return (
    <nav
      aria-label={label}
      className={`overflow-x-auto border border-slate-800 bg-slate-950/40 shadow-[0_12px_35px_rgba(2,8,23,0.22)] ${compact ? '-mt-3 rounded-lg p-1' : 'rounded-xl p-1.5'}`}
    >
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`group flex shrink-0 items-center gap-2 rounded-lg font-medium transition ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${selected ? 'bg-sky-500 text-slate-950 shadow-[0_6px_18px_rgba(14,165,233,0.2)]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
            >
              <Icon
                aria-hidden="true"
                size={15}
                strokeWidth={selected ? 2.4 : 1.9}
                className={selected ? 'text-slate-950' : 'text-sky-400 transition group-hover:text-sky-300'}
              />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const ALERT_TONES = {
  rose: 'border-rose-900/70 text-rose-300',
  amber: 'border-amber-900/70 text-amber-300',
  emerald: 'border-emerald-900/70 text-emerald-300',
  sky: 'border-sky-900/70 text-sky-300',
};

export function AlertLine({ tone, text }) {
  return <div className={`rounded-lg border bg-slate-950/60 px-3 py-2 text-sm ${ALERT_TONES[tone]}`}>{text}</div>;
}

export function StatusLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <Badge tone={value === 'Operacional' || value === '0' ? 'success' : 'pending'}>{value}</Badge>
    </div>
  );
}

const METRIC_TONES = { sky: 'text-sky-300', emerald: 'text-emerald-300', amber: 'text-amber-300', rose: 'text-rose-300' };

export function MetricTile({ label, value, tone = 'sky', compact = false }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/45 ${compact ? 'px-4 py-3' : 'p-4'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`${compact ? 'mt-1' : 'mt-2'} text-2xl font-bold ${METRIC_TONES[tone]}`}>{value}</p>
    </div>
  );
}

export function PageLead({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-slate-50">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function PreviewNotice() {
  return (
    <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
      Dados de demonstração visual — estrutura preparada conforme as referências; alterações permanecem desabilitadas
      até a conexão do backend.
    </div>
  );
}

export function DemoTable({ headers, rows }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-900 text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-800 text-slate-300">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InfoRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800/70 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-200">{children}</dd>
    </div>
  );
}

export function TagList({ items }) {
  return <div className="flex flex-wrap gap-2">{items.map((item) => <Badge key={item} tone="info">{item}</Badge>)}</div>;
}

export function EmbeddedArea({ title, children }) {
  return (
    <section className="rounded-2xl border border-sky-900/50 bg-slate-950/30 p-4">
      <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-400">Dentro da Administração</p>
          <h2 className="mt-1 text-lg font-bold text-slate-100">{title}</h2>
        </div>
        <Badge tone="success">Integrado</Badge>
      </div>
      {children}
    </section>
  );
}
