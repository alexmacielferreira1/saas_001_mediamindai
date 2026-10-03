import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Activity, Clock, CheckCircle2, AlertTriangle, Timer } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Panel, Badge } from '../../ui';

const STATUS_TONE = {
  queued: 'pending', processing: 'info', waiting_review: 'pending',
  completed: 'success', partial: 'pending', failed: 'error',
  retrying: 'info', cancelled: 'pending',
};
const STATUS_LABEL = {
  queued: 'Na fila', processing: 'Processando', waiting_review: 'Aguardando revisão',
  completed: 'Concluído', partial: 'Parcial', failed: 'Falhou',
  retrying: 'Tentando novamente', cancelled: 'Cancelado',
};

const LOCAL_JOBS = [
  { id: 'local-job-1', titulo: 'Transcrição — Entrevista Prefeito', status: 'completed', progresso: 100 },
  { id: 'local-job-2', titulo: 'Proxy — Entrevista Festival', status: 'processing', progresso: 54 },
  { id: 'local-job-3', titulo: 'Análise IA — Entrevista teste', status: 'failed', progresso: 22 },
  { id: 'local-job-4', titulo: 'OCR — Documento Turismo', status: 'waiting_review', progresso: 100 },
  { id: 'local-job-5', titulo: 'Transcrição — Coletiva de Imprensa', status: 'retrying', progresso: 68 },
];

export default function ManagementProcessamentosTab({ localDemo = false }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    if (localDemo) {
      setJobs(LOCAL_JOBS);
      setLoading(false);
      return;
    }
    try {
      const list = await base44.entities.ProcessamentoJob.list('-created_date', 100);
      setJobs(list);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [localDemo]);

  useEffect(() => { load(); }, [load]);

  async function retry(id) {
    if (localDemo) {
      setJobs((current) => current.map((job) => job.id === id ? { ...job, status: 'queued', progresso: 0 } : job));
      return;
    }
    await base44.entities.ProcessamentoJob.update(id, { status: 'queued', progresso: 0, erro: '', tentativas: 0 });
    await load();
  }
  async function cancel(id) {
    if (localDemo) {
      setJobs((current) => current.map((job) => job.id === id ? { ...job, status: 'cancelled' } : job));
      return;
    }
    await base44.entities.ProcessamentoJob.update(id, { status: 'cancelled' });
    await load();
  }

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);
  const stats = [
    ['Na fila', jobs.filter((j) => j.status === 'queued').length, Clock, 'sky'],
    ['Processando', jobs.filter((j) => ['processing', 'retrying'].includes(j.status)).length, Activity, 'sky'],
    ['Aguardando revisão', jobs.filter((j) => j.status === 'waiting_review').length, Timer, 'amber'],
    ['Concluídos', jobs.filter((j) => j.status === 'completed').length, CheckCircle2, 'emerald'],
    ['Falharam', jobs.filter((j) => j.status === 'failed').length, AlertTriangle, 'rose'],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map(([label, value, Icon, tone]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><Icon size={19} className={`mb-2 text-${tone}-400`} /><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold text-slate-100">{value}</p></div>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
    <Panel title="Central de processamentos" right={<Activity size={16} className="text-slate-500" />}>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-xs ${filter === 'all' ? 'bg-slate-800 text-sky-300' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Todos {jobs.length}
        </button>
        {Object.keys(STATUS_LABEL).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-lg px-3 py-1.5 text-xs ${filter === k ? 'bg-slate-800 text-sky-300' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {STATUS_LABEL[k]} {jobs.filter((j) => j.status === k).length}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading && <p className="text-sm text-slate-500">Carregando…</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">Nenhum processamento.</p>}
        {filtered.map((j) => (
          <div key={j.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-slate-200">{j.titulo}</p>
              <Badge tone={STATUS_TONE[j.status] || 'pending'}>{STATUS_LABEL[j.status] || j.status}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${j.progresso || 0}%` }} />
              </div>
              <span className="text-xs text-slate-500">{j.progresso || 0}%</span>
            </div>
            {j.erro && <p className="mt-1.5 text-[11px] text-rose-300">Erro: {j.erro}</p>}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Módulo: {j.modulo} · Tentativas: {j.tentativas || 0}</span>
              <div className="ml-auto flex gap-1.5">
                {(j.status === 'failed' || j.status === 'partial') && (
                  <button onClick={() => retry(j.id)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800">
                    <RefreshCw size={11} /> Repetir
                  </button>
                )}
                {['queued', 'processing', 'retrying'].includes(j.status) && (
                  <button onClick={() => cancel(j.id)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800">
                    <X size={11} /> Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
      <div className="space-y-4">
        <Panel title="Fila por módulo"><div className="space-y-3">{['Transcrição', 'Proxy', 'Análise IA', 'OCR'].map((label, index) => <div key={label}><div className="mb-1 flex justify-between text-xs text-slate-400"><span>{label}</span><span>{4-index}</span></div><div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-400" style={{width:`${76-index*14}%`}} /></div></div>)}</div></Panel>
        <Panel title="Erros recentes"><div className="space-y-2">{jobs.filter((job) => job.status === 'failed').map((job) => <div key={job.id} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-xs text-rose-200"><p className="font-semibold">{job.titulo}</p><p className="mt-1 text-rose-300/70">Falha de processamento · requer revisão</p></div>)}{!jobs.some((job) => job.status === 'failed') && <p className="text-xs text-slate-500">Nenhum erro recente.</p>}</div></Panel>
      </div>
      </div>
    </div>
  );
}
