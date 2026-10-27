import React, { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, HardDrive, Cpu, Volume2, Scan } from 'lucide-react';
import IngestSubMenu from '../components/IngestSubMenu';
import IngestNewPackage from '../components/IngestNewPackage';
import IngestList from '../components/IngestList';
import { getManagementOverview } from '../../api/management';
import { DEMO_MANAGEMENT_OVERVIEW } from '../lib/managementDemoData';
import { readLocalDemoSession } from '../lib/demoAccess';
import { MOCK_INGEST_PACKAGES, formatBytes } from '../data';
import { listIngestPackages, retryIngestPackage, runIngestPackage } from '../../api/ingest';

// Pipelines de IA da ingestão e a chave do serviço correspondente em
// /management/overview → services. Sem serviço publicado = não configurado.
const AI_PIPELINES = [
  { key: 'transcription', icon: Volume2, label: 'Transcrição de áudio', desc: 'Whisper ou provedor configurado', tone: 'text-sky-400' },
  { key: 'ocr', icon: Scan, label: 'Reconhecimento de texto (OCR)', desc: 'Texto em imagens e vídeos', tone: 'text-violet-400' },
  { key: 'object_detection', icon: Cpu, label: 'Detecção de objetos', desc: 'Pessoas, objetos e cenas', tone: 'text-emerald-400' },
];

export function pipelineBadge(service, loadError) {
  if (loadError) return { label: 'Status indisponível', className: 'bg-slate-700/40 text-slate-300' };
  if (!service) return { label: 'Não configurado', className: 'bg-slate-700/40 text-slate-300' };
  if (service.status === 'ok') return { label: 'Ativo', className: 'bg-emerald-500/15 text-emerald-300' };
  return { label: 'Indisponível', className: 'bg-rose-500/15 text-rose-300' };
}

export function ConfigView() {
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    const load = readLocalDemoSession() ? Promise.resolve(DEMO_MANAGEMENT_OVERVIEW) : getManagementOverview();
    load
      .then((data) => { if (active) setOverview(data); })
      .catch((error) => { if (active) setLoadError(error?.message || 'Não foi possível consultar o servidor.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const services = overview?.services || [];
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Settings size={18} className="text-slate-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-50">Configurações</h1>
            <p className="text-sm text-slate-400">Parâmetros de ingestão e processamento de IA.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 px-6 py-4">
        <div className="max-w-2xl space-y-4">
          {loadError && (
            <div role="alert" className="flex items-center gap-3 rounded-lg border border-rose-800 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
              <span className="flex-1">Não foi possível consultar o status real: {loadError}</span>
              <button type="button" onClick={() => setAttempt((value) => value + 1)} className="rounded border border-rose-700 px-2 py-1 font-semibold hover:bg-rose-900/40">Tentar de novo</button>
            </div>
          )}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <HardDrive size={15} className="text-sky-400" />
              <h2 className="text-sm font-bold text-slate-200">Armazenamento</h2>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Arquivos no acervo</span>
                <span className="font-mono text-slate-300">{loading ? '…' : overview ? overview.assets.total.toLocaleString('pt-BR') : '—'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Espaço usado</span>
                <span className="font-bold text-slate-200">{loading ? '…' : overview ? formatBytes(overview.assets.storage_bytes) : '—'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Cpu size={15} className="text-violet-400" />
              <h2 className="text-sm font-bold text-slate-200">Modelos de IA</h2>
            </div>
            <div className="flex flex-col gap-2">
              {AI_PIPELINES.map((m) => {
                const Icon = m.icon;
                const service = services.find((item) => item.key === m.key);
                const badge = loading ? { label: 'Consultando…', className: 'bg-slate-700/40 text-slate-400' } : pipelineBadge(service, loadError);
                return (
                  <div key={m.key} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                    <Icon size={16} className={m.tone} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{m.label}</p>
                      <p className="text-xs text-slate-500">{service?.detail || m.desc}</p>
                    </div>
                    <span data-testid={`pipeline-${m.key}`} className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>{badge.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Ingest() {
  const [view, setView] = useState('nova');
  const [params, setParams] = useSearchParams();
  // Pacotes reais do servidor; a sessão de demonstração (sem banco) continua com os de exemplo.
  const demo = Boolean(readLocalDemoSession());
  const [packages, setPackages] = useState(() => (demo ? MOCK_INGEST_PACKAGES : []));
  const [packagesError, setPackagesError] = useState('');
  const [runningId, setRunningId] = useState(null);

  const loadPackages = useCallback(() => {
    if (demo) return;
    listIngestPackages()
      .then((list) => { setPackages(list); setPackagesError(''); })
      .catch((error) => setPackagesError(error?.message || 'Não foi possível carregar os pacotes.'));
  }, [demo]);

  useEffect(() => { loadPackages(); }, [view, loadPackages]);

  // "Continuar" retoma a cópia de onde parou; "Reprocessar" devolve as falhas para a fila antes.
  async function resumePackage(pkg, { retry = false } = {}) {
    setRunningId(pkg.id);
    setPackagesError('');
    const replace = (updated) => setPackages((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    try {
      const start = retry ? await retryIngestPackage(pkg.id) : pkg;
      replace(start);
      await runIngestPackage(start, { onUpdate: replace });
    } catch (error) {
      setPackagesError(`Não foi possível continuar "${pkg.name}": ${error?.message || 'erro desconhecido'}`);
    } finally {
      setRunningId(null);
      loadPackages();
    }
  }
  const listProps = { packages, error: packagesError, runningId, onResume: demo ? undefined : resumePackage, onNew: () => setView('nova') };

  // Gatilho do botão "Novo": /ingest?novo=pacote abre o formulário de criação.
  useEffect(() => {
    if (params.get('novo') === 'pacote') {
      setView('nova');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      <IngestSubMenu
        view={view}
        onChange={setView}
        onNew={() => setView('nova')}
        packages={packages}
      />
      <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900/40">
        {view === 'nova' && <IngestNewPackage />}
        {view === 'andamento' && <IngestList view="andamento" {...listProps} />}
        {view === 'concluidas' && <IngestList view="concluidas" {...listProps} />}
        {view === 'falhas' && <IngestList view="falhas" {...listProps} />}
        {view === 'config' && <ConfigView />}
      </div>
    </div>
  );
}