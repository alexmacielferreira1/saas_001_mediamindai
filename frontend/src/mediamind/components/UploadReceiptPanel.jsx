import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Database, FileCheck2, ShieldCheck } from 'lucide-react';

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
}

function protocolFor(asset) {
  return `MM-${String(asset.id || '').replaceAll('-', '').slice(0, 8)}-${String(asset.sha256 || '').slice(0, 8)}`.toUpperCase();
}

export default function UploadReceiptPanel({ assets = [] }) {
  const [open, setOpen] = useState(true);
  if (!assets.length) return null;
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-emerald-700/60 bg-emerald-950/20" aria-label="Comprovantes de upload">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`${open ? 'Ocultar' : 'Mostrar'} comprovantes de upload`} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <CheckCircle2 size={18} className="text-emerald-400" />
        <span className="flex-1"><strong className="block text-sm text-emerald-200">Upload confirmado</strong><span className="text-xs text-emerald-400/80">{assets.length} arquivo(s) registrado(s) no Acervo</span></span>
        {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>
      {open && <div className="grid gap-2 border-t border-emerald-800/50 p-3">
        {assets.map((asset) => <article key={asset.id} className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs">
          <div className="mb-2 flex items-center gap-2"><FileCheck2 size={16} className="text-sky-400" /><strong className="min-w-0 truncate text-sm text-white">{asset.filename || asset.title}</strong><span className="ml-auto rounded bg-emerald-950 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">Confirmado</span></div>
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-slate-300">
            <dt className="text-slate-500">Protocolo</dt><dd className="font-mono text-amber-300">{protocolFor(asset)}</dd>
            <dt className="text-slate-500">Onde está</dt><dd className="flex items-center gap-1"><Database size={11} /> Armazenamento local persistente · Acervo MediaMind</dd>
            <dt className="text-slate-500">Identificador</dt><dd className="break-all font-mono">{asset.id}</dd>
            <dt className="text-slate-500">Integridade</dt><dd className="flex min-w-0 items-center gap-1"><ShieldCheck size={11} className="shrink-0 text-emerald-400" /><span className="truncate font-mono" title={asset.sha256}>SHA-256 {asset.sha256 || 'indisponível'}</span></dd>
            <dt className="text-slate-500">Arquivo</dt><dd>{formatBytes(asset.file_size)} · {asset.mime_type || 'tipo não informado'}</dd>
            <dt className="text-slate-500">Acesso</dt><dd className="break-all font-mono text-sky-300">{asset.stream_url}</dd>
          </dl>
        </article>)}
      </div>}
    </section>
  );
}
