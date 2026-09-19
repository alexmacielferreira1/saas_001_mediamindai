import React from 'react';
import { Check, HelpCircle } from 'lucide-react';
import CorpPanel from './CorpPanel';

export default function SegmentStructure({ segment }) {
  return (
    <div className="space-y-3">
      <CorpPanel>
        <h2 className="text-lg font-bold text-slate-50">{segment.name.toUpperCase()}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{segment.description}</p>
      </CorpPanel>

      <CorpPanel title="O que já foi definido">
        {segment.defined.length === 0 ? (
          <p className="text-sm text-slate-500">Nada definido ainda para este segmento.</p>
        ) : (
          <ul className="space-y-2.5">
            {segment.defined.map((d, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </CorpPanel>

      <CorpPanel title="O que ainda falta definir">
        {segment.undefined.length === 0 ? (
          <p className="text-sm text-slate-500">Nada pendente registrado.</p>
        ) : (
          <ul className="space-y-2.5">
            {segment.undefined.map((d, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
                <HelpCircle size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </CorpPanel>
    </div>
  );
}