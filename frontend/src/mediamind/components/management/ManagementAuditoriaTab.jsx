import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, Search, CheckCircle2, Upload, Download, AlertTriangle, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Panel } from '../../ui';
import { DEMO_AUDIT_LOGS } from '../../lib/managementDemoData';

export default function ManagementAuditoriaTab({ localDemo = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [acao, setAcao] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    if (localDemo) {
      setLogs(DEMO_AUDIT_LOGS.map((item) => ({ ...item, acao: item.action || item.acao || 'evento', entidade: item.entity_type || item.entidade || 'registro', detalhe: item.detail || item.detalhe || 'Evento administrativo registrado' })));
      setLoading(false);
      return;
    }
    try {
      const list = await base44.entities.LogAuditoria.list('-created_date', 200);
      setLogs(list);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [localDemo]);

  useEffect(() => { load(); }, [load]);

  const acoes = Array.from(new Set(logs.map((l) => l.acao)));
  const filtered = logs.filter(
    (l) =>
      (acao === 'all' || l.acao === acao) &&
      (!q || `${l.acao} ${l.entidade} ${l.detalhe} ${l.created_by || ''}`.toLowerCase().includes(q.toLowerCase()))
  );
  const stats = [
    ['Eventos', logs.length, ScrollText, 'text-sky-400'],
    ['Aprovações', logs.filter((l) => String(l.acao).toLowerCase().includes('aprov')).length, CheckCircle2, 'text-emerald-400'],
    ['Uploads', logs.filter((l) => String(l.acao).toLowerCase().includes('upload')).length, Upload, 'text-sky-400'],
    ['Exportações', logs.filter((l) => String(l.acao).toLowerCase().includes('export')).length, Download, 'text-violet-400'],
    ['Erros', logs.filter((l) => /erro|falha/i.test(`${l.acao} ${l.detalhe}`)).length, AlertTriangle, 'text-rose-400'],
    ['Usuários', new Set(logs.map((l) => l.created_by).filter(Boolean)).size, Users, 'text-sky-400'],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{stats.map(([label,value,Icon,color]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><Icon size={18} className={color}/><p className="mt-2 text-xs text-slate-400">{label}</p><p className="text-2xl font-bold text-slate-100">{value}</p></div>)}</div>
    <Panel title="Linha do tempo da auditoria" right={<ScrollText size={16} className="text-slate-500" />}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar na auditoria…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-9 pr-3 text-xs outline-none focus:border-sky-500"
          />
        </div>
        <select
          value={acao}
          onChange={(e) => setAcao(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
        >
          <option value="all">Todas ações</option>
          {acoes.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
        {loading && <p className="text-sm text-slate-500">Carregando…</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">Nenhum registro.</p>}
        {filtered.map((l) => (
          <div key={l.id} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-200">
                <span className="font-semibold text-sky-300">{l.acao}</span> · {l.entidade}
              </p>
              <p className="text-xs text-slate-400">{l.detalhe}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-slate-500">{l.created_by || '—'}</p>
              <p className="text-[10px] text-slate-600">
                {l.created_date ? new Date(l.created_date).toLocaleString('pt-BR') : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
    </div>
  );
}
