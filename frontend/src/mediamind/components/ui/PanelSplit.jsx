import React, { useState, useEffect, useRef } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { Save, Download, Upload, Layout as LayoutIcon, X, RotateCcw } from 'lucide-react';
import { useAuth } from '../../auth';

// Layout compartilhado dos serviços do Corp: painéis redimensionáveis
// (arrasta a divisória pra aumentar/diminuir) + toggles no topo pra ligar e
// desligar cada painel — desligado, o painel some e os outros expandem.
//
// A visibilidade E os tamanhos arrastados persistem entre sessões (storageKey).
// Dá pra salvar/carregar padrões nomeados, importar/exportar o layout em JSON
// e redefinir tudo pro padrão de fábrica.
//
// panels: [{ id, label, icon, defaultSize, minSize, content }]
export default function PanelSplit({ panels, storageKey, direction = 'horizontal', className = '' }) {
  const { user } = useAuth();
  const scope = user?.role || 'default';
  const visKey = storageKey ? `${storageKey}__${scope}` : null;
  const layoutsKey = visKey ? `${visKey}_layouts` : null;
  const sizesKey = visKey ? `${visKey}_sizes` : null;
  const fileInputRef = useRef(null);

  const [visible, setVisible] = useState(() => {
    const init = Object.fromEntries(panels.map((p) => [p.id, true]));
    if (!visKey) return init;
    try {
      const saved = JSON.parse(localStorage.getItem(visKey) || '{}');
      return Object.fromEntries(panels.map((p) => [p.id, saved[p.id] !== false]));
    } catch {
      return init;
    }
  });

  // Tamanhos atuais (por id) num ref — não re-renderiza durante o arraste;
  // viram defaultSize só quando o PanelGroup remonta (mountKey).
  const sizesRef = useRef(null);
  if (sizesRef.current === null) {
    let saved = {};
    if (sizesKey) {
      try { saved = JSON.parse(localStorage.getItem(sizesKey) || '{}'); } catch { saved = {}; }
    }
    sizesRef.current = Object.fromEntries(
      panels.map((p) => [p.id, saved[p.id] ?? p.defaultSize ?? 100 / panels.length]),
    );
  }
  const [mountKey, setMountKey] = useState(0);

  const [savedLayouts, setSavedLayouts] = useState([]);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (visKey) localStorage.setItem(visKey, JSON.stringify(visible));
  }, [visible, visKey]);

  useEffect(() => {
    if (!layoutsKey) return;
    try { setSavedLayouts(JSON.parse(localStorage.getItem(layoutsKey) || '[]')); } catch { setSavedLayouts([]); }
  }, [layoutsKey]);

  const shown = panels.filter((p) => visible[p.id]);

  function persistSizes() {
    if (sizesKey) localStorage.setItem(sizesKey, JSON.stringify(sizesRef.current));
  }
  function handleLayout(layout) {
    layout.forEach((sz, i) => {
      const id = shown[i]?.id;
      if (id) sizesRef.current[id] = sz;
    });
    persistSizes();
  }
  function remount() { setMountKey((k) => k + 1); }

  function saveLayout(name) {
    if (!layoutsKey || !name) return;
    const layout = { name, visible, sizes: sizesRef.current, savedAt: new Date().toISOString() };
    const updated = [...savedLayouts.filter((l) => l.name !== name), layout];
    setSavedLayouts(updated);
    localStorage.setItem(layoutsKey, JSON.stringify(updated));
  }

  function loadLayout(name) {
    const layout = savedLayouts.find((l) => l.name === name);
    if (!layout) return;
    setVisible((v) => Object.fromEntries(panels.map((p) => [p.id, layout.visible?.[p.id] ?? v[p.id]])));
    if (layout.sizes) {
      sizesRef.current = Object.fromEntries(panels.map((p) => [p.id, layout.sizes[p.id] ?? sizesRef.current[p.id]]));
      persistSizes();
    }
    setShowMenu(false);
    remount();
  }

  function deleteLayout(name) {
    if (!layoutsKey) return;
    const updated = savedLayouts.filter((l) => l.name !== name);
    setSavedLayouts(updated);
    localStorage.setItem(layoutsKey, JSON.stringify(updated));
  }

  function exportLayout() {
    const blob = new Blob([JSON.stringify({ visible, sizes: sizesRef.current }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${storageKey || 'mediamind'}-layout.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function importLayout(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const c = JSON.parse(ev.target.result);
        if (c.visible) setVisible((v) => Object.fromEntries(panels.map((p) => [p.id, c.visible[p.id] ?? v[p.id]])));
        if (c.sizes) {
          sizesRef.current = Object.fromEntries(panels.map((p) => [p.id, c.sizes[p.id] ?? sizesRef.current[p.id]]));
          persistSizes();
        }
        remount();
      } catch { alert('Arquivo de layout inválido'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function resetLayout() {
    setVisible(Object.fromEntries(panels.map((p) => [p.id, true])));
    sizesRef.current = Object.fromEntries(panels.map((p) => [p.id, p.defaultSize ?? 100 / panels.length]));
    persistSizes();
    remount();
  }

  const handleCls = direction === 'horizontal'
    ? 'w-1.5 shrink-0 rounded-full bg-slate-800 transition hover:bg-sky-600'
    : 'h-1.5 shrink-0 rounded-full bg-slate-800 transition hover:bg-sky-600';

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {panels.map((p) => {
          const Icon = p.icon;
          const on = visible[p.id];
          return (
            <button
              key={p.id}
              onClick={() => setVisible((v) => ({ ...v, [p.id]: !v[p.id] }))}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                on ? 'bg-sky-500/20 text-sky-300' : 'border border-slate-700 text-slate-500 hover:bg-slate-800'
              }`}
              title={on ? `Ocultar ${p.label}` : `Mostrar ${p.label}`}
            >
              {Icon && <Icon size={12} />} {p.label}
            </button>
          );
        })}

        <div className="mx-0.5 h-5 w-px bg-slate-700" />

        <div className="relative">
          <button onClick={() => setShowMenu((s) => !s)} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800">
            <LayoutIcon size={12} /> Padrões
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
                {savedLayouts.length === 0 && <p className="px-2 py-1.5 text-[11px] text-slate-500">Nenhum padrão salvo</p>}
                {savedLayouts.map((l) => (
                  <div key={l.name} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] hover:bg-slate-800">
                    <button onClick={() => loadLayout(l.name)} className="flex-1 text-left text-slate-300">{l.name}</button>
                    <div className="flex gap-1">
                      <button onClick={() => saveLayout(l.name)} className="text-slate-500 hover:text-sky-400" title="Sobrescrever"><Save size={12} /></button>
                      <button onClick={() => deleteLayout(l.name)} className="text-slate-500 hover:text-rose-400" title="Excluir"><X size={12} /></button>
                    </div>
                  </div>
                ))}
                <div className="mt-1 border-t border-slate-700 pt-1">
                  <button
                    onClick={() => { const name = prompt('Nome do padrão:'); if (name) { saveLayout(name); setShowMenu(false); } }}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-sky-400 hover:bg-slate-800"
                  >
                    <Save size={12} /> Salvar padrão atual
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <button onClick={exportLayout} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800">
          <Download size={12} /> Exportar
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800">
          <Upload size={12} /> Importar
        </button>
        <button onClick={resetLayout} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800" title="Voltar ao layout padrão">
          <RotateCcw size={12} /> Redefinir
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={importLayout} />
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-sm text-slate-500">
          Todos os painéis estão ocultos — ligue algum acima.
        </div>
      ) : (
        <PanelGroup key={mountKey} direction={direction} onLayout={handleLayout} className={`min-h-0 flex-1 ${className}`}>
          {shown.map((p, i) => {
            const order = panels.findIndex((pp) => pp.id === p.id) + 1;
            return (
              <React.Fragment key={p.id}>
                {i > 0 && <PanelResizeHandle className={handleCls} />}
                <Panel order={order} defaultSize={sizesRef.current[p.id] ?? p.defaultSize} minSize={p.minSize || 12} className="rounded-xl">
                  {p.content}
                </Panel>
              </React.Fragment>
            );
          })}
        </PanelGroup>
      )}
    </div>
  );
}