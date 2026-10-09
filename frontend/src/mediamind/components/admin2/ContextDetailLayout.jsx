import { forwardRef } from 'react';

export function ContextDetailLayout({ master, detail, detailTitle, isOpen, onClose, originRef, showClose = true }) {
  function closeDetail() {
    onClose?.();
    originRef?.current?.focus();
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
      <section className="min-w-0" aria-label="Lista e filtros">{master}</section>
      {isOpen && (
        <aside className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl" aria-labelledby="context-detail-title">
          <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <h2 id="context-detail-title" className="min-w-0 truncate text-base font-semibold text-slate-100">{detailTitle}</h2>
            {showClose && <button type="button" onClick={closeDetail} className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Fechar detalhes">×</button>}
          </header>
          <div className="min-w-0 p-4">{detail}</div>
        </aside>
      )}
    </div>
  );
}

export const SelectableItem = forwardRef(function SelectableItem({ selected = false, onSelect, children, className = '', ...buttonProps }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={className}
      {...buttonProps}
    >
      {children}
    </button>
  );
});

export function UnavailableAction({ reason, children, className = '' }) {
  return (
    <div className="space-y-1">
      <button type="button" disabled className={className}>{children}</button>
      <p className="text-xs text-slate-500">{reason}</p>
    </div>
  );
}
