import { X } from 'lucide-react';
import { describeTimelineExport } from '../../lib/timeline2Export';

/** Shows exactly what "Exportar sequência" renders today and what stays preview-only. */
export default function Timeline2ExportInfo({ document, onClose }) {
  const summary = describeTimelineExport(document);
  return (
    <section aria-label="Conteúdo da exportação da sequência" className="mb-3 rounded-xl border border-violet-700/60 bg-slate-950/80 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold uppercase text-violet-300">O que entra no MP4 da sequência</h2>
        <button type="button" onClick={onClose} aria-label="Fechar resumo da exportação" className="text-slate-500 hover:text-white"><X size={14} /></button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase text-emerald-300">Entra no arquivo</p>
          <ul className="list-disc space-y-1 pl-4 text-slate-300">{summary.included.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase text-amber-300">Fica fora do arquivo</p>
          {summary.omitted.length
            ? <ul className="list-disc space-y-1 pl-4 text-slate-300">{summary.omitted.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p className="text-slate-500">Nenhuma outra trilha tem clipes no intervalo exportado.</p>}
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase text-sky-300">Só no preview</p>
          {summary.previewOnly.length
            ? <ul className="list-disc space-y-1 pl-4 text-slate-300">{summary.previewOnly.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p className="text-slate-500">Os clipes exportados não usam recursos exclusivos do preview.</p>}
          <p className="mt-2 text-[10px] text-slate-500">Textos, legendas, sobreposições (PiP), trilhas de áudio separadas, transições e filtros ainda não são renderizados pelo servidor.</p>
        </div>
      </div>
    </section>
  );
}
